// 玩法说明里的数字，必须和代码里的常量对得上。
//   用法: node test_help_accuracy.mjs
//
// 说明文档是会腐烂的：改了一个常量，说明里那个数还停在旧值上，而且不会有
// 任何报错。这次就抓到一条 —— 连击规则早改成"跑动 1.6 秒"，说明里还写着
// "超过约 1 秒"。玩家照着做发现不是那么回事，比没有说明更糟。
//
// 而且说明有**三份**（网页 HTML、小游戏 canvas 逐行画、小程序 WXML），改一处
// 忘另外两处是必然会发生的事，这里一起核。
//
// 第三份是后来补进来的，补的理由值得记下来：它原先没被测，于是悄悄腐烂到只剩
// 四节、参数全是旧值 —— 没有传送门冷却、没有连击断线时间、能量豆还写着"自己还
// 会加速"。而三份说明的注释里都写着"改一处记得改另一处"。被测到的两份一直对得
// 上，没被测的那份烂掉了：靠注释提醒自己不管用，这就是证据。
import { existsSync, readFileSync } from 'node:fs';

const src  = readFileSync(new URL('../pacman_fragment.html', import.meta.url), 'utf8');
const ui   = readFileSync(new URL('../微信小游戏版/js/ui.js', import.meta.url), 'utf8');
const en   = readFileSync(new URL('../../en/index.html', import.meta.url), 'utf8');
const wxmlUrl = new URL('../../微信小程序版/pages/game/game.wxml', import.meta.url);
const hasWxml = existsSync(wxmlUrl);
const wxml = hasWxml ? readFileSync(wxmlUrl, 'utf8') : '';

/* 只在**说明那一段**里找，不能在整个文件里找。
   第一版就是拿整个文件搜的，结果 `const COMBO_WINDOW = 2.4;` 这行常量声明
   本身就能让检查通过 —— 测试永远是绿的，等于没测。 */
const helpStart = src.indexOf('<div class="help-doc">');
const helpEnd   = src.indexOf('id="helpCloseBtn"');
if (helpStart < 0 || helpEnd < 0) throw new Error('定位不到网页版的说明段落');
const helpHtml = src.slice(helpStart, helpEnd);

const num = (re, what) => {
  const m = src.match(re);
  if (!m) throw new Error('在代码里找不到' + what + '：' + re);
  return Number(m[1]);
};

// —— 从代码里读出真值 ——
const MULT   = num(/const SCORE_MULT = ([\d.]+);/, '总倍率');
const BOOST  = num(/const SCORE_BOOST = ([\d.]+);/, '统一计分提升');
const PELLET = num(/pelletsLeft--; addPelletScore\((\d+)\);\s*\n[\s\S]{0,80}?ch==='o'/, '豆子基础分')
               || 10;
const BONUS_LINE = src.match(/const BONUS = \{([^}]+)\}/)[1];
const bonus = k => Number(BONUS_LINE.match(new RegExp(k + ':\\s*(\\d+)'))[1]);
const fright = JSON.parse(src.match(/const FRIGHT_BY_LEVEL = (\[[^\]]+\])/)[1]);
const dash   = num(/const MOMENTUM_MAX = ([\d.]+);/, '冲刺倍率');
const pSpeed = num(/const FRIGHT_PLAYER_SPEED_MULT = ([\d.]+);/, '恐惧期玩家加速');
const gSpeed = num(/const FRIGHT_GHOST_SPEED_MULT = ([\d.]+);/, '恐惧期幽灵减速');
const bounty = num(/const GHOST_BOUNTY_STEP = (\d+);/, '悬赏步长');
const comboWin  = num(/const COMBO_WINDOW = ([\d.]+);/, '连击窗口');
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
const expect = [
  // 词条和数值之间隔着 </dt><dd> 之类的标签，所以用有界的任意字符，
  // 不能用 [^<]*（跨不过标签），也不能用 [\\s\\S]*（会一路匹配到别人家去）
  ['豆子',       `豆子[\\s\\S]{0,20}?<b>\uFFFF</b>`,     10 * MULT],
  ['能量星分数', `能量星[\\s\\S]{0,20}?<b>\uFFFF</b>`,    50 * MULT],
  ['相位晶石',   `相位晶石[\\s\\S]{0,40}?<b>\uFFFF</b>`, 300 * MULT],
  ['整关无伤',   `整关无伤[\\s\\S]{0,20}?<b>\uFFFF</b>`, bonus('PERFECT_LEVEL') * MULT],
  /* 全灭是**最终分**，不乘 SCORE_MULT（awardBonus 的 raw），所以这里不能
     跟着乘。现在常量已经从 10 万直接提高到 13 万。 */
  ['全灭对手',   `全灭对手[\\s\\S]{0,20}?<b>\uFFFF万</b>`, bonus('GHOST_SWEEP') / 10000],
  ['通关剩余命', `通关剩余命[\\s\\S]{0,20}?<b>\uFFFF</b>`, bonus('LIFE_LEFT')    * MULT],
  ['全程无伤',   `全程无伤[\\s\\S]{0,20}?<b>\uFFFF</b>`, bonus('FLAWLESS_RUN')  * MULT],
  // 说明改成分层结构后这两句重写过，模式跟着改；仍然要求数字和"能量星时长"
  // 出现在同一句里，不是满篇找一个孤零零的 9
  ['恐惧起始秒', `能量星时长[\\s\\S]{0,30}?<b>\uFFFF 秒</b>`, fright[0]],
  ['恐惧末关秒', `第 6 关只剩 <b>\uFFFF 秒</b>`,       fright[fright.length-1]],
  ['冲刺倍率',   `提速到 <b>\uFFFF 倍</b>`,            dash],
  ['玩家加速%',  `你快 \uFFFF%`,                       Math.round((pSpeed-1)*100)],
  ['敌人减速%',  `敌人慢 \uFFFF%`,                     Math.round((1-gSpeed)*100)],
  ['连击窗口',   `约 <b>\uFFFF 秒</b>没吃到才断`,      comboWin],
  ['传送门冷却', `冷却 <b>\uFFFF 秒</b>`,              portalCd],
];

