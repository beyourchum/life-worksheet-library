const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python = fs.existsSync(bundled) ? bundled : (process.platform === 'win32' ? 'python' : 'python3');
const result = spawnSync(python, ['tests/unit/scoped-fonts.test.py'], {encoding:'utf8',shell:false});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`單集字型重建回歸失敗：${result.stderr || result.stdout}`);
