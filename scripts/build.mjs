/** Emit DSH's lazy CommonJS module factory with lifecycle-owned CSS. */
import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
await mkdir('lib', { recursive: true })
await build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, format: 'esm', platform: 'node', packages: 'external' })
const client = await build({
  entryPoints: ['src/client/index.ts'], bundle: true, format: 'cjs', platform: 'browser',
  target: 'es2022', jsx: 'automatic', write: false, external: ['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  loader: { '.css': 'text' },
})
await writeFile('lib/client.js', `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory(require) {\nvar module = { exports: {} }; var exports = module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;\n} });\n`)
console.log('Built lib/index.js and lib/client.js')