const fail = [];
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
const boostText = `全部计分项目统一提高 ${Math.round((BOOST-1)*100)}%`;
if (!helpHtml.includes(boostText)) fail.push(`网页玩法说明没有写明「${boostText}」`);
if (!helpHtml.includes('最终入账取整')) fail.push('网页玩法说明没有交代半分最终取整');
const bountyWan = bounty / 10000;
const bountySequence = `${plainNum(bountyWan)}万 → ${plainNum(bountyWan*2)}万 → ${plainNum(bountyWan*3)}万`;
if (!helpHtml.includes(bountySequence)) fail.push(`网页玩法说明里的敌人悬赏不是「${bountySequence}」`);

// 英文入口是同域下另一份可玩的完整逻辑，分数和共用排行榜也必须同步。
const enHelpStart = en.indexOf('<div class="help-doc">');
const enHelpEnd = en.indexOf('id="helpCloseBtn"', enHelpStart);
if (enHelpStart < 0 || enHelpEnd < 0) throw new Error('定位不到英文版说明段落');
const enHelp = en.slice(enHelpStart, enHelpEnd);
const enChecks = [
  ['统一提升', 'All scoring is 30% higher than before.'],
  ['旧榜换算', 'previous leaderboard scores are converted at 1.3×'],
  ['豆子', `<b>${10*MULT}</b> × Combo`],
  ['能量星', `<b>${50*MULT}</b> × Combo`],
  ['相位晶石', `<b>${300*MULT}</b> × Combo`],
  ['敌人悬赏', `${bounty/1000}k → ${bounty*2/1000}k → ${bounty*3/1000}k`],
  ['整关无伤', `<b>${bonus('PERFECT_LEVEL')*MULT}</b> × level`],
  ['全灭对手', `<b>${bonus('GHOST_SWEEP')/1000}k</b>`],
  ['剩余生命', `<b>${bonus('LIFE_LEFT')*MULT}</b> × lives`],
  ['全程无伤', `<b>${bonus('FLAWLESS_RUN')*MULT}</b>`],
];
for (const [what, text] of enChecks){
  if (!enHelp.includes(text)) fail.push(`英文版说明里「${what}」和代码对不上`);
}
if (!enHelp.includes('Half-points are rounded when banked')) fail.push('英文版没有交代小数分最终取整');
if (!en.includes(`const SCORE_BOOST = ${BOOST};`) || !en.includes(`const SCORE_MULT = ${MULT};`) ||
    !en.includes(`const GHOST_BOUNTY_STEP = ${bounty};`) ||
    !en.includes(`GHOST_SWEEP: ${bonus('GHOST_SWEEP')}`))
  fail.push('英文版的计分常量没有和中文版同步');
if (!/const SCORE_KEY = 'doudou\.scores\.v3'/.test(en) ||
    !/const PREVIOUS_SCORE_KEY = 'doudou\.scores\.v2'/.test(en) ||
    !/score:\s*Math\.round\(row\.score \* SCORE_BOOST\)/.test(en))
  fail.push('英文版没有同步 v2 → v3 排行榜迁移');
