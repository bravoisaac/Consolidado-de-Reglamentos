import http from 'node:http';
import { readFile, writeFile, unlink, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Library } from './lib/documents.mjs';
import { search, extractiveAnswer } from './lib/search.mjs';
import { models, summarize, stopOllama } from './lib/ollama.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const run = promisify(execFile);
const MAX_BODY = 22 * 1024 * 1024;
function validSecret(a, b) { const x = Buffer.from(a || ''), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Se requiere JSON.');
  if (Number(req.headers['content-length']) > MAX_BODY) throw new Error('Archivo demasiado grande (máximo 15 MB).');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw new Error('Archivo demasiado grande.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function decodeUpload(data) {
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error('Contenido inválido.');
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length < 4 || buffer.length > 15 * 1024 * 1024) throw new Error('Usa un archivo de hasta 15 MB, que no esté vacío.');
  return buffer;
}
export async function createApp({ directory = path.join(ROOT, 'data'), port = 4318 } = {}) {
  const library = new Library(directory); await library.init();
  const temporary = path.join(directory, 'temporary'); await mkdir(temporary, { recursive: true });
  for (const name of await readdir(temporary)) if (/^[a-f0-9-]+\.png$/.test(name)) await unlink(path.join(temporary, name));
  const secret = randomBytes(32).toString('hex');
  let activeHeavy = false;
  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const host = `127.0.0.1:${address.port}`;
    const origin = `http://${host}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== origin) || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) return json(403, { error: 'Acceso permitido solo desde esta aplicación local.' });
    const url = new URL(req.url, origin);
    const route = url.pathname;
    try {
      if (req.method === 'GET' && ['/', '/app.js', '/styles.css'].includes(route)) {
        const name = route === '/' ? 'index.html' : route.slice(1);
        let bytes = await readFile(path.join(ROOT, 'public', name));
        if (route === '/') {
          bytes = Buffer.from(bytes.toString().replace('__CSRF__', secret));
          res.setHeader('Set-Cookie', `reglamentos=${secret}; HttpOnly; SameSite=Strict; Path=/`);
        }
        res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8' }); return res.end(bytes);
      }
      const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('reglamentos='))?.slice(12);
      if (!validSecret(cookie, secret)) return json(401, { error: 'Abre la aplicación para iniciar la sesión local.' });
      if (req.method !== 'GET' && !validSecret(req.headers['x-csrf-token'], secret)) return json(403, { error: 'Sesión inválida. Recarga la aplicación.' });
      if (req.method === 'GET' && route === '/api/documents') return json(200, { documents: library.list() });
      if (req.method === 'GET' && route.startsWith('/documents/')) {
        const doc = library.documents.find(d => d.id === route.slice(11));
        if (!doc) return json(404, { error: 'Documento no encontrado.' });
        const bytes = await readFile(library.file(doc));
        res.writeHead(200, { 'Content-Type': doc.kind === 'pdf' ? 'application/pdf' : doc.kind === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain; charset=utf-8', 'Content-Disposition': `${doc.kind === 'docx' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(doc.name)}` }); return res.end(bytes);
      }
      if (req.method === 'DELETE' && route.startsWith('/api/documents/')) { await library.remove(route.slice(15)); return json(200, { ok: true }); }
      if (req.method !== 'POST' || !['/api/documents', '/api/ask', '/api/ocr', '/api/models'].includes(route)) return json(404, { error: 'Ruta no encontrada.' });
      if (activeHeavy) return json(429, { error: 'Hay una operación en curso. Espera a que termine.' });
      activeHeavy = true;
      try {
        const input = await body(req);
        if (route === '/api/models') return json(200, { models: await models() });
        if (route === '/api/documents') {
          if (typeof input.name !== 'string' || /[\\/\x00-\x1f]/.test(input.name)) throw new Error('Nombre de archivo inválido.');
          return json(201, { document: await library.add(decodeUpload(input.data), input.name) });
        }
        if (route === '/api/ask') {
          if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 8000) throw new Error('Escribe una pregunta de entre 1 y 8.000 caracteres.');
          const sources = search(library.documents, input.question, input.documentId || '');
          let answer = extractiveAnswer(sources), mode = 'search', warning;
          if (input.mode === 'ai' && sources.length) {
            try { answer = await summarize(input.question, sources, input.model); mode = 'ai'; }
            catch { warning = 'La IA no pudo producir una respuesta con referencias válidas. Puedes revisar los pasajes recuperados o reintentar.'; }
          }
          return json(200, { answer, sources, mode, warning });
        }
        if (route === '/api/ocr') {
          const image = decodeUpload(input.data);
          if (!image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('La captura debe estar en formato PNG.');
          const file = path.join(temporary, `${randomUUID()}.png`);
          await writeFile(file, image, { mode: 0o600 });
          try {
            const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'ocr.ps1'), '-ImagePath', file], { windowsHide: true, timeout: 30000, maxBuffer: 1_000_000, encoding: 'utf8' });
            return json(200, JSON.parse(stdout.replace(/^\uFEFF/, '')));
          } catch { throw new Error('No se pudo leer la captura. Verifica que Windows tenga un idioma OCR instalado o pega el texto manualmente.'); }
          finally { await unlink(file).catch(() => {}); }
        }
      } finally { activeHeavy = false; }
    } catch (error) {
      const safe = /^(El archivo|Usa |No se encontr|Este documento|Demasiado texto|Archivo demasiado|Contenido inválido|Nombre de archivo|Escribe una|La captura|No se pudo|El puerto|Se requiere|Documento no encontrado)/.test(error.message);
      json(400, { error: safe ? error.message : 'No se pudo procesar la solicitud. Revisa el archivo o vuelve a intentarlo.' });
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, library, url: `http://127.0.0.1:${server.address().port}` };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const desktop = process.argv.includes('--desktop');
    const app = await createApp(desktop ? { directory: process.env.FOLIO_DATA_DIR, port: 0 } : {});
    if (desktop && process.send) {
      process.send({ type: 'ready', url: app.url });
      const shutdown = () => { stopOllama(); app.server.close(() => process.exit()); app.server.closeAllConnections(); setTimeout(() => process.exit(), 2000).unref(); };
      process.on('message', message => { if (message?.type === 'shutdown') shutdown(); });
      process.on('disconnect', shutdown);
    }
    console.log(`Reglamentos locales: ${app.url}\nCierra esta ventana o pulsa Ctrl+C para detener la app.`);
    if (process.argv.includes('--open') && process.platform === 'win32') execFile('rundll32.exe', ['url.dll,FileProtocolHandler', app.url], { windowsHide: true }, () => {});
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopOllama(); app.server.close(); process.exit(); });
    process.on('exit', stopOllama);
  } catch { console.error('No se pudo iniciar. Revisa que el puerto 4318 esté libre y que data/ sea accesible.'); process.exitCode = 1; }
}
