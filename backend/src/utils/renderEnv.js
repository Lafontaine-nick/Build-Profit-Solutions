/**
 * Detect Render-hosted runtime. Some images / env groups omit `RENDER=true` but keep
 * `RENDER_SERVICE_ID` or `RENDER_EXTERNAL_URL`; without this, Puppeteer skips the managed Chrome install.
 */
function isRenderHosting() {
  if (process.env.RENDER === 'true' || process.env.RENDER === '1') return true;
  if (String(process.env.RENDER_SERVICE_ID || '').trim()) return true;
  if (/onrender\.com/i.test(String(process.env.RENDER_EXTERNAL_URL || ''))) return true;
  if (String(process.cwd() || '').includes('/opt/render/project')) return true;
  return false;
}

module.exports = { isRenderHosting };
