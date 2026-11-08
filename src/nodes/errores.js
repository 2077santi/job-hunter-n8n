// Un único mensaje de Telegram con todos los fallos de la ejecución (fuentes + scoring)
const fuentes = $('Unir fuentes').all().map((i) => i.json).filter((x) => x._tipo === 'error');
const scoring = $getWorkflowStaticData('global').ultimoScoring?.errores ?? [];
if (!fuentes.length && !scoring.length) return [];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lineas = ['⚠️ <b>Job hunter: errores en la ejecución</b>',
  ...fuentes.map((e) => `• <b>${esc(e.fuente)}</b>: ${esc(e.mensaje)}`),
  ...scoring.slice(0, 10).map((e) => `• <b>scoring</b>: ${esc(e)}`),
  'El resto de fuentes se ha procesado con normalidad.'];
return [{ json: { texto: lineas.join('\n').slice(0, 4000) } }];
