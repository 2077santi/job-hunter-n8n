// Monta los workflows de n8n a partir de src/ -> workflows/*.json
// Uso: node build.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';

const leer = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const LIBS = { common: leer('src/lib/common.js'), salario: leer('src/lib/salario.js') };
const codigo = (file, libs = ['common']) => [...libs.map((l) => LIBS[l]), leer(`src/nodes/${file}`)].join('\n');
const uuid = () => crypto.randomUUID();
const CFG = '$("Config").first().json';

const nodes = [];
const connections = {};
const nodo = (name, type, typeVersion, position, parameters, extra = {}) => {
  nodes.push({ id: uuid(), name, type, typeVersion, position, parameters, ...extra });
  return name;
};
// conecta(origen, destino, salidaOrigen, entradaDestino)
const conecta = (from, to, out = 0, input = 0) => {
  connections[from] ??= { main: [] };
  while (connections[from].main.length <= out) connections[from].main.push([]);
  connections[from].main[out].push({ node: to, type: 'main', index: input });
};

// ---------- tipos de nodo reutilizables ----------
const code = (name, pos, file, libs, extra) => nodo(name, 'n8n-nodes-base.code', 2, pos, { jsCode: codigo(file, libs) }, extra);
const cond = (left, op) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [{ id: uuid(), leftValue: left, rightValue: '', operator: op }],
    combinator: 'and',
  },
  looseTypeValidation: true,
  options: {},
});
const siVerdadero = (name, pos, expr) => nodo(name, 'n8n-nodes-base.if', 2.2, pos,
  cond(expr, { type: 'boolean', operation: 'true', singleValue: true }));
const REINTENTOS = { retryOnFail: true, maxTries: 2, waitBetweenTries: 5000, onError: 'continueRegularOutput' };
const http = (name, pos, { method = 'GET', auth, headers, body, batch = [1, 1000], timeout = 30000, extra = {} }) => {
  const p = { method, url: '={{ $json.url }}', options: { timeout, batching: { batch: { batchSize: batch[0], batchInterval: batch[1] } } } };
  const creds = {};
  if (auth?.generic) { p.authentication = 'genericCredentialType'; p.genericAuthType = auth.generic; creds[auth.generic] = { id: auth.id, name: auth.name }; }
  if (auth?.predefined) { p.authentication = 'predefinedCredentialType'; p.nodeCredentialType = auth.predefined; creds[auth.predefined] = { id: auth.id, name: auth.name }; }
  if (headers) { p.sendHeaders = true; p.headerParameters = { parameters: Object.entries(headers).map(([name, value]) => ({ name, value })) }; }
  if (body) { p.sendBody = true; p.specifyBody = 'json'; p.jsonBody = body; }
  return nodo(name, 'n8n-nodes-base.httpRequest', 4.2, pos, p, { ...REINTENTOS, ...(Object.keys(creds).length ? { credentials: creds } : {}), ...extra });
};
const SHEET_DOC = { __rl: true, mode: 'id', value: `={{ ${CFG}.SHEET_ID }}` };
const CRED_SHEETS = { googleSheetsOAuth2Api: { id: 'jh-sheets', name: 'Google Sheets (job hunter)' } };
const CRED_TELEGRAM = { telegramApi: { id: 'jh-telegram', name: 'Telegram bot (job hunter)' } };
const sheetLeer = (name, pos, hoja) => nodo(name, 'n8n-nodes-base.googleSheets', 4.5, pos,
  { operation: 'read', documentId: SHEET_DOC, sheetName: { __rl: true, mode: 'name', value: hoja }, options: {} },
  { credentials: CRED_SHEETS, executeOnce: true, alwaysOutputData: true });
const sheetAnadir = (name, pos, hoja) => nodo(name, 'n8n-nodes-base.googleSheets', 4.5, pos,
  { operation: 'append', documentId: SHEET_DOC, sheetName: { __rl: true, mode: 'name', value: hoja },
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: hoja === 'Uso_API' ? { cellFormat: 'RAW' } : {} },
  { credentials: CRED_SHEETS, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 });
