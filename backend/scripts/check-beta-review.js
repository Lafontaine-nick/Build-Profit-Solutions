/**
 * Step 5 without curl quoting issues.
 *
 * From backend/:
 *   export BETA_FEEDBACK_ADMIN_KEY='paste-your-key-from-render-here'
 *   node scripts/check-beta-review.js
 *
 * Or one line:
 *   BETA_FEEDBACK_ADMIN_KEY='yourkey' node scripts/check-beta-review.js
 *
 * One row with full screenshot (data URL in item.screenshot_data — use in <img src="...">):
 *   BETA_FEEDBACK_ADMIN_KEY='yourkey' node scripts/check-beta-review.js 2
 */
const https = require('https');

const key = process.env.BETA_FEEDBACK_ADMIN_KEY;
const host = process.env.BETA_REVIEW_HOST || 'build-profit-solutions-backend.onrender.com';
const detailId = process.env.BETA_FEEDBACK_DETAIL_ID || process.argv[2];
const path =
  detailId && /^\d+$/.test(String(detailId).trim())
    ? `/api/beta-feedback/review/detail/${String(detailId).trim()}`
    : '/api/beta-feedback/review?limit=50';

if (!key || !key.trim()) {
  console.error('Set BETA_FEEDBACK_ADMIN_KEY first (same value as on Render).');
  console.error('Example: export BETA_FEEDBACK_ADMIN_KEY=\'yourkey\' && node scripts/check-beta-review.js');
  process.exit(1);
}

const options = {
  hostname: host,
  path,
  method: 'GET',
  headers: {
    'X-Beta-Feedback-Admin-Key': key.trim(),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (c) => {
    body += c;
  });
  res.on('end', () => {
    console.log('HTTP', res.statusCode);
    try {
      console.log(JSON.stringify(JSON.parse(body), null, 2));
    } catch {
      console.log(body);
    }
    if (res.statusCode === 401) {
      console.error('\n401 = key does not match Render BETA_FEEDBACK_ADMIN_KEY (typo, spaces, or wrong deploy).');
    }
    if (res.statusCode === 404) {
      console.error('\n404 = server does not have /api/beta-feedback (push latest code + redeploy Render).');
    }
  });
});

req.on('error', (e) => console.error(e.message));
req.end();
