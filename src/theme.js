import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Every color and font setting is a CSS custom property. A page restyles the
// editor by setting --code-editor-<name> on <code-editor> or on any ancestor.
const COMMON = {
	font: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
	'font-size': '13px',
	'line-height': '1.5',
	radius: '6px',
}

// Values of the `theme` attribute. Without it, the editor uses `light`, or
// `intellij-dark` when the operating system is in dark mode.
//
// `active-line` must stay see-through: the selection is drawn behind the text,
// so a solid line background would hide it on the line with the cursor.
const THEMES = {
	light: {
		scheme: 'light',
		colors: {
			bg: '#ffffff',
			fg: '#1f2328',
			muted: '#8c959f',
			'gutter-bg': '#f6f8fa',
			'gutter-active': '#1f2328',
			'gutter-border': '#d0d7de',
			border: '#d0d7de',
			'panel-bg': '#f6f8fa',
			'active-line': 'rgba(175, 184, 193, 0.18)',
			selection: 'rgba(84, 174, 255, 0.35)',
			cursor: '#1f2328',
			focus: '#0969da',
			'focus-ring': 'rgba(9, 105, 218, 0.25)',
			match: 'rgba(250, 225, 125, 0.6)',
			search: 'rgba(250, 225, 125, 0.6)',
			'search-current': 'rgba(84, 174, 255, 0.35)',
			bracket: 'rgba(52, 208, 88, 0.3)',
			'bracket-border': 'transparent',
			keyword: '#cf222e',
			control: '#cf222e',
			constant: '#0550ae',
			string: '#0a3069',
			regexp: '#0a3069',
			escape: '#0550ae',
			number: '#0550ae',
			comment: '#6e7781',
			'comment-style': 'italic',
			variable: '#1f2328',
			property: '#0550ae',
			function: '#8250df',
			type: '#953800',
			tag: '#116329',
			'tag-bracket': '#8c959f',
			attribute: '#0550ae',
			meta: '#8c959f',
			invalid: '#82071e',
		},
	},

	// IntelliJ IDEA's default "Dark" editor scheme (New UI, 2023.1 and later).
	'intellij-dark': {
		scheme: 'dark',
		colors: {
			bg: '#1e1f22',
			fg: '#bcbec4',
			muted: '#4b5059',
			'gutter-bg': '#1e1f22',
			'gutter-active': '#a1a3ab',
			'gutter-border': 'transparent',
			border: '#4e5157',
			'panel-bg': '#2b2d30',
			'active-line': 'rgba(110, 121, 154, 0.1)', // #26282e over the background
			selection: '#214283',
			cursor: '#ced0d6',
			focus: '#3574f0',
			'focus-ring': 'rgba(53, 116, 240, 0.35)',
			match: '#373b39',
			search: '#2d543f',
			'search-current': '#214283',
			bracket: '#43454a',
			'bracket-border': 'transparent',
			keyword: '#cf8e6d',
			control: '#cf8e6d',
			constant: '#cf8e6d',
			string: '#6aab73',
			regexp: '#42c3d4',
			escape: '#cf8e6d',
			number: '#2aacb8',
			comment: '#7a7e85',
			'comment-style': 'normal',
			variable: '#bcbec4',
			property: '#c77dbb',
			function: '#56a8f5',
			type: '#bcbec4',
			tag: '#d5b778',
			'tag-bracket': '#d5b778',
			attribute: '#bcbec4',
			meta: '#b3ae60',
			invalid: '#f75464',
		},
	},
}

const ALIASES = { dark: 'intellij-dark' }
const DEFAULT_DARK = 'intellij-dark'

export const themeNames = ['auto', ...Object.keys(THEMES), ...Object.keys(ALIASES)]

const v = (name) => `var(--_${name})`
const declare = (palette) =>
	Object.entries(palette)
		.map(([name, value]) => `--_${name}: var(--code-editor-${name}, ${value});`)
		.join('')
const themeBlock = (name) => `${declare(THEMES[name].colors)} color-scheme: ${THEMES[name].scheme};`
const themeSelector = (name) =>
	[name, ...Object.keys(ALIASES).filter((alias) => ALIASES[alias] === name)].map((value) => `:host([theme="${value}"])`).join(', ')