const telegram = (name, pos, text, extraParams = {}, extra = {}) => nodo(name, 'n8n-nodes-base.telegram', 1.2, pos, {
  chatId: `={{ ${CFG}.TELEGRAM_CHAT_ID }}`, text,
  additionalFields: { parse_mode: 'HTML', disable_web_page_preview: true, appendAttribution: false }, ...extraParams,
}, { credentials: CRED_TELEGRAM, ...extra });
const nota = (pos, content, width, height, color = 7) => nodo(`Nota ${nodes.length}`, 'n8n-nodes-base.stickyNote', 1, pos, { content, width, height, color });

// ================= TRIGGERS + CONFIG =================
nodo('Búsqueda 08:00 y 18:00', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 600],
  { rule: { interval: [{ field: 'cronExpression', expression: '0 8,18 * * *' }] } });
nodo('Resumen diario 19:00', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 1500],
  { rule: { interval: [{ field: 'cronExpression', expression: '0 19 * * *' }] } });
nodo('Webhook CV adaptado', 'n8n-nodes-base.webhook', 2, [0, 1800],
  { httpMethod: 'GET', path: 'cv-adaptado', authentication: 'basicAuth', responseMode: 'responseNode', options: {} },
  { webhookId: uuid(), credentials: { httpBasicAuth: { id: 'jh-basic', name: 'Basic auth webhook CV (job hunter)' } } });
nodo('Config', 'n8n-nodes-base.code', 2, [240, 1500], { jsCode: leer('src/config.js') });
['Búsqueda 08:00 y 18:00', 'Resumen diario 19:00', 'Webhook CV adaptado'].forEach((t) => conecta(t, 'Config'));

const regla = (valor, salida) => ({
  conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: uuid(), leftValue: '={{ $json._modo }}', rightValue: valor, operator: { type: 'string', operation: 'equals' } }], combinator: 'and' },
  renameOutput: true, outputKey: salida,
});
nodo('Modo', 'n8n-nodes-base.switch', 3.2, [460, 1500],
  { rules: { values: [regla('busqueda', 'Búsqueda'), regla('resumen', 'Resumen'), regla('cv', 'CV adaptado')] }, options: {} });
conecta('Config', 'Modo');

// ================= FUENTES =================
const X0 = 760, X1 = 1000, X2 = 1240, X3 = 1480, X4 = 1720;
const fila = (i) => i * 190;

// 0 JSearch
code('Plan JSearch', [X0, fila(0)], 'plan_jsearch.js', ['common']);
siVerdadero('¿Saltar JSearch?', [X1, fila(0)], '={{ $json._skip }}');
http('JSearch', [X2, fila(0) + 60], { auth: { generic: 'httpHeaderAuth', id: 'jh-rapidapi', name: 'RapidAPI JSearch (X-RapidAPI-Key)' },
  headers: { 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }, batch: [1, 1500] });
code('Norm JSearch', [X3, fila(0)], 'norm_jsearch.js');
conecta('Plan JSearch', '¿Saltar JSearch?'); conecta('¿Saltar JSearch?', 'Norm JSearch', 0); conecta('¿Saltar JSearch?', 'JSearch', 1); conecta('JSearch', 'Norm JSearch');

// 1 Adzuna
code('Plan Adzuna', [X0, fila(1)], 'plan_adzuna.js', ['common']);
http('Adzuna', [X2, fila(1)], { auth: { generic: 'httpCustomAuth', id: 'jh-adzuna', name: 'Adzuna (app_id + app_key)' }, batch: [1, 2500] });
code('Norm Adzuna', [X3, fila(1)], 'norm_adzuna.js');
conecta('Plan Adzuna', 'Adzuna'); conecta('Adzuna', 'Norm Adzuna');

// 2 InfoJobs (API oficial o Apify)
code('Plan InfoJobs', [X0, fila(2)], 'plan_infojobs.js', ['common']);
siVerdadero('¿Saltar InfoJobs?', [X1, fila(2)], '={{ $json._skip }}');
nodo('¿API oficial?', 'n8n-nodes-base.if', 2.2, [X2 - 120, fila(2) + 90],
  cond('={{ $json.modo }}', { type: 'string', operation: 'equals', rightValue: 'api' }));
nodes.at(-1).parameters.conditions.conditions[0].rightValue = 'api';
http('InfoJobs API', [X2 + 60, fila(2) + 30], { auth: { generic: 'httpBasicAuth', id: 'jh-infojobs', name: 'InfoJobs API (client_id / client_secret)' }, batch: [1, 1000] });
http('Apify InfoJobs', [X2 + 60, fila(2) + 150], { method: 'POST', auth: { generic: 'httpHeaderAuth', id: 'jh-apify', name: 'Apify (Authorization: Bearer)' },
  body: '={{ JSON.stringify($json.input) }}', timeout: 200000 });
