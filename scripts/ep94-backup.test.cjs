const assert = require('node:assert/strict');
async function testEp94Backup(page, base) {
  await page.goto(base + '/worksheets/EP94/');
  const input=id=>page.locator('#ep94-'+id);
  const fill=(id,value)=>input(id).fill(value);
  const value=id=>input(id).inputValue();
  const results=['work-finish','work-start','money-reserve','money-limit','time-total','time-depart'];
  for(const id of results) assert.equal(await value(id),'');
  await fill('work-hours','1.5');await fill('work-due','2026-10-10T11:00');await fill('work-buffer-hours','24');
  assert.equal(await value('work-start'),''); // A buffer choice must be explicit.
  await input('work-mode-hours').check();
  assert.equal(await value('work-finish'),'2026/10/09 11:00');assert.equal(await value('work-start'),'2026/10/09 09:30');
  await input('work-mode-percent').check();assert.equal(await value('work-start'),'');
  await fill('work-percent','20');assert.equal(await value('work-finish'),'2026/10/10 10:42');assert.equal(await value('work-start'),'2026/10/10 09:12');
  await fill('work-hours','2');assert.equal(await value('work-start'),'2026/10/10 08:36');
  for(const invalid of ['0','-1','']) {await fill('work-hours',invalid);assert.equal(await value('work-start'),'');assert.equal(await value('work-finish'),'');}
  await fill('work-hours','1.5');await fill('work-percent','-1');assert.equal(await value('work-start'),'');
  await fill('work-percent','0');assert.equal(await value('work-finish'),'2026/10/10 11:00');
  await fill('work-due','');assert.equal(await value('work-start'),'');await fill('work-due','2026-10-10T11:00');
  await fill('money-income','35000');await fill('money-percent','20');assert.equal(await value('money-limit'),'28000');assert.equal(await value('money-reserve'),'7000');
  await fill('money-income','1001');assert.equal(await value('money-limit'),'800');assert.equal(await value('money-reserve'),'200.2');
  await fill('money-income','101');await fill('money-percent','33.333');assert.equal(await value('money-reserve'),'33.67');assert.equal(await value('money-limit'),'67');
  await fill('money-income','1001');
  for(const invalid of ['101','-1','']) {await fill('money-percent',invalid);assert.equal(await value('money-limit'),'');}
  await fill('money-percent','100');assert.equal(await value('money-limit'),'0');
  await fill('money-percent','0');assert.equal(await value('money-limit'),'1001');
  await fill('money-income','-1');assert.equal(await value('money-limit'),'');
  await fill('money-income','100.5');assert.equal(await value('money-limit'),'');
  await fill('money-income','1e30');assert.equal(await value('money-limit'),'');
  await fill('money-income','35000');await fill('money-percent','20');
  await fill('time-arrival','2026-10-10T15:00');await fill('time-place','機場櫃檯');await fill('time-minutes','85');await fill('time-percent','10');
  assert.equal(await value('time-total'),'94');assert.equal(await value('time-depart'),'2026/10/10 13:26');
  await fill('time-arrival','2026-10-10T00:30');assert.equal(await value('time-depart'),'2026/10/09 22:56');
  for(const invalid of ['-1','']) {await fill('time-minutes',invalid);assert.equal(await value('time-total'),'');assert.equal(await value('time-depart'),'');}
  await fill('time-minutes','85');await fill('time-percent','-1');assert.equal(await value('time-depart'),'');await fill('time-percent','10');
  // Every original group supports simultaneous selection and a paired other answer.
  for(const group of await page.locator('.choices:not(.ep94-mode)').all()) {
    const boxes=await group.locator('input[type=checkbox]').all();for(const box of boxes)await box.check();
    await group.locator('.other-input').fill('依自己的情境安排');
  }
  await page.reload();assert.equal(await value('time-depart'),'2026/10/09 22:56');assert.equal(await value('money-limit'),'28000');
  assert.equal(await page.locator('input[type=checkbox]:checked').count(),33);
  assert.equal(await page.locator('.other-input').first().inputValue(),'依自己的情境安排');
  await page.evaluate(()=>document.fonts.ready);
  await page.emulateMedia({media:'print'});
  await page.pdf({path:'.qa/reports/EP94-filled.pdf',preferCSSPageSize:true,printBackground:true});
  for(const pageBox of await page.locator('.worksheet-page').all()) assert(await pageBox.evaluate(el=>el.scrollHeight<=el.clientHeight+2));
  await page.emulateMedia({media:'screen'});
  page.once('dialog',d=>d.dismiss());await page.locator('[data-clear]').click();assert.equal(await value('money-limit'),'28000');
  page.once('dialog',d=>d.accept());await page.locator('[data-clear]').click();
  for(const id of results)assert.equal(await value(id),'');assert.equal(await page.locator('input:checked').count(),0);
  await page.reload();for(const id of results)assert.equal(await value(id),'');
  await page.evaluate(()=>sessionStorage.setItem('worksheet:EP94:draft-v1',JSON.stringify({'ep94-work-backup':{value:'原本工作備案'},'ep94-money-backup':{value:'原本金錢備案'},'ep94-time-backup':{value:'原本時間備案'}})));
  await page.reload();for(const kind of ['work','money','time']){assert(await input(kind+'-legacy').isVisible());assert((await value(kind+'-backup')).startsWith('原本'));}
  page.once('dialog',d=>d.accept());await page.locator('[data-clear]').click();for(const kind of ['work','money','time'])assert(await input(kind+'-legacy').isHidden());
  await page.goto(base);for(const query of ['預留緩衝','來不及']){await page.locator('#search').fill(query);await page.waitForTimeout(500);assert(await page.locator('.result-row').filter({hasText:'為生活留一個備案'}).count());}
}
module.exports={testEp94Backup};
