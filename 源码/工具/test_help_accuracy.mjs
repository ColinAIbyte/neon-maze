// 玩法说明里的数字，必须和代码里的常量对得上。
//   用法: node test_help_accuracy.mjs
//
// 同时核验中文网页、英文网页和微信小游戏；旧小程序若仍存在，也必须同步。
// 数字只能在帮助正文里、对应词条或句子的上下文中命中，不能让脚本常量、
// 注释或其他规则里的同一个数字造成假通过。既核代码与说明一致，也锁定本轮
// 连击项目 +30%、完整窗口 +10%、六关统一参数及固定奖励/历史成绩不变的边界。
import { existsSync, readFileSync } from 'node:fs';

const src  = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
const ui   = readFileSync(new URL('../微信小游戏版/js/ui.js', import.meta.url), 'utf8');
const en   = readFileSync(new URL('../../en/index.html', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const wxmlUrl = new URL('../../微信小程序版/pages/game/game.wxml', import.meta.url);
const hasWxml = existsSync(wxmlUrl);
const wxml = hasWxml ? readFileSync(wxmlUrl, 'utf8') : '';

/* 只在**说明那一段**里找，不能在整个文件里找。
   第一版就是拿整个文件搜的，结果 `const COMBO_WINDOW = 2.4;` 这行常量声明
   本身就能让检查通过 —— 测试永远是绿的，等于没测。 */
const helpStart = src.indexOf('<div class="help-doc">');
const helpEnd   = src.indexOf('id="helpCloseBtn"', helpStart);
if (helpStart < 0 || helpEnd < helpStart) throw new Error('定位不到网页版的说明段落');
const helpHtml = src.slice(helpStart, helpEnd).replace(/<!--[\s\S]*?-->/g, '');
const uiHelpSection = section(ui, 'const HELP = [', '\n  ];');
if (!uiHelpSection) throw new Error('定位不到小游戏的说明段落');
const uiHelp = uiHelpSection.replace(/\/\*[\s\S]*?\*\//g, '');

const num = (re, what) => {
  const m = src.match(re);
  if (!m) throw new Error('在代码里找不到' + what + '：' + re);
  return Number(m[1]);
};

// —— 从代码里读出真值 ——
const MULT   = num(/const SCORE_MULT = ([\d.]+);/, '总倍率');
const BOOST  = num(/const SCORE_BOOST = ([\d.]+);/, '历史统一计分提升');
const COMBO_BOOST = num(/const COMBO_SCORE_BOOST = ([\d.]+);/, '本轮连击项目提升');
const PELLET = num(/pelletsLeft--; addPelletScore\((\d+)\);/, '豆子基础分');
const POWER  = num(/else if \(ch==='o'\)[\s\S]{0,100}?addPelletScore\((\d+)\);/, '能量星基础分');
const FRUIT  = num(/function updateFruit\(dt\)[\s\S]{0,700}?addComboScore\((\d+)\s*\*\s*combo\);/, '晶石基础分');
const BONUS_LINE = src.match(/const BONUS = \{([^}]+)\}/)[1];
const bonus = k => Number(BONUS_LINE.match(new RegExp(k + ':\\s*(\\d+)'))[1]);
const fright = num(/const FRIGHT_SECONDS = ([\d.]+);/, '六关统一能量时长');
const ghostBaseSpeed = num(/const GHOST_BASE_SPEED = ([\d.]+);/, '六关统一敌人基础速度');
const dash   = num(/const MOMENTUM_MAX = ([\d.]+);/, '冲刺倍率');
const pSpeed = num(/const FRIGHT_PLAYER_SPEED_MULT = ([\d.]+);/, '恐惧期玩家加速');
const gSpeed = num(/const FRIGHT_GHOST_SPEED_MULT = ([\d.]+);/, '恐惧期幽灵减速');
const bounty = num(/const GHOST_BOUNTY_STEP = (\d+);/, '悬赏步长');
const comboWin  = num(/const COMBO_WINDOW = ([\d.]+);/, '连击窗口');
const comboGrace = num(/const COMBO_GRACE_PER = ([\d.]+);/, '每级连击宽限');
const comboGraceMax = num(/const COMBO_GRACE_MAX = ([\d.]+);/, '连击宽限上限');
const comboMax = comboWin + comboGraceMax;
const portalCd  = num(/const PORTAL_COOLDOWN_SECONDS = ([\d.]+);/, '传送门冷却');
const comboIdle = num(/const COMBO_IDLE_DECAY = ([\d.]+);/, '停下衰减倍率');

// —— 期望：每个数值都要**带上下文**去核 ——
/* 光找"这个数出现过没有"是不行的，两次栽在同一个坑上：
     第一次 —— 拿整个文件搜，`const COMBO_WINDOW = 2.4;` 这行声明自己就让检查通过；
     第二次 —— 只搜说明段落，可 String(2.0) 是 "2"，而悬赏那行 "1万 → 2万 → 3万"
               里就有个孤零零的 2，照样通过。传送门冷却因此真的漏过一次：
               代码 2.0、说明 1.2，测试全绿。
   所以每一条都写清楚"这个数该出现在哪句话里"。麻烦一点，但这才叫核对。
   \uFFFF 是占位符，构造正则时替换成真实数值。 */
// 消掉 1.3 * 3 在 JS 里可能变成 3.9000000000000004 的浮点尾巴。
const plainNum = v => String(Number(Number(v).toFixed(10)));
const num2 = v => plainNum(v).replace('.', '\\.');
const pelletPoints = PELLET * MULT * COMBO_BOOST;
const powerPoints = POWER * MULT * COMBO_BOOST;
const fruitPoints = FRUIT * MULT * COMBO_BOOST;
const bountyPoints = bounty * COMBO_BOOST;
const comboIncrease = Math.round((comboWin / 1.6 - 1) * 100);
const expect = [
  // 词条和数值之间隔着 </dt><dd> 之类的标签，所以用有界的任意字符，
  // 不能用 [^<]*（跨不过标签），也不能用 [\\s\\S]*（会一路匹配到别人家去）
  ['豆子',       `<dt>豆子</dt><dd><b>\uFFFF</b> × 连击，最终取整`, pelletPoints],
  ['能量星分数', `<dt>能量星</dt><dd><b>\uFFFF</b> × 连击，最终取整`, powerPoints],
  ['相位晶石',   `<dt>相位晶石</dt><dd><b>\uFFFF</b> × 连击，最终取整`, fruitPoints],
  ['整关无伤',   `整关无伤[\\s\\S]{0,20}?<b>\uFFFF</b>`, bonus('PERFECT_LEVEL') * MULT],
  /* 全灭是**最终分**，不乘 SCORE_MULT（awardBonus 的 raw），所以这里不能
     跟着乘。现在常量已经从 10 万直接提高到 13 万。 */
  ['全灭对手',   `全灭对手[\\s\\S]{0,20}?<b>\uFFFF万</b>`, bonus('GHOST_SWEEP') / 10000],
  ['通关剩余命', `通关剩余命[\\s\\S]{0,20}?<b>\uFFFF</b>`, bonus('LIFE_LEFT')    * MULT],
  ['全程无伤',   `全程无伤[\\s\\S]{0,20}?<b>\uFFFF</b>`, bonus('FLAWLESS_RUN')  * MULT],
  ['六关能量时长', `能量星时长</dt><dd>六关统一 <b>\uFFFF 秒</b>`, fright],
  ['续星刷新时长', `能量星时长[\\s\\S]{0,70}?再吃一颗刷新至 \uFFFF 秒，不叠加`, fright],
  ['六关敌人速度', `敌人速度</dt><dd>六关基础速度统一为 <b>\uFFFF 格/秒</b>`, ghostBaseSpeed],
  ['冲刺倍率',   `提速到 <b>\uFFFF 倍</b>`,            dash],
  ['玩家加速%',  `你快 \uFFFF%`,                       Math.round((pSpeed-1)*100)],
  ['敌人减速%',  `敌人慢 \uFFFF%`,                     Math.round((1-gSpeed)*100)],
  ['连击基础窗口', `跑动基础窗口 <b>\uFFFF 秒</b>`, comboWin],
  ['连击最长窗口', `连击越高越宽，最长 <b>\uFFFF 秒</b>`, comboMax],
  ['连击延长比例', `连击持续时间延长 <b>\uFFFF%</b>`, comboIncrease],
  ['停下衰减倍率', `停下仍按 <b>\uFFFF 倍</b>速度消耗`, comboIdle],
  ['传送门冷却', `冷却 <b>\uFFFF 秒</b>`,              portalCd],
];

const fail = [];
for (const [what, actual, wanted] of [
  ['原总倍率', MULT, 1.95], ['历史提升倍率', BOOST, 1.3],
  ['本轮连击项目倍率', COMBO_BOOST, 1.3], ['豆子基础分', PELLET, 10],
  ['能量星基础分', POWER, 50], ['晶石基础分', FRUIT, 300],
  ['敌人基础悬赏', bounty, 13000], ['敌人当前悬赏', bountyPoints, 16900],
  ['固定整关无伤奖励', bonus('PERFECT_LEVEL') * MULT, 1950],
  ['固定全灭奖励', bonus('GHOST_SWEEP'), 130000],
  ['固定剩命奖励', bonus('LIFE_LEFT') * MULT, 2925],
  ['固定全程无伤奖励', bonus('FLAWLESS_RUN') * MULT, 19500],
  ['六关能量时长', fright, 9], ['六关敌人基础速度', ghostBaseSpeed, 2.35],
  ['基础连击窗口', comboWin, 1.76], ['最长连击窗口', comboMax, 2.75],
  ['每级连击宽限', comboGrace, 0.022], ['连击宽限上限', comboGraceMax, 0.99],
  ['停下衰减倍率', comboIdle, 3], ['完整窗口延长比例', comboIncrease, 10],
]) {
  if (Math.abs(actual - wanted) > 1e-9) fail.push(`${what}应为 ${wanted}，实际 ${actual}`);
}
for (const [what, actual, previous] of [
  ['基础窗口', comboWin, 1.6], ['每级宽限', comboGrace, 0.02], ['宽限上限', comboGraceMax, 0.9],
]) {
  if (Math.abs(actual - previous * 1.1) > 1e-9) fail.push(`连击${what}未完整延长 10%`);
}
if (Math.abs(MULT - 1.5 * BOOST) > 1e-9)
  fail.push(`普通项目倍率不是上一版 1.5 × ${BOOST}（实际 ${MULT}）`);
if (bounty !== Math.round(10000 * BOOST))
  fail.push(`敌人悬赏没有从 10000 提高 ${Math.round((BOOST-1)*100)}%（实际 ${bounty}）`);
if (bonus('GHOST_SWEEP') !== Math.round(100000 * BOOST))
  fail.push(`全灭奖励没有从 100000 提高 ${Math.round((BOOST-1)*100)}%（实际 ${bonus('GHOST_SWEEP')}）`);
if (!/const SCORE_KEY = 'doudou\.scores\.v3'/.test(src) ||
    !/const PREVIOUS_SCORE_KEY = 'doudou\.scores\.v2'/.test(src) ||
    !/score:\s*Math\.round\(row\.score \* SCORE_BOOST\)/.test(src))
  fail.push('旧排行榜没有从 v2 按统一计分提升比例迁移到 v3');
for (const [what, pat, v] of expect){
  const re = new RegExp(pat.replace(/\uFFFF/g, num2(v)));
  if (!re.test(helpHtml)) fail.push(`网页说明里「${what}」和代码对不上（代码是 ${v}）`);
}
const boostText = `连击项目再提高 ${Math.round((COMBO_BOOST-1)*100)}%`;
if (!helpHtml.includes(boostText)) fail.push(`网页玩法说明没有写明「${boostText}」`);
if (!helpHtml.includes('小数分在最终入账取整')) fail.push('网页玩法说明没有交代小数分最终取整');
if (!/小豆、大豆（能量星）、反击敌人、拿晶石，每次都让同一条连击涨一级并续满时间/.test(helpHtml))
  fail.push('网页玩法说明没有交代小豆、大豆、敌人和晶石续同一条连击');
if (!/通关等固定奖励和已有成绩不变/.test(helpHtml) ||
    !/历史成绩<\/dt><dd>本次只调整连击项目，已有成绩保持原值，不再统一乘 1\.3/.test(helpHtml))
  fail.push('网页玩法说明没有明确固定奖励和历史成绩本轮不变');
if (!/敌人悬赏独立递增，但也续连击/.test(helpHtml) || !/悬赏不再乘吃豆倍率/.test(helpHtml))
  fail.push('网页玩法说明没有区分敌人悬赏递增与吃豆倍率');
const bountyWan = bountyPoints / 10000;
const bountySequence = `${plainNum(bountyWan)}万 → ${plainNum(bountyWan*2)}万 → ${plainNum(bountyWan*3)}万`;
if (!helpHtml.includes(`<dt>敌人</dt><dd><b>${bountySequence}`)) fail.push(`网页玩法说明里的敌人悬赏不是「${bountySequence}」`);

// 英文入口是同域下另一份可玩的完整逻辑，分数和共用排行榜也必须同步。
const enHelpStart = en.indexOf('<div class="help-doc">');
const enHelpEnd = en.indexOf('id="helpCloseBtn"', enHelpStart);
if (enHelpStart < 0 || enHelpEnd < 0) throw new Error('定位不到英文版说明段落');
const enHelp = en.slice(enHelpStart, enHelpEnd).replace(/<!--[\s\S]*?-->/g, '');
const enChecks = [
  ['本轮连击提升', `Combo-scoring items are another ${Math.round((COMBO_BOOST-1)*100)}% higher`],
  ['固定奖励与旧成绩', 'fixed bonuses and existing scores are unchanged by this update'],
  ['豆子', `<dt>Berry</dt><dd><b>${plainNum(pelletPoints)}</b> × Combo, then rounded`],
  ['能量星', `<dt>Power Pellet</dt><dd><b>${plainNum(powerPoints)}</b> × Combo, then rounded`],
  ['相位晶石', `<dt>Mystery Fruit</dt><dd><b>${plainNum(fruitPoints)}</b> × Combo, then rounded`],
  ['敌人悬赏', `<dt>Owl</dt><dd><b>${plainNum(bountyPoints/1000)}k → ${plainNum(bountyPoints*2/1000)}k → ${plainNum(bountyPoints*3/1000)}k`],
  ['整关无伤', `<dt>Perfect level</dt><dd><b>${plainNum(bonus('PERFECT_LEVEL')*MULT)}</b> × level`],
  ['全灭对手', `<dt>Owl sweep</dt><dd><b>${plainNum(bonus('GHOST_SWEEP')/1000)}k</b>`],
  ['剩余生命', `<dt>Lives left at clear</dt><dd><b>${plainNum(bonus('LIFE_LEFT')*MULT)}</b> × lives`],
  ['全程无伤', `<dt>Flawless run</dt><dd><b>${plainNum(bonus('FLAWLESS_RUN')*MULT)}</b>`],
  ['六关能量时长', `<dt>Pellet duration</dt><dd><b>${fright}s on all six levels</b>`],
  ['续星刷新', `another Power Pellet resets the timer to ${fright}s`],
  ['六关敌人速度', `<dt>Owl speed</dt><dd><b>${ghostBaseSpeed} tiles/s base speed on all six levels</b>`],
  ['冲刺倍率', `<b>${dash}×</b>`],
  ['玩家加速', `you move ${Math.round((pSpeed-1)*100)}% faster`],
  ['敌人减速', `the owls ${Math.round((1-gSpeed)*100)}% slower`],
  ['传送门冷却', `<dt>Portal</dt><dd><b>${portalCd}s</b> cooldown`],
  ['统一连击', 'Berries, Power Pellets, fruit and owls all extend the <b>same combo</b>, adding one level'],
  ['独立敌人悬赏', 'owls also extend the same combo, but their bounties are not multiplied by Combo'],
];
for (const [what, text] of enChecks){
  if (!enHelp.includes(text)) fail.push(`英文版说明里「${what}」和代码对不上`);
}
if (!enHelp.includes('The complete payout is rounded once when banked')) fail.push('英文版没有交代完整倍率计算后只取整一次');
const enCombo = (section(enHelp, '<h3>Combo</h3>', '</div>') || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
for (const [what, pattern] of [
  ['完整窗口延长', `full combo window is ${comboIncrease}% longer`],
  ['基础窗口', `(?:${num2(comboWin)}s base|base[\\s\\S]{0,20}?${num2(comboWin)}s)`],
  ['最长窗口', `growing with your combo to ${num2(comboMax)}s`],
  ['停下三倍消耗', `Standing still drains it ${comboIdle === 3 ? 'three' : plainNum(comboIdle)} times as fast`],
  ['停下时间范围', `Standing still[\\s\\S]{0,80}?about ${num2(Number(((comboWin + comboGrace * 2) / comboIdle).toFixed(1)))}–${num2(Number((comboMax / comboIdle).toFixed(1)))}s`],
]) {
  if (!new RegExp(pattern, 'i').test(enCombo)) fail.push(`英文连击说明里的「${what}」和代码对不上`);
}
if (!new RegExp(`<dt>Dash</dt><dd>[\\s\\S]{0,60}?<b>${num2(dash)}×</b>`).test(enHelp))
  fail.push('英文版冲刺倍率没有在冲刺词条中说明');
if (!en.includes(`const SCORE_BOOST = ${BOOST};`) || !en.includes(`const SCORE_MULT = ${MULT};`) ||
    !en.includes(`const COMBO_SCORE_BOOST = ${COMBO_BOOST};`) ||
    !en.includes(`const GHOST_BOUNTY_STEP = ${bounty};`) ||
    !en.includes(`GHOST_SWEEP: ${bonus('GHOST_SWEEP')}`))
  fail.push('英文版的计分常量没有和中文版同步');
for (const [key, value] of [
  ['FRIGHT_SECONDS', fright], ['GHOST_BASE_SPEED', ghostBaseSpeed],
  ['COMBO_WINDOW', comboWin], ['COMBO_GRACE_PER', comboGrace],
  ['COMBO_GRACE_MAX', comboGraceMax], ['COMBO_IDLE_DECAY', comboIdle],
]) {
  const actual = en.match(new RegExp(`const ${key} = ([\\d.]+);`));
  if (!actual || Number(actual[1]) !== value) fail.push(`英文版 ${key} 未与中文规则同步`);
}
if (!/const SCORE_KEY = 'doudou\.scores\.v3'/.test(en) ||
    !/const PREVIOUS_SCORE_KEY = 'doudou\.scores\.v2'/.test(en) ||
    !/score:\s*Math\.round\(row\.score \* SCORE_BOOST\)/.test(en))
  fail.push('英文版没有同步 v2 → v3 排行榜迁移');
// 小游戏那份是纯文本，格式不同，只核关键几个数值出现在同一句话里
const uiChecks = [
  ['豆子',       `豆子'[\\s\\S]{0,20}?'${num2(pelletPoints)} 分 × 连击，最终取整`],
  ['能量星分数', `能量星'[\\s\\S]{0,20}?'${num2(powerPoints)} 分 × 连击，最终取整`],
  ['相位晶石',   `相位晶石'[\\s\\S]{0,20}?'${num2(fruitPoints)} 分 × 连击，最终取整`],
  ['敌人悬赏',   `敌人'[\\s\\S]{0,20}?'${num2(bountyWan)}万 → ${num2(bountyWan*2)}万 → ${num2(bountyWan*3)}万`],
  ['整关无伤',   `整关无伤[\\s\\S]{0,20}?${num2(bonus('PERFECT_LEVEL')*MULT)}`],
  ['全灭对手',   `全灭对手[\\s\\S]{0,20}?${num2(bonus('GHOST_SWEEP')/10000)}万`],
  ['通关剩余命', `通关剩余命[\\s\\S]{0,20}?${num2(bonus('LIFE_LEFT')*MULT)}`],
  ['全程无伤',   `全程无伤[\\s\\S]{0,20}?${num2(bonus('FLAWLESS_RUN')*MULT)}`],
  ['六关能量时长', `能量星时长'[\\s\\S]{0,20}?'六关统一 ${num2(fright)} 秒`],
  ['续星刷新',   `能量星时长'[\\s\\S]{0,50}?再吃一颗刷新至 ${num2(fright)} 秒，不叠加`],
  ['六关敌人速度', `敌人速度'[\\s\\S]{0,20}?'六关基础速度统一为 ${num2(ghostBaseSpeed)} 格/秒`],
  ['冲刺倍率',   `冲刺'[\\s\\S]{0,40}?提速到 ${num2(dash)} 倍`],
  ['玩家加速',   `期间你快 ${Math.round((pSpeed-1)*100)}%`],
  ['敌人减速',   `敌人慢 ${Math.round((1-gSpeed)*100)}%`],
  ['连击基础窗口', `跑动基础窗口 ${num2(comboWin)} 秒`],
  ['连击最长窗口', `连击越高越宽，最长 ${num2(comboMax)} 秒`],
  ['完整窗口延长', `连击持续时间延长 ${comboIncrease}%`],
  ['停下衰减倍率', `停下仍按 ${num2(comboIdle)} 倍速度消耗`],
  ['传送门冷却', `传送门'[\\s\\S]{0,20}?'冷却 ${num2(portalCd)} 秒`],
  ['统一连击',   '小豆、大豆（能量星）、反击敌人、拿晶石，每次都让同一条连击涨一级并续满时间'],
  ['独立敌人悬赏', "连击倍率'[\\s\\S]{0,50}?敌人悬赏独立递增，但也续连击"],
  ['本轮固定奖励不变', '通关等固定奖励和已有成绩不变'],
  ['历史成绩不变', "历史成绩'[\\s\\S]{0,20}?'本次只调整连击项目，已有成绩保持原值，不再统一乘 1\\.3"],
];
for (const [what, pat] of uiChecks){
  if (!new RegExp(pat).test(uiHelp)) fail.push(`小游戏那份说明里「${what}」和代码对不上`);
}
if (!uiHelp.includes(boostText)) fail.push(`小游戏玩法说明没有写明「${boostText}」`);
if (!uiHelp.includes('小数分最终取整')) fail.push('小游戏玩法说明没有交代小数分最终取整');
/* 小程序那份是 WXML，数字包在 <text class="b"> 里，所以模式跟网页那份不一样，
   但要核的是同一批数。只截说明那一段，别拿整个文件搜 —— 这个坑前面踩过两次。 */
const wxHelpStart = hasWxml ? wxml.indexOf('<scroll-view class="help-doc"') : -1;
const wxHelpEnd   = hasWxml ? wxml.indexOf('</scroll-view>', wxHelpStart) : -1;
if (hasWxml && (wxHelpStart < 0 || wxHelpEnd < 0)){
  fail.push('定位不到小程序版的说明段落');
} else if (hasWxml) {
  const wxHelp = wxml.slice(wxHelpStart, wxHelpEnd).replace(/<!--[\s\S]*?-->/g, '');
  const wxChecks = [
    ['豆子',       `豆子</text>[\\s\\S]{0,12}?${num2(pelletPoints)} × 连击`],
    ['能量豆分数', `能量豆</text>[\\s\\S]{0,12}?${num2(powerPoints)} × 连击`],
    ['水果',       `神秘水果</text>[\\s\\S]{0,12}?${num2(fruitPoints)} × 连击`],
    ['敌人悬赏',   `(?:敌人|幽灵)</text>[\\s\\S]{0,40}?${num2(bountyWan)}万 → ${num2(bountyWan*2)}万 → ${num2(bountyWan*3)}万`],
    ['整关无伤',   `整关无伤</text>[\\s\\S]{0,12}?${num2(bonus('PERFECT_LEVEL')*MULT)}`],
    ['全灭幽灵',   `全灭幽灵</text>[\\s\\S]{0,12}?${num2(bonus('GHOST_SWEEP')/10000)}万`],
    ['通关剩余命', `通关剩余命</text>[\\s\\S]{0,12}?${num2(bonus('LIFE_LEFT')*MULT)}`],
    ['全程无伤',   `全程无伤</text>[\\s\\S]{0,12}?${num2(bonus('FLAWLESS_RUN')*MULT)}`],
    ['六关能量时长', `六关统一(?: <text[^>]*>)?${num2(fright)} 秒`],
    ['续星刷新',   `再吃一颗刷新至 ${num2(fright)} 秒，不叠加`],
    ['六关敌人速度', `六关基础速度统一为(?: <text[^>]*>)?${num2(ghostBaseSpeed)} 格/秒`],
    ['冲刺倍率',   `提速到 ${num2(dash)} 倍`],
    ['玩家加速%',  `你快 ${Math.round((pSpeed-1)*100)}%`],
    ['幽灵减速%',  `幽灵慢 ${Math.round((1-gSpeed)*100)}%`],
    ['连击基础窗口', `跑动基础窗口(?: <text[^>]*>)?${num2(comboWin)} 秒`],
    ['连击最长窗口', `最长(?: <text[^>]*>)?${num2(comboMax)} 秒`],
    ['连击延长比例', `连击持续时间延长(?: <text[^>]*>)?${comboIncrease}%`],
    ['停下衰减倍率', `停下仍按(?: <text[^>]*>)?${num2(comboIdle)} 倍`],
    ['传送门冷却', `冷却 ${num2(portalCd)} 秒`],
  ];
  for (const [what, pat] of wxChecks){
    if (!new RegExp(pat).test(wxHelp)) fail.push(`小程序那份说明里「${what}」和代码对不上（代码是相关常量）`);
  }
  for (const text of [boostText, '最终取整', '同一条连击', '已有成绩保持原值']) {
    if (!wxHelp.includes(text)) fail.push(`小程序说明缺少现行规则「${text}」`);
  }
}

// README 的现行计分表也是交付说明，只查这张表，历史更新记录不算命中。
const scoreTable = section(readme, '现行计分（', '按吃之前的倍率计分');
if (!scoreTable) fail.push('README 缺少现行计分段落');
else {
  for (const [what, pattern] of [
    ['豆子', `\\| 豆子 \\| ${num2(pelletPoints)} × 连击 \\|`],
    ['能量星', `\\| 能量星 \\| ${num2(powerPoints)} × 连击 \\|`],
    ['相位晶石', `\\| 相位晶石 \\| ${num2(fruitPoints)} × 连击 \\|`],
    ['敌人悬赏', `\\| 同一颗能量星内反击敌人 \\| ${num2(bountyWan)} 万 → ${num2(bountyWan*2)} 万 → ${num2(bountyWan*3)} 万`],
    ['整关无伤', `\\| 整关无伤 \\| ${num2(bonus('PERFECT_LEVEL')*MULT)} × 关卡号`],
    ['全灭', `\\| 一次能量星内全灭对手 \\| ${num2(bonus('GHOST_SWEEP')/10000)} 万`],
    ['剩命', `\\| 通关剩余生命 \\| ${num2(bonus('LIFE_LEFT')*MULT)} × 条数`],
    ['全程无伤', `\\| 全程无伤 \\| ${num2(bonus('FLAWLESS_RUN')*MULT)} \\|`],
  ]) {
    if (!new RegExp(pattern).test(scoreTable)) fail.push(`README 现行计分表「${what}」和代码对不上`);
  }
}

/* 作者自己那段话：三份都必须有，不许被"顺手改写"，而且**必须在「关于这个游戏」
   那一页、不在玩法说明里**。
   它不是规则文案，是这个游戏为什么存在 —— 正是这类没有测试盯着的文字，最容易
   在某次"统一措辞"里被改掉，或者在整理说明时被顺手挪回规则堆里。
   所以两头都查：在该在的地方、且不在不该在的地方。 */
const ABOUT_LINES = ['暑期，儿子想玩一款简单刺激的小游戏', '他负责试玩和提意见',
                     '其它小朋友也加入试玩队伍',
                     '超级奶爸', '2685897@qq.com'];

/** 从一份文本里切出某一段；切不出来返回 null（而不是悄悄拿整份文件去搜）。 */
function section(text, startPat, endPat){
  const a = text.indexOf(startPat);
  if (a < 0) return null;
  const b = text.indexOf(endPat, a + startPat.length);
  return b > a ? text.slice(a, b) : null;
}

const aboutTargets = [
  ['网页',   section(src,  'id="aboutOverlay"',    'id="aboutCloseBtn"')],
  ['小游戏', section(ui,   'const ABOUT = [',      '\n  ];')],
];
if (hasWxml) aboutTargets.push(['小程序', section(wxml, "overlay === 'about'", 'onAboutClose')]);
for (const [name, part] of aboutTargets){
  if (!part){ fail.push(`${name}版找不到「关于这个游戏」那一页`); continue; }
  for (const line of ABOUT_LINES){
    if (!part.includes(line)) fail.push(`${name}版「关于」页里缺了「${line}」`);
  }
}
const webAbout = aboutTargets[0][1] || '';
if (!webAbout.includes('Neon Maze') || !webAbout.includes('这 6 个关卡')){
  fail.push('网页版「关于」页没有说明 Neon Maze 与六关的创作背景');
}

// 反过来：玩法说明里不许再出现作者那段话
const helpTargets = [
  ['网页',   helpHtml],
  ['小游戏', uiHelp],
];
if (hasWxml) helpTargets.push(['小程序', wxHelpStart >= 0 ? wxml.slice(wxHelpStart, wxHelpEnd) : null]);
for (const [name, part] of helpTargets){
  if (!part) continue;
  for (const line of ABOUT_LINES){
    if (part.includes(line)) fail.push(`${name}版玩法说明里混进了「${line}」—— 它该只在「关于」页`);
  }
}

console.log('从代码读到的真值：');
console.log(`  连击项目再 +${Math.round((COMBO_BOOST-1)*100)}%　基础倍率 ${MULT}　豆子 ${plainNum(pelletPoints)}　能量星 ${plainNum(powerPoints)}　相位晶石 ${plainNum(fruitPoints)}　敌人 ${plainNum(bountyPoints)}`);
console.log(`  奖励 无伤${bonus('PERFECT_LEVEL')*MULT} 全灭${bonus('GHOST_SWEEP')} 剩命${bonus('LIFE_LEFT')*MULT} 全程${bonus('FLAWLESS_RUN')*MULT}`);
console.log(`  六关统一 ${fright} 秒 / ${ghostBaseSpeed} 格每秒　冲刺 ${dash}x　连击 ${comboWin}–${comboMax}s（完整 +${comboIncrease}%，停下 ${comboIdle}x）　传送门冷却 ${portalCd}s`);
const targetLabel = hasWxml ? '中英文网页、小游戏、小程序说明与 README' : '中英文网页、小游戏说明与 README';
console.log('\n' + (fail.length ? '说明与代码对不上:\n  ' + fail.join('\n  ') : `${targetLabel}的数字都和代码一致；作者文字也只出现在「关于」页。`));
process.exit(fail.length ? 1 : 0);
