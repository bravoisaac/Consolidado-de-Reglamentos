import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { extract } from '../lib/documents.mjs';

function samplePdf() {
  const stream = 'BT /F1 14 Tf 60 700 Td (Reglamento ficticio. Vacaciones con quince dias de anticipacion.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>'
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test('extrae PDF con página real y advierte página sin texto', async () => {
  const result = await extract(samplePdf(), 'prueba.pdf');
  assert.equal(result.kind, 'pdf'); assert.match(result.chunks[0].text, /quince dias/);
  assert.equal(result.chunks[0].location.number, 1); assert.ok(result.warnings.some(w => w.includes('Página 2')));
});
test('extrae Word con párrafos verificables y sin páginas inventadas', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Las vacaciones requieren quince días de anticipación.</w:t></w:r></w:p><w:p><w:r><w:t>La jefatura autoriza cada solicitud de vacaciones.</w:t></w:r></w:p></w:body></w:document>');
  const result = await extract(await zip.generateAsync({ type: 'nodebuffer' }), 'prueba.docx');
  assert.equal(result.chunks.length, 2); assert.equal(result.chunks[1].location.label, 'Párrafo 2'); assert.match(result.chunks[0].text, /quince días/);
});
test('rechaza contenido falso y texto ilegible', async () => {
  await assert.rejects(extract(Buffer.from('archivo falso'), 'falso.pdf'));
  await assert.rejects(extract(Buffer.from([255, 254, 0, 0, 1]), 'binario.txt'));
  await assert.rejects(extract(Buffer.from('corto'), 'vacio.txt'));
});
