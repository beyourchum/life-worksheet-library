const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { runReported } = require('../../scripts/check/report.cjs');

(async () => {
  const root = path.resolve('.qa/work/general');
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'report-tests-'));
  const file = path.join(directory, 'quality-report.json');
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const log = console.log, errorLog = console.error;
  console.log = console.error = () => {};
  try {
    const success = await runReported(file, { target: 'source', scope: 'EP1' }, async (record) => {
      assert.equal(read().status, 'running');
      await record('正常檢查', async () => ({ result: 'ok' }));
    });
    assert.equal(success.status, 'passed');
    assert.equal(success.checks.length, 1);
    assert(success.startedAt && success.finishedAt && success.runId);
    for (const message of ['瀏覽器啟動失敗', 'JavaScript 執行錯誤', '瀏覽器關閉失敗']) {
      const failed = await runReported(file, { target: 'built', scope: 'all' }, async () => {
        assert.equal(read().status, 'running', '新一輪必須先取代舊的成功狀態');
        assert.notEqual(read().runId, success.runId);
        throw new Error(message);
      });
      assert.equal(failed.status, 'failed');
      assert.deepEqual(failed.failures, [{ name: '驗收執行錯誤', message }]);
      assert.equal(read().status, 'failed');
      assert.equal(read().checks.length, 0);
    }
    const partial = await runReported(file, {}, async (record) => {
      assert.equal(await record('失敗項目', async () => { throw new Error('測試錯誤'); }), false);
      assert.equal(await record('後續項目', async () => '仍須檢查'), true);
    });
    assert.equal(partial.status, 'failed');
    assert.equal(partial.failures.length, 1);
    assert.equal(partial.checks.length, 1);
    for (const [entrypoint, stage] of [['run.cjs', 'static'], ['browser.cjs', 'launch'], ['browser.cjs', 'runtime'], ['browser.cjs', 'cleanup']]) {
      const script = path.resolve('scripts/check', entrypoint);
      const requireFromScript = createRequire(script);
      const processState = { argv: ['node', script, ...(entrypoint === 'browser.cjs' ? ['--source'] : [])], env: {},
        chdir: () => {}, exitCode: 0, stderr: { write: () => {} } };
      let execution, closed = false;
      const browser = { newPage: async () => { throw new Error(`${stage} 測試錯誤`); },
        close: async () => { if (stage === 'cleanup') throw new Error('cleanup 測試錯誤'); } };
      vm.runInNewContext(fs.readFileSync(script, 'utf8'), { __dirname: path.dirname(script), process: processState, URL,
        console: { log: () => {}, error: () => {} },
        require: (name) => {
          if (name === './report.cjs') return { runReported: (_, metadata, run) => (execution = runReported(file, metadata, run)) };
          if (name === 'node:child_process') return { spawnSync: () => ({ status: 1, stderr: 'static 測試錯誤' }) };
          if (name === './server.cjs') return { start: async () => ({ base: 'http://test.invalid', server: { close: (done) => { closed = true; done(); } } }) };
          if (name === 'playwright') return { chromium: { launch: async () => {
            if (stage === 'launch') throw new Error('launch 測試錯誤');
            return browser;
          } } };
          return requireFromScript(name);
        },
      });
      const report = await execution;
      await Promise.resolve();
      assert.equal(report.status, 'failed', `${entrypoint} ${stage} 必須在實際入口留下失敗狀態`);
      assert(report.failures.some((failure) => failure.message.includes(`${stage} 測試錯誤`)));
      assert.equal(processState.exitCode, 1);
      if (entrypoint === 'browser.cjs') assert.equal(closed, true, '啟動或執行失敗仍須關閉測試伺服器');
    }
  } finally {
    console.log = log; console.error = errorLog;
    if (path.dirname(path.resolve(directory)) !== root) throw new Error('測試清理路徑超出專用目錄');
    fs.rmSync(directory, { recursive: true });
  }
  console.log('驗收報告負向測試通過：舊成功、啟動、執行與清理錯誤均有本輪失敗紀錄。');
})().catch((error) => { console.error(error); process.exitCode = 1; });
