// Busca la oferta pedida desde el botón de Telegram
const c = $('Config').first().json;
const id = String(c._entrada?.query?.id ?? '');
const fila = $input.all().map((i) => i.json).find((r) => String(r.id) === id);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pagina = (titulo, cuerpo) => `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CV adaptado</title><body style="font-family:system-ui;max-width:560px;margin:40px auto;padding:0 16px"><h2>${titulo}</h2><p>${cuerpo}</p></body></html>`;
if (!fila) return [{ json: { ok: false, html: pagina('Oferta no encontrada', `No hay ninguna oferta con id <code>${esc(id)}</code> en la hoja.`) } }];
if (!c.CV_ADAPTER_WORKFLOW_ID) return [{ json: { ok: false, html: pagina('Falta configurar el adaptador', 'Rellena <code>CV_ADAPTER_WORKFLOW_ID</code> en el nodo Config.') } }];
return [{ json: { ok: true, oferta: fila, html: pagina('Generando CV adaptado…', `<b>${esc(fila.titulo)}</b> — ${esc(fila.empresa)}<br>Te llegará por Telegram cuando esté listo. Puedes cerrar esta pestaña.`) } }];