code('Norm InfoJobs', [X3, fila(2)], 'norm_infojobs.js');
conecta('Plan InfoJobs', '¿Saltar InfoJobs?'); conecta('¿Saltar InfoJobs?', 'Norm InfoJobs', 0); conecta('¿Saltar InfoJobs?', '¿API oficial?', 1);
conecta('¿API oficial?', 'InfoJobs API', 0); conecta('¿API oficial?', 'Apify InfoJobs', 1);
conecta('InfoJobs API', 'Norm InfoJobs'); conecta('Apify InfoJobs', 'Norm InfoJobs');

// 3 Remotive
code('Plan Remotive', [X0, fila(3) + 60], 'plan_remotive.js', []);
siVerdadero('¿Saltar Remotive?', [X1, fila(3) + 60], '={{ $json._skip }}');
http('Remotive', [X2, fila(3) + 120], { timeout: 60000 });
code('Norm Remotive', [X3, fila(3) + 60], 'norm_remotive.js');
conecta('Plan Remotive', '¿Saltar Remotive?'); conecta('¿Saltar Remotive?', 'Norm Remotive', 0); conecta('¿Saltar Remotive?', 'Remotive', 1); conecta('Remotive', 'Norm Remotive');

// 4 Arbeitnow
code('Plan Arbeitnow', [X0, fila(4) + 60], 'plan_arbeitnow.js', []);
http('Arbeitnow', [X2, fila(4) + 60], { batch: [1, 2000], timeout: 60000 });
code('Norm Arbeitnow', [X3, fila(4) + 60], 'norm_arbeitnow.js');
conecta('Plan Arbeitnow', 'Arbeitnow'); conecta('Arbeitnow', 'Norm Arbeitnow');

// 5 Jobicy
code('Plan Jobicy', [X0, fila(5) + 60], 'plan_jobicy.js', []);
http('Jobicy', [X2, fila(5) + 60], { batch: [1, 2000] });
code('Norm Jobicy', [X3, fila(5) + 60], 'norm_jobicy.js');
conecta('Plan Jobicy', 'Jobicy'); conecta('Jobicy', 'Norm Jobicy');

