return [1, 2].map((page) => ({ json: { _skip: false, fuente: 'arbeitnow', url: `https://www.arbeitnow.com/api/job-board-api?page=${page}` } }));
