/** Link this plugin's development environment to the DSH checkout it targets. */
import { readFile, readdir, mkdir, symlink, lstat, readlink, unlink, writeFile, access } from 'node:fs/promises'
import { resolve, dirname, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const checkout = resolve(process.argv[2] ?? process.env.DSH_REPO ?? '../deepseek-harness')
const paths = {}
let linked = 0
async function linkPackage(directory) {
  let text
  try { text = await readFile(resolve(directory, 'package.json'), 'utf8') }
  catch (error) { if (error.code === 'ENOENT') return; throw error }
  const manifest = JSON.parse(text)
  const destination = resolve(root, 'node_modules', manifest.name)
  await mkdir(dirname(destination), { recursive: true })
  try {
    const existing = await lstat(destination)
    if (existing.isSymbolicLink() && resolve(dirname(destination), await readlink(destination)) !== directory) {
      await unlink(destination)
      await symlink(directory, destination, 'dir')
      linked++
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await symlink(directory, destination, 'dir')
    linked++
  }
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    if (typeof value !== 'object' || !value.types) continue
    const name = key === '.' ? manifest.name : manifest.name + key.slice(1)
    let types = resolve(directory, value.types)
    try { await access(types) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      types = resolve(directory, value.types.replace('./lib/types/', './src/').replace(/\.d\.ts$/, '.ts'))
    }
    paths[name] = ['./' + relative(root, types)]
  }
}
for (const group of await readdir(resolve(checkout, 'packages'), { withFileTypes: true })) {
  if (!group.isDirectory()) continue
  for (const entry of await readdir(resolve(checkout, 'packages', group.name), { withFileTypes: true })) {
    if (entry.isDirectory()) await linkPackage(resolve(checkout, 'packages', group.name, entry.name))
  }
}
for (const entry of await readdir(resolve(checkout, 'vendor'), { withFileTypes: true })) {
  if (entry.isDirectory()) await linkPackage(resolve(checkout, 'vendor', entry.name))
}
await writeFile(resolve(root, 'tsconfig.dsh.json'), JSON.stringify({ compilerOptions: { paths } }, null, 2) + '\n')
console.log(`Linked ${linked} DSH packages; type declarations resolve from ${checkout}.`)
