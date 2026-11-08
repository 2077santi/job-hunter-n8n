const plan = $('Plan JSearch').all().map((i) => i.json);
if (plan[0]?._skip) return [{ json: uso('jsearch', 0, 0, 0, plan[0].nota) }];
const out = []; let errores = 0, n = 0;
for (const { json: r } of $input.all()) {
  if (r.error) { errores++; out.push({ json: fallo('jsearch', mensajeError(r.error)) }); continue; }
  // search-v2 devuelve data.jobs (la v1 devolvía data como array)
  for (const j of (Array.isArray(r.data) ? r.data : r.data?.jobs) ?? []) {
    n++;
    out.push({ json: oferta({
      fuente: 'jsearch',
      titulo: j.job_title,
      empresa: j.employer_name,
      ubicacion: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || String(j.job_location ?? '').split('•')[0].trim(),
      pais: j.job_country || 'ES', // la búsqueda ya va con country=es
      remoto: j.job_is_remote === true,
      salario_min: j.job_min_salary, salario_max: j.job_max_salary,
      salario_periodo: j.job_salary_period ?? '', salario_moneda: j.job_salary_currency ?? '',
      salario_texto: j.job_salary_string ?? j.job_salary ?? '',
      fecha: j.job_posted_at_datetime_utc ?? j.job_posted_at_timestamp ?? fechaRelativa(j.job_posted_at),
      url: j.job_apply_link || j.job_google_link,
      descripcion: j.job_description,
    }) });
  }
}
out.push({ json: uso('jsearch', plan.length, n, errores, `acumulado mes: ${plan.at(-1)?.acumulado_mes ?? '?'}`) });
return out;