// 6 Gmail (alertas LinkedIn / InfoJobs / Glassdoor)
const ANTHROPIC = { predefined: 'anthropicApi', id: 'jh-anthropic', name: 'Anthropic (job hunter)' };
const ANTHROPIC_HEADERS = { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
code('Plan Gmail', [X0, fila(6) + 60], 'plan_gmail.js', []);
nodo('Gmail: alertas', 'n8n-nodes-base.gmail', 2.1, [X1, fila(6) + 60],
  { operation: 'getAll', returnAll: false, limit: 25, simple: false, filters: { q: '={{ $json.q }}' }, options: { downloadAttachments: false } },
  { credentials: { gmailOAuth2: { id: 'jh-gmail', name: 'Gmail (job hunter)' } }, alwaysOutputData: true, ...REINTENTOS });
code('Preparar correos', [X2 - 60, fila(6) + 60], 'prep_gmail.js');
siVerdadero('¿Sin correos?', [X2 + 120, fila(6) + 60], '={{ $json._skip }}');
http('Claude: extraer ofertas', [X3 - 60, fila(6) + 150], { method: 'POST', url: 'https://api.anthropic.com/v1/messages', auth: ANTHROPIC,
  headers: ANTHROPIC_HEADERS, body: '={{ JSON.stringify($json.body) }}', batch: [2, 1000], timeout: 120000 });
nodes.at(-1).parameters.url = 'https://api.anthropic.com/v1/messages';
code('Norm Gmail', [X3 + 160, fila(6) + 60], 'norm_gmail.js');
conecta('Plan Gmail', 'Gmail: alertas'); conecta('Gmail: alertas', 'Preparar correos'); conecta('Preparar correos', '¿Sin correos?');
conecta('¿Sin correos?', 'Norm Gmail', 0); conecta('¿Sin correos?', 'Claude: extraer ofertas', 1); conecta('Claude: extraer ofertas', 'Norm Gmail');

const PLANES = ['Plan JSearch', 'Plan Adzuna', 'Plan InfoJobs', 'Plan Remotive', 'Plan Arbeitnow', 'Plan Jobicy', 'Plan Gmail'];
PLANES.forEach((p) => conecta('Modo', p, 0));
const NORMS = ['Norm JSearch', 'Norm Adzuna', 'Norm InfoJobs', 'Norm Remotive', 'Norm Arbeitnow', 'Norm Jobicy', 'Norm Gmail'];
nodo('Unir fuentes', 'n8n-nodes-base.merge', 3, [X4 + 120, 600], { numberInputs: 7 });
NORMS.forEach((n, i) => conecta(n, 'Unir fuentes', 0, i));

// ================= DEDUPE, FILTROS, SCORING =================
const Y = 600, XA = X4 + 360;
sheetLeer('Leer ofertas guardadas', [XA, Y], 'Ofertas');
code('Dedupe y filtros', [XA + 220, Y], 'dedupe_filtros.js', ['common', 'salario'], { alwaysOutputData: true });
code('Preparar scoring', [XA + 440, Y - 160], 'prep_scoring.js', []);
http('Claude Haiku: scoring', [XA + 660, Y - 160], { method: 'POST', auth: ANTHROPIC, headers: ANTHROPIC_HEADERS,
  body: '={{ JSON.stringify($json.body) }}', batch: [5, 2000], timeout: 120000 });
nodes.at(-1).parameters.url = 'https://api.anthropic.com/v1/messages';
code('Parsear score', [XA + 880, Y - 160], 'parse_score.js');
sheetAnadir('Guardar ofertas', [XA + 1100, Y - 160], 'Ofertas');
code('Preparar alertas', [XA + 1320, Y - 160], 'alertas.js', []);
telegram('Telegram: alerta ≥75', [XA + 1540, Y - 160], '={{ $json.texto }}', {
  replyMarkup: 'inlineKeyboard',
  inlineKeyboard: { rows: [{ row: { buttons: [{ text: '📄 Generar CV adaptado', additionalFields: { url: '={{ $json.cv_url }}' } }] } }] },
}, { onError: 'continueErrorOutput' });
telegram('Telegram: alerta (sin botón)', [XA + 1760, Y - 60],
  `={{ $('Preparar alertas').item.json.texto }}\n\n📄 CV adaptado: {{ $('Preparar alertas').item.json.cv_url }}`, {}, { onError: 'continueRegularOutput' });
code('Registrar uso', [XA + 440, Y + 40], 'registrar_uso.js', []);
sheetAnadir('Guardar uso', [XA + 660, Y + 40], 'Uso_API');
code('Errores de la ejecución', [XA + 440, Y + 220], 'errores.js', []);
telegram('Telegram: errores', [XA + 660, Y + 220], '={{ $json.texto }}', {}, { onError: 'continueRegularOutput' });

conecta('Unir fuentes', 'Leer ofertas guardadas'); conecta('Leer ofertas guardadas', 'Dedupe y filtros');
// El orden importa (v1 ejecuta ramas de arriba a abajo): scoring -> uso -> errores
conecta('Dedupe y filtros', 'Preparar scoring'); conecta('Dedupe y filtros', 'Registrar uso'); conecta('Dedupe y filtros', 'Errores de la ejecución');
conecta('Preparar scoring', 'Claude Haiku: scoring'); conecta('Claude Haiku: scoring', 'Parsear score'); conecta('Parsear score', 'Guardar ofertas');
conecta('Guardar ofertas', 'Preparar alertas'); conecta('Preparar alertas', 'Telegram: alerta ≥75');
conecta('Telegram: alerta ≥75', 'Telegram: alerta (sin botón)', 1);
conecta('Registrar uso', 'Guardar uso'); conecta('Errores de la ejecución', 'Telegram: errores');

// ================= RESUMEN DIARIO =================
sheetLeer('Leer ofertas (resumen)', [760, 1500], 'Ofertas');
sheetLeer('Leer uso (resumen)', [1000, 1500], 'Uso_API');
code('Montar resumen', [1240, 1500], 'resumen.js', []);
telegram('Telegram: resumen', [1480, 1500], '={{ $json.texto }}');
conecta('Modo', 'Leer ofertas (resumen)', 1); conecta('Leer ofertas (resumen)', 'Leer uso (resumen)');
conecta('Leer uso (resumen)', 'Montar resumen'); conecta('Montar resumen', 'Telegram: resumen');

// ================= BOTÓN "GENERAR CV ADAPTADO" =================
sheetLeer('Leer ofertas (CV)', [760, 1800], 'Ofertas');
code('Buscar oferta', [1000, 1800], 'cv_buscar.js', []);
siVerdadero('¿Oferta encontrada?', [1240, 1800], '={{ $json.ok }}');
nodo('Lanzar adaptador de CV', 'n8n-nodes-base.executeWorkflow', 1.1, [1480, 1740],
  { source: 'database', workflowId: { __rl: true, mode: 'id', value: `={{ ${CFG}.CV_ADAPTER_WORKFLOW_ID }}` }, options: { waitForSubWorkflow: false } },
  { onError: 'continueRegularOutput' });
nodo('Responder al navegador', 'n8n-nodes-base.respondToWebhook', 1.1, [1720, 1800],
  { respondWith: 'text', responseBody: '={{ $("Buscar oferta").first().json.html }}',
    options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } } });
