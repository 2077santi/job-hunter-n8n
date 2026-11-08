// Fallo general del workflow principal (lo que no captura el manejo por fuente)
const TELEGRAM_CHAT_ID = 'TU_CHAT_ID';
const e = $input.first().json;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const texto = [
  '🛑 <b>Job hunter ha fallado</b>',
  `Workflow: ${esc(e.workflow?.name)}`,
  `Nodo: ${esc(e.execution?.lastNodeExecuted)}`,
  `Error: ${esc(e.execution?.error?.message ?? 'desconocido').slice(0, 500)}`,
  e.execution?.url ? `<a href="${esc(e.execution.url)}">Ver ejecución</a>` : '',
].filter(Boolean).join('\n');
return [{ json: { chatId: TELEGRAM_CHAT_ID, texto } }];
