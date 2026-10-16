const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {start}=require('../../scripts/check/server.cjs');
(async()=>{
const work=path.resolve('.qa/work/general');fs.mkdirSync(work,{recursive:true});
const root=fs.mkdtempSync(path.join(work,'server-snapshot-'));let server;
try{
fs.writeFileSync(path.join(root,'index.html'),'before');
const started=await start(root,{snapshot:true});server=started.server;
assert.equal(await (await fetch(started.base)).text(),'before');assert(started.snapshotUnchanged());
fs.writeFileSync(path.join(root,'index.html'),'after');
assert.equal(await (await fetch(started.base)).text(),'before','驗收須固定讀取開始時的建置產物');
assert.equal(started.snapshotUnchanged(),false,'不能把驗收期間的產物變更當成相同版本');
fs.writeFileSync(path.join(root,'added.html'),'new');
assert.equal((await fetch(started.base+'/added.html')).status,404);
fs.writeFileSync(path.join(root,'index.html'),'before');fs.unlinkSync(path.join(root,'added.html'));
assert(started.snapshotUnchanged());
}finally{
if(server)await new Promise(resolve=>server.close(resolve));
const resolved=fs.realpathSync(root);assert(resolved.startsWith(fs.realpathSync(work)+path.sep));
fs.rmSync(resolved,{recursive:true});
}
})().catch(error=>{console.error(error);process.exitCode=1;});
