import { CodeEditor } from './code-editor.js'

// Safe to include more than once on a page (for example, once per editor).
if (!customElements.get('code-editor')) customElements.define('code-editor', CodeEditor)
