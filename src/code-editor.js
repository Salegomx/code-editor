import { Compartment, EditorSelection, EditorState, Transaction, countColumn } from '@codemirror/state'
import {
	EditorView,
	crosshairCursor,
	drawSelection,
	dropCursor,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
	rectangularSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentLess, indentMore, redo } from '@codemirror/commands'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { minifyLanguageData, resolveLanguage } from './languages.js'
import { minify } from './minify.js'
import { detectIndent, readInitialContent } from './content.js'
import { editorTheme, hostStyles, syntaxColors, themeNames } from './theme.js'

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)

// Tab indents the selected lines, or inserts one indent unit at each cursor
// (up to the next tab stop when indenting with spaces), like VS Code.
function indentOrInsert({ state, dispatch }) {
	if (state.readOnly) return false
	if (state.selection.ranges.some((range) => !range.empty)) return indentMore({ state, dispatch })
	const unit = state.facet(indentUnit)
	const changes = state.changeByRange((range) => {
		const line = state.doc.lineAt(range.head)
		const column = countColumn(line.text.slice(0, range.head - line.from), state.tabSize)
		const insert = unit === '\t' ? '\t' : ' '.repeat(unit.length - (column % unit.length))
		return { changes: { from: range.head, insert }, range: EditorSelection.cursor(range.head + insert.length) }
	})
	dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input.indent' }))
	return true
}

/**
 * <code-editor>: a code editor that behaves like a <textarea> inside forms.
 *
 * The text is submitted through a hidden <textarea> kept in the element's light
 * DOM, so native submits, new FormData(form) and jQuery's $(form).serialize()
 * all include it without extra code.
 */
export class CodeEditor extends HTMLElement {
	static formAssociated = true
	static observedAttributes = ['language', 'readonly', 'disabled', 'minify', 'width', 'height', 'indent', 'theme', 'name', 'id', 'form', 'aria-label']

