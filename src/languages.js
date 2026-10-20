import { StreamLanguage } from '@codemirror/language'
import { json, jsonLanguage } from '@codemirror/lang-json'
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript'
import { html, htmlLanguage } from '@codemirror/lang-html'
import { css, cssLanguage } from '@codemirror/lang-css'
import { xml, xmlLanguage } from '@codemirror/lang-xml'
// SQL is turned off. To turn it back on, uncomment the three SQL lines in this file.
// import { sql, StandardSQL } from '@codemirror/lang-sql'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { MINIFY_RULES, RULES } from './minify.js'

const shellLanguage = StreamLanguage.define(shell)

// Values accepted by the `language` attribute. To add a language, install its
// @codemirror/lang-* package, add it here and give it minify rules below.
const LANGUAGES = {
	text: () => [],
	json: () => json(),
	javascript: () => javascript(),
	typescript: () => javascript({ typescript: true }),
	jsx: () => javascript({ jsx: true }),
	tsx: () => javascript({ jsx: true, typescript: true }),
	html: () => html(),
	css: () => css(),
	xml: () => xml(),
	// sql: () => sql(),
	shell: () => shellLanguage,
}

const ALIASES = {
	'': 'text',
	plain: 'text',
	plaintext: 'text',
	txt: 'text',
	js: 'javascript',
	ts: 'typescript',
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
	if (Object.hasOwn(LANGUAGES, id)) return { id, extension: LANGUAGES[id]() }
	console.warn(`<code-editor>: unknown language "${name}", showing plain text. Supported: ${languageNames.join(', ')}.`)
	return { id: 'text', extension: [] }
}

// Minify rules travel as language data, so a <script> block inside HTML is
// minified with the JavaScript rules and the tags around it with the markup rules.
export const minifyLanguageData = [
	jsonLanguage.data.of({ [MINIFY_RULES]: RULES.json }),
	javascriptLanguage.data.of({ [MINIFY_RULES]: RULES.javascript }),
	cssLanguage.data.of({ [MINIFY_RULES]: RULES.css }),
	// StandardSQL.language.data.of({ [MINIFY_RULES]: RULES.sql }),
	htmlLanguage.data.of({ [MINIFY_RULES]: RULES.markup }),
	xmlLanguage.data.of({ [MINIFY_RULES]: RULES.markup }),
	shellLanguage.data.of({ [MINIFY_RULES]: RULES.whitespaceIsSyntax }),
]
