import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('dist');
const sourceCommit = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(sourceCommit || '')) throw Error('GITHUB_SHA must identify the built source commit.');

const files = {};
async function visit(relative = '') {
  const entries = await readdir(resolve(directory, relative), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw Error('Deployment files must not be symbolic links: ' + path);
    if (entry.isDirectory()) await visit(path);
    else if (entry.isFile() && path !== 'site-manifest.json') files[path] = createHash('sha256').update(await readFile(resolve(directory, path))).digest('hex');
    else if (!entry.isFile()) throw Error('Unsupported deployment file: ' + path);
  }
}
await visit();
if (!files['index.html']) throw Error('dist/index.html is required.');
await writeFile(resolve(directory, 'site-manifest.json'), JSON.stringify({ version: 1, sourceCommit, files }, null, 2) + '\n');
console.log(JSON.stringify({ sourceCommit, files: Object.keys(files).length, manifest: 'dist/site-manifest.json' }));
