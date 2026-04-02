/**
 * One-time: creates beta_feedback + app_telemetry_events on your Postgres.
 *
 * EASIEST (no .env edit): from the backend folder run:
 *   DATABASE_URL="paste_RENDER_EXTERNAL_URL_here" node scripts/run-beta-feedback-migration.js
 *
 * Render External URL is under Postgres → Connect → External.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url || !String(url).startsWith('postgres')) {
  console.error('Missing DATABASE_URL.');
  console.error('Run: DATABASE_URL="your-external-url" node scripts/run-beta-feedback-migration.js');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '..', 'database', 'beta_feedback.sql');
const raw = fs.readFileSync(sqlPath, 'utf8');
const withoutLineComments = raw.replace(/--[^\n]*/g, '');
const statements = withoutLineComments
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: url.includes('render.com') || url.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  console.log('Connected. Running migration...');
  for (let i = 0; i < statements.length; i++) {
    const q = `${statements[i]};`;
    await client.query(q);
    console.log(`OK ${i + 1}/${statements.length}`);
  }
  await client.end();
  console.log('Done. Tables beta_feedback and app_telemetry_events are ready.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
