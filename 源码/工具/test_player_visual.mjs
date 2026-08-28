// 玩家视觉回归：守住“通道里留得出路、动作跟路程走、吃豆不横向变胖”。
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../pacman_fragment.html', import.meta.url), 'utf8');
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

const draw = src.slice(src.indexOf('function drawPlayer(){'), src.indexOf('function drawGhost(g){'));
if (/drawCharacterSprite\('player'/.test(draw))
  fail.push('玩家又退回正面静态贴图，四方向转身会看不出来');
if (/drawCharacterSprite\('player',\s*38\)/.test(draw))
  fail.push('旧的 38px 大头像又回来了');
if (!/updateDoudouFacing\(\)/.test(draw) || !/drawDirectionalDoudouFace\(facing,joy\)/.test(draw))
  fail.push('豆豆没有使用四方向脸型或 120ms 转身状态');
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
if (!/drawEnemyThreatFace\(g,threat,scale\)/.test(enemies))
  fail.push('敌人接近玩家时没有叠加压眉、尖牙追猎表情');
if (!/drawEnemyThreatAura\(g,threat,scale\)/.test(enemies))
  fail.push('追击敌人的红色尖刺剪影丢了');
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
console.log(`动作上限：上跳 ${hop}px，倾斜 ${lean}rad，转身 ${turn}s；敌人基础凶相 ${threatBase}，${threat} 格内继续增强。`);
