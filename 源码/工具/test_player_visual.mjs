// 玩家视觉回归：守住“通道里留得出路、动作跟路程走、吃豆不横向变胖”。
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
const fail = [];

const num = (name) => {
  const m = src.match(new RegExp('const\\s+' + name + '\\s*=\\s*([\\d.]+)'));
  if (!m) { fail.push(`找不到常量 ${name}`); return NaN; }
  return Number(m[1]);
};

const tile = num('TILE');
const size = num('PLAYER_SPRITE_SIZE');
const chomp = num('CHOMP_SECONDS');
const gait = num('PLAYER_GAIT_TILES');
const hop = num('PLAYER_HOP_PX');
const lean = num('PLAYER_LEAN_RAD');
const turn = num('PLAYER_TURN_SECONDS');
const threat = num('ENEMY_THREAT_TILES');
const threatBase = num('ENEMY_THREAT_BASE');
const enemySize = num('ENEMY_SPRITE_SIZE');

if (Number.isFinite(size) && (size < 28 || size > 30))
  fail.push(`豆豆图框是 ${size}px；应保持 28~30px，旧版 38px 会跨出 ${tile}px 通道`);
if (Number.isFinite(chomp) && (chomp < 0.08 || chomp > 0.11))
  fail.push(`吃豆动作 ${chomp}s；应在 0.08~0.11s 内收回，避免高速连吃时一直变形`);
if (Number.isFinite(gait) && (gait < 0.7 || gait > 1.0))
  fail.push(`步态周期 ${gait} 格；合理范围是 0.7~1.0 格`);
if (Number.isFinite(hop) && hop > 0.5)
  fail.push(`移动上跳 ${hop}px 太大，会重新变成机械蹦跳`);
if (Number.isFinite(lean) && lean > 0.06)
  fail.push(`转向倾斜 ${lean}rad 太大，会像要摔倒`);
if (Number.isFinite(turn) && (turn < 0.10 || turn > 0.16))
  fail.push(`转身动画 ${turn}s；应保持 0.10~0.16s，既看得见又不拖手`);
if (Number.isFinite(threat) && (threat < 3.5 || threat > 5))
  fail.push(`敌人追猎表情从 ${threat} 格开始；应保持 3.5~5 格的近距离压力`);
if (Number.isFinite(threatBase) && (threatBase < 0.3 || threatBase > 0.5))
  fail.push(`敌人基础凶相 ${threatBase}；追击时应始终可见，再由距离增强`);
if (Number.isFinite(enemySize) && enemySize !== 30)
  fail.push(`恶魔图框是 ${enemySize}px；必须保持 30px，避免跨出 ${tile}px 通道`);

