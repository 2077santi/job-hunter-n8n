# Job Hunter · automatización con n8n y Claude

Proyecto de portfolio: un sistema que busca ofertas de empleo varias veces al día, las normaliza, elimina duplicados, aplica filtros y las puntúa con un LLM frente a un perfil. Guarda el seguimiento en Google Sheets y avisa por Telegram. **No envía candidaturas.**

**Qué demuestra:** workflow de n8n de 59 nodos, integración de 6 API de empleo y correos de alertas, salidas estructuradas con Claude y prompt caching, tolerancia a fallos por fuente, control de cuotas y de coste, y tests de la lógica.

> Los datos de `src/config.js` y los workflows exportados son de ejemplo: el perfil es ficticio y los identificadores son marcadores.
> Web y política de privacidad de la app de Google: [`docs/`](docs/).

---

# Job hunter (n8n)

Busca ofertas 2 veces al día en 6 fuentes y en tus alertas de Gmail. Las filtra sin IA, las puntúa con Claude Haiku 5.5 según tu CV, las guarda en Google Sheets y te avisa por Telegram. **No postula a nada.**

```
08:00 / 18:00 ─┬─ JSearch ─┐
               ├─ Adzuna ──┤
               ├─ InfoJobs ┤ (API oficial o Apify, desactivado por defecto)
               ├─ Remotive ┼─ Unir ─ Dedupe vs Sheets ─ Filtros duros ─ Claude Haiku ─ Sheets ─ Telegram ≥75 (con botón)
               ├─ Arbeitnow┤                                   │
               ├─ Jobicy ──┤                                   ├─ Hoja Uso_API (peticiones, tokens, coste)
               └─ Gmail ───┘ (alertas LinkedIn/InfoJobs/Glassdoor, extraídas con Haiku)
                                                               └─ Telegram: errores por fuente
19:00 ─ Resumen diario (ofertas <75 del día y uso de APIs) ─ Telegram
Botón "Generar CV adaptado" ─ Webhook ─ busca la oferta en Sheets ─ lanza tu workflow adaptador de CV
```

## Archivos

| Archivo | Para qué |
|---|---|
| `workflows/job-hunter.json` | Workflow principal (3 triggers: búsqueda, resumen y webhook del botón). Se importa en n8n. |
| `workflows/job-hunter-errores.json` | Workflow de errores generales (Error Trigger → Telegram). |
| `plantillas/Ofertas.csv`, `plantillas/Uso_API.csv` | Cabeceras de las dos pestañas de la hoja. |
| `src/` | Código de los nodos Code. **El JSON se genera desde aquí** con `node build.mjs`. |
| `test/` | Tests de la lógica y la prueba real de las fuentes. |

Si editas el código de un nodo, hazlo en `src/` y ejecuta `node build.mjs`. Si lo editas directamente en n8n, `src/` deja de reflejar lo que corre.

## 1. Preparación (una vez)

### Google Sheet
1. Crea una hoja nueva con dos pestañas llamadas exactamente **`Ofertas`** y **`Uso_API`**.
2. En cada pestaña pega la fila de cabeceras de su CSV de `plantillas/` (en la fila 1).
3. En `Ofertas`, columna `estado`: Datos → Validación → desplegable con `Por postular, Sin respuesta, Respondido, Entrevista, Descartado`.
4. Copia el ID de la hoja (el trozo de la URL entre `/d/` y `/edit`).

### Telegram
1. Crea un bot con @BotFather y guarda el token.
2. Escribe a tu bot cualquier cosa y saca tu chat id (por ejemplo con @userinfobot).

### Claves de API
- **JSearch**: suscríbete al plan Basic (gratis, 200 req/mes) en RapidAPI → "JSearch" de OpenWeb Ninja. El workflow usa el endpoint `/search-v2` (el antiguo `/search` ya devuelve 404).
- **Adzuna**: crea una app en developer.adzuna.com (`app_id` + `app_key`).
- **Anthropic**: una API key de console.anthropic.com.
- Opcional: **InfoJobs** (developer.infojobs.net, `client_id` + `client_secret`) o **Apify** (token).

## 2. Importar

1. n8n → *Workflows* → *Import from File* → `workflows/job-hunter-errores.json`. Edita el nodo **Mensaje** y pon tu `TELEGRAM_CHAT_ID`. Guarda.
2. Importa `workflows/job-hunter.json`.
3. Abre el nodo **Config** y rellena `SHEET_ID`, `TELEGRAM_CHAT_ID` y `N8N_BASE_URL` (ver sección 4).
4. *Settings* del workflow → *Error workflow* → **Job hunter · errores**.

