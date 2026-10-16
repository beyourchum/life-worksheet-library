const assert = require('node:assert/strict');
const { experiencePromptIssues, sourceExperiencePromptIssues } = require('../../scripts/check/rules/experience-prompt-check.cjs');

for (const text of [
  '若不想使用自己的經驗，可以沿用 W1 的假設情境。',
  '若沒有合適經驗，可以想像「看到同學拿到實習錄取」的情境。',
  '不想分享可跳過。',
  '不想寫自己的事，可以改寫別人的故事。',
  '不必寫姓名或細節。',
  '沒有相關經驗時，可以使用假設案例。',
  '如果最近沒有正在面臨的抉擇，或不想使用真實經驗，可以沿用前面的「A 大公司／B 新創公司」情境作答。',
  '如果不想使用自己的經驗，可以把主角改成「某位大學生」。',
  '沒有固定收入時，可填假設金額練習。',
  '如果目前沒有合適任務，可以想像一個報告任務。',
  '也可以用假設案例作答。',
  '請找一個真實或假設的連結瞬間。',
  '我記得／想像中的連結瞬間是：',
  '我想練習的對象／假設角色是：',
  '如果資訊不足，請標示「待確認」，並提供一個具體的假設版本。',
]) {
  assert(experiencePromptIssues(`<p>${text}</p>`).length, `應攔截：${text}`);
  assert(experiencePromptIssues(`## 使用說明\n${text}`, 'markdown').length, `修訂稿應攔截：${text}`);
}
assert(experiencePromptIssues('<p>若不想使用自己的經驗，可以沿用 W1 的假<span>設</span>&#x60c5;境。</p>').length);
assert(experiencePromptIssues('<label><input type="checkbox">我沒有適合分享的真實情境，改用假設案例</label>').length);
assert(experiencePromptIssues('若不想使用自己的經驗，\n可以沿用 W1 的假設情境。', 'markdown').length);
assert(experiencePromptIssues('<!-- example: 沒有相關經驗時，可以使用假設案例。 -->', 'markdown').length);
assert(experiencePromptIssues('<p>沒有相關經驗時，可用假\n設案例。</p>').length);
assert(experiencePromptIssues('<aside class="prompt-quote"><p>沒有相關經驗時，請提供假設案例。</p></aside>').length);
for (const text of [
  '請整理我實際遇到的困難。',
  '例如：週末和同學一起完成報告。',
  '以下案例是知識判斷題：假設投影機斷訊，你會先確認什麼？',
  '請確認這個假設有沒有事實支持。',
  '如果沒有相關經驗，請如實記錄目前不知道的事，不要編造。',
  '不要改用假設案例作答。',
  '如果資訊不足，請標示「待確認」，不要自行補造。',
  '若回想內容讓你感到不安全或難以承受，先停止並找可信任的人協助。',
  '先寫在備忘錄，之後決定要不要分享。',
  '目前不確定。',
]) assert.deepEqual(experiencePromptIssues(`<p>${text}</p>`), [], `不應誤判：${text}`);
assert.deepEqual(experiencePromptIssues('<!-- 維護註記：沒有經驗時可以用假設案例。 -->\n請寫實際情境。', 'markdown'), []);
assert.deepEqual(experiencePromptIssues('---\nnote: 可用假設案例\n---\n請寫實際情境。', 'markdown'), []);
assert.deepEqual(experiencePromptIssues('<script>const x="可用假設案例";</script><p>真實經驗</p>'), []);

const bad = '沒有相關經驗時，可以使用假設案例。';
for (const source of [
  { hero: { question: bad } },
  { pages: [{ bodyHtml: `<p>${bad}</p>` }] },
  { pages: [{ footer: bad }] },
  { contentSyncHtml: [`<p>${bad}</p>`] },
  { textReplacements: [{ to: bad }] },
]) assert(sourceExperiencePromptIssues(source).length);
assert.deepEqual(sourceExperiencePromptIssues({ note: bad, pages: [{ bodyHtml: '<p>請整理實際問題。</p>' }] }), []);
console.log('經驗提示測試通過：替代經驗句型、選項、欄位、AI、隱藏註記及正常案例。');
