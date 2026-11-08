// Remotive pide máx. 4 llamadas/día: 1 por ejecución, con contador diario.
const c = $('Config').first().json;
const st = $getWorkflowStaticData('global');
const dia = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
if (!st.remotive || st.remotive.dia !== dia) st.remotive = { dia, usadas: 0 };
if (st.remotive.usadas >= c.REMOTIVE_MAX_DIA) return [{ json: { _skip: true, fuente: 'remotive', nota: 'límite diario alcanzado' } }];
st.remotive.usadas++;
return [{ json: { _skip: false, fuente: 'remotive', url: 'https://remotive.com/api/remote-jobs?limit=150' } }];
