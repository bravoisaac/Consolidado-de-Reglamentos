import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.mjs';

test('biblioteca privada: carga, consulta, persistencia, controles de acceso y eliminación', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'folio-test-'));
  const app = await createApp({ directory, port: 0 });
  const { server, url } = app;
  try {
    const home = await fetch(url); const html = await home.text();
    const cookie = home.headers.get('set-cookie').split(';')[0]; const token = html.match(/name="csrf-token" content="([^"]+)"/)[1];
    assert.match(home.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.match(home.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.equal(server.address().address, '127.0.0.1');
    const headers = { cookie, 'X-CSRF-Token': token, 'Content-Type': 'application/json', Origin: url };
    const api = (route, body, method = 'POST', extra = {}) => fetch(url + route, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.equal((await fetch(url + '/api/documents')).status, 401);
    assert.equal((await api('/api/documents', undefined, 'GET', { Origin: 'https://evil.invalid' })).status, 403);
    const wrongHost = await new Promise((resolve, reject) => { http.get(url + '/api/documents', { headers: { ...headers, Host: 'evil.invalid' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject); });
    assert.equal(wrongHost, 403);
    assert.equal((await api('/api/documents', undefined, 'GET', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await api('/api/ask', { question: 'vacaciones' }, 'POST', { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await api('/data/index.json', undefined, 'GET')).status, 404);
    const text = 'Artículo 8. Las vacaciones deben solicitarse con quince días de anticipación.\n\nArtículo 9. El horario de ingreso es a las 09:00.';
    const upload = { name: 'Reglamento de prueba.txt', data: Buffer.from(text).toString('base64') };
    const loaded = await api('/api/documents', upload); assert.equal(loaded.status, 201);
    const { document } = await loaded.json(); assert.equal(document.passages, 2);
    assert.equal((await api('/api/documents', upload)).status, 400);
    assert.equal((await api('/api/documents', { ...upload, name: '../escape.txt' })).status, 400);
    assert.equal((await api('/api/documents', { ...upload, name: 'falso.pdf' })).status, 400);
    const answer = await (await api('/api/ask', { question: '¿Con cuántos días de anticipación se solicitan las vacaciones?' })).json();
    assert.equal(answer.mode, 'search'); assert.equal(answer.sources[0].documentId, document.id); assert.equal(answer.sources[0].location.label, 'Párrafo 1');
    const original = await api(answer.sources[0].href, undefined, 'GET'); assert.equal(await original.text(), text);
    assert.equal((await fetch(url + answer.sources[0].href)).status, 401);
    const none = await (await api('/api/ask', { question: 'viajes orbitales espaciales' })).json(); assert.equal(none.sources.length, 0); assert.match(none.answer, /No encontré/);
    assert.equal((await api('/api/ocr', { data: upload.data })).status, 400);
    const { Library } = await import('../lib/documents.mjs'); const restored = new Library(directory); await restored.init(); assert.equal(restored.list().length, 1);
    assert.equal((await api(`/api/documents/${document.id}`, undefined, 'DELETE')).status, 200);
    assert.equal((await api(`/documents/${document.id}`, undefined, 'GET')).status, 404);
    assert.equal(app.library.list().length, 0);
    assert.deepEqual((await readdir(directory)).sort(), ['index.json', 'temporary']);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