## 3. Credenciales (n8n → Credentials)

Los nodos llegan apuntando a credenciales que no existen todavía: créalas y selecciónalas en cada nodo marcado en rojo.

| Credencial | Tipo en n8n | Campos | Nodos |
|---|---|---|---|
| RapidAPI JSearch | Header Auth | Name `X-RapidAPI-Key`, Value = tu key | JSearch |
| Adzuna | Custom Auth | `{"qs": {"app_id": "…", "app_key": "…"}}` | Adzuna |
| Anthropic | Anthropic | API key | Claude Haiku: scoring, Claude: extraer ofertas |
| Google Sheets | Google Sheets OAuth2 API | Client ID / Secret de Google Cloud | Leer/Guardar (5 nodos) |
| Gmail | Gmail OAuth2 API | el mismo Client ID / Secret | Gmail: alertas |
| Telegram | Telegram API | token del bot | Telegram: … (5 nodos) |
| Basic auth webhook CV | Basic Auth | usuario y contraseña que tú elijas | Webhook CV adaptado |
| InfoJobs API (opcional) | Basic Auth | client_id / client_secret | InfoJobs API |
| Apify (opcional) | Header Auth | Name `Authorization`, Value `Bearer <token>` | Apify InfoJobs |

Si el tipo "Anthropic" no aparece en el desplegable del HTTP Request, usa Header Auth con Name `x-api-key`.
Si usas OpenWeb Ninja directo en vez de RapidAPI, cambia en `src/nodes/plan_jsearch.js` la URL a `https://api.openwebninja.com/jsearch/search-v2` (comprueba la ruta en su panel) y la credencial a Header Auth `x-api-key`.

### Google OAuth con n8n en IP local (importante)
Google **no acepta una IP privada** (`http://192.168…`) como redirect de OAuth. Para conectar Sheets y Gmail:

1. En Google Cloud: crea un proyecto, activa **Google Sheets API** y **Gmail API**, y configura la pantalla de consentimiento (External, añade tu Gmail como usuario de prueba).
2. Crea un *OAuth client ID* de tipo "Web application" con redirect URI `http://localhost:5678/rest/oauth2-credential/callback`.
3. Abre n8n **por `http://localhost:5678`**, no por la IP:
   - si n8n corre en el mismo Mac, entra directamente por esa URL;
   - si corre en otra máquina, abre un túnel primero: `ssh -L 5678:localhost:5678 usuario@IP` y luego entra por `http://localhost:5678`.
4. Comprueba que el "OAuth Redirect URL" que muestra la credencial empieza por `http://localhost:5678`. Si muestra la IP, tienes `WEBHOOK_URL` o `N8N_EDITOR_BASE_URL` apuntando a la IP: cámbialos a localhost mientras conectas.
5. **Ojo**: con la app en modo *Testing*, Google caduca el token a los 7 días. Para que no caduque, pasa la app a *In production* (sin verificar te saldrá un aviso, pero para uso personal funciona).

## 4. Botón "Generar CV adaptado"

Telegram solo acepta botones con URL de un **nombre de dominio**: rechaza IPs. Pon en `N8N_BASE_URL` una de estas opciones:
- `http://192-168-1-50.nip.io:5678` (cambia por tu IP con guiones). nip.io resuelve ese nombre a tu IP privada. Algunos routers bloquean esa resolución (protección DNS rebinding); si te pasa, usa la siguiente opción.
- Tu nombre de Tailscale (`http://mi-mac.tailXXXX.ts.net:5678`). Además funciona fuera de casa.

Al pulsarlo, el navegador pide el usuario y la contraseña de la credencial Basic Auth y lanza el workflow cuyo ID pongas en `CV_ADAPTER_WORKFLOW_ID`. Ese workflow recibe un item con `oferta` (la fila completa de Sheets: título, empresa, url, motivos, gaps…) y es quien te devuelve el CV por Telegram.

Notas:
- El webhook solo responde con el workflow **activo** (la URL de producción es `/webhook/…`).
- Si Telegram rechaza el botón, el aviso se reenvía sin botón y con el enlace en el texto.

He elegido el botón con URL en vez de botones *callback* con `getUpdates`: Telegram solo permite llamar a `getUpdates` con el token en la URL, y n8n no puede meter una credencial ahí. Habría que poner el token en una variable de entorno, fuera de Credentials.

