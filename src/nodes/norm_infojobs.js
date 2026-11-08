// Acepta la respuesta de la API oficial ({offers:[...]}) o items sueltos de un actor de Apify (nombres de campo variables)
const plan = $('Plan InfoJobs').all().map((i) => i.json);
if (plan[0]?._skip) return [{ json: uso('infojobs', 0, 0, 0, plan[0].nota) }];
const v = (o, ...ks) => { for (const k of ks) { const x = k.split('.').reduce((a, p) => a?.[p], o); if (x !== undefined && x !== null && x !== '') return x?.value ?? x; } return ''; };
const out = []; let errores = 0, n = 0;
for (const { json: r } of $input.all()) {
  if (r.error) { errores++; out.push({ json: fallo('infojobs', mensajeError(r.error)) }); continue; }
  for (const j of r.offers ?? [r]) {
    if (!v(j, 'title', 'titulo', 'jobTitle')) continue;
    n++;
    const tele = String(v(j, 'teleworking', 'teletrabajo', 'workMode')).toLowerCase();
    out.push({ json: oferta({
      fuente: 'infojobs',
      titulo: v(j, 'title', 'titulo', 'jobTitle'),
      empresa: v(j, 'author.name', 'company', 'companyName', 'empresa'),
      ubicacion: [v(j, 'city', 'ciudad', 'location'), v(j, 'province', 'provincia')].filter(Boolean).join(', '),
      pais: 'ES',
      modalidad: /remot|teletrabajo|solo teletrabajo/.test(tele) ? 'remoto' : /hibrid|híbrid/.test(tele) ? 'híbrido' : undefined,
      salario_min: v(j, 'salaryMin', 'salaryMinValue'), salario_max: v(j, 'salaryMax', 'salaryMaxValue'),
      salario_periodo: /mes|month/i.test(v(j, 'salaryPeriod')) ? 'month' : 'year', salario_moneda: 'EUR',
      salario_texto: v(j, 'salaryDescription', 'salary', 'salario'),
      fecha: v(j, 'published', 'updated', 'publishedAt', 'date'),
      url: v(j, 'link', 'url', 'offerUrl'),
      descripcion: stripHtml(v(j, 'description', 'descripcion', 'requirementMin')),
    }) });
  }
}
out.push({ json: uso('infojobs', plan.length, n, errores, plan[0]?.modo) });
return out;
