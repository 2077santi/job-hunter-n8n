// Busca alertas desde la última ejecución (marca guardada en static data).
const st = $getWorkflowStaticData('global');
const ahora = Math.floor(Date.now() / 1000);
const desde = st.gmailDesde ?? ahora - 2 * 86400;
st.gmailDesde = ahora;
const remitentes = ['jobalerts-noreply@linkedin.com', 'jobs-noreply@linkedin.com', 'infojobs.net', 'glassdoor.com', 'glassdoor.es'];
return [{ json: { fuente: 'gmail', q: `(${remitentes.map((r) => `from:${r}`).join(' OR ')}) after:${desde}` } }];
