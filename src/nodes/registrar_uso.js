// Filas para la hoja Uso_API: una por fuente, una por uso de Claude (extracción y scoring) y otra con el resumen de filtros.
const todo = $('Unir fuentes').all().map((i) => i.json);
const f = $getWorkflowStaticData('global').ultimoFiltrado ?? {};
const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 16);
const filas = todo.filter((x) => x._tipo === 'uso').map((u) => ({
  fecha: ahora, ejecucion: $execution.id, fuente: u.fuente, peticiones: u.peticiones,
  ofertas: u.ofertas, errores: u.errores, tokens_in: '', tokens_out: '', coste_usd: '', nota: u.nota,
}));
for (const t of todo.filter((x) => x._tipo === 'tokens')) {
  filas.push({ fecha: ahora, ejecucion: $execution.id, fuente: t.fuente, peticiones: t.llamadas, ofertas: '', errores: '',
    tokens_in: t.input_tokens, tokens_out: t.output_tokens, coste_usd: ((t.input_tokens * 0.10 + t.output_tokens * 0.50) / 1e6).toFixed(4), nota: '' });
}
filas.push({ fecha: ahora, ejecucion: $execution.id, fuente: 'filtros', peticiones: 0, ofertas: f.candidatas ?? 0, errores: '',
  tokens_in: '', tokens_out: '', coste_usd: '',
  nota: `recibidas ${f.recibidas ?? 0} → candidatas ${f.candidatas ?? 0} → a puntuar ${f.puntuadas ?? 0}. Descartes: ${Object.entries(f.descartes ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ')}` });
const sc = $getWorkflowStaticData('global').ultimoScoring;
if (sc) filas.push({ fecha: ahora, ejecucion: $execution.id, fuente: 'claude-scoring', peticiones: sc.llamadas, ofertas: sc.ok,
  errores: sc.errores.length, tokens_in: sc.tin + sc.tcache, tokens_out: sc.tout, coste_usd: sc.coste.toFixed(4), nota: `caché leída: ${sc.tcache} tokens` });
return filas.map((json) => ({ json }));
