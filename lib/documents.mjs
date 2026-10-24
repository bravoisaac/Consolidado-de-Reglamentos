import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { passages } from './search.mjs';

export async function extract(buffer, name) {
  const ext = path.extname(name).toLowerCase();
  let chunks = [], warnings = [];
  if (ext === '.pdf') {
    if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('El archivo no es un PDF válido.');
    const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false });
    try {
      const result = await parser.getText();
      if (result.pages.length > 2000) throw new Error('El PDF supera el límite de 2.000 páginas.');
      for (const page of result.pages) {
        if (page.text.trim().length < 20) warnings.push(`Página ${page.num} sin texto suficiente; puede necesitar OCR.`);
        chunks.push(...passages(page.text, { label: `Página ${page.num}`, number: page.num }));
      }
    } finally { await parser.destroy(); }
  } else if (ext === '.docx') {
    if (buffer.readUInt16LE(0) !== 0x4b50) throw new Error('El archivo no es un DOCX válido.');
    const result = await mammoth.extractRawText({ buffer });
    chunks = result.value.split(/\n\s*\n/).filter(p => p.trim()).flatMap((p, i) => passages(p, { label: `Párrafo ${i + 1}`, number: i + 1 }));
  } else if (['.txt', '.md'].includes(ext)) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (text.includes('\0')) throw new Error('El archivo debe ser texto UTF-8.');
    chunks = text.split(/\n\s*\n/).filter(p => p.trim()).flatMap((p, i) => passages(p, { label: `Párrafo ${i + 1}`, number: i + 1 }));
  } else throw new Error('Usa PDF, DOCX, TXT o MD.');
  if (!chunks.some(c => c.text.length >= 20)) throw new Error('No se encontró texto legible. Si es un PDF escaneado, necesita una capa de texto OCR antes de importarlo.');
  if (chunks.reduce((sum, c) => sum + c.text.length, 0) > 8_000_000) throw new Error('Demasiado texto. Divide el reglamento en varios archivos.');
  return { chunks, warnings: warnings.slice(0, 30), kind: ext.slice(1) };
}

function extractIsolated(buffer, name) {
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(new URL('./extract-worker.mjs', import.meta.url)), [], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=256'] });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('No se pudo extraer el texto en 30 segundos. Divide o revisa el archivo.')); }, 30000);
    child.once('error', () => { clearTimeout(timeout); reject(new Error('No se pudo iniciar la lectura del documento.')); });
    child.once('message', message => {
      clearTimeout(timeout); child.kill();
      if (message.error) reject(new Error(message.error)); else resolve(message.result);
    });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('No se pudo extraer el documento. Puede ser demasiado complejo o estar dañado.')); });
    child.send({ data: buffer.toString('base64'), name });
  });
}

export class Library {
  constructor(directory) { this.directory = directory; this.documents = []; this.queue = Promise.resolve(); }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try { this.documents = JSON.parse(await readFile(path.join(this.directory, 'index.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('No se puede leer el índice local. Conserva data/ y revisa index.json.'); }
  }
  list() { return this.documents.map(({ chunks, ...doc }) => ({ ...doc, passages: chunks.length })); }
  file(doc) { return path.join(this.directory, `${doc.id}.${doc.kind}`); }
  async save() {
    const destination = path.join(this.directory, 'index.json');
    await writeFile(`${destination}.tmp`, JSON.stringify(this.documents), { mode: 0o600 });
    await rename(`${destination}.tmp`, destination);
  }
  mutate(operation) {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => {});
    return next;
  }
  async add(buffer, name) {
    const parsed = await extractIsolated(buffer, name);
    return this.mutate(async () => {
      const hash = createHash('sha256').update(buffer).digest('hex');
      if (this.documents.some(d => d.hash === hash)) throw new Error('Este documento ya está en la biblioteca.');
      const doc = { id: randomUUID(), name: path.basename(name).slice(0, 180), hash, bytes: buffer.length, added: new Date().toISOString(), ...parsed };
      await writeFile(this.file(doc), buffer, { mode: 0o600 });
      this.documents.push(doc);
      try { await this.save(); }
      catch (error) { this.documents.pop(); await unlink(this.file(doc)).catch(() => {}); throw error; }
      return this.list().find(d => d.id === doc.id);
    });
  }
  async remove(id) {
    return this.mutate(async () => {
      const doc = this.documents.find(d => d.id === id);
      if (!doc) throw new Error('Documento no encontrado.');
      const previous = this.documents;
      this.documents = this.documents.filter(d => d.id !== id);
      try { await this.save(); } catch (error) { this.documents = previous; throw error; }
      await unlink(this.file(doc));
    });
  }
}
