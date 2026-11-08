// Peticiones de JSearch en rotación por ejecución. Cuota mensual guardada en static data.
const c = $('Config').first().json;
const st = $getWorkflowStaticData('global');
const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
const mes = ahora.slice(0, 7);
const hora = Number(ahora.slice(11, 13));
if (!st.jsearch || st.jsearch.mes !== mes) st.jsearch = { mes, usadas: 0 };

// Rotación: cada ejecución continúa donde lo dejó la anterior.
const turno = Math.floor(Date.now() / 864e5) * 2 + (hora < 13 ? 0 : 1);
const total = c.JSEARCH_QUERIES.length, porEjecucion = Math.min(c.JSEARCH_POR_EJECUCION, total);
let qs = Array.from({ length: porEjecucion }, (_, i) => c.JSEARCH_QUERIES[(turno * porEjecucion + i) % total]);
const libres = c.JSEARCH_CUOTA_MES - st.jsearch.usadas;
qs = qs.slice(0, Math.max(0, libres));
if (!qs.length) return [{ json: { _skip: true, fuente: 'jsearch', nota: `cuota mensual agotada (${st.jsearch.usadas}/${c.JSEARCH_CUOTA_MES})` } }];

st.jsearch.usadas += qs.length;
return qs.map((q) => {
  const p = new QS({ query: q.query, num_pages: '1', country: 'es', date_posted: 'week' });
  if (q.work_from_home) p.set('work_from_home', 'true');
  return { json: { _skip: false, fuente: 'jsearch', url: `https://jsearch.p.rapidapi.com/search-v2?${p}`, acumulado_mes: st.jsearch.usadas } };
});
