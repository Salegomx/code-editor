import { EditorView } from '@codemirror/view'

/** Language-data key: 'html' or 'xml' for the languages whose tags close as you type. */
export const CLOSE_TAGS = 'codeEditorCloseTags'

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

const hasOddCount = (text, quote) => text.split(quote).length % 2 === 0

// Typing ">" at the end of an opening tag inserts its closing tag after the cursor:
// <div class="a">|</div>. HTML void elements (<br>, <img>…), self-closing tags
// (<item/>) and a ">" inside a quoted attribute value are left alone. It only looks
// at the tag being typed, so it works the same after deleting a closing tag and retyping.
export const closeTags = EditorView.inputHandler.of((view, from, to, text) => {
	const { state } = view
	if (text !== '>' || state.readOnly || state.selection.ranges.length > 1) return false
	const kind = state.languageDataAt(CLOSE_TAGS, from)[0] // undefined inside <script>/<style>
	if (!kind) return false
	const tag = /<([A-Za-z][\w:.-]*)([^<>]*)$/.exec(state.sliceDoc(Math.max(0, from - 2000), from))
	if (!tag || tag[2].endsWith('/') || hasOddCount(tag[2], '"') || hasOddCount(tag[2], "'")) return false
	if (kind === 'html' && VOID_ELEMENTS.has(tag[1].toLowerCase())) return false
	view.dispatch({
		changes: { from, to, insert: `></${tag[1]}>` },
		selection: { anchor: from + 1 },
		scrollIntoView: true,
		userEvent: 'input.type',
	})
	return true
})
