/** Build a deterministic visual-test page using the actual DSH theme. */
import { build } from 'esbuild'
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const destination = 'dist/preview'
if (!process.env.DSH_REPO) throw new Error('Set DSH_REPO to the DeepSeek Harness checkout.')
const dsh = resolve(process.env.DSH_REPO)
await mkdir(destination, { recursive: true })
await build({ entryPoints: ['tests/preview.tsx'], outfile: `${destination}/preview.js`, bundle: true,
  platform: 'browser', format: 'esm', jsx: 'automatic', loader: { '.module.css': 'local-css' },
  alias: {
    react: resolve('node_modules/react'), 'react-dom': resolve('node_modules/react-dom'),
    '@deepseek-ai/dsh-client-ui-primitives': resolve(dsh, 'packages/client/ui-primitives/src/markdown/CodeBlock.tsx'),
  },
  plugins: [{ name: 'inline-waterfall-css', setup(build) {
    build.onLoad({ filter: /waterfall\.css$/ }, async ({ path }) => ({ contents: await readFile(path, 'utf8'), loader: 'text' }))
  } }],
})
await copyFile(resolve(dsh, 'packages/client/ui-theme/src/styles/design-platform.css'), `${destination}/theme.css`)
await copyFile(resolve(dsh, 'packages/client/ui-theme/src/styles/shiki.css'), `${destination}/shiki.css`)
await writeFile(`${destination}/index.html`, `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH trace waterfall — visual test</title><link rel="stylesheet" href="theme.css"><link rel="stylesheet" href="shiki.css"><link rel="stylesheet" href="preview.css"><style>body{margin:0;padding:48px 32px;background:var(--dsw-alias-bg-layer-2);font-family:system-ui}#root{height:700px;max-width:1120px;margin:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;overflow:hidden;box-shadow:0 10px 40px #00000008}@media(max-width:600px){body{padding:10px}#root{height:calc(100dvh - 20px)}}</style></head><body><script>const theme=matchMedia('(prefers-color-scheme: dark)');function applyTheme(){document.body.toggleAttribute('data-ds-dark-theme',theme.matches)}applyTheme();theme.addEventListener('change',applyTheme);</script><div id="root"></div><script type="module" src="preview.js"></script></body></html>\n`)
console.log('Visual fixture: dist/preview/index.html')
