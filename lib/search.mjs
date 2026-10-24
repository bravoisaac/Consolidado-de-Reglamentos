const STOP = new Set('a al algo ante como con cual cuales cuando de del desde donde el ella en es esta este esto estos favor hay la las le lo los me mi o para pero por puede puedo que qué se si sin sobre su sus te tiene un una unos y yo segun según dice reglamento necesito saber correo consulta hola gracias buenas estimado'.split(' '));
export function tokens(text) {
  return [...new Set(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) || [])].filter(t => t.length > 2 && !STOP.has(t));
}
export function passages(text, location) {
  const result = [];
  const clean = text.replace(/\r/g, '').trim();
  for (let start = 0; start < clean.length;) {
    let end = Math.min(start + 1500, clean.length);
    if (end < clean.length) {
      const boundary = clean.lastIndexOf(' ', end);
      if (boundary > start + 700) end = boundary;
    }
    result.push({ text: clean.slice(start, end).trim(), location });
    if (end === clean.length) break;
    start = end;
  }
  return result;
}
export function search(documents, question, documentId = '') {
  const query = tokens(question);
  if (!query.length) return [];
  const chunks = documents.filter(d => !documentId || d.id === documentId).flatMap(d => d.chunks.map((c, index) => ({ ...c, documentId: d.id, name: d.name, index, kind: d.kind })));
  const indexed = chunks.map(c => ({ ...c, terms: tokens(c.text) }));
  const frequency = new Map(query.map(t => [t, indexed.filter(c => c.terms.includes(t)).length]));
  return indexed.map(c => {
    const matches = query.filter(t => c.terms.includes(t));
    const score = matches.reduce((sum, t) => sum + Math.log(1 + indexed.length / (1 + frequency.get(t))), 0) / Math.sqrt(1 + c.terms.length / 150);
    return { ...c, matches: matches.length, score };
  }).filter(c => c.matches >= Math.min(2, query.length)).sort((a, b) => b.score - a.score).slice(0, 5).map(({ terms, score, matches, ...c }, i) => ({ ...c, citation: i + 1, href: `/documents/${c.documentId}${c.kind === 'pdf' ? `#page=${c.location.number}` : ''}` }));
}
export function extractiveAnswer(sources) {
  if (!sources.length) return 'No encontré pasajes suficientes en los reglamentos cargados. Prueba con palabras concretas del tema o revisa si falta un documento. La ausencia de coincidencias no significa que una norma no exista.';
  return 'Estos son los pasajes que coinciden con tu consulta. Revisa su alcance, excepciones y vigencia en el documento original; la búsqueda por palabras no determina por sí sola qué norma corresponde aplicar.';
}