// 小游戏那份是纯文本，格式不同，只核关键几个数值出现在同一句话里
const uiChecks = [
  ['豆子',       `豆子[\\s\\S]{0,20}?${num2(10*MULT)} 分`],
  ['能量星分数', `能量星[\\s\\S]{0,20}?${num2(50*MULT)} 分`],
  ['相位晶石',   `相位晶石[\\s\\S]{0,20}?${num2(300*MULT)} 分`],
  ['敌人悬赏',   `${num2(bountyWan)}万 → ${num2(bountyWan*2)}万 → ${num2(bountyWan*3)}万`],
  ['整关无伤',   `整关无伤[\\s\\S]{0,20}?${num2(bonus('PERFECT_LEVEL')*MULT)}`],
  ['全灭对手',   `全灭对手[\\s\\S]{0,20}?${num2(bonus('GHOST_SWEEP')/10000)}万`],
  ['通关剩余命', `通关剩余命[\\s\\S]{0,20}?${num2(bonus('LIFE_LEFT')*MULT)}`],
  ['全程无伤',   `全程无伤[\\s\\S]{0,20}?${num2(bonus('FLAWLESS_RUN')*MULT)}`],
  ['恐惧起始秒', `${num2(fright[0])} 秒`],
  ['冲刺倍率',   `${num2(dash)} 倍`],
  ['连击窗口',   `${num2(comboWin)} 秒没吃到`],
  ['传送门冷却', `冷却 ${num2(portalCd)} 秒`],
];
for (const [what, pat] of uiChecks){
  if (!new RegExp(pat).test(ui)) fail.push(`小游戏那份说明里「${what}」和代码对不上`);
}
if (!ui.includes(boostText)) fail.push(`小游戏玩法说明没有写明「${boostText}」`);
if (!ui.includes('遇到半分最终取整')) fail.push('小游戏玩法说明没有交代半分最终取整');
/* 小程序那份是 WXML，数字包在 <text class="b"> 里，所以模式跟网页那份不一样，
   但要核的是同一批数。只截说明那一段，别拿整个文件搜 —— 这个坑前面踩过两次。 */
const wxHelpStart = hasWxml ? wxml.indexOf('<scroll-view class="help-doc"') : -1;
const wxHelpEnd   = hasWxml ? wxml.indexOf('</scroll-view>', wxHelpStart) : -1;
if (hasWxml && (wxHelpStart < 0 || wxHelpEnd < 0)){
  fail.push('定位不到小程序版的说明段落');
} else if (hasWxml) {
  const wxHelp = wxml.slice(wxHelpStart, wxHelpEnd);
  const wxChecks = [
    ['豆子',       `豆子</text>[\\s\\S]{0,12}?${num2(10*MULT)} × 连击`],
    ['能量豆分数', `能量豆</text>[\\s\\S]{0,12}?${num2(50*MULT)} × 连击`],
    ['水果',       `神秘水果</text>[\\s\\S]{0,12}?${num2(300*MULT)} × 连击`],
    ['整关无伤',   `整关无伤</text>[\\s\\S]{0,12}?${num2(bonus('PERFECT_LEVEL')*MULT)}`],
    ['全灭幽灵',   `全灭幽灵</text>[\\s\\S]{0,12}?${num2(bonus('GHOST_SWEEP')/10000)}万`],
    ['通关剩余命', `通关剩余命</text>[\\s\\S]{0,12}?${num2(bonus('LIFE_LEFT')*MULT)}`],
    ['全程无伤',   `全程无伤</text>[\\s\\S]{0,12}?${num2(bonus('FLAWLESS_RUN')*MULT)}`],
    ['恐惧起始秒', `${num2(fright[0])} 秒起`],
    ['恐惧末关秒', `第 6 关只剩 ${num2(fright[fright.length-1])} 秒`],
    ['冲刺倍率',   `提速到 ${num2(dash)} 倍`],
    ['玩家加速%',  `你快 ${Math.round((pSpeed-1)*100)}%`],
    ['幽灵减速%',  `幽灵慢 ${Math.round((1-gSpeed)*100)}%`],
    ['连击窗口',   `${num2(comboWin)} 秒</text>没吃到才断`],
    ['传送门冷却', `冷却 ${num2(portalCd)} 秒`],
  ];
  for (const [what, pat] of wxChecks){
    if (!new RegExp(pat).test(wxHelp)) fail.push(`小程序那份说明里「${what}」和代码对不上（代码是相关常量）`);
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
  return text.slice(a, b > a ? b : undefined);
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
  ['小游戏', section(ui, 'const HELP = [', '\n  ];')],
];
if (hasWxml) helpTargets.push(['小程序', wxHelpStart >= 0 ? wxml.slice(wxHelpStart, wxHelpEnd) : null]);
for (const [name, part] of helpTargets){
  if (!part) continue;
  for (const line of ABOUT_LINES){
    if (part.includes(line)) fail.push(`${name}版玩法说明里混进了「${line}」—— 它该只在「关于」页`);
  }
}

console.log('从代码读到的真值：');
console.log(`  全项目 +${Math.round((BOOST-1)*100)}%　倍率 ${MULT}　豆子 ${10*MULT}　能量星 ${50*MULT}　相位晶石 ${300*MULT}`);
console.log(`  奖励 无伤${bonus('PERFECT_LEVEL')*MULT} 全灭${bonus('GHOST_SWEEP')} 剩命${bonus('LIFE_LEFT')*MULT} 全程${bonus('FLAWLESS_RUN')*MULT}`);
console.log(`  恐惧 ${fright[0]}→${fright[fright.length-1]} 秒　冲刺 ${dash}x　连击 ${comboWin}s（停下 ${comboIdle}x）　传送门冷却 ${portalCd}s`);
const targetLabel = hasWxml ? '三份说明' : '网页与小游戏说明';
console.log('\n' + (fail.length ? '说明与代码对不上:\n  ' + fail.join('\n  ') : `${targetLabel}的数字都和代码一致；作者文字也只出现在「关于」页。`));
process.exit(fail.length ? 1 : 0);
