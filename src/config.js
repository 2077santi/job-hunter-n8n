// ============ CONFIGURACIÓN (lo único que tienes que editar) ============
// Aquí NO van claves: las API keys viven en n8n Credentials.
const CONFIG = {
  SHEET_ID: 'TU_SHEET_ID',
  TELEGRAM_CHAT_ID: 'TU_CHAT_ID',
  // URL con la que tu móvil llega a n8n. Telegram NO acepta IPs en botones:
  // usa un nombre, p.ej. http://192-168-1-50.nip.io:5678 o tu nombre de Tailscale.
  N8N_BASE_URL: 'http://192-168-1-50.nip.io:5678',
  CV_ADAPTER_WORKFLOW_ID: '', // ID del workflow que genera el CV adaptado (vacío = solo aviso)

  SCORE_ALERTA: 75,
  MAX_SCORING_POR_EJECUCION: 40, // tope de llamadas a Claude por ejecución
  MAX_DIAS: 7,
  SALARIO_MIN_NETO_MES: 2000,
  SALARIO_TOLERANCIA: 0.92, // descarta solo si el neto estimado < 2500 * 0.92 (claramente por debajo)
  MODELO: 'claude-haiku-5-5',

  JSEARCH_CUOTA_MES: 190, // plan gratuito = 200
  REMOTIVE_MAX_DIA: 4,
  INFOJOBS_API_ACTIVA: false, // true si tienes client_id/secret de developer.infojobs.net
  APIFY_INFOJOBS_ACTIVO: false, // true cuando elijas actor en Apify Store
  APIFY_INFOJOBS_ACTOR: '', // formato usuario~actor
  APIFY_INFOJOBS_INPUT: { keyword: 'analista operaciones automatización', province: 'barcelona', maxItems: 30 },

  // 6 queries de JSearch: 3 por ejecución (mañana / tarde) -> 180/mes
  JSEARCH_QUERIES: {
    manana: [
      { query: 'AI automation specialist OR n8n OR automatización IA in Barcelona, Spain' },
      { query: 'operations analyst OR business analyst OR process improvement in Barcelona, Spain' },
      { query: 'customer success manager in Barcelona, Spain' },
    ],
    tarde: [
      { query: 'AI automation OR workflow automation OR automatización remote Spain', work_from_home: true },
      { query: 'analista de operaciones OR analista de negocio OR mejora de procesos Barcelona' },
      { query: 'product owner junior OR IT business partner OR automatització in Barcelona, Spain' },
    ],
  },
  ADZUNA_QUERIES: [
    { where: 'Barcelona', what_or: 'automation automatización automatització n8n zapier rpa llm workflow' },
    { where: 'Barcelona', what_or: 'operations analyst analista operaciones business negocio procesos improvement' },
    { where: 'Barcelona', what_or: 'customer success product owner business partner' },
    { what: 'remoto', what_or: 'automatización automation n8n analista operaciones business success' },
  ],
  INFOJOBS_QUERIES: ['automatización', 'analista de operaciones', 'business analyst', 'customer success'],

  // Keywords EN / ES / CA por puesto (para filtros y para el prompt de scoring)
  KEYWORDS: {
    '1': ['AI automation', 'automation specialist', 'workflow automation', 'n8n', 'Make', 'Zapier', 'LLM', 'RPA', 'low-code',
          'automatización', 'automatización con IA', 'especialista en automatización',
          'automatització', 'automatització amb IA'],
    '2': ['operations analyst', 'business analyst', 'process improvement', 'business operations', 'revenue operations',
          'analista de operaciones', 'analista de negocio', 'mejora de procesos', 'mejora continua',
          "analista d'operacions", 'analista de negoci', 'millora de processos'],
    '3': ['customer success', 'customer success manager', 'onboarding specialist', 'implementation specialist',
          'éxito del cliente', 'gestor de clientes', "èxit del client"],
    'bonus': ['product owner', 'junior product owner', 'IT business partner', 'propietario de producto', 'responsable de producto'],
  },

  // Regex (sin acentos, minúsculas) que el TÍTULO debe cumplir para pasar
  RELEVANTES_TITULO: [
    'automat', 'n8n', '\\bmake\\b', 'zapier', 'low.?code', 'no.?code', '\\brpa\\b', 'workflow', '\\bllm', 'gen ?ai',
    '\\bai\\b', '\\bia\\b', 'operation', 'operacion', 'operacio', '\\bops\\b', 'analyst', 'analista', 'process', 'proceso',
    'proces', 'mejora continua', 'millora', 'customer success', 'client success', '\\bcsm\\b', 'success manager',
    'onboarding', 'implementation', 'implantacion', 'product owner', 'business partner', 'revops', 'customer experience',
    '\\bcx\\b', 'transformation', 'transformacion', 'efficiency', 'eficiencia',
  ],
  // Fuera siempre (título)
  EXCLUIR_TITULO: [
    'practicas', 'practiques', 'becari', 'intern\\b', 'internship', 'trainee', 'werkstudent', 'working student', 'minijob',
    'director', 'head of', '\\bstaff\\b', 'architect', 'arquitect', '\\bvp\\b', 'vice president', 'chief', 'principal',
    '\\b(german|deutsch|french|italian|dutch|portuguese|nordic|polish|swedish|danish|norwegian|finnish|japanese|korean|mandarin|chinese|arabic|hebrew|turkish|greek|czech|hungarian|romanian|georgian|russian|ukrainian)\\b',
    'ai trainer', 'trainers network', 'annotator', 'writer', 'copywriter',
    '\\(m/w/d\\)', 'account executive', 'sales (manager|representative|executive)', '\\bsdr\\b', '\\bbdr\\b',
    'telemarketing', 'teleoperador', 'call center', 'customer (support|service) (agent|representative)', 'atencion al cliente',
  ],
  // Fuera salvo que el título también diga automat/n8n/zapier/rpa/workflow/low-code
  EXCLUIR_TITULO_SALVO_AUTOMATIZACION: [
    'software engineer', 'developer', 'desarrollador', 'programador', 'backend', 'frontend', 'full.?stack', 'devops',
    '\\bsre\\b', 'data engineer', 'machine learning engineer', '\\bml engineer', 'data scientist', 'qa engineer', 'tester', '\\bengineer',
  ],
  ANIOS_EXPERIENCIA_MAX: 7, // descarta si piden 8+ años

  CV_PERFIL: `Alex Ejemplo — candidato ficticio de demostración. Sustituye este texto por tu CV.
Busca (prioridad): 1) AI Automation Specialist; 2) Operations / Business Analyst; 3) Customer Success.
Ubicación y salario: ajusta los filtros de esta configuración.
Experiencia (~3 años): analista de operaciones en una empresa ficticia; dashboards, SQL y automatizaciones con n8n y APIs de LLM.
Stack: n8n, Make, Zapier, SQL, Python, Power BI, Google Sheets.
Sin experiencia: Salesforce, SAP.`,
};
// ========================================================================

// Detecta qué trigger ha lanzado la ejecución
const ejecutado = (n) => { try { return $(n).isExecuted ?? $(n).all().length > 0; } catch (e) { return false; } };
let _modo = 'busqueda';
if (ejecutado('Resumen diario 19:00')) _modo = 'resumen';
if (ejecutado('Webhook CV adaptado')) _modo = 'cv';

return [{ json: { ...CONFIG, _modo, _entrada: $input.first()?.json ?? {} } }];
