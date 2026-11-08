return ['spain', 'europe'].map((geo) => ({ json: { _skip: false, fuente: 'jobicy', url: `https://jobicy.com/api/v2/remote-jobs?count=50&geo=${geo}` } }));
