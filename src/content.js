// Reading the code a developer pasted between <code-editor> and </code-editor>.

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

/**
 * Returns the element's initial code, dedented.
 *
 * Plain code is read as text. The browser parses anything that looks like a
 * tag before this runs, so markup is rebuilt from the parsed elements and a
 * warning suggests the exact forms: a single <script type="text/plain"> or
 * <textarea> child, whose content the browser keeps as raw text.
 */
export function readInitialContent(host) {
	const nodes = [...host.childNodes].filter((node) => !(node.nodeType === Node.TEXT_NODE && !node.data.trim()))
	const only = nodes.length === 1 ? nodes[0] : null

	if (only?.localName === 'textarea') return dedent(only.value)
	if (only?.localName === 'script' && only.type.toLowerCase() === 'text/plain') return dedent(only.text)

	const element = nodes.find((node) => node.nodeType === Node.ELEMENT_NODE)
	if (element) {
		const label = host.id ? `<code-editor id="${host.id}">` : host.getAttribute('name') ? `<code-editor name="${host.getAttribute('name')}">` : '<code-editor>'
		console.warn(
			`${label}: its content contains markup (<${element.localName}>), which the browser parsed as HTML before the editor read it. ` +
			'The code shown may differ from what you wrote, and any <script> or <style> in it already ran. ' +
			'To show code exactly, wrap it in <script type="text/plain">…</script>, or escape "<" as "&lt;".',
		)
	}
	return dedent(serialize(host))
}

// Rebuilds source text from parsed nodes: text as-is, elements as tags.
function serialize(parent) {
	let out = ''
	for (const node of parent.childNodes) {
		if (node.nodeType === Node.TEXT_NODE) out += node.data
		else if (node.nodeType === Node.COMMENT_NODE) out += `<!--${node.data}-->`
		else if (node.nodeType === Node.ELEMENT_NODE) {
			const tag = node.localName
			const attributes = [...node.attributes]
				.map(({ name, value }) => (value === '' ? ` ${name}` : ` ${name}="${value.replaceAll('"', '&quot;')}"`))
				.join('')
			out += `<${tag}${attributes}>`
			if (!VOID_ELEMENTS.has(tag)) out += `${serialize(tag === 'template' ? node.content : node)}</${tag}>`
		}
	}
	return out
}

/**
 * Removes the indentation the surrounding HTML added: blank first and last
 * lines, and the leading whitespace every line shares.
 */
export function dedent(text) {
	const lines = text.replace(/\r\n?/g, '\n').split('\n')
	while (lines.length && !lines[0].trim()) lines.shift()
	while (lines.length && !lines.at(-1).trim()) lines.pop()

	let common = null
	for (const line of lines) {
		if (!line.trim()) continue
		const indent = line.match(/^[ \t]*/)[0]
		if (common === null) common = indent
		else {
			let i = 0
			while (i < common.length && common[i] === indent[i]) i++
			common = common.slice(0, i)
		}
	}
	if (!common) return lines.join('\n')
	return lines.map((line) => (line.startsWith(common) ? line.slice(common.length) : line.trimStart())).join('\n')
}

/**
 * Guesses the indent unit from the code: a tab, or the smallest space
 * indentation in use (2 when the code has no indented lines).
 */
export function detectIndent(text) {
	let tabs = 0
	let spaced = 0
	let smallest = Infinity
	for (const [, indent] of text.matchAll(/^([ \t]+)\S/gm)) {
		if (indent[0] === '\t') tabs++
		else if (indent.length >= 2) {
			spaced++
			smallest = Math.min(smallest, indent.length)
		}
	}
	if (tabs > spaced) return '\t'
	return spaced ? ' '.repeat(Math.min(smallest, 8)) : '  '
}