	// Editors whose minified value is waiting to be copied to their hidden <textarea>.
	static #pending = new Set()
	static {
		document.addEventListener('submit', () => CodeEditor.#pending.forEach((editor) => editor.#syncProxy(true)), true)
	}

	#internals = this.attachInternals?.() ?? null
	#wrap
	#sizeStyle
	#view = null
	#state = null // the editor state while the element is out of the document
	#pendingValue
	#initialValue = ''
	#proxy = null
	#syncTimer = 0
	#formDisabled = false
	#valueAtFocus = null
	#language = new Compartment()
	#indent = new Compartment()
	#editable = new Compartment()
	#a11y = new Compartment()

	constructor() {
		super()
		const root = this.attachShadow({ mode: 'open', delegatesFocus: true })
		root.innerHTML = `<style>${hostStyles}</style><style></style><div class="wrap" part="editor"></div>`
		this.#sizeStyle = root.querySelectorAll('style')[1]
		this.#wrap = root.querySelector('.wrap')
		this.#applySize()

		// The editor's own input events would reach the page incompletely (Tab, paste
		// and undo don't fire them); a single `input` event is sent from #onUpdate instead.
		root.addEventListener('input', (event) => event.stopPropagation())
		this.addEventListener('focusin', () => {
			this.#valueAtFocus ??= this.value
		})
		this.addEventListener('focusout', (event) => {
			if (event.relatedTarget === this || this.contains(event.relatedTarget)) return
			this.#syncProxy(true)
			if (this.#valueAtFocus !== null && this.#valueAtFocus !== this.value) {
				this.dispatchEvent(new Event('change', { bubbles: true }))
			}
			this.#valueAtFocus = null
		})
	}

	connectedCallback() {
		for (const property of ['value', 'disabled', 'readOnly', 'minify']) this.#upgradeProperty(property)
		// A classic <script> in <head> defines the element before its content is parsed.
		if (document.readyState === 'loading' && !this.#view && !this.#state) {
			document.addEventListener('DOMContentLoaded', () => this.#connect(), { once: true })
		} else {
			this.#connect()
		}
	}

	disconnectedCallback() {
		// Moving the element fires disconnect + connect; only tear down if it stays out.
		queueMicrotask(() => {
			if (this.isConnected || !this.#view) return
			this.#state = this.#view.state
			this.#view.destroy()
			this.#view = null
		})
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return
		switch (name) {
			case 'language':
				this.#reconfigure(this.#language, resolveLanguage(newValue).extension)
				this.#syncProxy(true)
				break
			case 'readonly':
			case 'disabled':
				this.#applyEditable()
				break
			case 'minify':
				this.#syncProxy(true)
				break
			case 'width':
			case 'height':
				this.#applySize()
				break
			case 'indent':
				if (this.#currentState) this.#reconfigure(this.#indent, this.#indentExtension(this.#currentState.doc.toString()))
				break
			case 'aria-label':
				this.#reconfigure(this.#a11y, this.#a11yExtension())
				break
			case 'theme': // applied by the stylesheet; only unknown names need a word
				if (newValue && !themeNames.includes(newValue)) {
					console.warn(`<code-editor>: unknown theme "${newValue}". Supported: ${themeNames.join(', ')}.`)
				}
				break
			default: // name, id, form
				this.#syncProxyAttributes()
		}
	}

	formDisabledCallback(disabled) {
		this.#formDisabled = disabled
		this.#applyEditable()
	}

	formResetCallback() {
		this.value = this.#initialValue
		// The hidden <textarea> resets itself after this callback runs.
		queueMicrotask(() => this.#syncProxy(true))
	}

	/** The text as shown in the editor. */
	get value() {
		return this.#currentState?.doc.toString() ?? this.#pendingValue ?? ''
	}

	set value(text) {
		const insert = text == null ? '' : String(text)
		const spec = { changes: { from: 0, to: this.#currentState?.doc.length ?? 0, insert }, annotations: Transaction.addToHistory.of(false) }
		if (this.#view) this.#view.dispatch(spec)
		else if (this.#state) this.#state = this.#state.update(spec).state
		else this.#pendingValue = insert
		this.#syncProxy(true)
	}

	/** The text the form submits: `value`, minified when the `minify` attribute is set. */
	get submitValue() {
		const state = this.#currentState
		if (!state) return this.value
		return this.minify ? minify(state) : state.doc.toString()
	}

	get name() {
		return this.getAttribute('name') ?? ''
	}

	set name(name) {
		this.setAttribute('name', name)
	}

	get form() {
		return this.#internals?.form ?? this.#proxy?.form ?? null
	}

	get language() {
		return resolveLanguage(this.getAttribute('language')).id
	}

	set language(name) {
		this.setAttribute('language', name)
	}

	get readOnly() {
		return this.hasAttribute('readonly')
	}

	set readOnly(on) {
		this.toggleAttribute('readonly', Boolean(on))
	}

	get disabled() {
		return this.hasAttribute('disabled')
	}

	set disabled(on) {
		this.toggleAttribute('disabled', Boolean(on))
	}

	get minify() {
		return this.hasAttribute('minify')
	}

	set minify(on) {
		this.toggleAttribute('minify', Boolean(on))
	}

	get #currentState() {
		return this.#view?.state ?? this.#state
	}

	get #isDisabled() {
		return this.hasAttribute('disabled') || this.#formDisabled
	}

	#connect() {
		if (this.#view || !this.isConnected) return
		if (!this.#state) {
			const doc = this.#pendingValue ?? readInitialContent(this)
			this.#pendingValue = undefined
			this.#initialValue = doc
			this.#createProxy()
			this.#state = this.#createState(doc)
		}
		this.#view = new EditorView({ state: this.#state, parent: this.#wrap, root: this.shadowRoot })
		this.#state = null
		this.#applyEditable()
		this.#syncProxy(true)
	}

	#createState(doc) {
		return EditorState.create({
			doc,
			extensions: [
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightSpecialChars(),
				history(),
				foldGutter(),
				drawSelection(),
				dropCursor(),
				EditorState.allowMultipleSelections.of(true),
				indentOnInput(),
				bracketMatching(),
				closeBrackets(),
				autocompletion(),
				rectangularSelection(),
				crosshairCursor(),
				highlightActiveLine(),
				highlightSelectionMatches(),
				// Ctrl/Cmd+click (CodeMirror, Sublime) and Alt+click (VS Code) add a cursor.
				EditorView.clickAddsSelectionRange.of((event) => event.altKey || (isMac ? event.metaKey : event.ctrlKey)),
				keymap.of([
					{ key: 'Tab', run: indentOrInsert, shift: indentLess },
					// CodeMirror only binds Ctrl+Y for redo on Windows; VS Code also accepts Ctrl+Shift+Z.
					{ key: 'Mod-Shift-z', run: redo, preventDefault: true },
					...closeBracketsKeymap,
					...defaultKeymap,
					...searchKeymap,
					...historyKeymap,
					...foldKeymap,
					...completionKeymap,
				]),
				editorTheme,
				syntaxColors,
				minifyLanguageData,
				this.#language.of(resolveLanguage(this.getAttribute('language')).extension),
				this.#indent.of(this.#indentExtension(doc)),
				this.#editable.of(this.#editableExtension()),
				this.#a11y.of(this.#a11yExtension()),
				EditorView.updateListener.of((update) => this.#onUpdate(update)),
			],
		})
	}

	#onUpdate(update) {
		if (!update.docChanged) return
		this.#syncProxy()
		if (update.transactions.some((tr) => tr.docChanged && tr.annotation(Transaction.userEvent))) {
			queueMicrotask(() => this.dispatchEvent(new Event('input', { bubbles: true })))
		}
	}

	#reconfigure(compartment, extension) {
		const effects = compartment.reconfigure(extension)
		if (this.#view) this.#view.dispatch({ effects })
		else if (this.#state) this.#state = this.#state.update({ effects }).state
	}

	#indentExtension(doc) {
		const attribute = (this.getAttribute('indent') ?? '').trim().toLowerCase()
		const width = Number.parseInt(attribute, 10)
		const unit = attribute === 'tab' ? '\t' : width > 0 ? ' '.repeat(Math.min(width, 8)) : detectIndent(doc)
		return [indentUnit.of(unit), EditorState.tabSize.of(unit === '\t' ? 4 : unit.length)]
	}

	#editableExtension() {
		const disabled = this.#isDisabled
		const readOnly = disabled || this.readOnly
		return [
			EditorState.readOnly.of(readOnly),
			EditorView.editable.of(!disabled),
			// Read-only: still focusable and selectable, but no on-screen keyboard on phones.
			readOnly && !disabled ? EditorView.contentAttributes.of({ inputmode: 'none' }) : [],
		]
	}

	#a11yExtension() {
		const labels = [...(this.#internals?.labels ?? [])].map((label) => label.textContent.trim()).filter(Boolean)
		const label = this.getAttribute('aria-label') || labels.join(' ')
		return label ? EditorView.contentAttributes.of({ 'aria-label': label }) : []
	}

	#applyEditable() {
		this.#reconfigure(this.#editable, this.#editableExtension())
		this.#wrap.inert = this.#isDisabled
		if (this.#proxy) this.#proxy.disabled = this.#isDisabled
	}

	#applySize() {
		const rules = ['width', 'height']
			.map((property) => [property, toCssLength(this.getAttribute(property))])
			.filter(([, length]) => length)
			.map(([property, length]) => `${property}:${length}`)
		this.#sizeStyle.textContent = rules.length ? `:host{${rules.join(';')}}` : ''
	}

	// The hidden <textarea> that carries the value in form submissions.
	#createProxy() {
		const proxy = document.createElement('textarea')
		proxy.hidden = true
		proxy.tabIndex = -1
		proxy.autocomplete = 'off'
		proxy.setAttribute('aria-hidden', 'true')
		this.replaceChildren(proxy)
		this.#proxy = proxy
		this.#syncProxyAttributes()
	}

	#syncProxyAttributes() {
		if (!this.#proxy) return
		const name = this.getAttribute('name') || this.id
		if (name) this.#proxy.name = name
		else this.#proxy.removeAttribute('name')
		const form = this.getAttribute('form')
		if (form) this.#proxy.setAttribute('form', form)
		else this.#proxy.removeAttribute('form')
	}

	// The hidden <textarea> is updated on every change. For very large documents,
	// minifying waits until typing pauses for 150 ms, or until blur or form submit.
	#syncProxy(now = false) {
		clearTimeout(this.#syncTimer)
		if (!this.#proxy) return
		if (this.minify && !now && this.#currentState.doc.length > 50_000) {
			CodeEditor.#pending.add(this)
			this.#syncTimer = setTimeout(() => this.#syncProxy(true), 150)
			return
		}
		CodeEditor.#pending.delete(this)
		this.#proxy.value = this.submitValue
	}

	// A property set before the element was upgraded shadows the class accessor.
	#upgradeProperty(property) {
		if (!Object.hasOwn(this, property)) return
		const value = this[property]
		delete this[property]
		this[property] = value
	}
}

function toCssLength(value) {
	const length = value?.trim()
	if (!length) return ''
	if (/^\d+(\.\d+)?$/.test(length)) return `${length}px`
	return CSS.supports('width', length) ? length : ''
}