const draw = src.slice(src.indexOf('function drawPlayer(){'), src.indexOf('function drawGhost(g){'));
if (/drawCharacterSprite\('player'/.test(draw))
  fail.push('玩家又退回正面静态贴图，四方向转身会看不出来');
if (/drawCharacterSprite\('player',\s*38\)/.test(draw))
  fail.push('旧的 38px 大头像又回来了');
if (!/updateDoudouFacing\(\)/.test(draw) || !/drawDirectionalDoudouFace\(facing,joy,powered\)/.test(draw))
  fail.push('豆豆没有使用四方向脸型或 120ms 转身状态');
if (!/const\s+powered\s*=\s*frightTimer\s*>\s*0/.test(draw)
    || !/const\s+body\s*=\s*powered\s*\?\s*cssVar\(['"]--amber['"]\)/.test(draw))
  fail.push('吃到能量星后豆豆没有整只切换成金色能量形态');
if (!/drawDoudouPowerAura\(powered,powerAura\)/.test(draw))
  fail.push('能量星的金色状态环丢了，前后状态会不够醒目');
if (!/drawDoudouTurnSwoosh\(turning\)/.test(draw))
  fail.push('豆豆转身的短弧提示丢了，高速转弯会不够醒目');
if (!/gaitPhase\s*=\s*player\.distTravelled/.test(draw))
  fail.push('步态没有跟 player.distTravelled 绑定');
if (/Math\.sin\(elapsed\s*\*\s*12\)/.test(draw) || /player\.mouth\s*\+=/.test(draw))
  fail.push('玩家动作又变成固定时间/按帧驱动，在不同刷新率下会忽快忽慢');
if (!/\(1-joy\*\.018\)\*\(1-turning\*\.14\)/.test(draw)
    || !/\(1\+joy\*\.025\)\*\(1\+turning\*\.035\)/.test(draw))
  fail.push('吃豆必须横向收窄、纵向伸展，不能再把身体横向撑大');
if (!/drawPlayerBiteSpark\(joy\)/.test(draw))
  fail.push('吃豆的小能量点反馈丢了');

const enemies = src.slice(src.indexOf('function enemyThreatLevel(g){'), src.indexOf('function render(){'));
const sprite = src.slice(src.indexOf('function drawCharacterSprite(id,size'), src.indexOf('function fitMazeCanvas(){'));
const ghostDefs = src.slice(src.indexOf('const GHOST_DEFS = ['), src.indexOf('function ghostDefsForLevel'));
if (!src.includes("assets/neon-stalkers-tracking-eyes-v9.webp") || !/const\s+sw=aw\/2,sh=ah\/2/.test(sprite))
  fail.push('四只留白眼球、圆润无尖刺的大眼追猎怪 2×2 图集没有接入');
for (const [id,color] of [['chaser','--cyan'],['ambush','--danger'],['shy','--tang'],['patrol','--pink']]) {
  if (!new RegExp(`id:['"]${id}['"][^}]*color:['"]${color}['"]`).test(ghostDefs))
    fail.push(`${id} 的游戏提示色没有与新图集保持一致（应为 ${color}）`);
}
if (/color:['"]--lime['"]/.test(ghostDefs))
  fail.push('旧的荧光绿敌人提示色仍在角色定义中');
if (!/ambush:\{w:1,h:1\}/.test(src) || /ambush:\{w:1\.22/.test(src))
  fail.push('拦拦仍被横向放大，30px 图框也会重新挤进墙体');
if (!/wx\.createImage\(\)/.test(src) || !/images\/neon-stalkers-tracking-eyes-v9\.webp/.test(src))
  fail.push('微信小游戏没有使用本地 images/ 恶魔图集');
if (!/const\s+CHARACTER_EYES\s*=/.test(src) || !/function\s+drawCharacterTrackingEyes\(g,size,threat=0\)/.test(src))
  fail.push('四种怪物各自的动态瞳孔锚点或绘制函数没有接入');
if (!/targetX=moving\?g\.dir\.x/.test(src) || !/targetY=moving\?g\.dir\.y/.test(src) || !/Math\.exp\(-visualFrameDt\*15\)/.test(src))
  fail.push('怪物黑瞳孔没有按移动方向平滑转向');
if (!/fillStyle=['"]#05030f['"]/.test(src) || !/drawCharacterTrackingEyes\(g,ENEMY_SPRITE_SIZE,threat\)/.test(src))
  fail.push('正常状态没有绘制清晰的大黑瞳孔');
if (!/else\s*\{\s*drawCharacterTrackingEyes\(g,ENEMY_SPRITE_SIZE,threat\);\s*\}/.test(src))
  fail.push('能量模式仍可能叠加正常黑瞳孔，叉眼状态会看不清');
if (!/imageSmoothingEnabled=false/.test(sprite) || !/globalCompositeOperation='source-over'/.test(sprite))
  fail.push('像素怪物没有关闭平滑或保留黑色粗轮廓，30px 下会重新发糊');
if (/fused-hidden|handleFusion|isFusionHost|fusedWith/.test(src))
  fail.push('敌人融合逻辑仍在发布源码中，四只角色可能再次合体或隐藏');
if (/\.arc\(0,0,size\*\.53[\s\S]{0,40}?\.clip\(\)/.test(sprite))
  fail.push('恶魔仍被旧的圆形裁切限制，角、翼或尾巴会被切掉');
if (!/CHARACTER_DRAW\[id\]/.test(sprite) || !/ENEMY_SPRITE_BRIGHT_PASS_ALPHA/.test(sprite))
  fail.push('恶魔的小尺寸比例校准或轻量提亮丢了');
if (!/visualMode===['"]doze['"]/.test(sprite) || !/visualMode===['"]warning['"]/.test(sprite)
    || !/drawCharacterSprite\(g\.id,ENEMY_SPRITE_SIZE,spriteMode\)/.test(enemies))
  fail.push('能量星没有让整只恶魔进入冰蓝/白色可反击形态');
if (!/drawEnemyThreatFace\(g,threat,scale\)/.test(enemies))
  fail.push('恶魔接近玩家时没有追击锁定框');
if (!/drawEnemyThreatAura\(g,threat,scale\)/.test(enemies))
  fail.push('追击恶魔的方向尾流丢了');
if (!/g\.state!==['"]chase['"]/.test(enemies) || !/frightTimer>0/.test(enemies))
  fail.push('追猎表情没有限制在正常追击状态，可能在可反击时仍显得凶');

const phaseWalls = src.slice(src.indexOf('function drawMaze(){'), src.indexOf('function drawFruit(){'));
if (/Math\.floor\(elapsed\s*\*\s*6\)/.test(phaseWalls))
  fail.push('穿墙结束仍在整图硬闪');
if (!/PHASE_WALL_WARNING_HZ/.test(phaseWalls) || !/prefersReducedMotion\(\)/.test(phaseWalls))
  fail.push('穿墙结束的柔和提示或减少动态效果适配丢了');

if (fail.length){
  console.log('玩家视觉回归失败：\n  ✗ ' + fail.join('\n  ✗ '));
  process.exit(1);
}

console.log(`玩家视觉：${size}px 图框 / ${tile}px 通道，吃豆 ${chomp}s，步态每 ${gait} 格一轮。`);
console.log(`动作上限：上跳 ${hop}px，倾斜 ${lean}rad，转身 ${turn}s；${enemySize}px 恶魔，基础凶相 ${threatBase}，${threat} 格内继续增强。`);