## 5. Límites y peticiones

| Fuente | Por ejecución | Al mes | Límite |
|---|---|---|---|
| JSearch | 3 (rotan 6 queries mañana/tarde, `date_posted=3days`, 1 página) | ~180 | 200 gratis. Corta a 190 (`JSEARCH_CUOTA_MES`) |
| Adzuna | 4 | ~240 | muy por debajo del plan gratuito |
| Remotive | 1 | ~60 | máx. 4/día (contador diario) |
| Arbeitnow | 2 páginas | ~120 | API pública |
| Jobicy | 2 (spain, europe) | ~120 | API pública |
| Gmail | 1 + 1 llamada a Haiku por correo de alerta | — | — |
| InfoJobs/Apify | 4 (API) o 1 por la mañana (Apify) | — | según el plan |

- Las peticiones HTTP van en lotes con pausa (batching del nodo HTTP) y con 2 reintentos.
- Cada ejecución escribe en **Uso_API** una fila por fuente (peticiones, ofertas, errores), una por cada uso de Claude (tokens y coste) y otra con el embudo de filtros.
- Los contadores de cuota de JSearch y Remotive viven en el *static data* del workflow. n8n solo los guarda en ejecuciones de producción (programadas): las pruebas manuales no los incrementan. La hoja Uso_API sí registra todo.

## 6. Coste de Claude

Haiku 5.5 cuesta 0,10 $/MTok de entrada y 0,50 $/MTok de salida. El system prompt (CV + rúbrica, ~1.250 tokens) va cacheado y se cobra al 10 % en las llamadas siguientes. Cada oferta gasta unos 2–3 k tokens de entrada y ~300 de salida: **menos de 1 $/mes** con ~40 ofertas/día. `MAX_SCORING_POR_EJECUCION` (40) pone el tope.

## 7. Filtros duros (sin IA)

Todo se ajusta en **Config**:
- `RELEVANTES_TITULO`: el título debe contener alguna de estas palabras.
- `EXCLUIR_TITULO`: prácticas, director, otros idiomas, ventas, soporte, etc.
- `EXCLUIR_TITULO_SALVO_AUTOMATIZACION`: perfiles de desarrollo, salvo que el título hable de automatización.
- Ubicación: Barcelona y área metropolitana con cualquier modalidad. Fuera de ahí, solo remoto desde España, Europa, EMEA o worldwide.
- Antigüedad: más de `MAX_DIAS` (7) días, fuera.
- Experiencia: si piden más de `ANIOS_EXPERIENCIA_MAX` (7) años, fuera.
- Salario: si la oferta publica un salario y el neto estimado es menor que `SALARIO_MIN_NETO_MES × SALARIO_TOLERANCIA`, fuera.
  - Si la oferta no publica salario, no se penaliza.
  - Los salarios "estimados" de Adzuna no se usan para descartar.

El scoring de Claude devuelve: `score`, `puesto_categoria` (1/2/3/bonus), `motivos_match`, `gaps`, `salario_estimado_neto_mes`, `salario_por_debajo_minimo`, `red_flags` y `posible_oferta_fantasma`.
- Si `salario_por_debajo_minimo` es true, la oferta se guarda como **Descartado**.
- Las posibles ofertas fantasma se guardan, pero no generan aviso.

## 8. Probar en local

```bash
cp .env.example .env
```

Rellena `.env` (solo para esta prueba; n8n no lo usa). Después:

```bash
node test/probar_fuentes.mjs 3
```

Hace **1 llamada real por fuente** (gasta 1 de JSearch y 1 de Adzuna), aplica los filtros y puntúa 3 ofertas con Haiku. Tests de la lógica, sin red:

```bash
node test/test_fuentes.mjs && node test/test_filtros.mjs && node test/test_pipeline.mjs
```

## Limitaciones conocidas

- n8n ejecuta las ramas "paralelas" una detrás de otra dentro de la misma ejecución. El aislamiento de errores es real (cada petición usa `onError: continue`), pero no hay concurrencia.
- Adzuna solo devuelve unos 500 caracteres de descripción, y las alertas de Gmail no traen descripción. Para estas últimas el prompt limita el score a 80.
- Remotive publica con 24 h de retraso y pocas ofertas. Arbeitnow es sobre todo Alemania. Las fuentes con más volumen útil son JSearch, Adzuna y Gmail.
- El neto se estima con una tabla aproximada. No sustituye a una calculadora de nómina.
