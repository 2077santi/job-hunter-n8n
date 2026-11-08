const c = $('Config').first().json;
return c.ADZUNA_QUERIES.map((q) => {
  const p = new QS({ results_per_page: '50', max_days_old: String(c.MAX_DIAS), sort_by: 'date', 'content-type': 'application/json' });
  for (const [k, v] of Object.entries(q)) p.set(k, v);
  if (q.where) p.set('distance', '30');
  return { json: { _skip: false, fuente: 'adzuna', url: `https://api.adzuna.com/v1/api/jobs/es/search/1?${p}` } };
});
