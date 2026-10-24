import { readdir, stat, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist/win-unpacked/resources/app');
const allowed = new Set(['desktop','lib','public','scripts','server.mjs','package.json','node_modules','README.md','MANUAL-IA.md']);
for (const name of await readdir(root)) {
  if (!allowed.has(name)) throw new Error(`Archivo no autorizado en el paquete: ${name}`);
}
for (const name of ['data','output','.env','.git','tests']) {
  if (await stat(path.join(root,name)).catch(()=>false)) throw new Error(`Contenido privado o de pruebas en el paquete: ${name}`);
}
const files = (await readdir('dist')).filter(name => /^Folio-.*\.(exe|zip)$/.test(name));
if (!files.length) throw new Error('No hay paquetes de escritorio.');
const sums = [];
for (const name of files) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path.join('dist', name))) hash.update(chunk);
  sums.push(`${hash.digest('hex')}  ${name}`);
}
await writeFile('dist/SHA256SUMS.txt', sums.join('\n')+'\n');
await copyFile('MANUAL-IA.md', 'dist/MANUAL-IA.md');
console.log('Paquete revisado: sin biblioteca privada; hashes guardados en dist/SHA256SUMS.txt.');
