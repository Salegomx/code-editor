import { StreamLanguage } from '@codemirror/language'
import { jsonLanguage } from '@codemirror/lang-json'
import { javascriptLanguage } from '@codemirror/lang-javascript'
import { htmlLanguage } from '@codemirror/lang-html'
import { cssLanguage } from '@codemirror/lang-css'
import { xmlLanguage } from '@codemirror/lang-xml'
// SQL is turned off. To turn it back on, uncomment the three SQL lines in this file.
// import { StandardSQL } from '@codemirror/lang-sql'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { MINIFY_RULES, RULES } from './minify.js'
import { CLOSE_TAGS } from './close-tags.js'

const shellLanguage = StreamLanguage.define(shell)

// Values accepted by the `language` attribute. To add a language, install its
// @codemirror/lang-* package, add it here and give it minify rules below.
//
// The languages are used bare (htmlLanguage, not html()): the html(), css()…
// helpers only add autocomplete lists, which this editor doesn't use.
// HTML still highlights the JavaScript and CSS in its <script> and <style> blocks.
const LANGUAGES = {
	text: [],
	json: jsonLanguage,
	javascript: javascriptLanguage,
	html: htmlLanguage,
	css: cssLanguage,
	xml: xmlLanguage,
	// sql: StandardSQL.language,
	shell: shellLanguage,
}

const ALIASES = {
	'': 'text',
	plain: 'text',
	plaintext: 'text',
	txt: 'text',
	js: 'javascript',
	htm: 'html',
	svg: 'xml',
	bash: 'shell',
	sh: 'shell',
}

export const languageNames = Object.keys(LANGUAGES)

/** Maps a `language` attribute value to its CodeMirror extension. */
export function resolveLanguage(name) {
	const key = (name ?? '').trim().toLowerCase()
	const id = ALIASES[key] ?? key
	if (Object.hasOwn(LANGUAGES, id)) return { id, extension: LANGUAGES[id] }
	console.warn(`<code-editor>: unknown language "${name}", showing plain text. Supported: ${languageNames.join(', ')}.`)
	return { id: 'text', extension: [] }
}

// Per-language settings travel as language data, so a <script> block inside HTML
// is minified with the JavaScript rules, and only HTML/XML close tags as you type.
export const languageData = [
	jsonLanguage.data.of({ [MINIFY_RULES]: RULES.json }),
	javascriptLanguage.data.of({ [MINIFY_RULES]: RULES.javascript }),
	cssLanguage.data.of({ [MINIFY_RULES]: RULES.css }),
	// StandardSQL.language.data.of({ [MINIFY_RULES]: RULES.sql }),
	htmlLanguage.data.of({ [MINIFY_RULES]: RULES.markup, [CLOSE_TAGS]: 'html' }),
	xmlLanguage.data.of({ [MINIFY_RULES]: RULES.markup, [CLOSE_TAGS]: 'xml' }),
	shellLanguage.data.of({ [MINIFY_RULES]: RULES.whitespaceIsSyntax }),
]
