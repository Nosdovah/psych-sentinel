const https = require('https');
const crypto = require('crypto');

https.get('https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.js', (res) => {
  const hash = crypto.createHash('sha384');
  res.on('data', chunk => hash.update(chunk));
  res.on('end', () => {
    console.log(`sha384-${hash.digest('base64')}`);
  });
});
