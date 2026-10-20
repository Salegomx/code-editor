import { ensureSyntaxTree, language } from '@codemirror/language'
import { getStyleTags, tags } from '@lezer/highlight'

/** Language-data key each language uses to register its minify rules. */
export const MINIFY_RULES = 'codeEditorMinify'

// How a run of whitespace (or a removed comment) between two tokens is rewritten.
// `after` / `before` list characters next to which the whitespace can simply be
// dropped; anywhere else it collapses to one space so `SELECT a FROM t` keeps working.
export const RULES = {
	// JSON whitespace always touches punctuation, so the result is standard compact JSON.
	json: { after: '{[,:', before: '}],:' },
	// A line break can end a statement in JavaScript (automatic semicolon insertion),
	// so line breaks are only dropped where the next line cannot be a new statement.
	javascript: {
		after: '{}()[];,:=?!&|<>*%^~',
		before: '{}()[];,:=?&|<>*%^~.',
		afterNewline: '{([;,:=?!&|<>*%^~',
		beforeNewline: '})];,:=?&|<>*%^.([',
	},
	// Not `(` before or `)` after (`and (min-width…)`), not `+`/`-` (`calc(1px + 2px)`),
	// not `.`, `#`, `[`, `:` before (`.a .b` is a descendant selector).
	css: { after: '{};,:>~(', before: '{};,>~)' },
	sql: { after: ',;()=<>', before: ',;()=<>' },
	// HTML/XML: whitespace between two tags goes, whitespace in text collapses to one space.
	markup: { markup: true },
	text: {},
	// Shell: line breaks and spaces separate commands and arguments, so leave it alone.
	whitespaceIsSyntax: { skip: true },
}

const WHITESPACE = /[ \t\n\r\f\v]+/g

/**
 * Returns the document without the whitespace and comments that only serve layout.
 * Strings, template literals, regular expressions and attribute values are copied as-is.
 */
export function minify(state) {
	const text = state.doc.toString()
	const rulesAt = (pos) => state.languageDataAt(MINIFY_RULES, pos)[0] ?? RULES.text
	const top = rulesAt(0)
	if (top.skip) return text

	const lang = state.facet(language)
	let ranges = []
	if (lang) {
		const tree = ensureSyntaxTree(state, state.doc.length, 1000)
		// Without a full syntax tree we can't tell strings from code: send the text unchanged.
		if (!tree) return text
		ranges = specialRanges(tree, text)
	}
	const nested = Boolean(lang?.allowsNesting)

	const out = []
	let last = '' // last character written (reading it back from a growing string is slow)
	let gapAt = -1
	let gapHasNewline = false

	const gap = (pos, hasNewline) => {
		if (gapAt < 0) gapAt = pos
		gapHasNewline ||= hasNewline
	}
	const emit = (chunk) => {
		if (!chunk) return
		if (gapAt >= 0 && last) {
			out.push(separator(last, chunk[0], gapHasNewline, nested ? rulesAt(gapAt) : top))
		}
		gapAt = -1
		gapHasNewline = false
		out.push(chunk)
		last = chunk[chunk.length - 1]
	}
	const scan = (from, to) => {
		let pos = from
		WHITESPACE.lastIndex = from
		while (pos < to) {
			const match = WHITESPACE.exec(text)
			if (!match || match.index >= to) {
				emit(text.slice(pos, to))
				break
			}
			emit(text.slice(pos, match.index))
			const end = Math.min(match.index + match[0].length, to)
			gap(match.index, text.slice(match.index, end).includes('\n'))
			pos = end
			WHITESPACE.lastIndex = end
		}
	}

	let pos = 0
	for (const range of ranges) {
		if (range.from > pos) scan(pos, range.from)
		if (range.drop) gap(range.from, text.slice(range.from, range.to).includes('\n'))
		else emit(text.slice(range.from, range.to))
		pos = range.to
	}
	if (pos < text.length) scan(pos, text.length)
	return out.join('')
}

function separator(prev, next, hasNewline, rules) {
	if (rules.markup) return prev === '>' && next === '<' ? '' : ' '
	if (hasNewline && rules.afterNewline) {
		return rules.afterNewline.includes(prev) || rules.beforeNewline.includes(next) ? '' : '\n'
	}
	return rules.after?.includes(prev) || rules.before?.includes(next) ? '' : ' '
}

const hasTag = (nodeTags, tag) => nodeTags.some((nodeTag) => nodeTag.set.includes(tag))

// Collects, in document order, the ranges minify must not rewrite (`keep`)
// and the comments it removes (`drop`).
function specialRanges(tree, text) {
	const ranges = []
	const cursor = tree.cursor()
	for (let more = true; more;) {
		let kind = null
		if (cursor.from < cursor.to) {
			const nodeTags = getStyleTags(cursor)?.tags ?? []
			if (hasTag(nodeTags, tags.comment)) kind = 'drop'
			else if (hasTag(nodeTags, tags.string) || hasTag(nodeTags, tags.regexp)) kind = 'keep'
			// Markup text content is processed like code: its whitespace collapses.
			else if (!hasTag(nodeTags, tags.content) && isLeaf(cursor) && /\s/.test(text.slice(cursor.from, cursor.to))) {
				// Any other single token holding whitespace (a quoted name, for example).
				kind = 'keep'
			}
		}
		if (kind) ranges.push({ from: cursor.from, to: cursor.to, drop: kind === 'drop' })
		more = cursor.next(!kind)
	}
	return ranges
}

function isLeaf(cursor) {
	if (!cursor.firstChild()) return true
	cursor.parent()
	return false
}
