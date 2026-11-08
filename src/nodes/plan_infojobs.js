// Usa la API oficial si está activa; si no, el actor de Apify; si ninguno, se salta.
const c = $('Config').first().json;
const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
if (c.INFOJOBS_API_ACTIVA) {
  return c.INFOJOBS_QUERIES.map((q) => ({ json: { _skip: false, modo: 'api', fuente: 'infojobs',
    url: `https://api.infojobs.net/api/9/offer?${new QS({ q, province: 'barcelona', sinceDate: '_7_DAYS', maxResults: '50', order: 'updated-desc' })}` } }));
}
// Apify solo en la ejecución de la mañana para no gastar crédito
if (c.APIFY_INFOJOBS_ACTIVO && c.APIFY_INFOJOBS_ACTOR && Number(ahora.slice(11, 13)) < 13) {
  return [{ json: { _skip: false, modo: 'apify', fuente: 'infojobs',
    url: `https://api.apify.com/v2/acts/${c.APIFY_INFOJOBS_ACTOR}/run-sync-get-dataset-items?timeout=180`,
    input: c.APIFY_INFOJOBS_INPUT } }];
}
return [{ json: { _skip: true, fuente: 'infojobs', nota: c.APIFY_INFOJOBS_ACTIVO ? 'Apify solo por la mañana' : 'desactivado (llegan por alertas de Gmail)' } }];
