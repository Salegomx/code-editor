import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dedent, detectIndent } from '../src/content.js'

test('dedent: strips the indentation the surrounding HTML added', () => {
  const pasted = '\n      {\n        "a": 1,\n\n        "b": [2]\n      }\n    '
  assert.equal(dedent(pasted), '{\n  "a": 1,\n\n  "b": [2]\n}')
})

test('dedent: keeps tabs and CRLF-free output', () => {
  assert.equal(dedent('\r\n\t\tif (x) {\r\n\t\t\ty()\r\n\t\t}\r\n'), 'if (x) {\n\ty()\n}')
})

test('dedent: leaves unindented code alone', () => {
  assert.equal(dedent('a\n  b'), 'a\n  b')
})

test('detectIndent: tabs, 2 or 4 spaces, default a tab', () => {
  assert.equal(detectIndent('if (x) {\n\ty()\n}'), '\t')
  assert.equal(detectIndent('a:\n    b:\n        c'), '    ')
  assert.equal(detectIndent('{\n  "a": {\n    "b": 1\n  }\n}'), '  ')
  assert.equal(detectIndent('SELECT 1'), '\t')
})
