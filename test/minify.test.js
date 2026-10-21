import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EditorState } from '@codemirror/state'
import { minify } from '../src/minify.js'
import { resolveLanguage, languageData } from '../src/languages.js'

const run = (language, doc) =>
  minify(EditorState.create({ doc, extensions: [resolveLanguage(language).extension, languageData] }))

test('json: removes all layout whitespace, keeps strings exactly', () => {
  const doc = '{\n\t"name":  "Ada  Lovelace",\r\n  "tags": [ "a b", 1, true ],\n  "my  key": { "x": null }\n}\n'
  assert.equal(run('json', doc), '{"name":"Ada  Lovelace","tags":["a b",1,true],"my  key":{"x":null}}')
})

test('json: invalid JSON is still only stripped, never rewritten', () => {
  assert.equal(run('json', '{\n  "a": 1,\n  "b": \n}'), '{"a":1,"b":}')
})

test('javascript: drops comments, keeps strings, template literals and regexes as written', () => {
  const doc = [
    '// greeting',
    'const greet = (name) => {',
    '  /* block',
    '     comment */',
    "  const msg = `Hello,   ${ name }  !`;",
    "  return msg.replace(/a  b/g, 'x  y');",
    '};',
  ].join('\n')
  assert.equal(
    run('javascript', doc),
    "const greet=(name)=>{const msg=`Hello,   ${ name }  !`;return msg.replace(/a  b/g,'x  y');};",
  )
})

test('javascript: keeps the line breaks that end statements without semicolons', () => {
  const doc = 'const a = 1\nconst b = a\n  .toString()\nfoo()\n[1, 2].forEach(log)\nreturn\nx'
  assert.equal(run('javascript', doc), 'const a=1\nconst b=a.toString()\nfoo()[1,2].forEach(log)\nreturn\nx')
})

test('javascript: never merges + + or - - into ++ / --', () => {
  assert.equal(run('javascript', 'a + +b - -c'), 'a + +b - -c')
})

test('css: keeps spaces that change meaning', () => {
  const doc = '/* nav */\n.nav  .item > a:hover,\n.b {\n  margin: 0  auto;\n  width: calc(100% - 2px);\n}\n@media screen and (min-width: 600px) { .a { color: red !important } }'
  assert.equal(
    run('css', doc),
    '.nav .item>a:hover,.b{margin:0 auto;width:calc(100% - 2px);}@media screen and (min-width:600px){.a{color:red !important}}',
  )
})

test('css in an HTML <style> block: same rules', () => {
  const doc = '<style>\n  /* nav */\n  .nav  .item > a:hover,\n  .b {\n    margin: 0  auto;\n    width: calc(100% - 2px);\n  }\n  @media screen and (min-width: 600px) { .a { color: red !important } }\n</style>'
  assert.equal(
    run('html', doc),
    '<style>.nav .item>a:hover,.b{margin:0 auto;width:calc(100% - 2px);}@media screen and (min-width:600px){.a{color:red !important}}</style>',
  )
})

// SQL is turned off in src/languages.js. Remove `.skip` when turning it back on.
test.skip('sql: removes comments and layout, keeps words apart', () => {
  const doc = "-- active users\nSELECT id,\n       name\nFROM   users\nWHERE  status = 'a  b'\n  AND id IN (1, 2)\n  AND x - -1 > 0;"
  assert.equal(run('sql', doc), "SELECT id,name FROM users WHERE status='a  b' AND id IN(1,2)AND x - -1>0;")
})

test('html: whitespace between tags goes, text and attributes are preserved', () => {
  const doc = [
    '<!-- card -->',
    '<div class="card  big"   id="x">',
    '  <p>',
    '    Hello   <b>world</b>',
    '  </p>',
    '  <script>',
    '    const a = 1',
    '    const b = "x  y"',
    '  </script>',
    '</div>',
  ].join('\n')
  assert.equal(run('html', doc), '<div class="card  big" id="x"><p> Hello <b>world</b></p><script>const a=1\nconst b="x  y"</script></div>')
})

test('xml: indentation between elements is removed', () => {
  const doc = '<?xml version="1.0"?>\n<order id="7">\n  <item qty="2">Blue  pen</item>\n  <![CDATA[ a  b ]]>\n</order>'
  assert.equal(run('xml', doc), '<?xml version="1.0"?><order id="7"><item qty="2">Blue pen</item><![CDATA[ a  b ]]></order>')
})

test('shell: left unchanged because whitespace is syntax', () => {
  const doc = 'curl -X POST \\\n  https://api.example.com\ncd x\nls'
  assert.equal(run('shell', doc), doc)
})

test('plain text: every whitespace run becomes one space', () => {
  assert.equal(run('text', '  Hello\n\n\tworld  \n'), 'Hello world')
})
