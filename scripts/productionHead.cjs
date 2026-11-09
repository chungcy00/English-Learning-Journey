const { execFileSync } = require('node:child_process');

// Check at build completion as well as in Vercel's ignored-build step: an older
// queued commit must not overwrite a newer production release.
function productionHeadStatus(env, run) {
  if (env.VERCEL_ENV !== 'production') return 'skip';
  try {
    const options = { encoding: 'utf8', timeout: 12000, stdio: ['ignore', 'pipe', 'pipe'] };
    const current = (env.VERCEL_GIT_COMMIT_SHA || run('git', ['rev-parse', 'HEAD'], options)).trim();
    const remote = run('git', ['ls-remote', 'https://github.com/chungcy00/English-Learning-Journey.git', 'refs/heads/main'], options);
    const latest = remote.trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{40}$/i.test(current) || !/^[a-f0-9]{40}$/i.test(latest)) return 'unverified';
    return current.toLowerCase() === latest.toLowerCase() ? 'current' : 'stale';
  } catch { return 'unverified'; }
}
const ignoredBuildCommand = '[ "$VERCEL_ENV" = production ] || exit 1; deploy_sha=$(git ls-remote https://github.com/chungcy00/English-Learning-Journey.git refs/heads/main | cut -f1); [ -z "$deploy_sha" ] || [ "${VERCEL_GIT_COMMIT_SHA:-$deploy_sha}" != "$deploy_sha" ]';
module.exports = { productionHeadStatus, ignoredBuildCommand };
if (require.main === module) {
  const status = productionHeadStatus(process.env, execFileSync);
  if (status === 'stale' || status === 'unverified') {
    console.error(`Production version check: ${status}. Keeping the existing live deployment.`);
    process.exitCode = 1;
  }
}
