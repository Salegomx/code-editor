# &lt;code-editor&gt;

A code editor web component that works like a `<textarea>` in forms. It's built on [CodeMirror 6](https://codemirror.net/) and ships as **one JavaScript file** with no other dependencies, so it works on any page: plain HTML, ColdFusion, jQuery.

```html
<form action="/orders" method="post">
  <code-editor name="payload" language="json" minify>
    { "customer": "Ada Lovelace", "qty": 2 }
  </code-editor>
  <button>Send</button>
</form>
```

The form posts `payload` like any other field. No JavaScript changes are needed.

- [Package manager: pnpm only](#package-manager-pnpm-only)
- [Commands](#commands)
- [Deploying](#deploying)
- [Usage](#usage)
- [Attributes](#attributes)
- [Putting code in the editor](#putting-code-in-the-editor)
- [Forms](#forms)
- [JavaScript and jQuery](#javascript-and-jquery)
- [minify](#minify)
- [Theming](#theming)
- [Keyboard](#keyboard)
- [Languages](#languages)
- [Browser support and size](#browser-support-and-size)
- [Project layout](#project-layout)

---

## Package manager: pnpm only

This project uses **[pnpm](https://pnpm.io/)** and nothing else. Don't use `npm install`, `yarn` or `bun install` here.

**Requirements**

| Tool | Version |
| --- | --- |
| Node.js | 18 or newer (current LTS recommended) |
| pnpm | 9 or newer. No exact version is pinned; 9, 10, 11 and 12 were tested. |

**Installing pnpm** (once per machine; pick one):

```powershell
# Windows (PowerShell)
Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression
```

```sh
# macOS / Linux
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

```sh
# Any OS whose Node.js includes Corepack (Node 24 and older)
corepack enable pnpm

# Or, as a last resort, install it with npm. This is the only time npm is used.
npm install -g pnpm
```

Check it with `pnpm --version`. More options: <https://pnpm.io/installation>.

**Rules**

- Install with `pnpm install`. Add packages with `pnpm add <package>` (or `pnpm add -D <package>` for build tools). Update with `pnpm update`.
- Commit `pnpm-lock.yaml`. It's the only lockfile. `package-lock.json`, `yarn.lock` and `bun.lock` are gitignored and must never be committed.
- A `preinstall` script ([scripts/only-pnpm.js](scripts/only-pnpm.js)) stops npm, yarn and bun with a message. npm still leaves files behind before it stops, so if you ran `npm install` by mistake, delete `node_modules/` and `package-lock.json`, then run `pnpm install`.
- `pnpm-workspace.yaml` holds pnpm's settings for this project. This isn't a monorepo. Its `allowBuilds` entry lets esbuild run its small install script, which pnpm 10 and later block by default.
- `package.json` deliberately has no `packageManager` field, so any pnpm version from 9 up works. `engines.pnpm` only sets that minimum.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies. Run after cloning and after pulling changes to `package.json` or `pnpm-lock.yaml`. |
| `pnpm build` | Builds `dist/code-editor.js`: one minified file, ready to deploy. |
| `pnpm dev` | Starts a dev server at <http://127.0.0.1:8000/demo/> that rebuilds on every save. It serves the bundle from memory and doesn't touch `dist/`. Stop it with Ctrl+C. |
| `pnpm test` | Runs the unit tests (`node --test`). |

The demo page ([demo/index.html](demo/index.html)) shows every feature: form submission (native, `FormData`, jQuery), `minify`, read-only snippets, disabled fields and themes.

## Deploying

Run `pnpm build` and copy `dist/code-editor.js` to the web server, for example to `/common/code-editor.js`. `dist/` is gitignored, so build before each deploy. Then load it on the page:

```html
<script type="module" src="/common/code-editor.js"></script>
```

- `type="module"` is recommended. The browser downloads and runs the file **once per page**, even if the tag appears many times. That makes it safe for a ColdFusion custom tag that writes this `<script>` next to every editor.
- A classic `<script src="/common/code-editor.js" defer></script>` also works, even without `defer` and even inside `<head>`.
- Including the file twice never causes an error.

Optional: until the script loads, the browser shows the code as plain text. To make that moment look tidier, add this CSS to the page:

```css
code-editor:not(:defined) { display: block; white-space: pre; font-family: monospace; overflow: auto; }
```

## Usage

```html
<!-- An editable field in a form -->
<code-editor id="payload" name="payload" language="json" height="200">
  {
    "status": "active"
  }
</code-editor>

<!-- A read-only snippet for documentation -->
<code-editor language="shell" readonly>
  curl -X GET https://api.example.com/v1/orders/42 \
    -H "Authorization: Bearer <token>"
</code-editor>
```

## Attributes

| Attribute | Example | Description |
| --- | --- | --- |
| `name` | `name="payload"` | Field name used when the form is submitted. |
| `id` | `id="payload"` | Usual HTML id. Used as the field name when there's no `name`. |
| `language` | `language="json"` | Syntax highlighting. See [Languages](#languages). Defaults to plain text. |
| `readonly` | `readonly` | Can't be edited, but can be focused, selected, searched and copied. **Is** submitted. Use it for documentation. |
| `disabled` | `disabled` | Greyed out, can't be focused, **not** submitted. A disabled `<fieldset>` around the editor has the same effect. |
| `minify` | `minify` | Submits the code without layout whitespace and comments. See [minify](#minify). Off when absent. |
| `width` | `width="600"`, `width="50%"` | Width. Plain numbers are pixels. Defaults to the full width of the container. |
| `height` | `height="300"`, `height="40vh"` | Fixed height, with scrolling inside. Without it, the editor grows with its content. Use `style="max-height: 400px"` to cap the growth. |
| `indent` | `indent="tab"`, `indent="4"` | What Tab inserts. Without it, the editor detects it from the code (tabs, or the smallest space indent; 2 spaces if unsure). |
| `theme` | `theme="vscode-dark"` | `light`, `intellij-dark` (alias `dark`) or `vscode-dark`. Without it, the editor uses `light`, or `intellij-dark` when the operating system is in dark mode. See [Theming](#theming). |
| `style` | `style="border-radius: 0"` | Styles the outer box. |
| `form` | `form="order-form"` | Belongs to that form even when placed outside it, like any form field. |
| `aria-label` | `aria-label="Request body"` | Accessible name. A `<label for="id">` works too. |

Boolean attributes (`readonly`, `disabled`, `minify`) are on when present, whatever their value, just like `disabled` on an `<input>`.

## Putting code in the editor

Paste the code between the tags. The indentation that comes from the surrounding HTML is removed, so you can indent the code to match the page.

There's one browser limitation. The browser reads everything between `<code-editor>` and `</code-editor>` as HTML **before** the editor starts:

- Code without tags (JSON, SQL, CSS, most JavaScript) can be pasted as-is.
- HTML or XML, or code where `<` is directly followed by a letter (`if (a<b)`), would be changed by the browser. Any `<script>` or `<style>` in it would run. Wrap such code in `<script type="text/plain">` and the browser keeps it exactly as written:

  ```html
  <code-editor language="html" readonly>
    <script type="text/plain">
      <form action="/orders" method="post">
        <input name="qty">
      </form>
    </script>
  </code-editor>
  ```

  A `<textarea>` wrapper works too, but it decodes entities such as `&lt;`.
- Escaping `<` as `&lt;` and `&` as `&amp;` also works. Server-side code can do this for you, for example ColdFusion's `EncodeForHTML()`.

If markup slips through unwrapped, the editor still shows its best reconstruction and logs a warning in the browser console.

## Forms

The editor submits its text through a hidden `<textarea>` that it keeps inside itself, so every way of sending a form includes it:

- a normal submit (`<button type="submit">`, `form.submit()`),
- `new FormData(form)` and `fetch`,
- jQuery's `$(form).serialize()`, `$(form).serializeArray()` and `$.post(url, $(form).serialize())`.

Details:

- **Line breaks arrive as `\r\n`.** Browsers send every multi-line form field that way, so ColdFusion and other servers receive `\r\n` in `FORM.payload`. Tabs are sent as typed.
- **Reset** (`<button type="reset">` or `form.reset()`) restores the code the page loaded with.
- **Events:** `input` fires on every edit and `change` fires on blur after the text changed, as with a `<textarea>`. They bubble, so `$(form).on('change', 'code-editor', …)` works.
- `form.elements.payload` returns two elements: the editor and its hidden `<textarea>`. Read the value from the editor itself (see below).

## JavaScript and jQuery

```js
const editor = document.getElementById('payload')

editor.value               // the text as shown, with \n line breaks
editor.value = '{"a": 1}'  // replaces the text
editor.submitValue         // what the form sends: `value`, minified when `minify` is on
editor.readOnly = true     // same as the readonly attribute (also: disabled, minify, language)
editor.focus()
editor.form                // the form it belongs to
```

```js
$('#payload').val()                // read
$('#payload').val('{"a": 1}')      // write
$('#payload').on('input', fn)      // listen
```

Change the code through `.value` or `.val()`. Don't use `.html()` or `.text()` on the editor: those replace the hidden `<textarea>` that carries the value.

## minify

With `minify`, the form receives the code without the whitespace that only serves layout (line breaks, tabs, indentation) and without comments. The editor itself keeps showing the code as typed.

What's never changed: the contents of strings, template literals, regular expressions, attribute values and CDATA, and any space needed to keep two words apart (`SELECT a FROM t` stays `SELECT a FROM t`).

| Language | Result |
| --- | --- |
| `json` | Standard compact JSON: `{"a":1,"b":[1,2]}`. Invalid JSON is stripped the same way, never rewritten. |
| `javascript`, `typescript`, `jsx`, `tsx` | Whitespace and comments removed. A line break is kept where removing it could change the meaning, for example between statements without semicolons. |
| `css`, and CSS in an HTML `<style>` block | Whitespace and comments removed, except spaces that matter (`.a .b`, `calc(1px + 2px)`, `and (min-width…)`). |
| `html`, `xml` | Whitespace between tags removed, whitespace in text collapsed to one space, comments removed. Note: this also collapses text inside `<pre>`. Code inside `<script>` and `<style>` follows the JavaScript and CSS rules. |
| `text` | Every run of whitespace becomes one space. |
| `shell` | **Not minified.** Line breaks and spaces separate commands and arguments, so the code is sent unchanged. |

## Theming

Pick a theme with the `theme` attribute:

| `theme` | Look |
| --- | --- |
| *(none)* or `auto` | `light`, or `intellij-dark` when the operating system is in dark mode |
| `light` | Light, GitHub-style colors |
| `intellij-dark` or `dark` | IntelliJ IDEA's default dark editor scheme ("Dark", New UI) |
| `vscode-dark` | VS Code's default dark theme ("Dark Modern", with Dark+ syntax colors) |

```html
<code-editor language="json" theme="vscode-dark" readonly>…</code-editor>
```

The IntelliJ and VS Code colors are taken from those editors' own theme files. The editor's syntax parser isn't the same as theirs, so a few tokens can still be colored differently, for example CSS values and constants declared with `const`. Dark themes also switch the scrollbars to dark. An unknown theme name falls back to `light` and logs a warning in the console.

To add a theme, add an entry to `THEMES` in [src/theme.js](src/theme.js). Every theme sets the same list of colors.

Every color and font is also a CSS variable, so a page can adjust any theme without a new one. Set them on `code-editor` or on any ancestor, such as `:root`:

```css
code-editor {
  --code-editor-font-size: 14px;
  --code-editor-bg: #fdfdfd;
  --code-editor-keyword: #a626a4;
}
```

| Variable | Used for |
| --- | --- |
| `--code-editor-font`, `--code-editor-font-size`, `--code-editor-line-height` | Text |
| `--code-editor-radius`, `--code-editor-border` | Outer box |
| `--code-editor-bg`, `--code-editor-fg`, `--code-editor-panel-bg` | Background, text, search panel and tooltips |
| `--code-editor-gutter-bg`, `--code-editor-gutter-border`, `--code-editor-muted`, `--code-editor-gutter-active` | Line-number gutter: background, divider, numbers, current line's number |
| `--code-editor-active-line`, `--code-editor-selection`, `--code-editor-cursor` | Editing |
| `--code-editor-focus`, `--code-editor-focus-ring` | Focus outline |
| `--code-editor-match` | Other occurrences of the selected text |
| `--code-editor-search`, `--code-editor-search-current` | Search results, current search result |
| `--code-editor-bracket`, `--code-editor-bracket-border` | Matching bracket |
| `--code-editor-keyword`, `-control`, `-constant`, `-string`, `-regexp`, `-escape`, `-number`, `-comment`, `-variable`, `-property`, `-function`, `-type`, `-tag`, `-tag-bracket`, `-attribute`, `-meta`, `-invalid` | Syntax colors. `control` is `if`/`return`/`import`; `constant` is `true`/`false`/`null`; `meta` is decorators and `<?xml ?>`. |
| `--code-editor-comment-style` | `italic` or `normal` |

A variable you set overrides that color in every theme. To change one theme only, target it: `code-editor[theme="vscode-dark"] { --code-editor-bg: #181818; }`. The editor area is also exposed as `code-editor::part(editor)`.

## Keyboard

| Keys (Windows/Linux; use Cmd for Ctrl on macOS) | Action |
| --- | --- |
| Tab / Shift+Tab | Indent / outdent. With a selection, works on every selected line. |
| Esc, then Tab | Move focus out of the editor (Tab alone indents) |
| Ctrl+click or Alt+click | Add a cursor |
| Alt+drag | Column (box) selection |
| Ctrl+Alt+↑ / ↓ | Add a cursor above / below |
| Ctrl+D | Select the next occurrence of the current word |
| Ctrl+Shift+L | Select every occurrence of the selection |
| Alt+↑ / ↓ | Move line up / down |
| Shift+Alt+↑ / ↓ | Copy line up / down |
| Ctrl+/ | Toggle comment |
| Ctrl+] / Ctrl+[ | Indent / outdent line |
| Ctrl+F | Find and replace (one panel). F3 / Shift+F3: next / previous match. |
| Ctrl+Alt+G | Go to line |
| Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z | Undo, redo |

In `readonly` editors, Tab moves focus as on any other field.

## Languages

| `language` | Also accepted as |
| --- | --- |
| `text` (default) | `plain`, `plaintext`, `txt` |
| `json` | |
| `javascript` | `js` |
| `typescript` | `ts` |
| `jsx`, `tsx` | |
| `html` | `htm` |
| `css` | |
| `xml` | `svg` |
| `shell` | `bash`, `sh` |

**Turned off for now:** `sql`. Its code is commented out in [src/languages.js](src/languages.js), and its package is still installed. To turn it back on, uncomment its three lines in `src/languages.js` (the import, the `sql` entry and its minify rules). Then remove `.skip` from the SQL test in [test/minify.test.js](test/minify.test.js) and add `sql` to the table above. This adds about 12 KB gzipped.

To add a language: install its CodeMirror package with pnpm (for example `pnpm add @codemirror/lang-python`), register it in [src/languages.js](src/languages.js), give it minify rules in [src/minify.js](src/minify.js), add a test in [test/minify.test.js](test/minify.test.js), and update the table above. Every language adds to the bundle size.

## Browser support and size

- Works in current Chrome, Edge, Firefox and Safari: Chrome/Edge 102+, Firefox 112+, Safari 16.4+. It isn't meant for Internet Explorer.
- Automated tests run in Chrome. Check Firefox and Safari by hand when changing editor behavior.
- `dist/code-editor.js` is about 580 KB minified, **about 203 KB gzipped**. Most of that is CodeMirror's editing core; the languages are roughly a quarter.

## Project layout

```
src/index.js         registers the <code-editor> element
src/code-editor.js   the element: attributes, form integration, events
src/content.js       reads and dedents the code pasted between the tags
src/languages.js     the `language` values and their minify rules
src/minify.js        the minify logic
src/theme.js         colors, fonts and CSS variables
test/                unit tests (pnpm test)
demo/index.html      demo page (pnpm dev)
scripts/only-pnpm.js blocks npm, yarn and bun
```
