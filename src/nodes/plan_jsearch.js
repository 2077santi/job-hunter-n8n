// 3 queries por ejecución, rotando mañana/tarde. Cuota mensual guardada en static data.
const c = $('Config').first().json;
const st = $getWorkflowStaticData('global');
const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
const mes = ahora.slice(0, 7);
const hora = Number(ahora.slice(11, 13));
if (!st.jsearch || st.jsearch.mes !== mes) st.jsearch = { mes, usadas: 0 };

let qs = hora < 13 ? c.JSEARCH_QUERIES.manana : c.JSEARCH_QUERIES.tarde;
const libres = c.JSEARCH_CUOTA_MES - st.jsearch.usadas;
qs = qs.slice(0, Math.max(0, libres));
if (!qs.length) return [{ json: { _skip: true, fuente: 'jsearch', nota: `cuota mensual agotada (${st.jsearch.usadas}/${c.JSEARCH_CUOTA_MES})` } }];

st.jsearch.usadas += qs.length;
return qs.map((q) => {
  const p = new QS({ query: q.query, num_pages: '1', country: 'es', date_posted: '3days' });
  if (q.work_from_home) p.set('work_from_home', 'true');
  return { json: { _skip: false, fuente: 'jsearch', url: `https://jsearch.p.rapidapi.com/search-v2?${p}`, acumulado_mes: st.jsearch.usadas } };
});
