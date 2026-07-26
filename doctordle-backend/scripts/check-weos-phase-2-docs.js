const { spawnSync } = require('node:child_process');

const docs = [
  '../docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md',
  '../docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md',
  '../docs/weos/WEOS-IMP-004-legacy-status-crosswalk.md',
];

function run(command, args) {
  const result = spawnSync(command, args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('node', ['scripts/generate-weos-phase-2-docs.js']);
run('npx', ['prettier', '--write', ...docs]);
run('git', ['diff', '--exit-code', '--', ...docs]);