conecta('Modo', 'Leer ofertas (CV)', 2); conecta('Leer ofertas (CV)', 'Buscar oferta'); conecta('Buscar oferta', '¿Oferta encontrada?');
conecta('¿Oferta encontrada?', 'Lanzar adaptador de CV', 0); conecta('¿Oferta encontrada?', 'Responder al navegador', 1);
conecta('Lanzar adaptador de CV', 'Responder al navegador');

// ================= NOTAS =================
nota([-40, -260], `## Job hunter\n1. Edita **Config** (SHEET_ID, TELEGRAM_CHAT_ID, N8N_BASE_URL).\n2. Asigna credenciales en los nodos marcados en rojo.\n3. En Settings → Error workflow elige **Job hunter · errores**.\n4. Activa el workflow.\n\nDetalle en README.md. Nada de postulación automática.`, 520, 240, 4);
nota([X0 - 40, -260], `### Fuentes y límites\n- JSearch: 3 req/ejecución, cuota mensual en static data (190)\n- Adzuna: 4 req/ejecución\n- InfoJobs: API oficial o Apify (desactivado por defecto)\n- Remotive: 1 req/ejecución (máx. 4/día)\n- Arbeitnow: 2 páginas · Jobicy: 2 geos\n- Gmail: alertas desde la última ejecución\nCada fuente falla de forma aislada (onError → continue).`, 620, 240, 5);

const principal = {
  name: 'Job hunter · búsqueda y scoring',
  nodes, connections, pinData: {},
  settings: { executionOrder: 'v1', timezone: 'Europe/Madrid', saveManualExecutions: true, saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', callerPolicy: 'workflowsFromSameOwner' },
  meta: { templateCredsSetupCompleted: false }, tags: [],
};

// ================= WORKFLOW DE ERRORES =================
const errNodes = [
  { id: uuid(), name: 'Error Trigger', type: 'n8n-nodes-base.errorTrigger', typeVersion: 1, position: [0, 0], parameters: {} },
  { id: uuid(), name: 'Mensaje', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0], parameters: { jsCode: leer('src/nodes/error_workflow.js') } },
  { id: uuid(), name: 'Telegram', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [440, 0], credentials: CRED_TELEGRAM,
    parameters: { chatId: '={{ $json.chatId }}', text: '={{ $json.texto }}', additionalFields: { parse_mode: 'HTML', disable_web_page_preview: true, appendAttribution: false } } },
];
const errores = {
  name: 'Job hunter · errores', nodes: errNodes, pinData: {},
  connections: { 'Error Trigger': { main: [[{ node: 'Mensaje', type: 'main', index: 0 }]] }, Mensaje: { main: [[{ node: 'Telegram', type: 'main', index: 0 }]] } },
  settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' }, meta: {}, tags: [],
};

fs.mkdirSync(new URL('workflows/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('workflows/job-hunter.json', import.meta.url), JSON.stringify(principal, null, 2));
fs.writeFileSync(new URL('workflows/job-hunter-errores.json', import.meta.url), JSON.stringify(errores, null, 2));
console.log(`OK: ${nodes.length} nodos en job-hunter.json, ${errNodes.length} en job-hunter-errores.json`);
