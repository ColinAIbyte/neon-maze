/* 隐私政策必须和真正上线的统计配置对得上。
 * 之前隐私政策白纸黑字写着「统计目前处于关闭状态」，一旦有人在 config.js 里
 * 填了 token 而忘了改这一页，页面就变成了一句假话。把两边锁在一起。 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../../'+name,import.meta.url),'utf8');
const config = read('config.js');
const zh = read('privacy/index.html');
const en = read('en/privacy/index.html');

const m = config.match(/cloudflareBeaconToken:\s*'([^']*)'/);
assert(m,'config.js 里找不到 cloudflareBeaconToken');
const token = m[1];
const on = token !== '';
if (on) assert.match(token,/^[a-f0-9]{32}$/,'Cloudflare beacon token 必须是 32 位十六进制，否则 analytics.js 会静默忽略它');

/* 关掉时不许说在统计，打开时不许说没统计。 */
const offClaims = [[zh,'目前处于关闭状态'],[en,'currently switched off']];
const onClaims  = [[zh,'Cloudflare Web Analytics'],[en,'Cloudflare Web Analytics']];
for (const [page,text] of offClaims)
  assert.equal(page.includes(text), !on, on
    ? '统计已启用，隐私政策却还写着已关闭：'+text
    : '统计已关闭，隐私政策却删掉了这句说明：'+text);
for (const [page,text] of onClaims)
  assert.equal(page.includes(text), on, on
    ? '统计已启用，隐私政策没有告诉玩家用的是哪家：'+text
    : '统计已关闭，隐私政策不该声称在用：'+text);

if (on){
  /* Cloudflare Web Analytics 不写 Cookie —— 这正是选它的理由，也是不弹同意条的依据。 */
  assert(zh.includes('不写 Cookie')||zh.includes('不使用追踪 Cookie'),'中文页要说明统计不写 Cookie');
  assert(/no cookies|No tracking cookies/i.test(en),'英文页要说明统计不写 Cookie');
  /* GA4 会写 Cookie、在中国大陆也打不开，开它之前必须先重写这一页。 */
  const ga = config.match(/ga4MeasurementId:\s*'([^']*)'/);
  assert(ga && ga[1] === '','启用了 GA4 就得重写隐私政策的 Cookie 与第三方章节，不能靠这条测试放行');
}

console.log('✓ 隐私政策与 config.js 里真正启用的统计一致（Cloudflare '+(on?'已启用':'未启用')+'）');