export const hostStyles = `
:host {
  ${declare(COMMON)}
  ${themeBlock('light')}
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
  text-align: left;
  border: 1px solid ${v('border')};
  border-radius: ${v('radius')};
  background: ${v('bg')};
  color: ${v('fg')};
  font-family: ${v('font')};
  font-size: ${v('font-size')};
}
@media (prefers-color-scheme: dark) {
  :host(:not([theme])), :host([theme=""]), :host([theme="auto"]) { ${themeBlock(DEFAULT_DARK)} }
}
${Object.keys(THEMES)
	.filter((name) => name !== 'light')
	.map((name) => `${themeSelector(name)} { ${themeBlock(name)} }`)
	.join('\n')}
:host([hidden]) { display: none; }
:host(:focus-within) {
  border-color: ${v('focus')};
  box-shadow: 0 0 0 3px ${v('focus-ring')};
}
:host([disabled]), :host(:disabled) { opacity: 0.6; cursor: not-allowed; }
.wrap, .cm-editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
`

export const editorTheme = EditorView.theme({
	'&': { color: v('fg'), backgroundColor: v('bg'), fontSize: 'inherit' },
	'&.cm-focused': { outline: 'none' },
	'.cm-scroller': { fontFamily: 'inherit', lineHeight: v('line-height'), overflow: 'auto' },
	'.cm-content': { caretColor: v('cursor'), padding: '8px 0' },
	'.cm-line': { padding: '0 12px 0 6px' },
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: v('cursor'), borderLeftWidth: '2px' },
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
		{ backgroundColor: v('selection') },
	'.cm-gutters': { backgroundColor: v('gutter-bg'), color: v('muted'), border: 'none', borderRight: `1px solid ${v('gutter-border')}` },
	'.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },
	'.cm-activeLine': { backgroundColor: v('active-line') },
	'.cm-activeLineGutter': { backgroundColor: v('active-line'), color: v('gutter-active') },
	// Only mark the cursor line while the editor has focus, so read-only snippets look clean.
	'&:not(.cm-focused) .cm-activeLine, &:not(.cm-focused) .cm-activeLineGutter': { backgroundColor: 'transparent', color: 'inherit' },
	'.cm-selectionMatch': { backgroundColor: v('match') },
	'.cm-searchMatch': { backgroundColor: v('search'), outline: 'none' },
	'.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: v('search-current') },
	'&.cm-focused .cm-matchingBracket': { backgroundColor: v('bracket'), outline: `1px solid ${v('bracket-border')}` },
	'&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'transparent', outline: `1px solid ${v('invalid')}` },
	'.cm-foldPlaceholder': { backgroundColor: v('panel-bg'), border: 'none', color: v('muted'), padding: '0 6px' },
	'.cm-panels': { backgroundColor: v('panel-bg'), color: v('fg') },
	'.cm-panels.cm-panels-top': { borderBottom: `1px solid ${v('border')}` },
	'.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${v('border')}` },
	'.cm-textfield, .cm-button': {
		backgroundColor: v('bg'),
		backgroundImage: 'none',
		color: v('fg'),
		border: `1px solid ${v('border')}`,
		borderRadius: '4px',
	},
	'.cm-textfield:focus': { outline: 'none', borderColor: v('focus') },
	'.cm-tooltip': { backgroundColor: v('panel-bg'), color: v('fg'), border: `1px solid ${v('border')}`, borderRadius: '4px' },
	'.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: v('selection'), color: v('fg') },
})

export const syntaxColors = syntaxHighlighting(
	HighlightStyle.define([
		{ tag: [t.keyword, t.operatorKeyword, t.modifier, t.definitionKeyword, t.self], color: v('keyword') },
		{ tag: [t.controlKeyword, t.moduleKeyword], color: v('control') },
		{ tag: [t.bool, t.null, t.atom, t.constant(t.name), t.standard(t.name)], color: v('constant') },
		{ tag: [t.string, t.special(t.string)], color: v('string') },
		{ tag: t.regexp, color: v('regexp') },
		{ tag: t.escape, color: v('escape') },
		{ tag: [t.number, t.unit], color: v('number') },
		{ tag: t.comment, color: v('comment'), fontStyle: v('comment-style') },
		{ tag: [t.variableName, t.labelName], color: v('variable') },
		{ tag: t.propertyName, color: v('property') },
		{ tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: v('function') },
		{ tag: [t.typeName, t.className, t.namespace], color: v('type') },
		{ tag: t.tagName, color: v('tag') },
		{ tag: t.angleBracket, color: v('tag-bracket') },
		{ tag: t.attributeName, color: v('attribute') },
		{ tag: [t.meta, t.processingInstruction, t.documentMeta], color: v('meta') },
		{ tag: t.invalid, color: v('invalid') },
		{ tag: t.heading, fontWeight: 'bold' },
		{ tag: t.strong, fontWeight: 'bold' },
		{ tag: t.emphasis, fontStyle: 'italic' },
		{ tag: t.link, textDecoration: 'underline' },
		{ tag: t.strikethrough, textDecoration: 'line-through' },
	]),
)
