/* 自动生成，请勿手改。
 * 由 源码/工具/build_weapp.mjs 从 源码/neon_maze_fragment.html 提取。
 * 要改游戏逻辑，改网页版那一份，然后重新跑一次生成脚本。
 * 源码指纹: 61a8cb038219   （只跟 neon_maze_fragment.html 的内容走）
 */
function createGame(env){
  /* 浏览器全局一律从 env 取，声明成局部变量把宿主那份遮蔽掉。
   *
   * 为什么非这样不可：微信基础库 3.17 自带只读的 window 和 document，
   * 而那个 document 里没有 getElementById。试过替换全局（只读，装不上），
   * 也试过往宿主对象上补方法（对象本身也只读，补不进去），都失败了 ——
   * 逻辑一跑到 document.getElementById 就崩，游戏加载即黑屏。
   *
   * 局部变量则一定赢：它在词法作用域上遮蔽全局，宿主怎么锁都无关。
   * 这也比跟运行时较劲更稳 —— 基础库以后再改行为，这里都不用跟着改。 */
  const document = env.document;
  const window = env.window;
  const localStorage = env.localStorage;
  const getComputedStyle = env.getComputedStyle;
  const requestAnimationFrame = env.requestAnimationFrame;
  const cancelAnimationFrame = env.cancelAnimationFrame;
  const performance = env.performance;

/* ---------- maze data (generated + validated: fully connected, 19x21) ----------
 * Every maze keeps the same footprint, ghost-house box, tunnel row and player
 * spawn so the shared SPAWN / HOUSE_DOOR / HOUSE_EXIT_TILE / PATROL_ROUTE
 * constants below stay valid across levels — only the wall layout changes.
 * Each is validated 100% reachable by walking alone, with portals placed only
 * at true dead ends (never mid-corridor, which would strand pellets behind a
 * warp) and never on the ghost-house exit path (which would teleport ghosts
 * the instant they leave home).
 */
const MAZE_LEVEL_1 = [
"###################",
"#o....#.....#....o#",
"###.#.###.###.#.###",
"#1#...#.....#...#1#",
"#.#.#.#.#.#.#.#.#.#",
"#.#.#...#.#...#.#.#",
"#.#.#.###.###.#.#.#",
"#.....#.....#.....#",
"#.###.###D###.###.#",
"#...#.#ggggg#.#...#",
"T.....#ggggg#....oT",
"#...#.#ggggg#.#...#",
"#.###.###D###.###.#",
"#...#.........#...#",
"###.#####.#####.###",
"#.......#P#.......#",
"#.#######.#######.#",
"#.......#.#.......#",
"#.#####.#.#.#####.#",
"#o...2#.....#2....#",
"###################",
];

const MAZE_LEVEL_2 = [
"###################",
"#1.........o.....2#",
"###.#.#.#.#.#.#.###",
"#...#.#.#.#.#.#...#",
"#.#.#.#.#.#.#.#.#.#",
"#.#o#.#.#.#.#.#o#.#",
"#.###.#.#.#.#.###.#",
"#.#.....#.#.....#.#",
"#.#.#####D#####.#.#",
"#.#...#ggggg#...#.#",
"T.....#ggggg#.....T",
"#...#.#ggggg#.#...#",
"#.###.###D###.###.#",
"#.................#",
"#.#######.#######.#",
"#...#...#P#...#...#",
"###o#.#.#.#.#.#o###",
"#...#.#.....#.#...#",
"#.#.#.###.###.#.#.#",
"#2....#.....#....1#",
"###################",
];

const MAZE_LEVEL_3 = [
"###################",
"#1...o#.....#o...2#",
"#.###.#.###.#.###.#",
"#.....#.....#.....#",
"#.#######.#######.#",
"#.#.............#.#",
"#.#####.#.#.#####.#",
"#.#.....# #.....#.#",
"#.#.#####D#####.#.#",
"#.#...#ggggg#...#.#",
"T.....#ggggg#.....T",
"#o..#.#ggggg#.#..o#",
"###.#.###D###.#.###",
"#...#.........#...#",
"#.#.#####.#####.#.#",
"#.#.#....P....#.#.#",
"#.#.#.###.###.#.#.#",
"#.#...#.....#...#.#",
"#.#.#.#.###.#.#.#.#",
"#2..o.#.....#.o..1#",
"###################",
];

const MAZE_LEVEL_4 = [
"###################",
"#1..#....o....#..2#",
"#.#.###.#.#.###.#.#",
"#.#...#.....#...#.#",
"#.###.#.###.#.###.#",
"#.#...#.....#...#.#",
"#.#.###.#.#.###.#.#",
"#.#.............#.#",
"#.###.###D###.###.#",
"#...#.#ggggg#.#...#",
"T.....#ggggg#.....T",
"#o#.#.#ggggg#.#.#o#",
"###.#.###D###.#.###",
"#.....#.....#.....#",
"#.###.###.###.###.#",
"#...#....P....#...#",
"###.#####.#####.###",
"#...#.........#...#",
"#.###.#######.###.#",
"#2..o.........o..1#",
"###################",
];

const MAZE_LEVEL_5 = [
"###################",
"#1##o.........o##2#",
"#.###.###.###.###.#",
"#.......#.#.......#",
"#.#.###.#.#.###.#.#",
"#...#..o...o..#...#",
"#####.## .###.#####",
"#.#.............#.#",
"#.#.#####D#####.#.#",
"#...#.#ggggg#.#...#",
"T.....#ggggg#.....T",
"#.#...#ggggg#...#.#",
"#.#.#.###D###.#.#.#",
"#.#.#.........#.#.#",
"#.#####.#.#.#####.#",
"#.......#P#.......#",
"#####.###.###.#####",
"#.o.#...#.#...#.o.#",
"#.#.###.#.#.###.#.#",
"#2...............1#",
"###################",
];

const MAZE_LEVEL_6 = [
"###################",
"#1##o...#.#...o##2#",
"#.###.#.#.#.#.###.#",
"#.....#.....#.....#",
"#.#.#.#.#.#.#.#.#.#",
"#...#...#o#...#...#",
"#####.#.#.#.#.#####",
"#o#...#.....#...#o#",
"#.#.#####D#####.#.#",
"#.#...#ggggg#...#.#",
"T.....#ggggg#.....T",
"#.....#ggggg#.....#",
"#.#.#####D#####.#.#",
"#.#.............#.#",
"#.#######.#######.#",
"#..o....#P#....o..#",
"#######.#.#.#######",
"#.......#.#.......#",
"#.#.#####.#####.#.#",
"#2...............1#",
"###################",
];

const MAZE_TEMPLATES = [
  MAZE_LEVEL_1, MAZE_LEVEL_2, MAZE_LEVEL_3,
  MAZE_LEVEL_4, MAZE_LEVEL_5, MAZE_LEVEL_6,
];
/** Total levels in a run; clearing this many ends the game in victory. */
const MAX_LEVEL = 6;

/* 每关一个短名字。
   六关本来只有"比上一关难一点"的区别，玩家记不住任何一关。名字挑的是**这一关
   真正新增的那件事**，不是形容词：第 2 关多一只追击者、第 3 关满图传送门、
   第 6 关七只幽灵且恐惧只剩 5 秒。这样名字就是提示，不是装饰。 */
const LEVEL_NAMES = ['初入迷宫', '猎手苏醒', '虫洞交错', '四面围猎', '极速追击', '终极迷宫'];
function levelName(lvl){ return LEVEL_NAMES[(Math.max(1,lvl)-1) % LEVEL_NAMES.length]; }

/* ---------- 开关前的关卡卡片 ----------
 *
 * 每关开打前定住一下，报出"第 N 关 · 名字"。为的是让六关各自留下记忆点——
 * 玩家事后该记得"第三关那个满地传送门"，而不是"第三关比第二关难一点"。
 *
 * 画在**棋盘画布**上，不做成 DOM 弹层：网页 / 小游戏 / 小程序 / iOS 四个端
 * 共用同一个 render()，画在画布上四端自动都有；做成弹层则要在小游戏的 canvas
 * UI 和小程序的 WXML 里各接一遍（BEST 那次就是这么接的，接了三处）。
 *
 * 这段时间里整局是**冻住**的：loop 跳过 update，所以 elapsed 不走、幽灵不动、
 * 恐惧和复活的计时也不走。街机的 READY! 就是这个作用——给玩家一个"看清楚
 * 这是哪一关"的空拍，而不是一睁眼幽灵已经压到脸上。
 */
// 1.8 → 1.4：第一次看很舒服，但重开时每次都等 1.8 秒就显得拖。
// 1.3~1.5 是玩家给的可接受区间，取中。开场期间整局仍然冻结。
const LEVEL_INTRO_SECONDS = 1.4;
let introTimer = 0;

function startLevelIntro(){ introTimer = LEVEL_INTRO_SECONDS; }

function drawLevelIntro(){
  if (introTimer <= 0) return;
  const W = COLS*TILE, H = ROWS*TILE;
  // 进场淡入、退场淡出，中间实打实停一会儿
  const k = introTimer / LEVEL_INTRO_SECONDS;          // 1 -> 0
  const fade = Math.min(1, Math.min(k, 1-k) / 0.22);

  ctx.save();
  ctx.globalAlpha = 0.82 * fade;
  ctx.fillStyle = 'rgba(6,3,16,1)';
  ctx.fillRect(0, H/2 - TILE*2.4, W, TILE*4.8);
  // 上下两道细光边，把这块和棋盘分开
  ctx.globalAlpha = 0.5 * fade;
  ctx.fillStyle = cssVar('--wall');
  ctx.fillRect(0, H/2 - TILE*2.4, W, 1);
  ctx.fillRect(0, H/2 + TILE*2.4 - 1, W, 1);

  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.95 * fade;
  ctx.fillStyle = cssVar('--text-dim');
  ctx.font = `600 ${Math.round(TILE*0.62)}px ${cssVar('--font-display') || 'monospace'}`;
  ctx.fillText(`LEVEL ${level}`, W/2, H/2 - TILE*0.55);

  ctx.globalAlpha = fade;
  ctx.fillStyle = cssVar('--amber');
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16 * fade;
  ctx.font = `700 ${Math.round(TILE*1.15)}px ${cssVar('--font-display') || 'monospace'}`;
  ctx.fillText(levelName(level), W/2, H/2 + TILE*1.05);
  ctx.restore();
}
const COLS = MAZE_LEVEL_1[0].length; // 19
const ROWS = MAZE_LEVEL_1.length;    // 21
const TILE = 26;
const canvas = document.getElementById('mazeCanvas');
canvas.width = COLS*TILE; canvas.height = ROWS*TILE;
const ctx = canvas.getContext('2d');

/* 敌人美术是一次加载、每帧 drawImage 的贴图；加载失败时下面仍保留完整的
   Canvas 矢量兜底。这样精细度不再依赖每帧堆 shadowBlur，弱机也更轻。 */
const IS_WECHAT_MINIGAME =
  typeof wx !== 'undefined' && typeof wx.createImage === 'function';
const makeCharacterImage = IS_WECHAT_MINIGAME
  ? ()=>wx.createImage()
  : (typeof Image === 'function' ? ()=>new Image() : null);
let characterAtlas = null, characterAtlasReady = false;
if (makeCharacterImage){
  characterAtlas = makeCharacterImage();
  characterAtlas.decoding = 'async';
  characterAtlas.onload = ()=>{ characterAtlasReady = true; staticFrameDirty = true; };
  characterAtlas.src = IS_WECHAT_MINIGAME
    ? 'images/neon-stalkers-tracking-eyes-v9.webp'
    : 'assets/neon-stalkers-tracking-eyes-v9.webp';
}
const CHARACTER_CELL = {
  chaser:[0,0], ambush:[1,0], shy:[0,1], patrol:[1,1]
};
/* 四格统一按 30px 图框绘制。旧版诡计魔额外放宽到 1.22 倍，视觉会跨进墙体；
   这里把四只都收回同一通道尺度，碰撞体与 AI 坐标完全不变。 */
const CHARACTER_DRAW = {
  chaser:{w:1,h:1}, ambush:{w:1,h:1},
  shy:{w:1,h:1}, patrol:{w:1,h:1}
};
const ENEMY_SPRITE_SIZE = 30;
const ENEMY_SPRITE_BRIGHT_PASS_ALPHA = .26;

/* 眼白留在贴图里，黑瞳孔由 Canvas 单独画。每种脸的两只眼睛大小和倾斜都不同，
   所以这里记录各自的中心、瞳孔半径与可移动范围；坐标以 30px 游戏尺寸为基准。
   大小眼的不对称继续保留，但四只怪都会明确看向自己的行进方向。 */
const CHARACTER_EYES = {
  chaser:[{x:-5.43,y:.60,r:1.78,tx:1.35,ty:1.35},{x:6.61,y:3.14,r:1.32,tx:1.08,ty:.62}],
  ambush:[{x:-6.35,y:3.00,r:1.34,tx:1.08,ty:.62},{x:6.63,y:3.20,r:1.34,tx:1.08,ty:.62}],
  shy:[{x:-5.36,y:.64,r:1.78,tx:1.30,ty:1.58},{x:6.41,y:2.38,r:1.45,tx:1.00,ty:1.12}],
  patrol:[{x:-5.87,y:.61,r:1.82,tx:1.34,ty:1.58},{x:6.33,y:3.76,r:1.25,tx:.92,ty:.58}]
};

function drawCharacterSprite(id,size,visualMode='normal'){
  if (!characterAtlasReady || !characterAtlas || !CHARACTER_CELL[id]) return false;
  const cell=CHARACTER_CELL[id];
  const fit=CHARACTER_DRAW[id] || {w:1,h:1};
  const aw=characterAtlas.naturalWidth||characterAtlas.width||256;
  const ah=characterAtlas.naturalHeight||characterAtlas.height||256;
  const sw=aw/2,sh=ah/2,dw=size*fit.w,dh=size*fit.h;
  ctx.save();
  /* tracking-eyes-v9 是透明底、截图校色、圆润无尖刺并保留可爱小嘴的硬边像素图；
     贴图只留眼白，黑瞳孔由 drawCharacterTrackingEyes 按移动方向实时绘制。
     关掉平滑，30px 时异形眼睛、轮廓和面罩才不会被浏览器抹成一团；
     第一遍正常覆盖保住黑色粗轮廓，第二遍 screen 只加轻微霓虹。
     可反击时整张贴图统一变成冰蓝/白色；即使小程序端不支持 filter，下面仍会画
     睡眠光罩和叉眼，所以状态不会只靠颜色传达。 */
  ctx.imageSmoothingEnabled=false;
  ctx.globalCompositeOperation='source-over';
  if (visualMode==='doze') ctx.filter='grayscale(1) sepia(.35) hue-rotate(155deg) saturate(1.7) brightness(1.55)';
  else if (visualMode==='warning') ctx.filter='grayscale(1) brightness(2.05)';
  ctx.drawImage(characterAtlas,cell[0]*sw,cell[1]*sh,sw,sh,-dw/2,-dh/2,dw,dh);
  ctx.globalCompositeOperation='screen';
  ctx.globalAlpha=ENEMY_SPRITE_BRIGHT_PASS_ALPHA;
  ctx.drawImage(characterAtlas,cell[0]*sw,cell[1]*sh,sw,sh,-dw/2,-dh/2,dw,dh);
  ctx.restore();
  return true;
}

function drawCharacterTrackingEyes(g,size,threat=0){
  const eyes=CHARACTER_EYES[g.id];
  if (!eyes) return;
  const moving=!!(g.dir.x||g.dir.y);
  const targetX=moving?g.dir.x:(Number.isFinite(g.eyeLookX)?g.eyeLookX:0);
  const targetY=moving?g.dir.y:(Number.isFinite(g.eyeLookY)?g.eyeLookY:-1);
  if (!Number.isFinite(g.eyeLookX)) g.eyeLookX=targetX;
  if (!Number.isFinite(g.eyeLookY)) g.eyeLookY=targetY;
  /* 约 0.15 秒从旧方向滑到新方向，转弯时能清楚看到瞳孔穿过眼睛，而不是瞬移。 */
  const follow=1-Math.exp(-visualFrameDt*15);
  g.eyeLookX+=(targetX-g.eyeLookX)*follow;
  g.eyeLookY+=(targetY-g.eyeLookY)*follow;
  const sizeScale=size/ENEMY_SPRITE_SIZE;
  ctx.save();
  eyes.forEach(eye=>{
    const px=(eye.x+g.eyeLookX*eye.tx)*sizeScale;
    const py=(eye.y+g.eyeLookY*eye.ty)*sizeScale;
    const radius=eye.r*(1+threat*.12)*sizeScale;
    /* 几乎纯黑的大瞳孔是最主要的恐惧信号；离豆豆越近，红色暗光越明显。 */
    ctx.fillStyle='#05030f';
    ctx.shadowColor=threat>.35?'rgba(255,58,103,.88)':'rgba(0,0,0,.82)';
    ctx.shadowBlur=(.55+threat*2.25)*sizeScale;
    ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,.82)';
    ctx.beginPath();ctx.arc(px-radius*.30,py-radius*.33,Math.max(.30*sizeScale,radius*.18),0,Math.PI*2);ctx.fill();
  });
  ctx.restore();
}

/* 让画布的**内部像素**跟上它实际被显示的大小。
 *
 * 原来这块画布固定 494x546 内部像素，而 CSS 把它按可用高度拉伸 —— 在一台
 * 1280x900 的窗口上实测被拉到 593x655，等于每个像素放大 1.2 倍；而这还是
 * devicePixelRatio=1 的情况。在 Mac、iPhone 这类 2 倍屏上就是 2.4 倍欠采样。
 * 这游戏整个观感靠的是霓虹细线和光晕，糊掉的正是它最值钱的部分。
 *
 * 同一份文件里的烟花画布（fxResize）从一开始就是这么做的，主画布反而漏了。
 *
 * 逻辑始终按 494x546 这套坐标画，不改一行绘制代码：把缩放交给变换矩阵。
 *
 * dpr 上限取 2：3 倍屏（多数安卓旗舰和 iPhone Pro）按原样就是 9 倍的填充量，
 * 而 2 倍和 3 倍在这种尺寸的线条上肉眼已经分不出来，不值得拿帧率换。
 */
const DPR_CAP = 2;
/* 只有网页版自己管这块画布的尺寸。
 *
 * 微信那两版的外壳各有各的算法，尤其小游戏版把画布铺满整个屏幕、再用 translate
 * 把迷宫摆到中间 —— 那边要是按"画布宽 / 494"去算缩放，会得出一个完全不对的
 * 倍数，还会把外壳的位移一起抹掉。
 *
 * 判据必须是"这是不是一块真的 DOM 画布"，不能是"它有没有某个方法"。
 * 第一版写的是 typeof canvas.getBoundingClientRect === 'function'，结果小游戏
 * 版当场崩了 —— 我们自己的垫片给假元素补了 getBoundingClientRect，它返回的还是
 * 非零尺寸，于是守卫形同虚设。冒烟测试逮住的。
 * instanceof 骗不过去：垫片造的是普通对象，无论补了多少方法都不是 HTMLCanvasElement。 */
const CAN_OWN_CANVAS =
  typeof HTMLCanvasElement === 'function' &&
  canvas instanceof HTMLCanvasElement &&
  typeof ctx.setTransform === 'function';

/* 墙的离屏缓存状态。声明必须放在 fitMazeCanvas 首次执行（下面初始化那几行）
   之前 —— 它一改尺寸就会标脏，let 若在更后面就是一颗加载即炸的 TDZ 雷。
   缓存本身的画法见 buildWallEdges 旁边那段。 */
let wallCache = null;        // 离屏画布；null = 还没建或环境建不出来
let wallCacheDirty = true;   // 建关/换关、resize 之后要重画
let wallCacheFailed = false; // 离屏不可用（微信垫片等）时退回每帧现画
let dotCache = null;         // 普通豆子同样是静态层，吃到时只擦掉对应小块
let dotCacheDirty = true;
let dotCacheFailed = false;
let staticFrameDirty = true; // 开始/暂停/结算页只在必要时重画一次

function fitMazeCanvas(){
  if (!CAN_OWN_CANVAS) return;
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;                            // 还没布局好，等下一次
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  /* 高度必须从宽度和固定地图比例推导，不能再读取 r.height。
     canvas 的 CSS height:auto 会参考 intrinsic ratio；如果又把量到的高度反写回
     intrinsic height，四舍五入误差会触发 ResizeObserver 一直长高，顺带每次
     重建墙缓存。1280×738 上已经实测复现 592→598→605→611… 的漂移。 */
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(w * ROWS / COLS));
  if (canvas.width === w && canvas.height === h) return;   // 尺寸没变就别动
  /* 给 canvas.width 赋值会清空画布并**重置变换矩阵**，所以这两件事必须
     一起做，而且只在真的变了的时候做 —— 每帧无脑设一次等于每帧清一次屏。 */
  canvas.width = w; canvas.height = h;
  wallCacheDirty = true;   // 内部像素变了，墙的离屏缓存要按新尺寸重画
  dotCacheDirty = true;
  staticFrameDirty = true;
}

/* 变换在每帧开头设，不是在 fitMazeCanvas 里设一次就完。
   绘制代码里有大量 save/restore，任何一处配对不当都会把矩阵带回默认值，
   而那种错只在某个特定状态下出现，极难查。每帧重设一次是 O(1)，买个踏实。 */
function applyMazeTransform(){
  if (!CAN_OWN_CANVAS) return;   // 微信两版由各自外壳设好变换，不许覆盖
  ctx.setTransform(canvas.width / (COLS*TILE), 0, 0, canvas.height / (ROWS*TILE), 0, 0);
}

/* 画布的显示尺寸不只在窗口缩放时变：开打之后标题栏会收起（body.in-game），
   可用高度一变，CSS 算出来的棋盘尺寸就跟着变。只听 window.resize 是漏的，
   所以用 ResizeObserver 直接盯这块画布本身。
   没有 ResizeObserver 的环境（以及微信）退回 resize 事件，再不行就算了 ——
   fitMazeCanvas 本身对"量不到尺寸"是安全的。 */
if (CAN_OWN_CANVAS){
  if (typeof ResizeObserver === 'function') new ResizeObserver(fitMazeCanvas).observe(canvas);
  else if (window.addEventListener) window.addEventListener('resize', fitMazeCanvas);
  fitMazeCanvas();
}

/** Cycles through the available mazes once levels outrun the list. */
function templateForLevel(lvl){
  return MAZE_TEMPLATES[(Math.max(1, lvl) - 1) % MAZE_TEMPLATES.length];
}

function emptyGrid(){
  return templateForLevel(level).map(row=>row.split(''));
}

/* entity-specific walkability */
function walkableFor(ch, kind){
  if (ch === '#') return false;
  if (ch === 'g') return kind !== 'player';
  if (ch === 'D') return kind !== 'player';
  return true;
}

/* ---------- game state ---------- */
let grid, pelletsLeft, pelletsTotal, score, level, lives, combo, comboTimer, gameState, startTime, elapsed, frightTimer = 0;
let currentRunId = '', runActiveSeconds = 0, lastCloudEntry = null;
let ghosts, player, fruit, toastTimer, invuln, warpCooldownEntities;

/* ---------- bonus scoring ----------
 * Four bonuses, each rewarding a different skill so they don't all pay out for
 * the same behaviour:
 *   PERFECT_LEVEL  clear a level untouched — scaled by level number, since the
 *                  later ones are genuinely harder
 *   GHOST_SWEEP    eat every ghost within ONE power pellet's fixed 9s window
 *   LIFE_LEFT      each life still in hand at the finish
 *   FLAWLESS_RUN   clear all six levels without dying once
 * Every award is logged so the player is told WHAT they earned and why — an
 * unexplained score jump just reads as noise.
 */
/* GHOST_SWEEP 是**最终分**，不乘 SCORE_MULT（见 awardBonus 的 raw）。
   本版所有计分统一比上一版提高 30%：全灭从 100000 调到 130000；
   其余三项仍是基础分，经 SCORE_MULT 从原来的 1.5 提到 1.95。 */
const BONUS = { PERFECT_LEVEL: 1000, GHOST_SWEEP: 130000, LIFE_LEFT: 1500, FLAWLESS_RUN: 10000 };

/* 2026-09-03：六关采用第一关的基础速度，不再随关卡提速。
   地图、敌人数量和 AI 保持原样；能量减速、失败辅助也在各关使用同一套倍率。 */
const GHOST_BASE_SPEED = 2.35;
let deathsThisLevel = 0, deathsThisRun = 0, sweepsThisRun = 0, ghostsEatenThisRun = 0;
// 星星第三颗看的是「这一关」反杀了几只，所以不能复用 ThisRun 那个。
let ghostsEatenThisLevel = 0;
/* 无伤通过的关数。不能拿 MAX_LEVEL - deathsThisRun 去反推——一关里可能死好几次，
   那样算出来会偏低甚至变成负数。只能在过关那一刻按 deathsThisLevel 数。 */
let perfectLevelsThisRun = 0;
let levelBonuses = [];   // earned within the current level, shown on level clear
let runBonuses = [];     // everything across the run, shown on the end screen

/* 这几个声明刻意放在**所有写入之前**（resetLevel 一进场就写它们）——
   声明跟在写入后面是一颗 TDZ 雷：哪天有人把调用挪前一点，炸点离源头很远。 */
let ghostEatChain = 0;              // 同一颗能量豆内连续吃了几只（悬赏阶梯）
let deathPause = 0, deathFlash = 0; // 死亡定格与红闪，见 loseLife
let comboMilestoneHit = 0;          // 本局连击里程碑已报到哪档，见 checkComboMilestone
/* 温柔降难：同一关连续死 3 次（中途没通关），本关幽灵速度 ×0.9。
   运行时乘数 —— GHOST_BASE_SPEED 不变；过关或手动重开时归 1。
   只存内存，不落盘。 */
let mercySpeedMult = 1;

/**
 * Global payout multiplier. EVERY point earned goes through addScore, so the
 * multiplier is applied in exactly one place — the toasts and the end-screen
 * breakdown all read back the returned amount rather than the base figure,
 * which is what keeps "幽灵! +400" and the score counter telling the same story.
 * Raising a base constant instead would have meant touching four call sites and
 * every string that quotes one.
 */
/* 2026-08-31：所有现行得分在上一版基础上统一提高 30%。
   非 raw 项目原来乘 1.5，现在乘 1.5 × 1.30 = 1.95。 */
const SCORE_BOOST = 1.3;
const SCORE_MULT = 1.95;
/* 本轮只增加能续连击的收集/反击奖励。固定结算奖励和历史成绩不再放大。 */
const COMBO_SCORE_BOOST = 1.3;

/** 吃幽灵的悬赏步长：同一颗能量豆内第 n 只 = n × 这个数。不乘 SCORE_MULT。
 *  上一版基础步长 13000；本轮经 addComboScore 再 ×1.3，实际每级 16900。 */
const GHOST_BOUNTY_STEP = 13000;

/**
 * Adds points at the current multiplier and returns what was actually banked.
 * Rounded because SCORE_MULT can produce fractional points; an arcade score
 * must still bank and display whole numbers. The help text states this rule.
 */
function addScore(base, raw){
  // raw=true 跳过历史总倍率 1.95；本轮连击加成只由 addComboScore 负责。
  const points = raw ? Math.round(base) : Math.round(base * SCORE_MULT);
  score += points;
  return points;
}

/** @param raw 传 true 表示这个数字就是最终分，不再乘 SCORE_MULT。
 *  全灭用它：13 万已经是提高 30% 后的最终分，不能重复放大。 */
function awardBonus(label, base, raw){
  const points = addScore(base, raw);
  levelBonuses.push({ label, points });
  runBonuses.push({ label, points });
  updateHud();
  return points;
}

// 7 slots: the roster grows to 7 by the final level. All sit on ghost-house
// floor tiles (x 7..11, y 9..11 are 'g' in every maze).
const SPAWN = { player:{x:9,y:15}, ghosts:[
  {x:8,y:10},{x:10,y:10},{x:8,y:11},{x:10,y:11},
  {x:9,y:10},{x:9,y:11},{x:7,y:10},
] };
const HOUSE_DOOR = {x:9, y:8};
const HOUSE_EXIT_TILE = {x:9, y:7};

const GHOST_DEFS = [
  {id:'chaser',  color:'--cyan',   label:'闪闪'},
  {id:'ambush',  color:'--danger', label:'狐狐'},
  {id:'shy',     color:'--tang',   label:'软软'},
  {id:'patrol',  color:'--pink',   label:'慢慢'},
];

// 5th ghost, joins from level 2 on: a second chaser. Same id so every
// id-keyed lookup (targeting AI, color) treats it exactly like the first,
// but flagged `flank` so it aims beside the player instead of at them.
const EXTRA_CHASER_DEF = {id:'chaser', color:'--cyan', label:'闪闪', flank:true};
const FLANK_OFFSET_TILES = 4;

// 6th ghost (level 3+): an ambusher that reads much further ahead, so it cuts
// you off well before the regular ambusher would.
const EXTRA_AMBUSH_DEF = {id:'ambush', color:'--danger', label:'狐狐', lookahead:7};
// 7th ghost (final level only): a patroller running the loop backwards, so the
// two patrollers sweep opposite halves instead of trailing each other.
const EXTRA_PATROL_DEF = {id:'patrol', color:'--pink', label:'慢慢', reverseRoute:true};

/** Roster grows with the level: 4 -> 5 (L2) -> 6 (L3) -> 7 (final). */
function ghostDefsForLevel(lvl){
  const defs = GHOST_DEFS.slice();
  if (lvl >= 2) defs.push(EXTRA_CHASER_DEF);
  if (lvl >= 3) defs.push(EXTRA_AMBUSH_DEF);
  if (lvl >= MAX_LEVEL) defs.push(EXTRA_PATROL_DEF);
  return defs;
}
const PATROL_ROUTE = [{x:2,y:2},{x:16,y:2},{x:16,y:18},{x:2,y:18}];
const PATROL_ROUTE_REV = PATROL_ROUTE.slice().reverse();
/* 老巢只有一个出口。四只同时出发会在门口排成同一个像素团，看起来像又发生了
   一个色团。低关慢速时需要更大的时间差，高关速度快、数量多则缩短；换算成实际
   路程始终约 1.5～2 格，只改变开局队形，不改 AI、碰撞范围或最高速度。 */
const GHOST_RELEASE_GAP_BY_LEVEL = [0.90,0.75,0.65,0.55,0.45,0.40];
function ghostReleaseGap(){
  return GHOST_RELEASE_GAP_BY_LEVEL[level-1] || GHOST_RELEASE_GAP_BY_LEVEL[MAX_LEVEL-1];
}

/* ---------- durable local save ----------
 *
 * 旧版本把关键进度拆在多个 localStorage 键里。它们继续保留，避免升级时丢掉
 * 排行榜、图鉴和每日挑战；同时把玩家最在意的四项合成一个带版本号的稳定存档：
 * 最高分、已解锁关卡、星级和设置。读取时逐字段校验并从旧键合并，任意一个旧键
 * 损坏都不会拖垮其他数据。以后扩展结构只需迁移这一个入口。
 */
const LOCAL_SAVE_KEY = 'doudou.save.v1';
const LOCAL_SAVE_VERSION = 2;
const EMPTY_LOCAL_SAVE = () => ({
  version: LOCAL_SAVE_VERSION,
  playerId: '',
  highScore: 0,
  maxLevel: 1,
  stars: {},
  settings: { muted:false },
  updatedAt: '',
});
const saveObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
const saveInteger = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : fallback;
};
function backupCorruptJSON(key, raw){
  try { localStorage.setItem(key + '.corrupt.' + Date.now(), String(raw).slice(0, 20000)); } catch (e) {}
}
function readStoredJSON(key, diagnostic){
  try {
    const raw = localStorage.getItem(key);
    if (diagnostic) diagnostic.raw = raw;
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) {
      if (diagnostic) diagnostic.status = 'corrupt';
      backupCorruptJSON(key, raw);
      return null;
    }
  } catch (e) {
    if (diagnostic) diagnostic.status = 'unavailable';
    return null;
  }
}
function normalizeLocalStars(value){
  const stars = {};
  if (!saveObject(value)) return stars;
  for (let lv=1; lv<=MAX_LEVEL; lv++){
    const bits = value[lv];
    if (Number.isInteger(bits) && bits >= 0 && bits <= 7) stars[lv] = bits;
  }
  return stars;
}
function normalizeLocalSave(value){
  const clean = EMPTY_LOCAL_SAVE();
  if (!saveObject(value)) return clean;
  if (validPlayerId(value.playerId)) clean.playerId = value.playerId.toLowerCase();
  clean.highScore = saveInteger(value.highScore, 0, 1e12, 0);
  clean.maxLevel = saveInteger(value.maxLevel, 1, MAX_LEVEL, 1);
  clean.stars = normalizeLocalStars(value.stars);
  if (saveObject(value.settings)) clean.settings.muted = value.settings.muted === true;
  if (typeof value.updatedAt === 'string') clean.updatedAt = value.updatedAt.slice(0, 32);
  return clean;
}
function validPlayerId(value){
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function createPlayerId(){
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'){
      const id = crypto.randomUUID();
      if (validPlayerId(id)) return id.toLowerCase();
    }
  } catch (e) {}

  // 旧 WebView / 小游戏没有 randomUUID。这里只需要匿名稳定标识，不采集设备指纹。
  const bytes = new Uint8Array(16);
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
    else throw new Error('secure random unavailable');
  } catch (e) {
    for (let i=0; i<bytes.length; i++) bytes[i] = Math.floor(Math.random()*256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b=>b.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
function loadLocalSave(mutedFallback=false){
  const raw = readStoredJSON(LOCAL_SAVE_KEY);
  const saved = normalizeLocalSave(raw);
  const hasMuted = saveObject(raw) && saveObject(raw.settings)
    && typeof raw.settings.muted === 'boolean';
  if (!hasMuted) saved.settings.muted = mutedFallback;

  // 进度可以取并集；设置不能取 OR，否则玩家明确取消静音也会被旧键恢复。
  try {
    saved.maxLevel = Math.max(saved.maxLevel,
      saveInteger(localStorage.getItem('doudou.reached'), 1, MAX_LEVEL, 1));
    if (!hasMuted){
      const legacyMuted = localStorage.getItem('doudou.muted.v1');
      if (legacyMuted === '0' || legacyMuted === '1') saved.settings.muted = legacyMuted === '1';
    }
  } catch (e) {}
  const oldProgress = readStoredJSON('doudou.progress.v1');
  if (saveObject(oldProgress)){
    const oldStars = normalizeLocalStars(oldProgress.stars);
    for (let lv=1; lv<=MAX_LEVEL; lv++){
      if (oldStars[lv]) saved.stars[lv] = (saved.stars[lv] || 0) | oldStars[lv];
    }
  }
  return saved;
}
let localSave = loadLocalSave();
function saveLocalState(mutedOverride){
  // 中文/英文或两个游戏标签页共享存储。每次写前合并最新进度，防止陈旧页
  // 记录一次碰撞就把另一页新拿到的星星、解锁和最高分覆盖回去。
  const latest = loadLocalSave(localSave.settings.muted);
  if (validPlayerId(latest.playerId)) localSave.playerId = latest.playerId;
  localSave.highScore = Math.max(localSave.highScore, latest.highScore);
  localSave.maxLevel = Math.max(localSave.maxLevel, latest.maxLevel);
  for (let lv=1; lv<=MAX_LEVEL; lv++){
    const bits = (localSave.stars[lv] || 0) | (latest.stars[lv] || 0);
    if (bits) localSave.stars[lv] = bits;
  }
  // 只有用户点静音按钮时才覆盖设置；普通进度保存沿用最新明确选择。
  localSave.settings.muted = typeof mutedOverride === 'boolean'
    ? mutedOverride : latest.settings.muted;
  localSave.version = LOCAL_SAVE_VERSION;
  localSave.updatedAt = new Date().toISOString();
  try { localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(localSave)); return true; }
  catch (e) { return false; }
}
function getPlayerId(){
  const saved = readStoredJSON(LOCAL_SAVE_KEY);
  if (saveObject(saved) && validPlayerId(saved.playerId)) localSave.playerId = saved.playerId.toLowerCase();
  if (!validPlayerId(localSave.playerId)) localSave.playerId = createPlayerId();
  return localSave.playerId;
}
// 首次打开新版即落一份统一存档；存储不可用时仍保持内存态，不影响游戏。
getPlayerId();
saveLocalState();

/* 调色板全程不变，所以查一次就存下来。
 *
 * 之所以值得单独说：原来这行每次调用都是一次 getComputedStyle，而它被写在了
 * 画豆子的双层循环里 —— 实测第一关每帧 361 次。getComputedStyle 不是读个属性
 * 那么便宜，它会迫使浏览器把样式重新解析一遍，是那种不看数字永远不会怀疑到的
 * 大头。缓存之后每帧只剩十来次（各画一次就命中）。
 *
 * 前提是颜色真的不变：整份代码没有一处 setProperty / documentElement.style，
 * 也没有主题切换。哪天真要做换肤，记得在切换时 CSSVAR.clear()。 */
const CSSVAR = new Map();
const cssVar = (name)=>{
  let v = CSSVAR.get(name);
  if (v === undefined){
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    CSSVAR.set(name, v);
  }
  return v;
};

/* ---------- retro synthesized audio (no external assets) ---------- */
const Audio2 = (()=>{
  /* 静音状态要存下来。原来只活在内存里 —— 玩家特意关掉声音（比如在教室、
     在孩子睡觉的房间），下次打开又哗啦响起来，还得再关一次。
     键带版本号：以后要改语义（比如分成音效/音乐两档）时，老值不会被误读。
     存储在无痕模式或配额满时会直接抛，所以照例包一层。 */
  const MUTE_KEY = 'doudou.muted.v1';
  let actx = null, pelletToggle = 0;
  let muted = localSave.settings.muted;
  // Each entry is a [lo, hi] bite-tone pair, stepping up a pentatonic-ish scale
  // (A4/C5 -> C5/E5 -> D5/G5 -> E5/A5 -> G5/C6): musical intervals rather
  // than arbitrary frequencies, so later steps read as melody, not siren.
  const PELLET_SCALE = [
    [440, 523],
    [523, 659],
    [587, 784],
    [659, 880],
    [784, 1047],
  ];
  function ctx(){
    if (!actx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function unlock(){ ctx(); }
  function tone(freq, t0, dur, {type='square', gain=0.16, slideTo=null, slideDur=null}={}){
    const ac = ctx(); if (!ac || muted) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo,1), t0+(slideDur||dur));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0); osc.stop(t0+dur+0.03);
  }
  function now(){ const ac=ctx(); return ac ? ac.currentTime : 0; }
  return {
    unlock,
    setMuted(v){
      muted = !!v;
      localSave.settings.muted = muted;
      saveLocalState(muted);
      // 继续写旧键，让尚未更新的构建（例如旧微信包）仍能读到玩家选择。
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* 存不下就只在本次生效 */ }
    },
    isMuted(){ return muted; },
    /**
     * `progress` is 0 at the start of a level and 1 when the last pellet is
     * eaten. Rather than sliding the pitch continuously upward (which, on a
     * square wave, read as a siren winding up by the end of a level), the
     * two-tone bite pair steps up a short scale in whole discrete jumps —
     * a rounder triangle wave and an eased curve that holds near the base
     * pitch for most of the level and only climbs in the final stretch.
     */
    pellet(progress){
      const p = Math.max(0, Math.min(1, progress || 0));
      const step = Math.min(PELLET_SCALE.length - 1, Math.floor(p * p * PELLET_SCALE.length));
      const [lo, hi] = PELLET_SCALE[step];
      const t = now();
      pelletToggle = 1 - pelletToggle;
      const freq = pelletToggle ? hi : lo;
      const dur = 0.058 - p * 0.016;
      const gain = 0.115 - p * 0.02; // taper slightly so the higher steps don't read as louder/harsher
      tone(freq, t, dur, {type:'triangle', gain});
    },
    power(){ const t=now(); tone(220, t, 0.32, {type:'sawtooth', gain:0.14, slideTo:440, slideDur:0.32}); },
    /**
     * 吃幽灵。声音随第几只越来越隆重。
     *
     * 原来是固定的四个上行音，和吃豆子那声"哇卡"是同一个量级 —— 可现在一只
     * 幽灵值一万分，抵得上几百颗豆子，反馈却听不出区别，玩家不会觉得自己刚
     * 干了件大事。声音是这里唯一能表达"分量"的手段（画面上就是幽灵消失）。
     *
     * n 越大：音阶越长、起点越高、底下那记闷响越重。第四只往后加一层八度，
     * 听感上直接换一个档次。
     */
    eatGhost(n){
      const t = now();
      const k = Math.max(1, n || 1);
      // 五声音阶，避免半音带来的紧张感 —— 这是奖励，不是警报
      const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];
      const notes = Math.min(4 + k, 8);        // 音符数随只数增加
      const start = Math.min(k - 1, 4);        // 起点也往上挪
      for (let i = 0; i < notes; i++){
        const f = scale[Math.min(start + i, scale.length - 1)];
        tone(f, t + i*0.038, 0.1, { type:'triangle', gain:0.15 });
        // 第四只起叠一层高八度，厚度立刻不一样
        if (k >= 4) tone(f*2, t + i*0.038, 0.08, { type:'sine', gain:0.07 });
      }
      // 底下一记闷响，越靠后越沉，给"吃到大的"一个重量
      tone(150 - k*8, t, 0.18 + k*0.02, { type:'sine', gain:0.10 + k*0.02, slideTo:70, slideDur:0.2 });
    },
    /** 一次能量豆内全灭 —— 一段短促的上行号角，和单只区分开 */
    sweep(){
      const t = now();
      [523, 659, 784, 1047, 1319].forEach((f,i)=>{
        tone(f, t + i*0.07, 0.26, { type:'triangle', gain:0.16 });
        tone(f/2, t + i*0.07, 0.26, { type:'sine', gain:0.08 });
      });
    },
    warp(){ const t=now(); tone(300,t,0.22,{type:'sine',gain:0.14,slideTo:1200,slideDur:0.22}); },
    fruit(){ const t=now();
      // 吃到水果先"嗡"一下再叮 —— 那一声低频是"规则变了"的信号
      tone(90, t, 0.34, {type:'sine', gain:0.20, slideTo:200, slideDur:0.34});
      tone(700,t+0.06,0.09,{type:'triangle',gain:0.16}); tone(1050,t+0.15,0.16,{type:'triangle',gain:0.16}); },
    /** 连击里程碑（x10 / x20 / x50）：明亮的上行音阶，档越高音符越多、越亮。 */
    comboMilestone(m){
      const t=now();
      const tier = m>=50 ? 2 : m>=20 ? 1 : 0;
      const base = [587, 659, 784][tier];
      const n = 3 + tier;
      for (let i=0;i<n;i++){
        tone(base * Math.pow(1.26, i), t + i*0.05, 0.13, {type:'triangle', gain:0.12 + tier*0.02});
        if (tier >= 1) tone(base * Math.pow(1.26, i) / 2, t + i*0.05, 0.12, {type:'sine', gain:0.06});
      }
    },
    /** 穿墙倒数：3/2/1，越数越高越急 */
    phaseTick(n){ const t=now(); const f = n===3?520 : n===2?620 : 760;
      tone(f, t, 0.10, {type:'triangle', gain:0.13 + (3-n)*0.03}); },
    /** 穿墙结束：往下一沉，和吃到时的上扬正好相反 */
    phaseEnd(){ const t=now(); tone(300,t,0.26,{type:'sine',gain:0.15,slideTo:120,slideDur:0.26}); },
    death(){ const t=now(); [520,440,360,280,200].forEach((f,i)=>tone(f, t+i*0.11, 0.13, {type:'sawtooth', gain:0.15})); },
    levelUp(){ const t=now(); [440,554,660,880].forEach((f,i)=>tone(f, t+i*0.09, 0.14, {type:'square', gain:0.14})); },
    gameOver(){ const t=now(); [392,349,294,220,164].forEach((f,i)=>tone(f, t+i*0.16, 0.2, {type:'sawtooth', gain:0.15})); },
    victory(){ const t=now(); [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f, t+i*0.13, 0.22, {type:'triangle', gain:0.15})); },
    /* 破纪录的声音要和"游戏结束"截然相反：后者是下行的丧气音阶，前者一路往上。
       死了但破了纪录是个矛盾的时刻，声音必须替玩家定性——这是好事。 */
    newBest(){ const t=now(); [659,784,988,1319].forEach((f,i)=>{
      tone(f, t+i*0.11, 0.26, {type:'triangle', gain:0.17});
      tone(f/2, t+i*0.11, 0.26, {type:'sine', gain:0.08});
    }); },
  };
})();

function inBounds(x,y){ return y>=0 && y<ROWS && x>=0 && x<COLS; }
function tileAt(x,y){
  let nx=x, ny=y;
  if (nx<0) nx=COLS-1; if (nx>=COLS) nx=0;
  if (!inBounds(nx,ny)) return '#';
  return grid[ny][nx];
}

function resetLevel(fullReset){
  if (fullReset){ score=0; level=1; lives=3; }
  grid = emptyGrid();
  pelletsLeft = 0;
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++){
    const ch = grid[y][x];
    if (ch==='.' || ch==='o') pelletsLeft++;
  }
  pelletsTotal = pelletsLeft; // fixed at level load, so eating progress reads 0 -> 1
  buildEyeField();            // 迷宫定下来了，把眼睛的回家地图重算一遍
  buildWallEdges();           // 墙的线段表也只跟迷宫有关，一关算一次就够
  buildPortals();             // 传送门坐标表：checkPortal 和绘制都不用再全图扫
  wallCacheDirty = true;      // 墙的离屏缓存跟着迷宫一起失效
  dotCacheDirty = true;
  staticFrameDirty = true;
  const playerSpeed = 5.408 + (level-1)*0.2912;
  player = {
    x: SPAWN.player.x, y: SPAWN.player.y, dir:{x:0,y:0}, want:{x:0,y:0},
    baseSpeed: playerSpeed, speed: playerSpeed,
    mouth:0, chompT:1, visualLean:0,
    visualFacing:'down', visualFacingFrom:'down', visualFacingTarget:'down',
    visualTurnT:1, visualTurnSign:0,
    phase:0, alive:true, kind:'player', warpCd:0, warpCdCh:null,
    warpChoiceUntil:0,   // 传送落地后的思考时间，见 orientAfterWarp
    warpStandingOn:null, // 正踩着的那扇门（落地那扇不再触发）
    // odometer driving the distance-based turn buffer (see player control)
    distTravelled:0, wantAtDist:0,
    // tiles run without changing direction, and the fading motion trail it drives
    straightTiles:0, trail:[], trailAt:0,
  };
  const ghostSpeed = GHOST_BASE_SPEED;
  ghosts = ghostDefsForLevel(level).map((def,i)=>({
    ...def,
    kind:'ghost',
    x: SPAWN.ghosts[i].x, y: SPAWN.ghosts[i].y,
    dir:{x:0,y:-1},
    baseSpeed: ghostSpeed, speed: ghostSpeed,
    // 单门依次放行，避免同速敌人在出口永久叠成一团。
    state: i===0 ? 'exiting' : 'house',
    releaseAt: i * ghostReleaseGap(),
    warpCd:0, warpCdCh:null, warpStandingOn:null,
    eatenThisFright:false,   // 这一轮能量豆里已经被吃过一次，见 isEdible
    homeY:null,               // 走回老巢后停下的位置，见 'eaten' 分支
    routeIdx:0, wobble:Math.random()*Math.PI*2,
    eyeLookX:0, eyeLookY:-1,
  }));
  fruit = { active:false, x:9, y:13, timer:0, nextAt: 60, path:0 };
  comboTimer = 0; combo = 1;
  frightTimer = 0; ghostEatChain = 0;
  deathsThisLevel = 0; ghostsEatenThisLevel = 0; levelBonuses = [];
  mercySpeedMult = 1;   // 过关或重开：温柔降难复位（见 loseLife）
  introTimer = 0;   // 复位关卡时清掉卡片，免得它挂在上一关的画面上
  deathPause = 0; deathFlash = 0;
  if (fullReset){ deathsThisRun = 0; sweepsThisRun = 0; ghostsEatenThisRun = 0; perfectLevelsThisRun = 0; runBonuses = []; maxComboSeen = 1; comboMilestoneHit = 0;
    currentRunId = createPlayerId(); runActiveSeconds = 0; lastCloudEntry = null;
    if (window.NeonCompetition) window.NeonCompetition.reset();
    /* 每一局默认都**不是**每日挑战。startDaily 在 startPractice 回来之后才把它
       打开——放这儿而不是放 startDaily 里清，是为了让"忘了清"这件事不可能发生：
       任何开局路径都经过这里。 */
    dailyRun = false; }
  invuln = 2.4;
  /* 图鉴按"出过场"解锁，不按"抓到过你"。用被抓解锁的话，玩得好的孩子反而
     看不到图鉴 —— 那就把这一栏做成了对失败的奖励。见过就算见过。 */
  noteOwlsSeen(level);
  elapsed = 0;
}

/* ---------- 练习模式 ----------
 *
 * 起因是一位小玩家的原话："一失败就要从头开始，能不能从失败的那关开始。"
 * 卡在第五关的小孩，要重打前四关才能再试一次——那四关她早就会了，重复的
 * 部分不是挑战，是罚站。
 *
 * 但直接允许"从第五关继续"会毁掉通关这件事本身：六关连着打不死才叫通关，
 * 能接关的话这个成就就不值钱了，而通关的满足感恰恰是整个游戏的终点。
 *
 * 所以拆成两种模式，边界划得很硬：
 *   正式挑战：六关连打，计分、进排行榜、有评级、有通关庆祝
 *   练习：单独打某一关，**完全不计分**，没有排行榜、不更新最高分、
 *        清掉也不算通关，只说一句"练习完成"
 * 练习是拿来练手的，不是拿来刷成绩的——它换来的是"再试一次"的成本从
 * 四关变成零，而通关的含金量一分没少。
 *
 * 只能练**已经打到过**的关卡：没到过第五关就直接跳过去练，六关递进的设计
 * 就白做了，而且小孩会一头撞进远超自己水平的关卡。
 */
const REACHED_KEY = 'doudou.reached';
let practiceLevel = null;          // null = 正式挑战
let practiceOfferLevel = 1;        // 结算页那个「练习第 N 关」按钮指向哪一关

function maxLevelReached(){
  // 选关/每日挑战打开时再读最新解锁：另一标签页或兼容旧构建可能刚通关。
  // 这里只会在菜单和开局路径调用，避免每帧读存储；旧值也不能重新锁回关卡。
  const saved = readStoredJSON(LOCAL_SAVE_KEY);
  if (saveObject(saved)) localSave.maxLevel = Math.max(localSave.maxLevel,
    saveInteger(saved.maxLevel, 1, MAX_LEVEL, 1));
  try {
    localSave.maxLevel = Math.max(localSave.maxLevel,
      saveInteger(localStorage.getItem(REACHED_KEY), 1, MAX_LEVEL, 1));
  } catch (e) {}
  return localSave.maxLevel;
}
function noteLevelReached(lv){
  // 只有正式挑战里到达的关卡才算解锁 —— 练习不能拿来给自己解锁下一关
  if (practiceLevel) return;
  const reached = saveInteger(lv, 1, MAX_LEVEL, 1);
  if (reached <= localSave.maxLevel) return;
  localSave.maxLevel = reached;
  saveLocalState();
  // 双写旧键，兼容还在使用旧存档格式的其他构建。
  try {
    localStorage.setItem(REACHED_KEY, String(localSave.maxLevel));
  } catch (e) { /* 无痕模式就每次从第一关解锁起，不影响玩 */ }
}

function fullNewGame(){
  resetJoystick();
  /* 开新一局就取消上一局的「新」徽章，并把榜单收回前三 ——
     不然玩家回到开始页，看到的还是上一局残留的状态。 */
  justAddedId = null;
  boardExpanded = false;
  practiceLevel = null;
  resetLevel(true);
  gameState='ready';
  updateHud();
}

/** 开一局练习：只打这一关，打完就结束，全程不计分。 */
function startPractice(lv, analyticsModeName='practice'){
  resetJoystick();
  justAddedId = null;
  boardExpanded = false;
  const target = Math.max(1, Math.min(maxLevelReached(), lv));
  resetLevel(true);
  practiceLevel = target;
  level = target;
  resetLevel(false);
  updateHud();
  syncChrome();
  startLevelIntro();
  gameState = 'playing';
  Analytics.track('game_start',{mode:analyticsModeName,level:target});
}

/* ---------- movement helpers ---------- */
const DIRS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
function opposite(d){ return {x:-d.x,y:-d.y}; }
function nearCenter(v){ return Math.abs(v - Math.round(v)) < 0.001; }

/**
 * THE single rule for "may this entity enter that tile". Everything that asks
 * the question has to come through here.
 *
 * It exists because the question used to be answered in two places that
 * disagreed, and the mystery fruit's phase power was the casualty: stepEntity
 * allowed walking into a wall while phasing, but openDirs — which runs FIRST,
 * at every tile centre — filtered wall directions out unconditionally. So the
 * chooser had already zeroed the heading before the permissive check could ever
 * see it, and the phase branch in stepEntity was dead code. Eating the fruit
 * played the sound, paid the score, tinted the player cyan, and did nothing at
 * all. One rule, one place, so the two cannot drift apart again.
 *
 * Phasing is deliberately limited to '#' walls strictly inside the border: the
 * outer ring must stay solid or the player leaves the board entirely, and the
 * ghost house ('g'/'D') stays off-limits so the fruit can't be used to camp
 * inside it.
 */
function canEnter(ent, tx, ty){
  const ch = tileAt(tx, ty);
  if (walkableFor(ch, ent.kind)) return true;
  return ent.phase > 0 && ch === '#' &&
         tx > 0 && tx < COLS-1 && ty > 0 && ty < ROWS-1;
}

/* 结果复用同一个预分配数组：幽灵 AI 每帧每只都要问一次，次次新建 [] 是
   纯垃圾。所有调用方都是"拿出来立刻用完"（find/for/取下标），没有把返回
   值存起来跨帧用的，也没有嵌套调用 —— 哪天要加嵌套，先改回局部数组。 */
const OPEN_DIRS_BUF = [];
function openDirs(ent, excludeReverse){
  const cx = Math.round(ent.x), cy = Math.round(ent.y);
  const out = OPEN_DIRS_BUF;
  out.length = 0;
  for (const key in DIRS){
    const d = DIRS[key];
    if (excludeReverse && ent.dir.x===-d.x && ent.dir.y===-d.y && (ent.dir.x||ent.dir.y)) continue;
    if (canEnter(ent, cx+d.x, cy+d.y)) out.push(d);
  }
  return out;
}

function stepEntity(ent, dt, chooseDir, onArrive){
  // an entity can cross more than one tile-center within a single frame; onArrive
  // must fire for every one of them, not just wherever the entity ends the frame,
  // or things sitting mid-corridor (pellets, portals) get silently skipped.
  if (onArrive && nearCenter(ent.x) && nearCenter(ent.y)) onArrive(ent);
  let remaining = ent.speed*dt;
  let guard = 0;
  while (remaining > 1e-9 && guard++ < 8){
    const atCenter = nearCenter(ent.x) && nearCenter(ent.y);
    if (atCenter){
      ent.x = Math.round(ent.x); ent.y = Math.round(ent.y);
      const newDir = chooseDir(ent);
      if (newDir) ent.dir = newDir;
      if (ent.dir.x || ent.dir.y){
        // Same rule the chooser used — see canEnter. Duplicating the logic here
        // is what broke the phase power in the first place.
        if (!canEnter(ent, ent.x+ent.dir.x, ent.y+ent.dir.y)) ent.dir = {x:0,y:0};
      }
    }
    if (!(ent.dir.x || ent.dir.y)) break;
    // use floor/ceil (not round) so the "current cell" stays correct even once
    // the entity is more than halfway across the tile toward its destination
    const cellOf = (pos,d)=> d>0 ? Math.floor(pos+1e-9) : d<0 ? Math.ceil(pos-1e-9) : Math.round(pos);
    const distToCenter = ent.dir.x
      ? Math.abs((cellOf(ent.x,ent.dir.x)+ent.dir.x) - ent.x)
      : Math.abs((cellOf(ent.y,ent.dir.y)+ent.dir.y) - ent.y);
    const move = Math.min(remaining, distToCenter);
    ent.x += ent.dir.x*move; ent.y += ent.dir.y*move;
    remaining -= move;
    if (distToCenter - move < 1e-6){
      ent.x = Math.round(ent.x); ent.y = Math.round(ent.y);
      if (onArrive) onArrive(ent);
    }
  }
  // tunnel wrap
  if (ent.x < -0.5) ent.x = COLS-0.5;
  if (ent.x > COLS-0.5) ent.x = -0.5;
}

/** How long the mystery fruit lets the player walk through walls. */
const FRUIT_PHASE_SECONDS = 10;
/** 穿墙期间的速度倍率，同时顶替冲刺加成。见 applySpeedModifiers 里的说明。 */
const FRUIT_PHASE_SPEED_MULT = 0.88;

/**
 * Puts the player back on a legal tile if the phase power left them inside a
 * wall. Without this the run can SOFTLOCK outright: six wall tiles across
 * levels 2, 3 and 6 — the ones flanking the ghost-house door — have no
 * player-walkable neighbour at all, so once phase expires there, every
 * direction is refused and nothing can reach the player to kill them either.
 * The level cannot be finished and the game cannot be lost; the only way out
 * is to reload.
 *
 * Checked every frame rather than only at the moment phase hits zero, so any
 * other route into an illegal tile recovers too. BFS picks the nearest legal
 * tile, which is at most a step or two away and reads as being nudged out of
 * the wall.
 */
function rescueFromWall(){
  if (player.phase > 0) return;
  const px = Math.round(player.x), py = Math.round(player.y);
  if (walkableFor(tileAt(px,py), 'player')) return;

  const seen = new Set([`${px},${py}`]);
  const q = [[px,py]];
  while (q.length){
    const [x,y] = q.shift();
    for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
      const nx = x+dx, ny = y+dy;
      if (nx<0 || nx>=COLS || ny<0 || ny>=ROWS) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (walkableFor(tileAt(nx,ny), 'player')){
        player.x = nx; player.y = ny;
        player.dir = {x:0,y:0}; player.want = {x:0,y:0};
        player.straightTiles = 0; player.trail.length = 0; player.trailAt = player.distTravelled;
        return;
      }
      q.push([nx,ny]);
    }
  }
}

/* ---------- portal warp ---------- */
// 落地之后这么久，同色的门才会再次生效 —— 玩家有时间看清新环境、选个方向，
// 而不是被立刻弹回去。
// 1.0 秒起步，玩家试用后改成 2.0：一秒钟在被追的时候太短，人刚落地还没看清
// 局面就又能穿了，结果反而在两个角之间来回横跳，越跳越乱。
//
// 冷却是**按颜色分开算**的：走了红门，蓝门照样能立刻用。
//
// 原来一个 warpCd 管所有门，用了红的连蓝的一起锁。那是多锁的 —— 冷却存在的
// 唯一理由是"别刚落地就被弹回去"，而落点永远是**同色**的另一头，跟另一种
// 颜色毫无关系。四个角上两种颜色各占两格，红门的落点上不可能有蓝门，
// 所以分开算不会有任何来回弹的风险。
//
// 分开之后还多出一条真正的路线：红门跳过去、紧接着踩蓝门再跳一次。
// 被幽灵堵在角上时，这是一条能救命的连跳 —— 本来就该允许。
//
// 数值走过 1.0 → 2.0 → 1.2。一度需要 2.0，是因为它在兼职兜一个 bug：
// 站在落地那扇门上不动，冷却一到就会被自己传回去。那件事已经由上面的
// warpStandingOn 单独解决，冷却不必再当安全网，只剩一个职责 ——
// 别让传送门变成可以无限刷的走位手段。
// 现在试 0：完全不冷却。
// 敢归零是因为安全网已经不靠它了 —— 上面的 warpStandingOn 保证"站在落地那扇
// 门上永远不会再触发"，所以不会有自动来回弹射。归零之后想再穿一次，必须**自己
// 走回门上**，而每次落地又有 0.75 秒的选方向停顿，成本天然存在。
// 换来的是被追急时可以贴着传送门反复周旋 —— 这是不是好玩，得真人试了才知道。
const PORTAL_COOLDOWN_SECONDS = 0;

/**
 * 落地之后重新安顿好朝向、待转向和冲刺蓄力。
 *
 * 不做这一步的话，玩家是**朝着一堵墙、满速、还带着一个过期转向指令**落地的：
 *   - 朝向照搬穿越前的方向，可落点的走廊往往完全不是那个走向。实测多数
 *     传送门的落点**只有一个出口**（第一关四个全是），所以"落地面壁"是常态，
 *     玩家得先愣一下、再重按方向键才动得了。
 *   - want 是穿越前缓存的转向，跨过传送门之后早就没意义了，留着会在落点
 *     附近某个路口冷不丁触发一次莫名其妙的拐弯。
 *   - 冲刺蓄力原样保留 = 1.22 倍速落地。换了个完全陌生的角落还开着最高速，
 *     这是最难控的一点。
 *
 * 处理顺序刻意是"能直走就直走"优先：保住流畅感，只有走不通时才接管。
 */
function orientAfterWarp(ent){
  ent.want = {x:0, y:0};        // 过期的转向指令不跨传送门
  ent.straightTiles = 0;        // 换地方了，冲刺从零重新起
  if (ent.trail){ ent.trail.length = 0; ent.trailAt = ent.distTravelled || 0; }

  const cx = Math.round(ent.x), cy = Math.round(ent.y);
  const can = d => canEnter(ent, cx + d.x, cy + d.y);

  /* 玩家落地先**停住**，把选择权交回去。
   *
   * 之前是"只有一个出口就替他转过去、立刻满速跑起来"。看着体贴，实际很糟：
   * 人被瞬间挪到地图另一个角，还没看清自己在哪、幽灵在哪，就已经在跑了。
   * 传送门本来是用来脱险的，结果落地那一下反而最容易送命。
   *
   * 停住不等于慢：按下方向的**那一帧**就走（人站在格心上，stepEntity 会立刻
   * 重新选方向）。所以想好了的人零延迟，没想好的人有时间看——两头都照顾到。
   *
   * 一直不按也不会站死：过了 WARP_CHOICE_SECONDS，若只有一条路就自己走上去。
   * 有岔路则继续等——那是真的需要玩家做决定，替他猜反而更糟。
   */
  if (ent === player){
    ent.dir = {x:0, y:0};
    ent.warpChoiceUntil = elapsed + WARP_CHOICE_SECONDS;
    return;
  }

  // 幽灵不需要思考时间，照旧：能直走就直走，否则走唯一出口，再否则停下
  if ((ent.dir.x || ent.dir.y) && can(ent.dir)) return;
  const exits = [];
  for (const k in DIRS) if (can(DIRS[k])) exits.push(DIRS[k]);
  if (exits.length === 1){ ent.dir = { x: exits[0].x, y: exits[0].y }; return; }
  ent.dir = {x:0, y:0};
}

/** 落地后停下来等玩家按方向；超过这个时间还没按，且只有一条路，就自己走。 */
const WARP_CHOICE_SECONDS = 0.75;

/** 每帧检查：思考时间到了、人还站着、而且只有一条路可走，就替他迈出去。 */
function resumeAfterWarp(){
  if (!player.warpChoiceUntil) return;
  if (player.dir.x || player.dir.y){ player.warpChoiceUntil = 0; return; }  // 已经自己走了
  if (elapsed < player.warpChoiceUntil) return;
  const cx = Math.round(player.x), cy = Math.round(player.y);
  const exits = [];
  for (const k in DIRS) if (canEnter(player, cx + DIRS[k].x, cy + DIRS[k].y)) exits.push(DIRS[k]);
  // 有岔路就继续等：这时候是真的要玩家自己选，替他挑一条比让他站着更糟
  if (exits.length === 1) player.dir = { x: exits[0].x, y: exits[0].y };
  player.warpChoiceUntil = 0;
}

function checkPortal(ent){
  const cx = Math.round(ent.x), cy = Math.round(ent.y);
  if (!nearCenter(ent.x) || !nearCenter(ent.y)) return;
  // 已经离开落地的那扇门了，解除豁免 —— 下次再踩上来就正常传送
  if (ent.warpStandingOn && (ent.warpStandingOn.x !== cx || ent.warpStandingOn.y !== cy)){
    ent.warpStandingOn = null;
  }
  const ch = grid[cy] && grid[cy][cx];
  if (ch !== '1' && ch !== '2') return;
  // Cooldown runs on simulation time (ticked in update), not a wall-clock
  // setTimeout — a timeout would keep running while the game is paused and
  // could expire mid-pause. It also stops an idle entity that lands on the
  // exit portal from being bounced straight back, over and over.
  /* 脚下这扇门就是刚把你送过来的那扇 —— 不再触发，直到你走开。
   *
   * 这条比冷却更根本。原先只靠冷却兜底，于是出现了这个 bug：落在有岔路的
   * 传送门上、玩家没按方向（正在看局面），冷却一到就被传回去，然后来回弹个
   * 不停 —— 实测第二关干等 6 秒能弹 9 次。
   *
   * 靠"把冷却调长"去压这个问题是治标的：等得越久只是弹得越慢，而代价是
   * 真正想再用一次传送门时也得干等。把"站着不算触发"单独写出来之后，
   * 冷却就回归成一个纯粹的玩法旋钮，可以按手感自由调短。
   */
  if (ent.warpStandingOn && ent.warpStandingOn.x === cx && ent.warpStandingOn.y === cy) return;

  // 只有**同色**的门在冷却里才拦；另一种颜色不受影响
  if (ent.warpCd > 0 && ent.warpCdCh === ch) return;
  /* 门的坐标在建关时就存好了（portalTiles），不用再每帧全图扫 399 格。 */
  const pair = portalTiles[ch];
  if (!pair) return;
  for (const p of pair){
    if (p.x===cx && p.y===cy) continue;
    ent.x = p.x; ent.y = p.y;
    ent.warpCd = PORTAL_COOLDOWN_SECONDS;
    ent.warpCdCh = ch;               // 记下是哪种颜色在冷却
    ent.warpStandingOn = { x: p.x, y: p.y };    // 站在这扇门上不再触发，见上面的说明
    orientAfterWarp(ent);
    if (ent===player){
      Audio2.warp();
      // 第一次用到才讲。写在说明里没人看，而这一刻他刚被传走，正想知道
      // 发生了什么 —— 同一句话在这个时候的效果，比放在文档里高得多。
      hintOnce('portal', '传送门：四角成对，颜色相同的两个互通', 500);
    }
    return;
  }
}

/* ---------- player control ----------
 * Direction is otherwise only ever re-evaluated when the player sits exactly
 * on a tile centre, which is the root of every "my turn didn't register"
 * complaint. Three things relax that:
 *   1. a 180 needs no junction at all, so honour it the moment it's pressed
 *   2. a perpendicular turn may begin slightly BEFORE the junction, instead of
 *      demanding pixel-exact alignment and sailing past when you're a hair late
 *   3. a buffered press expires by DISTANCE, so it can't lie dormant and then
 *      fire at some unrelated junction many tiles later
 * The expiry window is measured in tiles rather than seconds so the feel stays
 * identical if the player's speed is ever retuned.
 */
const TURN_ASSIST_TILES = 0.22;  // enough to catch a near miss, too small to look like a jump
const TURN_BUFFER_TILES = 2.2;   // catches a planned turn without surviving several junctions

/** Current cell along an axis. Not Math.round: past the halfway point that
 *  flips to the destination tile early and breaks the distance maths. */
function cellOf(pos, d){
  return d > 0 ? Math.floor(pos + 1e-9) : d < 0 ? Math.ceil(pos - 1e-9) : Math.round(pos);
}

function wantIsFresh(ent){
  if (!(ent.want.x || ent.want.y)) return false;
  return (ent.distTravelled - ent.wantAtDist) <= TURN_BUFFER_TILES;
}

/** Reversal takes effect immediately, mid-tile — no junction required. */
function applyInstantReversal(ent){
  if (!(ent.dir.x || ent.dir.y) || !wantIsFresh(ent)) return;
  const w = ent.want;
  if (w.x !== -ent.dir.x || w.y !== -ent.dir.y) return;
  if (nearCenter(ent.x) && nearCenter(ent.y)){
    // sitting on a centre, so there's no partial tile to retrace into:
    // the tile behind has to actually be open
    const bx = Math.round(ent.x) + w.x, by = Math.round(ent.y) + w.y;
    if (!walkableFor(tileAt(bx, by), ent.kind)) return;
  }
  // mid-tile a reversal just retraces the tile already being crossed, which
  // was necessarily entered from — no walkability check needed
  ent.dir = { x: w.x, y: w.y };
}

/** Lets a perpendicular turn start just short of the junction. */
function applyCornerAssist(ent){
  if (!(ent.dir.x || ent.dir.y) || !wantIsFresh(ent)) return;
  const w = ent.want;
  if (w.x === ent.dir.x && w.y === ent.dir.y) return;          // straight on
  if (w.x === -ent.dir.x && w.y === -ent.dir.y) return;        // reversal's job

  /* 穿墙时转向立刻生效，不必等到前方那个路口。
   *
   * 平时只允许提前 0.45 格是有道理的：转弯得落在真的路口上，否则会拐进墙里。
   * 但穿墙时**每一格都是路口**，这条限制就纯粹是在碍事了——玩家眼看着目标在
   * 左边，却要先往前飘过大半格才拐得动。这个道具最大的卖点就是"想去哪去哪"，
   * 转向却不跟手，卖点就没了。
   *
   * 就近取整而不是取前方那一格：这样最多只修正半格，而且允许**往回**贴一点。
   * 往回在平时是不行的（会退进墙里），穿墙时正好没有这个问题。
   * 仍然落在格心上，不让玩家跑到格线之间——那会让 stepEntity 再也找不到
   * 重新选方向的时机，人就卡死了（幽灵那个 bug 就是这么来的）。 */
  if (ent.phase > 0){
    ent.x = Math.round(ent.x); ent.y = Math.round(ent.y);
    if (canEnter(ent, ent.x + w.x, ent.y + w.y)) ent.dir = { x: w.x, y: w.y };
    return;
  }

  const nx = ent.dir.x ? cellOf(ent.x, ent.dir.x) + ent.dir.x : Math.round(ent.x);
  const ny = ent.dir.y ? cellOf(ent.y, ent.dir.y) + ent.dir.y : Math.round(ent.y);
  const gap = Math.abs(nx - ent.x) + Math.abs(ny - ent.y);
  if (gap === 0 || gap > TURN_ASSIST_TILES) return;
  if (!walkableFor(tileAt(nx + w.x, ny + w.y), ent.kind)) return;

  // snap the remaining sliver onto the junction and take the turn. stepEntity
  // fires onArrive for a centre it starts on, so the pellet here still counts.
  ent.x = nx; ent.y = ny;
  ent.dir = { x: w.x, y: w.y };
}

function choosePlayerDir(ent){
  const opts = openDirs({...ent, kind:'player'}, false);
  if (wantIsFresh(ent)){
    const wantMatch = opts.find(d=>d.x===ent.want.x && d.y===ent.want.y);
    if (wantMatch) return wantMatch;
  }
  const keepGoing = opts.find(d=>d.x===ent.dir.x && d.y===ent.dir.y);
  if (keepGoing) return ent.dir;
  return {x:0,y:0};
}

/* ---------- ghost AI ---------- */
function ghostTarget(g){
  if (g.state==='frightened') return null; // handled separately
  if (g.state==='eaten') return HOUSE_EXIT_TILE;
  if (g.state==='house' || g.state==='exiting') return HOUSE_DOOR;
  const px = player.x, py = player.y;
  const ddx = px-g.x, ddy = py-g.y;
  const dist2 = ddx*ddx + ddy*ddy;   // 热点路径用平方距离，不开根号
  switch(g.id){
    case 'chaser':
      // The level-2 second chaser aims to one SIDE of the player (perpendicular
      // to their heading) rather than straight at them. Two ghosts running the
      // identical pure-pursuit target end up stacked on the same tile acting as
      // one wall; offsetting the twin makes it approach at an angle, which both
      // reads more clearly and leaves the player an escape line.
      if (g.flank){
        return {x: px + player.dir.y * FLANK_OFFSET_TILES,
                y: py + player.dir.x * FLANK_OFFSET_TILES};
      }
      return {x:px, y:py};
    case 'ambush': {
      const reach = g.lookahead || 4; // the level-3 twin reads further ahead
      return {x:px+player.dir.x*reach, y:py+player.dir.y*reach};
    }
    case 'shy':
      return dist2 > 49 ? {x:px,y:py} : {x:1,y:ROWS-2};
    case 'patrol': {
      const route = g.reverseRoute ? PATROL_ROUTE_REV : PATROL_ROUTE;
      const wp = route[g.routeIdx % route.length];
      /* 副作用说明：routeIdx 在"取目标"这里推进，是有意的。ghostTarget 每帧
         至多被 chooseGhostDir 调一次、且只在格点上触发，所以每个路点恰好
         数到一次；挪去 onArrive 反而要处理传送瞬移造成的误触发，风险更大。
         知道它在这儿就行，别"顺手"搬走。 */
      const pdx = g.x-wp.x, pdy = g.y-wp.y;
      if (pdx*pdx + pdy*pdy < 0.36) g.routeIdx++;
      return wp;
    }
  }
  return {x:px,y:py};
}

function chooseGhostDir(g){
  if (g.state==='house'){ return null; }

  /* 人在老巢里，状态却已经不是 house/eaten/exiting 了 —— 先出门，别的以后再说。
     会走到这一步是因为状态可以在它还没走出老巢时被改掉：刚放出来（exiting）
     的那一刻玩家吃到能量豆，startPowerMode 就把它改成了 frightened；恐惧结束
     再变 chase。而"往门口走"这条逻辑只写在 exiting 分支里，于是这只幽灵在
     巢里打转出不来——追不到人，也吃不着，就杵在那一小块地方。
     这里只改**目标**不改状态：状态一改，颜色和能不能吃就跟着变，而 startPowerMode
     下一帧又会把它改回去，两边来回打架。允许掉头（不排除反向），老巢是个
     封闭小盒子，不许掉头反而容易顶在墙角。 */
  if (g.state!=='eaten' && g.state!=='exiting' &&
      tileAt(Math.round(g.x), Math.round(g.y))==='g'){
    return bestDirTo(g, HOUSE_DOOR, false);
  }

  if (g.state==='exiting'){
    if (Math.round(g.x)===HOUSE_DOOR.x && Math.round(g.y)===HOUSE_DOOR.y){
      // rejoin as edible if the power pellet is still running — the global
      // timer is authoritative, never the ghost's own (now removed) field。
      // 但这轮已经被吃过的那只不算：它复活后是正常状态，重新有威胁（见 isEdible）
      g.state = (frightTimer > 0 && !g.eatenThisFright) ? 'frightened' : 'chase';
      applySpeedModifiers();
    }
    const target = HOUSE_DOOR;
    return bestDirTo(g, target, true);
  }
  if (g.state==='eaten'){
    const target = EYE_HOME;
    // 进了老巢的格子就算到家，不必死磕正中间那一格
    if (tileAt(Math.round(g.x), Math.round(g.y)) === 'g'){
      /* 到家先在老巢里待一会儿再出来，不是立刻满血杀回场上。
         这是修好眼睛回家之后唯一需要补的平衡：以前吃掉的幽灵大概率再也不回来，
         等于一颗能量豆永久清场；现在它们真回来了，如果还是秒复活，吃完一轮
         幽灵反而比不吃更危险——那就没人敢转身了，悬赏也就白设。
         停这几秒换来的是"吃完有一段喘息、但知道它们正在回来"，紧张感留着，
         压迫感不至于压死人。老巢里的幽灵不参与碰撞，这段时间是真安全。 */
      g.state = 'house';
      g.homeY = g.y;      // 就地待着，不弹回出生点——那又是一次瞬移
      g.releaseAt = elapsed + GHOST_RESPAWN_DELAY;
      return null;
    }
    // 走回家地图；万一没建好，退回原来的贪心走法（会卡，但总比不动强）
    return eyeDir(g) || bestDirTo(g, target, true);
  }
  if (g.state==='frightened'){
    const opts = openDirs(g, true);
    if (!opts.length) return g.dir;
    // mostly flee (maximize distance from player), with some randomness
    if (Math.random() < 0.28) return opts[Math.floor(Math.random()*opts.length)];
    let best=opts[0], bestD=-1;
    for (const d of opts){
      const nx=Math.round(g.x)+d.x, ny=Math.round(g.y)+d.y;
      const ddx=nx-player.x, ddy=ny-player.y;
      const dist2 = ddx*ddx + ddy*ddy;
      if (dist2>bestD){ bestD=dist2; best=d; }
    }
    return best;
  }
  const target = ghostTarget(g);
  return bestDirTo(g, target, true);
}

/* ---------- 眼睛回巢：一张最短路地图 ----------
 *
 * 被吃掉的幽灵只剩眼睛往老巢跑。原来它跟其他幽灵走的是同一套 bestDirTo——
 * 挑一个"直线距离离目标最近"的方向，而且不许掉头。这两条凑一块儿是会走死的：
 * 直线距离不认识墙，所以它会一头扎进凹进去的死角；进去之后不许掉头，就在
 * 两格之间来回弹，永远回不了家。实测第二关有 77% 的格子会这样。
 *
 * 后果不是卡顿而是**难度悄悄塌了**：吃掉的幽灵再也不回来，吃一颗能量豆等于
 * 永久清场。玩家看到的就是"两只眼睛卡在那儿不动"。
 *
 * 换成从老巢做一次 BFS，得到每个格子回家要走几步。眼睛每步挑邻居里步数最小的
 * 那个，等于顺着坡往下走：一定越走越近，一定到得了家，也不可能来回弹。
 * 迷宫是 19x21 且每关只算一次，开销可以忽略。
 *
 * 这里**允许掉头**——恰恰是"不许掉头"造出了死角。眼睛掉头在观感上也没问题，
 * 它本来就是在往回走。
 */
let eyeField = null;

/**
 * 眼睛回到老巢后，在里面待几秒再出来（见下面 'eaten' 分支的说明）。
 *
 * 这是**难度的主阀门**，不是随手填的手感参数。眼睛能正常回家之后，幽灵多快
 * 重新上场几乎决定了整局的松紧。工具/playtest.mjs 各 30 局实测：
 *
 *   0.0s   7%   吃完它立刻满血杀回来，等于不敢转身，能量豆废掉
 *   1.0s  60%
 *   1.5s  73%   ← 取这个
 *   2.2s  84%   喘息太长，一颗能量豆又成了半场清空
 *
 * 定 1.5 的依据不是这条完整通关率（每过一关送一条命，越往后缓冲越厚，这个数
 * 噪声很大，同一档反复跑能在 70~95% 之间晃），而是**分关通关率**：1.5s 下是
 * 100/100/90/93/80/97，跟这些改动之前的老数据（第五关最难 76%，其余 92-100%）
 * 几乎重合 —— 也就是修完 bug 之后，难度回到了玩家原本熟悉的那条曲线上。
 */
const GHOST_RESPAWN_DELAY = 1.5;

/* 眼睛的终点是老巢**里面**，不是门外那一格。
   门外那格 (9,7) 是幽灵出门的落脚点；眼睛停在那儿的话还得再瞬移三格进屋，
   屏幕上就是"啪"地闪一下。直接拿老巢中心当终点，它自己穿过门走进去。
   六关的老巢格局完全一致（(9,8) 是门 D，(9,9)(9,10) 是巢 g），已逐关验过。 */
const EYE_HOME = {x:9, y:10};

/* 墙的线段表。只在只跟非墙格相邻的那一侧画线（这是那种"矢量描边"观感的来源，
 * 不是把每格描成一个方框），而这个判断只跟迷宫布局有关 —— 一整关都不会变。
 * 摊平成 [x1,y1,x2,y2, x1,y1,x2,y2, ...] 一维数组而不是对象数组：每帧要走一遍，
 * 少几百个对象的间接寻址，在低端手机上是白捡的。
 * 不用 Path2D —— 微信的 canvas 没有它，而这份代码三个平台共用。 */
let wallEdges = [];
function buildWallEdges(){
  const e = [];
  const n = (yy,xx)=> (xx<0||xx>=COLS||yy<0||yy>=ROWS) ? '#' : grid[yy][xx];
  for (let y=0;y<ROWS;y++){
    for (let x=0;x<COLS;x++){
      if (grid[y][x] !== '#') continue;
      const px = x*TILE, py = y*TILE;
      if (n(y-1,x)!=='#') e.push(px+2, py+2, px+TILE-2, py+2);
      if (n(y+1,x)!=='#') e.push(px+2, py+TILE-2, px+TILE-2, py+TILE-2);
      if (n(y,x-1)!=='#') e.push(px+2, py+2, px+2, py+TILE-2);
      if (n(y,x+1)!=='#') e.push(px+TILE-2, py+2, px+TILE-2, py+TILE-2);
    }
  }
  wallEdges = e;
}

/* 传送门坐标表。一共就四格，原来 checkPortal 和每帧的绘制都要做 399 格
   全图扫描才能找到它们 —— 建关时存下来，之后都是 O(4)。 */
let portalTiles = { '1': [], '2': [] };
function buildPortals(){
  portalTiles = { '1': [], '2': [] };
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++){
    const ch = grid[y][x];
    if (ch==='1' || ch==='2') portalTiles[ch].push({x, y});
  }
}

/* 墙的离屏缓存。墙（含 shadowBlur 光晕）一整关都不变，原来却每帧把几百条
   线段带阴影重描一遍 —— shadowBlur 是 canvas 2D 里最贵的操作。建关/换关时
   渲染到一块离屏画布，之后每帧一次 drawImage；resize/DPR 变化由
   fitMazeCanvas 标脏重建。离屏造不出来（微信垫片等）就退回每帧现画，
   行为和原来一模一样。鬼门那两条线从不变色，一并进缓存。
   穿墙期间不走缓存：那时墙要变淡变虚线，是每帧都在变的少数时刻。 */
function drawWallsNormal(c2){
  c2.save();
  c2.lineCap = 'round';
  /* 一条路径画完整张墙。原来是每个墙格 beginPath + stroke，第一关就是 200 次
     带阴影的描边 —— 而墙一整关都不动，每帧重算邻居、重描一遍纯属白干。 */
  c2.beginPath();
  for (let i=0;i<wallEdges.length;i+=4){
    c2.moveTo(wallEdges[i], wallEdges[i+1]);
    c2.lineTo(wallEdges[i+2], wallEdges[i+3]);
  }
  /* 先用不发光的暗边把墙从路面里切出来，再叠主色与细高光。
     旧版四层都带 4~18px shadowBlur，紫光合在一起就变成一片雾；
     这里保留霓虹识别度，但让轮廓本身始终是锐的。 */
  c2.strokeStyle = '#09031f';
  c2.lineWidth = 12;
  c2.shadowBlur = 0;
  c2.globalAlpha = 1;
  c2.stroke();
  c2.strokeStyle = cssVar('--wall-core');
  c2.lineWidth = 8;
  c2.shadowColor = cssVar('--wall-cyan');
  c2.shadowBlur = 5;
  c2.globalAlpha = .95;
  c2.stroke();
  c2.strokeStyle = cssVar('--wall');
  c2.lineWidth = 4.25;
  c2.shadowColor = cssVar('--wall');
  c2.shadowBlur = 3;
  c2.globalAlpha = .98;
  c2.stroke();
  c2.strokeStyle = cssVar('--wall-hi');
  c2.lineWidth = 1;
  c2.shadowBlur = 0;
  c2.globalAlpha = .76;
  c2.stroke();
  c2.restore();

  // ghost house door
  c2.save();
  c2.strokeStyle = cssVar('--pink');
  c2.lineWidth = 2;
  [[9,8],[9,12]].forEach(([x,y])=>{
    c2.beginPath();
    c2.moveTo(x*TILE+3, y*TILE+TILE/2);
    c2.lineTo(x*TILE+TILE-3, y*TILE+TILE/2);
    c2.stroke();
  });
  c2.restore();
}

function rebuildWallCache(){
  wallCacheDirty = false;
  if (!CAN_OWN_CANVAS || wallCacheFailed) return;
  try {
    if (!wallCache) wallCache = document.createElement('canvas');
    if (!wallCache || typeof wallCache.getContext !== 'function') throw new Error('no offscreen');
    wallCache.width = canvas.width; wallCache.height = canvas.height;
    const wctx = wallCache.getContext('2d');
    if (!wctx || !wctx.arc) throw new Error('no 2d');
    wctx.setTransform(canvas.width / (COLS*TILE), 0, 0, canvas.height / (ROWS*TILE), 0, 0);
    drawWallsNormal(wctx);
  } catch (e) {
    // 造不出离屏画布就退回每帧现画 —— 慢一点，但画面和原来一模一样
    wallCache = null; wallCacheFailed = true;
  }
}

/* 普通豆子不需要每帧重建 175 个圆弧。它们和墙一样先画进离屏层；吃掉一颗时
   只清掉那颗周围的一小块。最后十颗为了保留“呼吸提示”才退回动态绘制。 */
function drawRegularDots(c2, glow){
  const r = PELLET_R;
  const amber = cssVar('--amber');
  const TAU = Math.PI * 2;
  let any = false;
  c2.save();
  c2.fillStyle = amber;
  c2.shadowColor = amber;
  c2.shadowBlur = glow;
  c2.beginPath();
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++){
    if (grid[y][x] !== '.') continue;
    const cxp=x*TILE+TILE/2, cyp=y*TILE+TILE/2;
    c2.moveTo(cxp+r,cyp); c2.arc(cxp,cyp,r,0,TAU); any=true;
  }
  if (any) c2.fill();
  c2.restore();
}

function rebuildDotCache(){
  dotCacheDirty = false;
  if (!CAN_OWN_CANVAS || dotCacheFailed) return;
  try {
    if (!dotCache) dotCache = document.createElement('canvas');
    if (!dotCache || typeof dotCache.getContext !== 'function') throw new Error('no offscreen');
    dotCache.width = canvas.width; dotCache.height = canvas.height;
    const dctx = dotCache.getContext('2d');
    if (!dctx || !dctx.arc) throw new Error('no 2d');
    dctx.setTransform(canvas.width/(COLS*TILE),0,0,canvas.height/(ROWS*TILE),0,0);
    drawRegularDots(dctx, PELLET_GLOW);
  } catch (e) {
    dotCache = null; dotCacheFailed = true;
  }
}

function eraseDotCache(x,y){
  if (!dotCache || dotCacheDirty || dotCache.width !== canvas.width) return;
  const dctx = dotCache.getContext('2d');
  if (!dctx) { dotCacheDirty = true; return; }
  const cxp=x*TILE+TILE/2, cyp=y*TILE+TILE/2;
  dctx.save();
  dctx.setTransform(canvas.width/(COLS*TILE),0,0,canvas.height/(ROWS*TILE),0,0);
  dctx.clearRect(cxp-10,cyp-10,20,20);
  dctx.restore();
}

function buildEyeField(){
  const f = Array.from({length:ROWS}, () => new Array(COLS).fill(Infinity));
  const t = EYE_HOME;
  if (!inBounds(t.x, t.y)) { eyeField = null; return; }
  f[t.y][t.x] = 0;
  const q = [t];
  for (let i = 0; i < q.length; i++){
    const cur = q[i], d = f[cur.y][cur.x];
    for (const key in DIRS){
      const dd = DIRS[key];
      let nx = cur.x + dd.x, ny = cur.y + dd.y;
      // 跟 tileAt 一样让左右两侧接起来，否则隧道那一行算出来的距离是错的
      if (nx < 0) nx = COLS-1; else if (nx >= COLS) nx = 0;
      if (ny < 0 || ny >= ROWS) continue;
      if (f[ny][nx] !== Infinity) continue;
      if (!walkableFor(grid[ny][nx], 'ghost')) continue;
      f[ny][nx] = d + 1;
      q.push({x:nx, y:ny});
    }
  }
  eyeField = f;
}

/** 顺着回家地图往下走一格。地图没建好或四周都到不了家时返回 null，由调用方兜底。 */
function eyeDir(g){
  if (!eyeField) return null;
  const cx = Math.round(g.x), cy = Math.round(g.y);
  let best = null, bestD = Infinity;
  for (const key in DIRS){
    const d = DIRS[key];
    let nx = cx + d.x, ny = cy + d.y;
    if (nx < 0) nx = COLS-1; else if (nx >= COLS) nx = 0;
    if (ny < 0 || ny >= ROWS) continue;
    const v = eyeField[ny][nx];
    if (v < bestD){ bestD = v; best = d; }
  }
  return bestD === Infinity ? null : best;
}

function bestDirTo(ent, target, excludeReverse){
  const opts = openDirs(ent, excludeReverse);
  if (!opts.length) return ent.dir;
  let best=opts[0], bestD=Infinity;
  for (const d of opts){
    const nx=Math.round(ent.x)+d.x, ny=Math.round(ent.y)+d.y;
    const dist = (nx-target.x)**2 + (ny-target.y)**2;
    if (dist<bestD){ bestD=dist; best=d; }
  }
  return best;
}

/* ---------- combo / scoring ----------
 *
 * 连击窗口：吃到一颗之后有这么久去够下一颗，超时归零。
 *
 * 原来是 1.15 秒平摊倒计时，问题出在**地图后期**：豆子越来越稀，玩家为了够
 * 剩下几颗必然要穿过已经吃空的走廊，连击断在这儿不是因为菜，是因为地图就长
 * 那样。这种"冤枉断连"会让人觉得规则在耍赖。
 *
 * 但单纯把窗口调大到 1.5 秒又会把"别停下"这层紧张感一起冲掉——站着不动也能
 * 保住连击，那连击就不再奖励什么了。
 *
 * 所以改成两档衰减：**在跑就慢扣，停下就快扣**。
 *   跑动中：基础余量从 1.6 提到 1.76 秒（+10%）
 *   停下来：仍然 3 倍速扣；随连击宽限，约 0.6–0.9 秒就断
 * 规则本身还是"别停、往前冲"，只是不再因为地图空了而惩罚玩家。
 */
const COMBO_WINDOW = 1.76;
/** 停下不动时的额外衰减倍率。见上面的说明。 */
const COMBO_IDLE_DECAY = 3.0;

/* 连得越长，窗口给得越宽 —— 但**有上限**。
 *
 * 理由不是"让玩家轻松"，而是难度曲线本身是反的：连击越高，剩下的豆子越少、
 * 越分散，续上一颗的难度自然越大。窗口不变的话，等于越到后面越苛刻，
 * 高连击不是靠本事保住的，是靠地图还没被吃空。
 *
 * 宽限也同步 +10%，封在 +0.99 秒（x45 触顶），总窗口最多 2.75 秒。
 * 再宽下去，高连击就变成"断不了"，那份"别断啊"的
 * 紧张感——也就是连击唯一的乐趣——就没了。停下不动仍然是 3 倍速扣，
 * 所以"别停"这条规矩一点没松。
 */
const COMBO_GRACE_PER = 0.022;  // 原 0.02 ×1.1
const COMBO_GRACE_MAX = 0.99;   // 原 0.9 ×1.1

function comboWindow(){
  return COMBO_WINDOW + Math.min(COMBO_GRACE_MAX, combo * COMBO_GRACE_PER);
}

/** 剩几颗豆子开始呼吸闪烁 / 几颗开始明显跳动。见豆子的绘制。 */
/* ---------- 两种豆子的尺寸与光晕 ----------
 *
 * 这几个数以前是散在 drawMaze 里的字面量，于是出过一次很难发现的事故：
 * "剩最后几颗时让豆子喘气"这个效果，把小豆的半径从 2.6 一路胀到 5.1、光晕
 * 涨到 24 —— 而大豆的半径最小才 3.2、光晕固定 12。结果是**反过来的**：
 * 最该显眼的能量豆，被普通豆子在大小和亮度上同时盖过去，玩家分不出哪颗
 * 是能量豆。
 *
 * 现在的规矩：小豆**只亮不胀**，半径恒定；能量豆永远更大、也永远更亮。
 * 下面这条不变式由 test_pellet_contrast.mjs 守着：
 *     小豆半径（恒定） <  能量豆最小半径
 *     小豆最大光晕     <  能量豆光晕
 */
const PELLET_R          = 2.6;   // 小豆半径，恒定 —— 不许再随呼吸变化
const PELLET_GLOW       = 2;     // 小豆平时的紧致光晕
const PELLET_GLOW_SWING = 4.5;   // 最后几颗仍会呼吸，但不再糊成光团
const PELLET_GLOW_BASE_SWING = 1;// 呼吸的固定部分
const POWER_R           = 5.0;   // 能量豆半径中心值
const POWER_R_SWING     = 0.7;   // 能量豆脉动幅度 → 4.3 ~ 5.7
const POWER_GLOW        = 9;     // 能量星仍比小豆更亮，但边界清楚

const LAST_PELLET_HINT = 10;
// 剩三颗才转成明显跳动：那时候才真的开始「到底在哪」，五颗时一般还看得见
const LAST_PELLET_LOUD = 3;

/**
 * 续上连击：加一级、把倒计时打满。**不加分**——给谁加、加多少由调用方决定。
 *
 * 抽出来是因为原先只有"吃豆子"这一条路会续连击，于是出现了一个很别扭的冲突：
 * 游戏用 1 万 / 2 万 / 3 万的悬赏拼命鼓励玩家转身去追幽灵，可追幽灵要横穿
 * 半张图、好几秒吃不到豆 —— **连击就这么断了**。一边发奖金让你去做一件事，
 * 一边因为你做了而没收你的倍率，两套核心机制在互相拆台。
 *
 * 吃幽灵是这游戏里最难、最需要胆量的操作，它理应喂养连击，而不是掐断它。
 * 水果同理：它拿 combo 当倍率却不续期，等于只吃不喂。
 */
function sustainCombo(){
  combo = combo + 1;
  comboTimer = comboWindow();
  if (combo === 5) hintOnce('combo', '连击 x5！小豆、大豆和反击都续连击；豆子与晶石按倍率加分', 0);
  checkComboMilestone();
  updateHud();
}

/** 同一入口处理小豆、大豆、晶石和敌人：加成后只取整一次，再续连击。 */
function addComboScore(base, raw){
  const points = addScore(base * COMBO_SCORE_BOOST, raw);
  sustainCombo();
  return points;
}

function addPelletScore(base){
  return addComboScore(base * combo);
}

/* ---------- 连击里程碑 ----------
 *
 * 连击上不封顶，可越往上爬反馈越不变 —— x8 和 x80 在屏幕上是一模一样的，
 * 玩家没有理由为了保住 x47 而绷紧。给它几个台阶，让"别断"这件事自己有分量。
 *
 * 三条规矩：
 *   1 反馈只升不降：音高一档比一档亮，toast 的语气一档比一档激动
 *   2 彩带**轻而短**：一把小彩点从上沿飘下来，一秒多就散 —— 是个道贺，
 *     不是烟花秀。绝不在迷宫中间炸开：玩家这时候正贴着小夜枭跑，
 *     屏幕中间糊一层特效等于害他送命。
 *   3 每档**每局**只响一次：断了重连不再重复报，comboMilestoneHit 只在
 *     开新一局（fullReset）时清零。
 */
const COMBO_MILESTONES = [10, 20, 50];

function checkComboMilestone(){
  for (const m of COMBO_MILESTONES){
    if (combo >= m && comboMilestoneHit < m){
      comboMilestoneHit = m;
      Audio2.comboMilestone(m);
      startComboFx();
      toast(m >= 50 ? `连击 x${m}！全场为你鼓掌`
          : m >= 20 ? `连击 x${m}！停不下来了`
          :           `连击 x${m}！好节奏`);
    }
  }
}
/* ---------- 新手提示 ----------
 * 「?」说明是可选的，绝大多数人不会点。真正有效的是在**正好需要的那一刻**
 * 给一句话：开局时说怎么走，第一次死时说能量豆可以反打。
 *
 * 每条只出现一次，记在 localStorage 里 —— 每局都弹就成了噪音，老玩家会烦。
 * 无痕模式下读写都会抛，包一层 try 就当没提示过，不影响游戏。
 */
const HINT_KEY = 'doudou.hints.v1';
/* 已提示过的 id 加载时读进内存，之后 hintSeen 不再碰 localStorage ——
   它被 checkPowerPelletNearby 每帧调用，每次都 getItem + split 一遍不值得。
   写的时候才落盘（markHintSeen）。 */
let hintSeenCache = null;
function hintSeen(id){
  if (hintSeenCache === null){
    hintSeenCache = {};
    try {
      (localStorage.getItem(HINT_KEY) || '').split(',').forEach(s=>{ if (s) hintSeenCache[s] = true; });
    } catch (e) { /* 无痕模式：每次都当没提示过 */ }
  }
  return !!hintSeenCache[id];
}

/* ---------- 长期进度：星星册 · 对手图鉴 · 每日挑战 ----------
 *
 * 前面那些 localStorage 键（分数、名字、提示、静音）记的都是**一局之内**或者
 * 一次性的事。这一个不同：它记的是这个孩子玩了几个月之后手里攒下了什么。
 *
 * 合成一个键而不是三个：这三样天天都在写（每过一关写星星、每被抓一次写图鉴、
 * 每天写一次挑战），分成三个键就要读写三次、失败三次、迁移三次。而它们的
 * 生命周期是同一个 —— 都是"这个人的存档"，要清就一起清。
 *
 * 出错一律吞掉走默认值：无痕模式、存储配额满、别的站点写脏了同名键，都不该
 * 让游戏打不开。星星丢了是可惜，白屏是事故。
 */
const PROGRESS_KEY = 'doudou.progress.v1';
const EMPTY_PROGRESS = () => ({ stars:{}, owls:{}, daily:{} });
let progress = EMPTY_PROGRESS();
const validProgressObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
const progressCount = v => typeof v === 'number' && Number.isFinite(v)
  ? Math.min(1e9, Math.max(0, Math.floor(v))) : 0;
const owlIdAllowed = id => GHOST_DEFS.some(g => g.id === id);
const normalizeOwl = e => ({
  met: progressCount(e && e.met), caught: progressCount(e && e.caught), ate: progressCount(e && e.ate),
});

function loadProgress(){
  progress = EMPTY_PROGRESS();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    /* 逐字段挑，不整个 assign。存档是用户能改的（开发者工具里两秒的事），
       而下面所有代码都假设 stars/owls/daily 是对象 —— 让 stars 变成 null
       就够让开始页整个渲染不出来了。 */
    if (validProgressObject(p)){
      if (validProgressObject(p.stars)) for (let lv=1;lv<=MAX_LEVEL;lv++){
        const bits = p.stars[lv];
        if (Number.isInteger(bits) && bits >= 0 && bits <= 7) progress.stars[lv] = bits;
      }
      if (validProgressObject(p.owls)) for (const {id} of GHOST_DEFS){
        const e = normalizeOwl(p.owls[id]);
        if (e.caught || e.ate) e.met = Math.max(1, e.met);
        progress.owls[id] = e;
      }
      if (validProgressObject(p.daily)){
        const {d,lv,best} = p.daily;
        if (Number.isInteger(d) && d >= 10000101 && d <= 99991231
            && Number.isInteger(lv) && lv >= 1 && lv <= MAX_LEVEL
            && Number.isFinite(best) && best >= 0)
          progress.daily = {d,lv,best:Math.min(Number.MAX_SAFE_INTEGER, best)};
      }
    }
  } catch (e) { progress = EMPTY_PROGRESS(); }
  // 星级以统一存档和旧进度的并集为准，只增不减。
  for (let lv=1; lv<=MAX_LEVEL; lv++){
    const merged = (progress.stars[lv] || 0) | (localSave.stars[lv] || 0);
    if (merged) progress.stars[lv] = localSave.stars[lv] = merged;
  }
}
function saveProgress(){
  const stars = normalizeLocalStars(progress.stars);
  for (let lv=1; lv<=MAX_LEVEL; lv++){
    const bits = (localSave.stars[lv] || 0) | (stars[lv] || 0);
    if (bits) localSave.stars[lv] = bits;
  }
  saveLocalState();
  // 双写旧键也必须用合并后的星星，不能留下第二份已经回退的存档。
  progress.stars = {...localSave.stars};
  // 图鉴和每日挑战仍写旧进度键；后续版本可独立迁移，不扩大本次风险。
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
}
loadProgress();

/* ---------- 对手图鉴 ----------
 *
 * 这一栏是把**挫败翻译成收藏**。被同一个对手抓了十次，孩子记住的原本只是
 * "我又死了"；图鉴让那十次变成一行数字和一句"它是这么动的"。
 *
 * 所以每条的 how 必须是**可执行的对策**，不是形容词。"很凶"没用，
 * "拐个弯就甩掉了"才有用 —— 这句话下次真的会改变他的手指。
 * 名字和颜色跟 GHOST_DEFS 走，行为描述跟玩法说明里那四行走，改了记得同步。
 */
const OWL_CODEX = [
  { id:'chaser', name:'闪闪', color:'--cyan',
    how:'锁定你的位置追踪。利用岔路拉开距离，后续关卡还会有同伴包抄。',
    tip:'闪闪会追踪你 —— 利用岔路拉开距离' },
  { id:'ambush', name:'狐狐', color:'--danger',
    how:'不追你，追你**要去的地方**。老朝一个方向跑，正好撞它怀里。',
    tip:'狐狐会抄到你前面 —— 别一直朝一个方向跑' },
  { id:'shy',    name:'软软', color:'--tang',
    how:'离得远时追踪，靠近时转向角落。观察它的退路，但不要直接撞上去。',
    tip:'软软靠近时会退开 —— 留意退路，别直接碰撞' },
  { id:'patrol', name:'慢慢', color:'--pink',
    how:'沿固定目标巡逻。看准它经过的方向再穿过路口，最后一关还要留意反向巡逻。',
    tip:'慢慢只走它那个圈 —— 记住它的路线就能避开' },
];

/** 记一笔图鉴。kind: 'met' 见过 · 'caught' 被它抓 · 'ate' 反杀它 */
function noteOwl(id, kind){
  if (!owlIdAllowed(id) || !['met','caught','ate'].includes(kind)) return;
  const e = progress.owls[id] = normalizeOwl(progress.owls[id]);
  e[kind] = Math.min(1e9, e[kind] + 1);
  if (kind !== 'met') e.met = Math.max(1, e.met || 0);   // 抓过你的，一定见过
  saveProgress();
}

/** 这一关会出场的对手都算"见过"——开关卡时记一次，不等它真的追上来。 */
function noteOwlsSeen(lvl){
  const ids = new Set(ghostDefsForLevel(lvl).map(d => d.id));
  let dirty = false;
  ids.forEach(id=>{
    if (!owlIdAllowed(id)) return;
    const e = progress.owls[id] = normalizeOwl(progress.owls[id]);
    if (!e.met){ e.met = 1; dirty = true; }
  });
  if (dirty) saveProgress();
}

/** 图鉴要显示的那份数据。UI 层不碰存档，只拿这个数组。 */
function owlCodexView(){
  return OWL_CODEX.map(o=>{
    const e = progress.owls[o.id] || { met:0, caught:0, ate:0 };
    return { id:o.id, name:o.name, color:o.color, how:o.how,
             met:!!e.met, caught:e.caught||0, ate:e.ate||0 };
  });
}

/* ---------- 星星收集册 ----------
 *
 * 一关三颗，是三个**不同性质**的目标，不是同一件事的三个难度档：
 *
 *   ★ 通关     —— 会玩就有。保证每个孩子第一次打完都能拿到东西。
 *   ★ 无伤     —— 考熟练。同一关反复打自然会到。
 *   ★ 反杀两只 —— 考胆量。它逼着孩子做这游戏最想让他做的决定：转身。
 *
 * 三颗如果是"通关/快速通关/更快通关"，就只是一个目标的三个刻度，卡在第三颗
 * 的人也知道自己差在哪，不会去改玩法。分成三种，他会**换一种打法**再来 ——
 * 那才是这套东西存在的理由。
 */
const STAR_GOALS = ['通关这一关', '一次都不死', '反杀 2 个对手'];

/** 结算这一关拿到几颗，写进存档，返回本次**新拿到**的颗数。 */
function awardStars(lvl){
  let bits = 1;                                  // 能走到这儿就是清光了豆子
  if (deathsThisLevel === 0)      bits |= 2;
  if (ghostsEatenThisLevel >= 2)  bits |= 4;
  const had = progress.stars[lvl] || 0;
  const now = had | bits;                        // 只增不减：拿到的星星不会因为
  if (now === had) return 0;                     // 下次打得差就被收回去
  progress.stars[lvl] = now;
  saveProgress();
  return countBits(now) - countBits(had);
}
function countBits(b){ return (b&1?1:0) + (b&2?1:0) + (b&4?1:0); }
function starsOf(lvl){ return countBits(progress.stars[lvl] || 0); }
function totalStars(){ let t = 0; for (let i=1;i<=MAX_LEVEL;i++) t += starsOf(i); return t; }

/* ---------- 每日挑战 ----------
 *
 * 这一条是给"爸爸和儿子"设计的，不是给排行榜设计的。
 *
 * 排行榜比的是历史最高分 —— 一旦一方冲出一个高分，另一方要追很久，中间那些
 * 天就没得比了。每日挑战每天零点清空：今天谁高谁就赢了今天。这才是一对父子
 * 每天能玩一轮的东西。
 *
 * 关卡由日期和已解锁范围决定：解锁进度相同的玩家当天选到同一关。
 * 只从**已解锁**的关里挑 —— 出一关孩子还没打到的，今天他就直接出局了。
 *
 * 它走练习模式的路子，所以整局不进排行榜。这是故意的：每日挑战允许反复重来，
 * 能进榜的话刷分就太容易了，而排行榜的价值全在"不好刷"。
 */
function todayKey(){
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
}
/** 日期与解锁上限相同，才会得到同一关。 */
function dailyLevel(){
  const top = Math.max(1, maxLevelReached());
  /* 先把日期打散再取模。直接 todayKey() % top 的话，连着几天的日期号只差 1，
     关卡就只是 1→2→3 地顺着走，一眼能猜到明天是哪关。

     打散必须用 Math.imul：写成 todayKey() * 2654435761 的话，乘积是 5.4e16，
     超过 Number.MAX_SAFE_INTEGER（9.0e15），结果被舍到 8 的倍数上，于是
     % 4 恒等于 0 —— 解锁四关的人**每天都会拿到第 1 关**，而且不报任何错。
     Math.imul 走 32 位整数乘法，不经过浮点，没有这个问题。 */
  let h = todayKey();
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h = (h ^ (h >>> 15)) >>> 0;          // 转成无符号，免得负数取模出负值
  return (h % top) + 1;
}
function dailyBest(lv = dailyLevel(), d = todayKey()){
  return progress.daily.d === d && progress.daily.lv === lv ? (progress.daily.best || 0) : 0;
}
function recordDaily(sc){
  if (!Number.isFinite(sc) || sc <= 0) return false;
  const d = dailyRun ? dailyRun.d : todayKey(), lv = dailyRun ? dailyRun.lv : dailyLevel();
  // 跨午夜的局仍属于开局那天，不能把昨天的难度写成今天的纪录。
  if (progress.daily.d > d || sc <= dailyBest(lv,d)) return false;
  progress.daily = { d, lv, best: Math.min(Number.MAX_SAFE_INTEGER,sc) };
  saveProgress();
  return true;
}
let dailyRun = false;   // 本局是不是每日挑战，endGame 要用

/* ---------- 开局的滑动手势 ----------
 *
 * 这一条以前是弹一行字："滑动屏幕 或 按方向键移动"。换成动画有两个理由：
 *
 * 一是**读字有门槛**。这游戏主要给小朋友玩，一年级的孩子读一行字要好几秒，
 * 而这几秒里幽灵已经出来了。手势是看一眼就懂的，不认字也懂。
 *
 * 二是**教的东西和做的动作必须长得一样**。文字说"滑动"，玩家还要在脑子里把
 * 这两个字翻译成手上的动作；一根手指在屏幕上划过去，中间那道翻译就省了。
 *
 * 画在主角身上而不是屏幕中央：手势要和"谁会动"绑定，否则玩家不知道滑的是啥。
 * 玩家一旦真的动了就立刻消失 —— 他已经会了，再教就是打扰。这也是整套提示的
 * 共同原则：证明会了就闭嘴。
 */
/* 走近能量豆时先讲一句，而不是等他死了才讲。
 *
 * 原来这条只挂在"第一次死掉"上——那一刻确实最想知道还能怎么办，但那已经是
 * 失败之后了。走到跟前提醒，玩家有机会**自己试出来**："哦，原来这颗大的能
 * 吃它们"，这比死一次再被告知强得多。
 *
 * 死亡那处的调用**留着不动**：万一有人一路避开所有能量豆先死了，那条还能兜住。
 * hintOnce 本身按 id 去重，谁先到算谁的，两处并存不会讲两遍。
 */
const POWER_HINT_TILES = 3.2;    // 走进这个距离就算"看见了"

function checkPowerPelletNearby(){
  if (hintSeen('power')) return;
  const px = Math.round(player.x), py = Math.round(player.y);
  const r = Math.ceil(POWER_HINT_TILES);
  for (let y = py-r; y <= py+r; y++){
    for (let x = px-r; x <= px+r; x++){
      if (tileAt(x, y) !== 'o') continue;
      const pdx = x-player.x, pdy = y-player.y;
      if (pdx*pdx + pdy*pdy <= POWER_HINT_TILES*POWER_HINT_TILES){
        hintOnce('power', '能量星：收集后就能反击敌人', 0);
        return;
      }
    }
  }
}

const SWIPE_HINT_SECONDS = 3.2;
let swipeHint = null;     // { until } —— until 为 0 表示还没开始计时

function startSwipeHint(){
  if (hintSeen('move')) return;
  swipeHint = { until: 0 };
}

function drawSwipeHint(){
  if (!swipeHint) return;
  // 弹层盖着的时候不算数，跟文字提示同一个规矩：没真的显示就不能算用掉
  if (gameState !== 'playing') return;
  /* 关卡卡片期间也不画：那段时间 elapsed 是冻住的，手势会定格成一个不动的
     点，看起来像卡住了。等卡片过去再从头划。 */
  if (introTimer > 0) return;
  if (!swipeHint.until){
    swipeHint.until = elapsed + SWIPE_HINT_SECONDS;
    markHintSeen('move');
  }
  // 玩家一动就收起来
  if (player.dir.x || player.dir.y){ swipeHint = null; return; }
  const left = swipeHint.until - elapsed;
  if (left <= 0){ swipeHint = null; return; }

  const cx = player.x*TILE + TILE/2, cy = player.y*TILE + TILE/2;
  const cycle = 1.15;                       // 一次划动的时长
  const k = (elapsed % cycle) / cycle;      // 0..1
  const ease = k < 0.75 ? (k/0.75) : 1;     // 后四分之一停住，让人看清终点
  const reach = TILE * 2.6;
  const fade = Math.min(1, left / 0.6) * (k < 0.75 ? 1 : 1 - (k-0.75)/0.25);

  ctx.save();
  ctx.globalAlpha = 0.85 * fade;
  /* 拖影和指尖的透明度是量出来的，不是estimate的：第一版拖影最高只有 0.16、
     指尖 0.27 格，截图里量下来主角右侧那块青色像素只占 0.3% —— 等于没画。
     "轻"是指不要盖住棋盘、不要抢戏，不是指看不见。 */
  for (let i = 6; i >= 1; i--){
    const t = Math.max(0, ease - i*0.055);
    ctx.globalAlpha = (0.08 + (6-i)*0.05) * fade;
    ctx.fillStyle = cssVar('--cyan');
    ctx.beginPath();
    ctx.arc(cx + reach*t, cy, TILE*0.24, 0, Math.PI*2);
    ctx.fill();
  }
  // 指尖：外圈一道淡光晕，中间实心，最里一点白 —— 三层才像"一根手指按着"
  const fx = cx + reach*ease;
  ctx.globalAlpha = 0.22 * fade;
  ctx.fillStyle = cssVar('--cyan');
  ctx.beginPath(); ctx.arc(fx, cy, TILE*0.52, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 0.95 * fade;
  ctx.shadowColor = cssVar('--cyan'); ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(fx, cy, TILE*0.32, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(fx, cy, TILE*0.15, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function markHintSeen(id){
  hintSeen(id);                 // 确保缓存已建
  hintSeenCache[id] = true;     // 内存先记，本帧起就生效
  try {
    const seen = (localStorage.getItem(HINT_KEY) || '').split(',').filter(Boolean);
    if (seen.indexOf(id) < 0) seen.push(id);
    localStorage.setItem(HINT_KEY, seen.join(','));
  } catch (e) { /* 无痕模式：记不住就每次都提示一遍，不影响玩 */ }
}

function hintOnce(id, msg, delay){
  if (hintSeen(id)) return;
  /* 「用掉」必须和「真的显示了」绑在一起。
     原来是先记进 localStorage 再 setTimeout 弹 —— 如果这段延迟里玩家死了或
     重开了，toast 会弹在结算弹层后面（它在棋盘里，被弹层盖住），玩家什么都
     没看到，可这条提示已经**终身用掉了**，再也不会出现。教学提示总共就那么
     几条，白丢一条就是永久少教一件事。
     所以：延迟到点时先确认还在游戏中，确认了才记账、才显示。 */
  const fire = ()=>{
    if (hintSeen(id)) return;              // 这期间可能已由别的路径显示过
    if (gameState !== 'playing') return;   // 弹层盖着，弹了也看不见，留着下次
    markHintSeen(id);
    toast(msg);
  };
  if (delay) setTimeout(fire, delay); else fire();
}

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 1400);
}

/* ---------- collisions / eating ---------- */

/** 0 at level start, 1 once the last pellet is gone — drives the rising munch pitch. */
function eatProgress(){
  return pelletsTotal ? 1 - pelletsLeft / pelletsTotal : 0;
}

/** One compact bite per pellet. It must finish before the next high-speed pellet. */
const CHOMP_SECONDS = 0.10;
function triggerChomp(){
  player.chompT = 0;
}

function eatPelletAt(x,y){
  const ch = grid[y][x];
  if (ch==='.'){
    eraseDotCache(x,y);
    grid[y][x]=' '; pelletsLeft--; addPelletScore(10);
    Audio2.pellet(eatProgress());
    triggerChomp();
  }
  else if (ch==='o'){
    grid[y][x]=' '; pelletsLeft--; addPelletScore(50);
    triggerChomp();
    startPowerMode();
    ghostEatChain = 0;
    /* 恐惧时长不乘连击（见 frightSeconds），原来的「幽灵受惊 ×combo」会让玩家
       以为连击越高恐惧越久 —— 不是。toast 只报告真正发生的事。 */
    toast('能量星！现在可以反击敌人');
    Audio2.power();
  }
}

/* ---------- power mode ----------
 * Fright is tracked as ONE global timer rather than a per-ghost countdown.
 * Per-ghost timers caused a real bug: eating a ghost zeroed its own fright,
 * so when it respawned it came back out as a lethal chaser while the power
 * pellet was still visibly active — killing players who reasonably expected
 * to be able to eat it. Anything asking "are ghosts edible right now?" must
 * consult frightTimer, never a ghost's own field.
 */
// 1.15, down from 1.30. At 1.30 the base 5.41 tiles/sec jumped to 7.03, fast
// enough that turns started overshooting right when the player most wants
// precision (threading toward a fleeing ghost). 1.15 still reads clearly as
// "I got faster" without costing control.
const FRIGHT_PLAYER_SPEED_MULT = 1.15;
const FRIGHT_GHOST_SPEED_MULT = 0.85;
// 六关可反击时间统一为 9 秒。续星刷新，而不是累加；不受连击倍率影响。
const FRIGHT_SECONDS = 9;
function frightSeconds(){
  return FRIGHT_SECONDS;
}

function startPowerMode(){
  frightTimer = frightSeconds();
  ghosts.forEach(g=>{
    // 已被吃掉、正在回家的敌人保持 eaten；其余场上敌人统一进入可反击状态。
    if (g.state!=='house' && g.state!=='eaten'){
      if (g.state!=='frightened') g.dir = opposite(g.dir);
      g.state = 'frightened';
    }
    // 新的一颗能量豆 = 新的一轮，"这轮已经吃过谁"一笔勾销，全场重新可吃
    g.eatenThisFright = false;
  });
  applySpeedModifiers();
}

function endPowerMode(){
  frightTimer = 0;
  ghosts.forEach(g=>{
    if (g.state==='frightened') g.state='chase';
    g.eatenThisFright = false;
  });
  applySpeedModifiers();
}

/** Re-derives every entity's speed from its base, so modifiers never compound. */
/* ---------- momentum ----------
 * Holding one direction winds the player up to MOMENTUM_MAX; any change of
 * direction drops it straight back to 1. This is what makes barrelling down a
 * corridor feel greedy: commit and you accelerate, weave and you stay slow.
 *
 * Deliberately NOT driven by the combo counter. Combo already pays out as a
 * score multiplier and is uncapped, so feeding it into speed too would be a
 * runaway loop — faster means more pellets means faster still — and it would
 * reward circling a dense pocket just as much as charging forward, which is
 * the opposite of the intent.
 *
 * The ramp length is tuned against the maps: average unbroken straight run is
 * ~7.4 tiles, so 5 tiles means full speed arrives near the end of a typical
 * corridor rather than instantly.
 */
const MOMENTUM_RAMP_TILES = 5;
const MOMENTUM_MAX = 1.22;
/* 闪烁频率。WCAG 2.1 的通用闪烁阈值是每秒 3 次，这两个都压在下面。
   穿墙比无敌更慢，因为它持续 10 秒而无敌只有 1.6~2.4 秒 —— 越长越要温和。 */
const PHASE_PULSE_HZ = 2;
const INVULN_PULSE_HZ = 3;
/* 能量结束的小夜枭警示也保持温和：2Hz 足够醒目，不再每秒四次硬闪。 */
const GHOST_WARNING_HZ = 2;
/* 穿墙结束时整张迷宫只做轻微呼吸；红色倒计时条负责真正的警示。 */
const PHASE_WALL_WARNING_HZ = 2;
/* 游戏内豆豆必须给通道留出读路空间。30px 图框里的实色角色约 23px，
   和 26px 通道、小游戏的矢量豆豆尺寸相配；不再使用原来的 38px 大头像。 */
const PLAYER_SPRITE_SIZE = 30;
const PLAYER_GAIT_TILES = 0.85; // 每走 0.85 格完成一步，速度越快动作自然越快
const PLAYER_HOP_PX = 0.38;
const PLAYER_SWAY_PX = 0.22;
const PLAYER_LEAN_RAD = 0.045;
const PLAYER_TURN_SECONDS = 0.12;
const ENEMY_THREAT_TILES = 4.5;
const ENEMY_THREAT_BASE = 0.38;
/* 尾迹：间距和点数。压到这一档是业主看过三档对比之后选的（方案 B）——
   最大的一个只有本体 60%、最亮 0.18，速度感留着，但不再和角色抢。 */
const TRAIL_SPACING = 0.34;   // 每隔多少格留一个点
const TRAIL_MAX = 5;          // 最多留几个

function momentumMult(){
  const t = Math.min(1, player.straightTiles / MOMENTUM_RAMP_TILES);
  return 1 + t * (MOMENTUM_MAX - 1);
}

function applySpeedModifiers(){
  const powered = frightTimer > 0;
  /* 穿墙时**不吃冲刺加成**，另外再慢一档。
   *
   * 冲刺的设计意图是"敢走长直线就奖励你"。可穿墙的时候没有墙逼你转弯，长直线
   * 是白送的，动量必然顶满 1.22 倍 —— 奖励的不是胆量，只是道具本身。结果第六关
   * 穿墙状态下是 6.86×1.22≈8.4 格/秒，横穿整张图 2.3 秒，根本来不及瞄。
   *
   * 道具变得难用，等于把最有意思的一个道具做废了：玩家吃到它反而不敢乱走。
   * 现在改成穿墙期间锁 0.88 倍，比平时还慢一点 —— 换来的是能贴着想去的那颗豆
   * 停下、能在墙里精确改道。速度它本来就不缺，缺的是控制。
   * （第六关 6.86×0.88≈6.0，仍然快过敌人的统一基础速度 2.35。） */
  const phasing = player.phase > 0;
  player.speed = player.baseSpeed
    * (powered ? FRIGHT_PLAYER_SPEED_MULT : 1)
    * (phasing ? FRUIT_PHASE_SPEED_MULT : momentumMult());
  ghosts.forEach(g=>{
    g.speed = g.baseSpeed * (powered ? FRIGHT_GHOST_SPEED_MULT : 1) * mercySpeedMult;
  });
}

/** True only while the player may safely touch this ghost. */
/**
 * 能量豆生效期间，除了"已被吃掉、正飘回老巢的那双眼睛"，其余幽灵一律可吃。
 *
 * 原来这里还排除了 'house'，导致老巢里和刚出门那段时间的幽灵状态含糊。
 * 排不排其实无所谓 —— handleGhostCollisions 本来就整个跳过 house 状态的
 * 幽灵，玩家也走不进老巢 —— 但含糊会传染到画面上：drawGhost 曾经按
 * state==='frightened' 上色，而判定按这个函数，两套依据必然对不齐。
 * 于是出现"看着是红的、其实能吃"的幽灵。
 *
 * 现在这是唯一的依据：能不能吃、画成什么颜色，都问它。
 */
/* 能不能吃，只认这一个函数——颜色和判定都从这儿出，绝不能各判各的。
 *
 * eatenThisFright：这一轮已经被吃过的幽灵，从老巢出来后就**不再可吃**了，
 * 街机原版也是这个规则。少了它，复活的幽灵会重新变成可吃状态，同一颗能量豆
 * 里能把一只幽灵反复吃，悬赏还是一路往上加：第一关实测一轮吃到 11 只（场上
 * 总共才 4 只），第六关一颗豆能刷出两百多万分，排行榜直接废掉。
 * 顺带它也让"全灭"重新有确定含义——吃满场上只数，不多不少。
 *
 * 复活的幽灵因此画的是本来的颜色，不是恐惧色。这跟"吃了大豆所有幽灵变一种
 * 颜色"不冲突：没被吃过的（包括这期间刚出老巢的）照样是恐惧色，而复活那只
 * 确实已经不能吃了，给它涂成可吃的颜色才是害人——照着颜色去撞，白丢一条命。
 */
function isEdible(g){
  return frightTimer > 0 && !g.eatenThisFright && g.state !== 'eaten';
}

function handleGhostCollisions(){
  for (const g of ghosts){
    if (g.state==='house' || g.state==='eaten') continue;
    const cdx = g.x-player.x, cdy = g.y-player.y;
    if (cdx*cdx + cdy*cdy >= 0.3025) continue;   // 0.55 格，平方比较不开根号

    if (isEdible(g)){
      ghostEatChain++;
      /* 悬赏：同一颗能量豆内，第 n 只实际值 n × 1.69 万分。
         原来是 200×2^n（封顶第 4 只），换算下来最多两千出头 —— 和一路吃豆子
         的收益比起来，主动去追幽灵完全不划算，玩家自然选择躲。现在一只就抵
         得上几百颗豆子，"敢不敢转身"才成为真正的决策。
         按线性递增而不是翻倍：翻倍到第 7 只会是 64 万，一次全灭就锁死排行榜，
         后面再玩多久都没意义。 */
      // 悬赏再 +30%，并续同一条连击；不额外叠乘吃豆倍率。
      const pts = addComboScore(ghostEatChain * GHOST_BOUNTY_STEP, true);
      g.state='eaten';
      g.eatenThisFright = true;   // 这轮不能再吃第二次，见 isEdible
      ghostsEatenThisRun++;       // 结算页要报这一局吃了几只
      ghostsEatenThisLevel++;
      noteOwl(g.id, 'ate');
      applySpeedModifiers();
      toast('反击! +' + fmtNum(pts));
      /* 悬赏是阶梯式的，可玩家第一次只看到"+16,900"这一个数，没法知道它会往上
         涨 —— 而"要不要冒险再追一只"正是这套设计想让他做的决定。晚 1.4 秒发，
         让上面那条加分先显示完，别把两条消息挤成一条。 */
      hintOnce('bounty', '同一颗能量星里：第 2 只 3.38 万，第 3 只 5.07 万，越吃越值钱', 1400);
      updateHud();
      Audio2.eatGhost(ghostEatChain);

      /* 一颗能量豆之内把场上幽灵全吃了？看的是**这一轮吃掉的只数**，不是
         "现在是不是每只都还躺着"。
         以前那种写法（ghosts.every(state==='eaten')）能成立，靠的其实是眼睛
         回不了家这个 bug —— 吃掉的永远躺着，自然每只都是 'eaten'。眼睛能正常
         回家之后，先吃的那只往往在你吃到最后一只之前就复活了，条件永远不成立，
         全灭奖励会无声无息地再也拿不到。
         数只数则不受回家快慢影响：吃满 ghosts.length 只就是全灭。 */
      if (ghostEatChain >= ghosts.length){
        sweepsThisRun++;
        Audio2.sweep();
        toast('全灭对手！+' + fmtNum(awardBonus('全灭对手', BONUS.GHOST_SWEEP, true)));
      }
    } else if (invuln<=0){
      loseLife(g);
      return;
    }
  }
}

/* ---------- life / level ---------- */
/* 死亡后的定格。
 *
 * 原来是**瞬间复活**：碰到幽灵的下一帧人就回到出生点继续跑。快是快，但玩家
 * 常常不知道刚才发生了什么 —— 尤其连掉两条命时，画面上只是"位置突然变了"，
 * 三条命可能在两秒内没光，而他全程没意识到自己在死。
 *
 * 定住 0.55 秒（规格给的是 400~700ms），配一圈红色内发光闪 130ms。
 * 这段时间里 update 整个不跑，所以幽灵也停着 —— 复活后不会一睁眼就被贴脸。
 */
const DEATH_PAUSE_SECONDS = 0.55;
const DEATH_FLASH_SECONDS = 0.13;

function drawDeathFlash(){
  if (deathFlash <= 0) return;
  const k = deathFlash / DEATH_FLASH_SECONDS;          // 1 -> 0
  const W = COLS*TILE, H = ROWS*TILE;
  ctx.save();
  /* 只在四周描一圈内发光，不铺满整屏 —— 铺满会盖住幽灵和主角，
     而这一刻玩家最需要看清的恰恰是"我是被谁碰到的"。 */
  ctx.globalAlpha = 0.55 * k;
  ctx.strokeStyle = cssVar('--danger');
  ctx.shadowColor = cssVar('--danger');
  ctx.shadowBlur = 34;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W-10, H-10);
  ctx.restore();
}

/* 参数 killer 是**抓住你的那一个**。
 *
 * 加这个参数的理由不是记账，是教学：小孩连着死五次，脑子里留下的往往只有
 * "这一关好难"，而不是"我每次都死在同一个抄近路的家伙手上"。死因提示把那
 * 五次合并成一条可执行的对策，挫败才变成学习。
 *
 * 允许为空：碰不到实体的死法（真出现的话）不该因为少个参数就崩。 */
function loseLife(killer){
  lives--;
  deathsThisLevel++; deathsThisRun++;
  /* 温柔降难：同一关连续死到第 3 次，本关幽灵放慢一成。不是送分 —— 只是
     让卡住的人多一点反应时间；过关或重开就复位（resetLevel 里 mercySpeedMult=1）。
     提示挑最温和的说法，不点破"你死太多次了"。 */
  let mercyJustKicked = false;
  if (deathsThisLevel === 3 && mercySpeedMult === 1){
    mercySpeedMult = 0.9;
    mercyJustKicked = true;
    toast('对手们放慢脚步啦');
  }
  updateHud();
  Audio2.death();
  deathFlash = DEATH_FLASH_SECONDS;
  deathPause = DEATH_PAUSE_SECONDS;
  /* 死因提示。每次都说，不做 hintOnce ——
     这不是"教一次就会"的规则说明，是**对这一次死法的复盘**：同一句话看第五遍
     的时候，孩子才会把它和自己刚才那一下连起来。真正会烦人的是重复无关的话，
     不是重复正中要害的话。
     上面那条"温柔降难"抢在前面时让位：连死三次的那一刻，先告诉他情况变好了，
     比再解释一遍他为什么死更重要。 */
  const killerId = killer && killer.id;
  if (killerId){
    noteOwl(killerId, 'caught');
    const entry = OWL_CODEX.find(o => o.id === killerId);
    if (entry && !mercyJustKicked) toast(entry.tip);
  }
  /* 从 900 挪到 1600：死因提示占着前 1.4 秒，900 会把它顶掉。
     两条都值得看，那就排队，不要抢。 */
  hintOnce('power', '收集能量星，可以反击敌人！', 1600);
  if (lives<=0){ endGame(false); return; }
  player.x=SPAWN.player.x; player.y=SPAWN.player.y; player.dir={x:0,y:0}; player.want={x:0,y:0};
  player.warpCd=0; player.warpCdCh=null; player.warpChoiceUntil=0; player.warpStandingOn=null;
  player.straightTiles=0; player.trail.length=0; player.trailAt=player.distTravelled; // respawn at a standstill, no leftover wind-up
  frightTimer = 0; // dying cancels the power pellet outright
  ghostEatChain = 0;
  ghosts.forEach((g,i)=>{
    g.x=SPAWN.ghosts[i].x; g.y=SPAWN.ghosts[i].y;
    g.state=i===0?'exiting':'house';
    g.warpCd=0; g.warpCdCh=null; g.warpStandingOn=null;
    g.releaseAt = elapsed + i * ghostReleaseGap();
    // 上面 frightTimer 已经清零，这两个是配套的每局状态，一起归位：
    // homeY 留着会让下次进巢停在上一条命的位置，eatenThisFright 留着会让
    // 新一轮能量豆里有幽灵莫名其妙吃不了。
    g.homeY = null; g.eatenThisFright = false;
  });
  applySpeedModifiers();
  invuln = 1.6;
}

/* ---------- victory fireworks ----------
 * Runs on its own canvas and its own rAF loop, and stops itself once the last
 * spark dies, so it can never keep burning frames behind the game. Respects
 * prefers-reduced-motion: the burst is skipped entirely rather than merely
 * slowed, since the whole point of it is motion.
 */
const fxCanvas = document.getElementById('fxCanvas');
const fxCtx = fxCanvas.getContext('2d');
let fxParticles = [], fxRunning = false, fxNextBurst = 0, fxUntil = 0, fxBigLeft = 0;

const FX_COLORS = ['#ffd166','#ff5a6e','#ff9ad5','#7ee0c9','#ffb26b','#ffffff'];

/* 每种颜色预渲染一张"发光点"贴图，粒子直接贴图，不再逐个算阴影。
 *
 * 为什么必须这么做：礼花每个粒子原来都是 shadowBlur=8 的一次 arc+fill，
 * 而 shadowBlur 是 canvas 2D 最贵的操作。实测通关礼花期间**平均每帧 352 次、
 * 单帧峰值 506 次**带阴影绘制，四秒里十万次 —— 比当初豆子那个问题（394/帧）
 * 还重，而且它出现在最该流畅的一刻，还要持续十八秒。孩子的手机正是在这里卡。
 *
 * 贴图只在第一次用到时生成六张（每色一张），之后每帧就是 drawImage —— 一次
 * 位图拷贝，比重新算一遍高斯模糊便宜一个数量级。
 *
 * 贴图里用径向渐变模拟原来的光晕：中心实心，向外淡出。CORE 是实心部分占整张
 * 贴图半径的比例，取 0.28 —— 原来 size 在 1.6~4 之间、光晕固定 8px，换算过来
 * 这个比值在 0.17~0.33 之间，取中间值，肉眼分不出差别（改完做过像素比对）。 */
/* 贴图**用真正的 shadowBlur 画一次**，而不是拿径向渐变去模仿它。
   第一版就是用渐变仿的，结果整幅亮度从 5.36 涨到 14.1（亮了 2.6 倍）——
   高斯模糊的衰减比线性渐变快得多，仿不像。现在这张贴图就是原来那一颗粒子，
   只是只画一次；观感一致由像素比对验证。 */
const FX_REF = 3;            // 贴图按这个粒子半径渲染，画的时候按 size/FX_REF 缩放
const FX_PAD = 14;           // 给 shadowBlur 留的边距（blur 8，尾巴到不了 14）
let fxSprites = null;        // 颜色 -> canvas；null 表示还没生成
let fxSpritesFailed = false; // 环境造不出离屏画布时退回老路径

function fxGetSprites(){
  if (fxSprites || fxSpritesFailed) return fxSprites;
  try {
    const made = {};
    const R = FX_REF + FX_PAD;
    for (const col of FX_COLORS){
      const c = document.createElement('canvas');
      c.width = c.height = R * 2;
      const g = c.getContext('2d');
      if (!g || !g.arc) throw new Error('no 2d');
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8;
      g.beginPath(); g.arc(R, R, FX_REF, 0, Math.PI*2); g.fill();
      made[col] = c;
    }
    fxSprites = made;
    fxSpriteR = R;
  } catch (e) {
    // 微信那两版的 document 是垫片，可能没有 createElement —— 退回原来的画法
    fxSpritesFailed = true;
  }
  return fxSprites;
}
let fxSpriteR = FX_REF + FX_PAD;
const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 内存吃紧时把能放的都放掉。

   小游戏跑在别人的手机上，低端机内存告警是常事 —— 收到 onMemoryWarning 却
   什么都不做，下一步就是被系统杀掉，玩家看到的是"闪退"。
   能放的就两样：烟花贴图（每种颜色一块离屏画布）和调色板缓存。两样都会在
   下次需要时自动重建，所以放掉是安全的，代价只是那一帧稍慢一点。 */
function releaseCaches(){
  fxSprites = null;
  fxSpritesFailed = false;   // 给它一次重建的机会，别因为一次告警就永久退化
  wallCache = null;          // 墙的离屏缓存也放掉，下一帧自动重建
  wallCacheDirty = true;
  wallCacheFailed = false;
  dotCache = null;           // 普通豆的离屏层同样可以随时重建
  dotCacheDirty = true;
  dotCacheFailed = false;
  CSSVAR.clear();
  return true;
}

function fxResize(){
  const r = fxCanvas.getBoundingClientRect();
  /* 和迷宫画布用同一个上限。3 倍和 2 倍在这种发光圆点上肉眼分不出，而烟花
     期间同屏粒子最多，高 DPR 设备上白涨一倍多的像素面积很不划算。 */
  const cap = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  fxCanvas.width = Math.round(r.width * cap);
  fxCanvas.height = Math.round(r.height * cap);
  /* 用 scale 而不是 setTransform。给 canvas 赋 width 之后变换本来就是单位矩阵，
     两者等价，而老基础库的 2d context 不一定实现 setTransform —— 迷宫那边早就
     因为这个改用 scale 了，烟花这条一直没跟上。
     而它**只在通关时才跑**：普通启动、普通试玩全都碰不到，真机上一崩就是
     打穿六关那一刻，最难复现的时机。留个兜底，两条路都走得通。 */
  if (typeof fxCtx.setTransform === 'function') fxCtx.setTransform(cap, 0, 0, cap, 0, 0);
  else fxCtx.scale(cap, cap);
  return { w: r.width, h: r.height };
}

/**
 * 一朵烟花。
 *
 * big=true 是"大礼花"：粒子多一倍、飞得更远、还带一圈同心的内环，看上去
 * 像真的炸开而不是撒了一把点。通关是六关全通才有的稀有事件，一辈子可能就
 * 见几次，值得铺张 —— 之前那版太克制，像个小小的确认动画。
 */
function fxBurst(w, h, big){
  const cx = w * (0.14 + Math.random()*0.72);
  const cy = h * (0.10 + Math.random()*0.46);
  const hue = FX_COLORS[Math.floor(Math.random()*FX_COLORS.length)];
  const n = big ? 62 + Math.floor(Math.random()*24) : 30 + Math.floor(Math.random()*18);
  const power = big ? 1.7 : 1;
  for (let i=0;i<n;i++){
    const a = (Math.PI*2*i)/n + Math.random()*0.2;
    const sp = (46 + Math.random()*105) * power;
    fxParticles.push({ x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                       life:1, color:hue, size:(1.6+Math.random()*2.0)*(big?1.35:1) });
  }
  if (big){
    // 内环用另一种颜色，炸开时有层次，而不是一团同色的雾
    const inner = FX_COLORS[Math.floor(Math.random()*FX_COLORS.length)];
    const m = 22;
    for (let i=0;i<m;i++){
      const a = (Math.PI*2*i)/m;
      const sp = 30 + Math.random()*26;
      fxParticles.push({ x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                         life:1.25, color:inner, size:2.4+Math.random()*1.6 });
    }
  }
}

/** 粒子循环本体。startFireworks 和 startComboFx 共用 —— 两条入口只差在
 *  "要不要继续产生新的爆发"，更新与绘制只有一份。 */
function fxLoopStart(w, h){
  if (fxRunning) return;
  fxRunning = true;

  let last = performance.now();
  const step = (now)=>{
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;
    fxCtx.clearRect(0, 0, w, h);

    if (now < fxUntil && now >= fxNextBurst){
      // 开场连放五发大的，之后三成概率再来一发；气势要一上来就有
      const big = fxBigLeft > 0 || Math.random() < 0.3;
      if (fxBigLeft > 0) fxBigLeft--;
      fxBurst(w, h, big);
      // 大礼花之间留久一点，让它炸得开；小的密集补位
      fxNextBurst = now + (big ? 300 + Math.random()*160 : 130 + Math.random()*190);
    }

    for (const p of fxParticles){
      p.vy += 90*dt;              // gravity
      p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.life -= dt*0.55;
    }
    fxParticles = fxParticles.filter(p => p.life > 0);

    const sprites = fxGetSprites();
    if (sprites){
      /* 贴图路径：一次 drawImage 顶掉原来的 beginPath+arc+fill+阴影。
         贴图是按半径 FX_REF 的粒子渲染的，所以整体按 size/FX_REF 缩放。 */
      for (const p of fxParticles){
        fxCtx.globalAlpha = Math.max(0, p.life);
        const r = fxSpriteR * (p.size / FX_REF);
        fxCtx.drawImage(sprites[p.color], p.x - r, p.y - r, r * 2, r * 2);
      }
    } else {
      // 退路：环境造不出贴图时照旧逐个画（微信垫片等）
      for (const p of fxParticles){
        fxCtx.globalAlpha = Math.max(0, p.life);
        fxCtx.fillStyle = p.color;
        fxCtx.shadowColor = p.color;
        fxCtx.shadowBlur = 8;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        fxCtx.fill();
      }
      fxCtx.shadowBlur = 0;
    }
    fxCtx.globalAlpha = 1;

    if (now >= fxUntil && !fxParticles.length){
      fxRunning = false;
      fxCanvas.classList.remove('on');
      fxCtx.clearRect(0, 0, w, h);
      return;                      // self-terminating: no idle frames left behind
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** @param ms 放多久。通关是大事（默认 18 秒），破纪录小庆祝一下就够（6 秒）。 */
function startFireworks(ms){
  if (prefersReducedMotion()) return;
  fxCanvas.classList.add('on');
  const { w, h } = fxResize();
  fxParticles = [];
  fxNextBurst = 0;
  // 12s, up from 6s. Clearing all six levels is a rare event — level 6 was
  // unwinnable until recently, so almost nobody had ever seen this — and six
  // seconds of it was over before the player had finished reading their score.
  const dur = ms || 18000;
  fxUntil = performance.now() + dur;
  fxBigLeft = dur >= 12000 ? 5 : 2;   // 开场连放几发大的，气势要一上来就有
  fxLoopStart(w, h);
}

/* 连击里程碑的一小把彩带：轻、短、只从上沿往下飘。
 *
 * 和通关礼花的区别就两点：粒子只有一小把（26 颗对 60+），而且**不再产生新的
 * 爆发**（fxUntil=0）——飘完这一把就自己收场，全程一秒多。粒子从画布上沿外
 * 出发往下飘，不在迷宫中间炸开：玩家正贴着幽灵跑，中间必须永远是清楚的。
 * 礼花正在放的时候不抢画布（里程碑只在游玩中触发，正常撞不上，兜底而已）。 */
function startComboFx(){
  if (prefersReducedMotion()) return;
  if (fxRunning) return;
  fxCanvas.classList.add('on');
  const { w, h } = fxResize();
  fxParticles = [];
  fxUntil = 0;   // 不产生新爆发，这把彩带飘完就结束
  const n = 26;
  for (let i=0;i<n;i++){
    fxParticles.push({
      x: w * (0.08 + Math.random()*0.84),
      y: -4 - Math.random()*10,
      vx: (Math.random()-0.5)*36,
      vy: 30 + Math.random()*50,
      life: 1.1,
      color: FX_COLORS[Math.floor(Math.random()*FX_COLORS.length)],
      size: 1.8 + Math.random()*1.8,
    });
  }
  fxLoopStart(w, h);
}

function stopFireworks(){
  fxUntil = 0;
  fxParticles = [];
  fxCanvas.classList.remove('on');
}

/* ---------- high score board ----------
 * localStorage throws outright in some private-browsing modes rather than
 * just returning null, so every access is guarded. A blocked board must never
 * take the game down with it — it simply stops persisting.
 */
const SCORE_KEY = 'doudou.scores.v3';
const PREVIOUS_SCORE_KEY = 'doudou.scores.v2';
const LEGACY_SCORE_KEY = 'doudou.scores.v1';
const NAME_KEY = 'doudou.name';
const BOARD_SIZE = 8;
const NAME_MAX = 8;
const DEFAULT_NAME = '无名豆豆';
let bestScoreCache = null, bestComboCache = null;

/**
 * v1 rows were earned before SCORE_MULT existed, so ranking them against new
 * runs unchanged would permanently bury them. They are carried over multiplied
 * up and flagged, rather than dropped — wiping someone's board to ship a
 * scoring change is the rude option.
 *
 * The factor is pinned at 2 rather than reading SCORE_MULT: 2 is what the
 * migration actually applied when it shipped. Following later multiplier changes
 * would convert two players' legacy rows at different rates depending on when
 * they happened to open the game, which is worse than being slightly generous
 * to everyone equally.
 */
const LEGACY_SCALE = 2;
function migrateLegacy(){
  try {
    const raw = localStorage.getItem(LEGACY_SCORE_KEY);
    if (!raw) return null;
    localStorage.removeItem(LEGACY_SCORE_KEY);
    const old = JSON.parse(raw);
    if (!Array.isArray(old)) return null;
    const list = old.map((r,i)=>({
      id: 'legacy-'+i, name: DEFAULT_NAME, score: (r.score||0) * LEGACY_SCALE,
      level: r.level||1, combo: r.combo||1, won: !!r.won, date: r.date||'', legacy: true,
    }));
    localStorage.setItem(SCORE_KEY, JSON.stringify(list));
    return list;
  } catch { return null; }
}

/* v2 就是提高 30% 之前的当前排行榜。新局全部多拿 30%，旧纪录如果原样保留，
   同一套打法只因打开游戏的日期不同就不再可比。首次读取 v3 时把 v2 的每条分数
   同步乘 1.3；v2 原件不删除，迁移失败或以后需要排查时仍有退路。 */
function migratePreviousScores(){
  try {
    const raw = localStorage.getItem(PREVIOUS_SCORE_KEY);
    if (raw === null) return null;
    const old = JSON.parse(raw);
    if (!Array.isArray(old)) return null;
    const list = old.map(sanitizeScore).filter(Boolean).map(row=>({
      ...row,
      score: Math.round(row.score * SCORE_BOOST),
    }));
    localStorage.setItem(SCORE_KEY, JSON.stringify(list));
    return list;
  } catch { return null; }
}

/* 逐条校验存进来的纪录。

   存档是**外部输入** —— 它可能被上一版写坏、被别的工具改过、或者存到一半
   断电截断。原来只判了"是不是数组"，一条 score 是 NaN 的记录就能让排行榜
   排序变得毫无意义（NaN 参与比较永远返回 false），而 name 是对象的话
   渲染时直接抛。这些都不报错，只是榜单突然变得莫名其妙。 */
function sanitizeScore(r){
  if (!r || typeof r !== 'object') return null;
  const num = (v, lo, hi) => {
    /* null / undefined / 空串要先挡掉。Number(null) 是 **0** 不是 NaN，
       Number('') 也是 0 —— 直接 Number() 的话，一条 score 缺失的坏记录会变成
       "0 分"混进榜单，看起来还挺正常。这是 JS 里最容易被忽略的一处强制转换。 */
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(hi, Math.max(lo, Math.round(n)));
  };
  const score = num(r.score, 0, 1e12);
  if (score === null) return null;              // 分数是这条记录存在的理由，没有就丢
  const lv = num(r.level, 1, MAX_LEVEL), cb = num(r.combo, 1, 1e6);
  return {
    id: typeof r.id === 'string' ? r.id.slice(0, 64) : ('r' + score + '-' + Math.random().toString(36).slice(2, 8)),
    name: cleanName(r.name) || DEFAULT_NAME,
    score,
    level: lv === null ? 1 : lv,   // 微信基础库没有 ??，一律三元
    combo: cb === null ? 1 : cb,
    won: !!r.won,
    date: typeof r.date === 'string' ? r.date.slice(0, 32) : '',
    legacy: !!r.legacy,
  };
}

function loadScores(){
  let raw = null;
  try { raw = localStorage.getItem(SCORE_KEY); } catch (e) { return []; }
  if (raw === null){
    try { const migrated = migratePreviousScores(); if (migrated) return migrated; } catch (e) {}
    try { const migrated = migrateLegacy(); if (migrated) return migrated; } catch (e) {}
    return [];
  }
  let list;
  try { list = JSON.parse(raw); }
  catch (e) {
    /* JSON 坏了。原来直接返回空数组 —— 玩家的纪录就这么无声清零了，而且
       下一次保存会把坏值覆盖掉，再也找不回来。先留一份原始副本再清空：
       占不了多少空间，万一是可修复的，人还有得救。 */
    try { localStorage.setItem(SCORE_KEY + '.corrupt.' + Date.now(), String(raw).slice(0, 20000)); } catch (e2) {}
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.map(sanitizeScore).filter(Boolean);
}

function saveScores(list){
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(list));
    const boardBest = list.length ? Math.max.apply(null,list.map(r=>r.score||0)) : 0;
    bestComboCache = list.reduce((m,r)=>Math.max(m,r.combo||0),0);
    if (boardBest > localSave.highScore){
      localSave.highScore = boardBest;
      saveLocalState();
    }
    bestScoreCache = Math.max(localSave.highScore, boardBest);
    return true;
  }
  catch { return false; }
}

/* Recent runs are an independent local journal, never a cloud upload queue.
   Reuse save parsing/backup and score validation, then validate the extra fields
   strictly: coercing "false" or inventing a timestamp would misdescribe a run. */
const RECENT_SCORE_KEY = 'doudou.recent.v1';
const RECENT_SCORE_LIMIT = 30;
let recentWriteFailed = false;
let lastRecentRunId = null;
let recentBadRaw = null;
let recentBadRows = [];
function sanitizeRecentScore(r){
  if (!saveObject(r) || typeof r.runId !== 'string' || !r.runId || r.runId.length > 64
      || !Number.isSafeInteger(r.score) || r.score < 0 || r.score > 1e12
      || !Number.isInteger(r.level) || r.level < 1 || r.level > MAX_LEVEL
      || !Number.isSafeInteger(r.maxCombo) || r.maxCombo < 1 || r.maxCombo > 1e6
      || typeof r.won !== 'boolean'
      || !Number.isSafeInteger(r.playedAt) || r.playedAt <= 0
      || !Number.isFinite(new Date(r.playedAt).getTime())) return null;
  const clean = sanitizeScore({score:r.score, level:r.level, combo:r.maxCombo, won:r.won, id:r.runId});
  if (!clean) return null;
  return {runId:r.runId, score:clean.score, level:clean.level,
    maxCombo:clean.combo, won:clean.won, playedAt:r.playedAt};
}
function loadRecentScores(){
  const diagnostic = {status:'ok', raw:null};
  // Avoid multiplying identical corruption backups during cloud/UI refreshes.
  let value;
  try {
    const raw = localStorage.getItem(RECENT_SCORE_KEY);
    if (raw !== null && raw === recentBadRaw) return {rows:recentBadRows.slice(), status:'corrupt'};
  } catch (e) { return {rows:[], status:'unavailable'}; }
  value = readStoredJSON(RECENT_SCORE_KEY, diagnostic);
  if (diagnostic.status !== 'ok') {
    if (diagnostic.status === 'corrupt') { recentBadRaw = diagnostic.raw; recentBadRows = []; }
    return {rows:[], status:diagnostic.status};
  }
  if (diagnostic.raw === null) return {rows:[], status:'ok'};
  if (!Array.isArray(value)) {
    recentBadRaw = diagnostic.raw;
    recentBadRows = [];
    backupCorruptJSON(RECENT_SCORE_KEY, diagnostic.raw);
    return {rows:[], status:'corrupt'};
  }
  const seen = new Set();
  const rows = value.map(sanitizeRecentScore).filter(row=>{
    if (!row || seen.has(row.runId)) return false;
    seen.add(row.runId); return true;
  });
  const damaged = rows.length !== value.length || rows.length > RECENT_SCORE_LIMIT;
  // Keep valid siblings. A bounded extra backup protects malformed row fields.
  if (damaged && diagnostic.raw !== recentBadRaw) {
    backupCorruptJSON(RECENT_SCORE_KEY, diagnostic.raw);
    recentBadRaw = diagnostic.raw;
    recentBadRows = rows.slice(0, RECENT_SCORE_LIMIT);
  }
  return {rows:rows.slice(0, RECENT_SCORE_LIMIT), status:damaged ? 'corrupt' : 'ok'};
}
function recordRecentScore(entry){
  if (practiceLevel || dailyRun) return false;
  const row = sanitizeRecentScore(entry);
  if (!row) return false;
  const saved = loadRecentScores(); // read the latest journal, including other tabs
  if (saved.status === 'unavailable') { recentWriteFailed = true; return false; }
  if (lastRecentRunId === row.runId || saved.rows.some(item=>item.runId === row.runId)) return true;
  const next = [row].concat(saved.rows).slice(0, RECENT_SCORE_LIMIT);
  try {
    localStorage.setItem(RECENT_SCORE_KEY, JSON.stringify(next));
    lastRecentRunId = row.runId;
    recentWriteFailed = false;
    recentBadRaw = null;
    return true;
  } catch (e) { recentWriteFailed = true; return false; }
}
function recentScoreState(){
  const saved = loadRecentScores();
  const highScore = Math.max(bestScore(), normalizeLocalSave(readStoredJSON(LOCAL_SAVE_KEY)).highScore);
  return {rows:saved.rows, status:saved.status, saveFailed:recentWriteFailed, highScore};
}

function loadName(){
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function saveName(name){
  try { localStorage.setItem(NAME_KEY, name); } catch { /* private mode: don't persist */ }
}

/** Trims to a sane display width and strips anything that could break the row. */
function cleanName(raw){
  return String(raw || '').replace(/[<>&"']/g, '').trim().slice(0, NAME_MAX);
}

/* ---------- optional Supabase leaderboard ----------
 *
 * 静态站不能安全保存 service_role 私钥。这里只读取可以公开的 anon key，并且只
 * 调用数据库里明确授权的 RPC / 只读视图。没配 config.js、网络失败或 Supabase
 * 暂停时全部安静降级成本机榜，游戏本身不依赖云服务。
 */
const CLIENT_VERSION = 'web-2026.09.04';
const Analytics = {
  track(event, params={}){
    try {
      if (window.NeonAnalytics && typeof window.NeonAnalytics.track === 'function')
        window.NeonAnalytics.track(event, params);
    } catch (e) {}
  },
};
function notifyAdOpportunity(kind){
  // 仅预留自然停顿挂点；仓库当前没有 NeonAdHooks 实现，也不会调用任何广告服务。
  if (kind !== 'post_game') return false;
  try {
    if (window.NeonAdHooks && typeof window.NeonAdHooks.onOpportunity === 'function'){
      window.NeonAdHooks.onOpportunity(kind);
      return true;
    }
  } catch (e) {}
  return false;
}
function currentAnalyticsMode(){ return dailyRun ? 'daily' : practiceLevel ? 'practice' : 'normal'; }
function analyticsScoreBand(value){
  return value < 50000 ? 'under_50k'
    : value < 100000 ? '50k_100k'
    : value < 500000 ? '100k_500k'
    : value < 1000000 ? '500k_1m' : 'over_1m';
}
function analyticsDurationBand(seconds){
  return seconds < 60 ? 'under_1m' : seconds < 180 ? '1m_3m'
    : seconds < 600 ? '3m_10m' : 'over_10m';
}
const CloudLeaderboard = (()=>{
  const REQUEST_TIMEOUT_MS = 8000;
  const submissions = new Map();
  function config(){
    try {
      const root = window.NEON_MAZE_CONFIG;
      const value = root && root.supabase;
      if (!value || typeof value.url !== 'string') return null;
      const url = value.url.trim().replace(/\/+$/,'');
      const publishableKey = typeof value.publishableKey === 'string' ? value.publishableKey.trim() : '';
      const legacyKey = typeof value.anonKey === 'string' ? value.anonKey.trim() : '';
      const apiKey = publishableKey || legacyKey;
      const isPublishable = /^sb_publishable_[A-Za-z0-9_-]+$/.test(apiKey);
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
          || apiKey.startsWith('sb_secret_')
          || (publishableKey && !isPublishable)
          || (isPublishable ? apiKey.length < 30 : apiKey.length < 40)) return null;
      return {url,apiKey,isPublishable};
    } catch (e) { return null; }
  }
  function enabled(){ return !!config() && typeof fetch === 'function'; }
  async function request(path, options={}){
    const cfg = config();
    if (!cfg || typeof fetch !== 'function') return {status:'disabled'};
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer;
    try {
      const responseTask = (async()=>{
      const response = await fetch(cfg.url + path, {
        ...options,
        ...(controller ? {signal:controller.signal} : {}),
        headers: {
          apikey: cfg.apiKey,
          // Publishable keys identify the app; they are not user JWTs.
          ...(cfg.isPublishable ? {} : {Authorization:'Bearer ' + cfg.apiKey}),
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (!response.ok) return {status:'error',code:response.status};
      if (response.status === 204) return {status:'ok',data:null};
      return {status:'ok',data:await response.json()};
      })();
      // Bound both connection and body reads, including older WebViews that
      // ignore abort. Network errors must not leave the board loading forever.
      const timeout = new Promise(resolve=>{
        timer = setTimeout(()=>{
          if (controller) controller.abort();
          resolve({status:'offline'});
        }, REQUEST_TIMEOUT_MS);
      });
      return await Promise.race([responseTask, timeout]);
    } catch (e) { return {status:'offline'}; }
    finally { clearTimeout(timer); }
  }
  async function submit(entry){
    if (!enabled()) return {status:'disabled'};
    const options = {
      method:'POST',
      body:JSON.stringify({
        p_player_id: entry.playerId,
        p_run_id: entry.runId,
        p_player_name: cleanName(entry.name) || DEFAULT_NAME,
        p_score: saveInteger(entry.score,0,1e12,0),
        p_level: saveInteger(entry.level,1,MAX_LEVEL,1),
        p_max_combo: saveInteger(entry.maxCombo,1,1e6,1),
        p_won: entry.won === true,
        p_duration_ms: saveInteger(entry.durationMs,1000,86400000,1000),
        p_deaths: saveInteger(entry.deaths,0,100000,0),
        p_ghosts_eaten: saveInteger(entry.ghostsEaten,0,1000000,0),
        p_sweeps: saveInteger(entry.sweeps,0,100000,0),
        p_client_version: CLIENT_VERSION,
      }),
    };
    // A rename for a run must follow its initial score submission. Capture the
    // payload now, before the caller changes the in-memory name again.
    const previous = submissions.get(entry.runId) || Promise.resolve();
    const pending = previous.catch(()=>{}).then(()=>request('/rest/v1/rpc/submit_score', options));
    submissions.set(entry.runId, pending);
    try { return await pending; }
    finally { if (submissions.get(entry.runId) === pending) submissions.delete(entry.runId); }
  }
  async function top(limit=20){
    const n = saveInteger(limit,1,50,20);
    const result = await request('/rest/v1/leaderboard_public?select=player_name,score,level,max_combo,won,played_at&order=score.desc,played_at.asc&limit='+n);
    if (result.status !== 'ok') return result;
    if (!Array.isArray(result.data)) return {status:'error'};
    const rows = result.data.map(row=>{
      if (!saveObject(row)) return null;
      const score = saveInteger(row.score,0,1e12,-1);
      if (score < 0) return null;
      return {
        name:cleanName(row.player_name) || DEFAULT_NAME,
        score,
        level:saveInteger(row.level,1,MAX_LEVEL,1),
        combo:saveInteger(row.max_combo,1,1e6,1),
        won:row.won === true,
      };
    }).filter(Boolean);
    return {status:'ok',data:rows};
  }
  async function hall({scope='current',offset=0,limit=25,near=false}={}, playerId=null){
    const result = await request('/rest/v1/rpc/leaderboard_hall', {
      method:'POST', body:JSON.stringify({p_player_id:playerId,
        p_scope:scope === 'history' ? 'history' : 'current',
        p_offset:saveInteger(offset,0,1000000,0), p_limit:saveInteger(limit,1,50,25), p_near:near === true}),
    });
    if (result.status === 'error' && [400,404].includes(result.code)) return {status:'unavailable'};
    if (result.status !== 'ok') return result;
    const d=result.data;
    if (!d || !Array.isArray(d.rows) || !Array.isArray(d.podium)
        || d.scope !== (scope === 'history' ? 'history' : 'current')
        || typeof d.rule_version !== 'string' || typeof d.has_more !== 'boolean'
        || typeof d.revision !== 'string' || !/^[a-f0-9]{32}$/.test(d.revision)
        || !Number.isSafeInteger(d.offset) || d.offset < 0
        || !Number.isSafeInteger(d.total) || d.total < 0 || !Number.isFinite(Date.parse(d.updated_at))) return {status:'error'};
    const valid = r => r && typeof r.name === 'string' && r.name.length <= 128
      && Number.isSafeInteger(r.score) && r.score > 0 && r.score <= 1e12
      && Number.isSafeInteger(r.rank) && r.rank > 0 && Number.isSafeInteger(r.position) && r.position > 0
      && r.rank <= r.position && r.position <= d.total
      && Number.isInteger(r.level) && r.level >= 1 && r.level <= 6
      && Number.isInteger(r.combo) && r.combo >= 1 && typeof r.is_me === 'boolean'
      && typeof r.won === 'boolean' && Number.isFinite(Date.parse(r.played_at));
    if (!d.rows.every(valid) || !d.podium.every(valid) || (d.mine !== null && !valid(d.mine))
        || (d.next !== null && !valid(d.next))) return {status:'error'};
    if (d.podium.length !== Math.min(3,d.total) || !d.podium.every((r,i)=>r.position===i+1)
        || !d.rows.every((r,i)=>r.position===d.offset+i+1)) return {status:'error'};
    if ((d.mine && !d.mine.is_me) || (d.next && (!d.mine || d.next.score <= d.mine.score))
        || (d.next ? d.next_gap !== d.next.score-d.mine.score+1 : d.next_gap !== null)) return {status:'error'};
    return result;
  }
  return {enabled,submit,top,hall};
})();

function submitCloudScore(entry){
  if (!CloudLeaderboard.enabled()) return;
  if (window.NeonCompetition){ window.NeonCompetition.offer(entry); return; }
  // Fail closed if the web confirmation UI did not load: local saves still work.
}

/**
 * Files the run and returns { rank, id }. rank is the 1-based placing, or 0 if
 * the run missed the board. The id is what lets the end screen rename the row
 * afterwards — the player types their name once the score is already on screen,
 * so the row has to exist before the name does.
 */
function recordScore(entry){
  const list = loadScores();
  const row = {
    id: 'r'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
    name: cleanName(entry.name) || DEFAULT_NAME,
    score: entry.score, level: entry.level, combo: entry.combo, won: !!entry.won,
    date: new Date().toISOString().slice(0, 10),
  };
  list.push(row);
  list.sort((a,b) => b.score - a.score);
  const rank = list.indexOf(row) + 1;
  const kept = list.slice(0, BOARD_SIZE);
  saveScores(kept);
  return { rank: rank <= BOARD_SIZE ? rank : 0, id: row.id };
}

/** Renames an already-filed row. Returns false if it has since fallen off. */
function renameScore(id, name){
  const list = loadScores();
  const row = list.find(r => r.id === id);
  if (!row) return false;
  row.name = cleanName(name) || DEFAULT_NAME;
  return saveScores(list);
}

/**
 * 个人最高分。新版统一存档保存历史峰值，旧排行榜继续作为迁移来源。
 *
 * 旧版一直从榜单第一名派生；首次读取时会把榜单峰值写进统一存档。之后即使
 * 排行榜旧键损坏或迁移，已经确认过的历史最高分也不会随之消失。
 *
 * 返回 0 表示还没有任何记录（第一次玩），调用方据此决定要不要显示。
 */
function bestScore(){
  if (bestScoreCache !== null) return Math.max(bestScoreCache, localSave.highScore);
  const list = loadScores();
  const boardBest = list.length ? (list[0].score || 0) : 0;
  bestScoreCache = Math.max(localSave.highScore, boardBest);
  if (bestScoreCache > localSave.highScore){
    localSave.highScore = bestScoreCache;
    saveLocalState();
  }
  return bestScoreCache;
}

/**
 * 历史最高连击。同样从榜单派生——每条记录里本来就存着那一局的 combo。
 * **只加这一个**，不做最佳时间、最佳击杀、每关纪录：并列的纪录多了会互相稀释，
 * 小孩不需要一张 Excel。分数管"打得多好"，连击管"打得多顺"，两个够了。
 */
function bestCombo(){
  if (bestComboCache !== null) return bestComboCache;
  bestComboCache = loadScores().reduce((m, r)=> Math.max(m, r.combo || 0), 0);
  return bestComboCache;
}

/** 开始页的关卡选择。只在解锁了第二关之后才出现——第一次玩的人屏幕上
 *  只该有一个「开始」，多一行按钮就是多一个要理解的东西。 */
function renderLevelSelect(){
  const el = document.getElementById('levelSel');
  if (!el) return;
  const top = maxLevelReached();
  if (top < 2){ el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  /* 「练习」两个字后面挂着总星数，收集册就不必单开一页了。
     总数放在最左边而不是最右边：孩子的视线是从这一行的开头进来的，
     "我攒了几颗"应该是他看到的第一个数，而不是扫完六个按钮之后的补充说明。 */
  const tot = totalStars(), max = MAX_LEVEL * 3;
  let html = `<span class="levelsel-k">练习 <b style="color:var(--amber)">★${tot}</b>/${max}</span>`;
  for (let i = 1; i <= MAX_LEVEL; i++){
    const locked = i > top;
    const st = starsOf(i);
    /* 锁着的关也画三颗空星。空着的格子是这套东西的全部动力来源 ——
       看不见要填什么，就没有要填的冲动。 */
    const stars = `<span class="lv-st"><b>${'★'.repeat(st)}</b>${'★'.repeat(3 - st)}</span>`;
    const tip = `练习第 ${i} 关 · ${levelName(i)}　★ ${STAR_GOALS.join(' / ')}`;
    html += `<button class="lv" data-lv="${i}"${locked ? ' disabled aria-label="未解锁"' : ` title="${tip}"`}>`
          + `<span class="lv-n">${locked ? '🔒' : i}</span>` + stars + '</button>';
  }
  /* 图鉴入口挂在这一行末尾。跟选关同一个门槛（打到第二关才出现）：
     第一次玩的人屏幕上不该多出一个还看不懂的东西。
     用 document.getElementById 而不是 el.querySelector：小游戏那份 DOM 垫片
     的元素桩上没有 querySelector，只有 document 上有。这行是开始页初始化链的
     一环 —— 在垫片下抛异常的话，它后面的键盘、暂停、手势全都不会接线，
     而且一声不吭。 */
  html += '<button class="lv lv-codex enemy-choice chaser" id="owlBtn" type="button" title="对手图鉴" aria-label="对手图鉴" aria-haspopup="dialog" aria-controls="owlOverlay" aria-expanded="false"><span class="enemy-thumb" aria-hidden="true"></span></button>';
  el.innerHTML = html;
  const ob = document.getElementById('owlBtn');
  if (ob){
    ob.addEventListener('click', ()=>{ Audio2.unlock(); openOwl(); });
    // Enter/空格保留给原生按钮，不能同时触发开始游戏快捷键。
    ob.addEventListener('keydown', e=>{ if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
  }
  el.querySelectorAll('.lv[data-lv]').forEach(b=>{
    b.addEventListener('click', ()=>{
      Audio2.unlock();
      document.getElementById('startOverlay').classList.add('hidden');
      startPractice(Number(b.dataset.lv));
    });
  });
}

/**
 * 开始页那句迎接的话。
 *
 * 第一次来和再回来说的不是同一句：这游戏是给一个小孩和他的朋友们做的，
 * 他们会一次次回来 —— 那就该认得出他们。判据用"有没有本机纪录"，因为它
 * 恰好等于"以前玩过没有"，不需要另存一个标记。
 */
function renderWelcome(){
  const el = document.getElementById('welcomeLine');
  if (!el) return;
  let played = false;
  try { played = loadScores().length > 0; } catch (e) {}
  el.textContent = played ? '欢迎回来，豆豆等你再闯一次。' : '豆豆已就位，准备进入霓虹迷宫！';

  /* 老玩家不再显示"滑动转向 · 吃光豆子即可过关"。
     他早就会走了，而这一行占掉的高度，正是那句故事需要的 —— 有纪录的人屏幕上
     多出最高分和榜单两块，实测整屏溢出 67px，而故事那句正好被挤到看不见的
     地方。它是这一屏最该被看到的一句，不能为一句他已经知道的操作说明让位。
     想查规则的人旁边就有「玩法说明」。 */
  const tip = document.querySelector ? document.querySelector('.start-tip') : null;
  if (tip && tip.classList) tip.classList.toggle('hidden', played);
}

/** 开始页顶部那行最高纪录。没有记录时整行不出现，免得挂一个 0 在那儿。 */
function renderBest(){
  const el = document.getElementById('bestLine');
  if (!el) return;
  const b = bestScore();
  if (!b){ el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  /* 各段之间那些空格是**故意留的**：微信两个版本读的是 stripTags 之后的
     纯文本，没有空格就会连成 "BEST128,650"。网页版这边是 flex + gap 布局，
     多几个空白文本节点没有任何影响。 */
  const c = bestCombo();
  /* 「你的最高纪录」而不是 BEST：中文、而且带一个"你的" —— 这是他自己的成绩，
     不是一块公共排行榜上的数字。街机感由「投币」和字体扛着，够了。 */
  el.innerHTML = `<span class="best-k">你的最高纪录</span> <span class="best-v">${fmtNum(b)}</span>`
    + (c > 1 ? ` <span class="best-combo">最高连击 x${c}</span>` : '');
}

/* 榜单是不是展开着。放在模块级而不是 DOM 上：开始页和结算页共用这一个
   渲染函数，两处该保持一致的展开状态。刷新归位到收起。 */
let boardExpanded = false;
/* 刚刚打出来的那条纪录的 id，用来给它挂一个「新」徽章。
   只存在内存里 —— 刷新页面、开下一局都自动失效，旧纪录不会一直挂着"新"。 */
let justAddedId = null;
/* 哪些榜单容器已经挂过展开监听。记在这里而不是元素上：微信垫片的假元素
   没有 dataset，往它上面记会直接抛。 */
const boardWired = {};
const boardMode = {};

function wireBoard(elId, highlightId){
  const el = document.getElementById(elId);
  if (!el || typeof el.addEventListener !== 'function' || boardWired[elId]) return;
  boardWired[elId] = true;
  el.addEventListener('click', (e)=>{
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    if (t.closest('.board-cloud')){
      boardMode[elId] = 'cloud';
      renderCloudScoreboard(elId, highlightId);
      return;
    }
    if (t.closest('.board-local')){
      boardMode[elId] = 'local';
      renderScoreboard(elId, highlightId);
      return;
    }
    if (t.closest('.board-more')){
      boardExpanded = !boardExpanded;
      renderScoreboard(elId, highlightId);
    }
  });
}

async function renderCloudScoreboard(elId, highlightId){
  const el = document.getElementById(elId);
  if (!el || !CloudLeaderboard.enabled()) return renderScoreboard(elId, highlightId);
  boardMode[elId] = 'cloud';
  Analytics.track('leaderboard_view',{mode:'cloud'});
  el.classList.remove('hidden');
  el.innerHTML = '<div class="board-head"><div class="board-title">全球榜</div>'
    + '<button class="board-switch board-local">本机纪录</button></div>'
    + '<div class="board-status">正在读取…</div>';
  wireBoard(elId, highlightId);
  const result = await CloudLeaderboard.top(20);
  if (boardMode[elId] !== 'cloud') return;
  if (result.status !== 'ok'){
    el.innerHTML = '<div class="board-head"><div class="board-title">全球榜</div>'
      + '<button class="board-switch board-local">本机纪录</button></div>'
      + '<div class="board-status">暂时无法连接，成绩仍已保存在本机</div>';
    return;
  }
  const rows = result.data || [];
  const html = rows.map((r,i)=>
    `<div class="board-row${i===0?' board-top':''}">`
      + `<span class="board-rank">${i+1}</span>`
      + `<span class="board-name">${r.name}</span>`
      + `<span class="board-score">${fmtNum(r.score)}</span>`
      + `<span class="board-meta">${r.won ? '通关' : '第'+r.level+'关'} · x${r.combo}</span>`
      + '</div>').join('');
  el.innerHTML = '<div class="board-head"><div class="board-title">全球榜</div>'
    + '<button class="board-switch board-local">本机纪录</button></div>'
    + (rows.length ? '<div class="board-list">'+html+'</div>'
                   : '<div class="board-status">还没有云端成绩</div>')
    + '<div class="board-note board-cloud-note">昵称与成绩公开 · 每个玩家 ID 只显示最高分</div>';
}

function renderScoreboard(elId, highlightId){
  // Keep the pre-game notice visible even when the board is empty or offline.
  for (const id of ['cloudNotice','cloudAbout']){
    const notice = document.getElementById(id);
    if (notice) notice.classList.toggle('hidden', !CloudLeaderboard.enabled());
  }
  const el = document.getElementById(elId);
  if (!el) return;
  if (boardMode[elId] === 'cloud' && CloudLeaderboard.enabled()){
    renderCloudScoreboard(elId, highlightId);
    return;
  }
  boardMode[elId] = 'local';
  const list = loadScores();
  /* 一条纪录都没有时**整块藏起来**，不留占位。
     原来显示一句"还没有记录，来跑一局"——它既没帮玩家开始，又在首屏多堆了
     一层弱信息。第一次打开的人屏幕上该只有：投币 / 一句操作 / 开始游戏 /
     玩法说明 / 署名。 */
  if (!list.length){
    if (!CloudLeaderboard.enabled()){ el.innerHTML = ''; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = '<div class="board-head"><div class="board-title">本机纪录</div>'
      + '<button class="board-switch board-cloud">全球榜</button></div>'
      + '<div class="board-status">完成一局后会保存在这里</div>';
    wireBoard(elId, highlightId);
    return;
  }
  el.classList.remove('hidden');
  /* 默认只露前三名。
     六行纪录摆在开始页上，这一屏就变成了一块排行榜 —— 而这游戏最该被先看到的
     不是"你排第几"。前三是够用的参照（最好成绩 + 上下文），剩下的想看再展开。
     只有超过三条时才出现展开按钮：只有四条却摆个"查看全部"是徒增一次点击。 */
  const TOP_N = 3;
  const more = list.length > TOP_N;
  const shown = boardExpanded ? list : list.slice(0, TOP_N);

  const row = (r, i) =>
    `<div class="board-row${i===0?' board-top':''}${r.id===highlightId?' board-mine':''}">` +
      `<span class="board-rank">${i+1}</span>` +
      `<span class="board-name">${r.name || DEFAULT_NAME}</span>` +
      /* 「新」是**独立的徽章**，不是拼在名字后面的字。
         拼上去的话读出来就是"超级奶爸新"，看着像名字的一部分或者程序出错。
         只标刚刚打出来的那一条：justAddedId 存在内存里，刷新或开下一局就没了，
         所以旧纪录永远不会挂着"新"。 */
      (r.id === justAddedId ? '<span class="board-new">新</span>' : '') +
      `<span class="board-score">${fmtNum(r.score)}</span>` +
      `<span class="board-meta">${r.won ? '通关' : '第'+r.level+'关'} · x${r.combo}</span>` +
    '</div>';

  el.innerHTML =
    /* 叫「本机纪录」不叫「排行榜」：数据只在 localStorage 里，
       换台电脑、清个缓存就没了。叫排行榜会让玩家以为是全网共用的在线榜单，
       进而以为自己在和别人比 —— 那是个不存在的承诺。 */
    '<div class="board-head"><div class="board-title">本机纪录</div>'
      + (CloudLeaderboard.enabled() ? '<button class="board-switch board-cloud">全球榜</button>' : '')
      + '</div>' +
    /* 只有**行**这一段滚，标题和「查看全部纪录」固定在外面。
       原来整块一起滚：屏幕一矮，榜单被压到 70px，那个展开按钮就跟着滚到看不见的
       地方 —— 一个看不见的展开入口等于没有。 */
    '<div class="board-list">' + shown.map(row).join('') + '</div>' +
    (more ? `<button class="board-more" data-board="${elId}">`
          + (boardExpanded ? '收起纪录' : `查看全部纪录（${list.length}）`)
          + '</button>' : '') +
    /* 「纪录只保存在当前浏览器」只在摊开时说。
       收起时上面就写着「本机纪录」，已经说明了同一件事；而开始页的每一行都在
       跟那句故事抢高度 —— 同一个意思占两行，让位的该是重复的那一行。 */
    (boardExpanded || !more ? '<div class="board-note">'
      + (CloudLeaderboard.enabled() ? '此处为本机纪录；全球榜需联网查看' : '纪录只保存在当前浏览器')
      + '</div>' : '');

  /* 展开/收起。用事件委托挂在容器上，因为这段 innerHTML 每次都整体重建，
     直接给按钮挂监听会在下一次渲染时连按钮一起丢掉。
     "挂过没有"记在模块级的 boardWired 里，**不能记在 el.dataset 上** ——
     微信垫片造的假元素有 addEventListener 却没有 dataset，一读就抛，
     而这一行在 endGame 里，抛出来的表现就是"死一条命之后直接黑屏"。
     整个测试套件当场红了十条，这个坑之前踩过一模一样的一次。 */
  wireBoard(elId, highlightId);

  /* 榜单最多只露五行左右（再高就把按钮挤出屏幕了），可名次是第几名不由我们说了算。
     结算页写着"本次排名第 5 名"，而那一行正好在可视区外边——最该看到的一行看不见，
     这是整个结算页最要紧的一眼。所以渲染完把自己那行滚到中间。
     不用 scrollIntoView()：它会顺带滚祖先和整个页面，而这个页面是锁死不滚的。

     只在真浏览器里做：微信那两个版本的 el 是垫片造的假节点，没有 querySelector
     也没有 getBoundingClientRect，它们的榜单是各自用 canvas / WXML 画的。
     这里少一个判断，endGame 就会抛异常——而 endGame 抛异常的表现，正是玩家
     那次报的"死一条命后直接黑屏"。 */
  if (typeof el.querySelector !== 'function') return;
  const rowsBox = el.querySelector('.board-list');
  const mine = el.querySelector('.board-mine');
  if (rowsBox && mine && typeof mine.getBoundingClientRect === 'function'){
    const r = mine.getBoundingClientRect(), c = rowsBox.getBoundingClientRect();
    rowsBox.scrollTop += (r.top - c.top) - (c.height - r.height) / 2;
  }
}

function endGame(won){
  resetJoystick();
  gameState='over';

  if (won){
    // The per-level "no damage" bonus is deliberately NOT awarded here: the
    // level-clear path already grants it before calling endGame, and doing it
    // again paid the final level twice.
    if (lives > 0) awardBonus(`剩余生命 ×${lives}`, BONUS.LIFE_LEFT * lives);
    if (deathsThisRun === 0) awardBonus('全程无伤通关', BONUS.FLAWLESS_RUN);
  }

  /* 练习整局不计分：不入榜、不动最高分、不评级、不放礼花。
     这条边界必须硬 —— 一旦练习的成绩能进榜，排行榜就没意义了
     （谁都可以反复练第一关刷分），而排行榜正是"正式挑战"的全部价值。 */
  const practice = !!practiceLevel;
  Analytics.track('game_end',{
    mode:currentAnalyticsMode(), level, won:won === true,
    score_band:analyticsScoreBand(score), duration_band:analyticsDurationBand(runActiveSeconds),
  });

  /* 旧纪录必须在把本局写进榜单**之前**读，否则读到的就是本局自己，
     "破纪录了没有"永远是 false，"差多少分"永远是 0。 */
  const prevBest = practice ? 0 : bestScore();
  const isNewBest = !practice && score > prevBest;

  // The row is filed FIRST, under the remembered name, so the board is already
  // correct if the player never touches the input. Typing a name renames that
  // same row in place rather than filing a second one.
  /* 每日挑战的成绩存在自己那儿，不进排行榜（理由见 dailyLevel 上面那段）。
     它走的是练习模式，本来也进不去 —— 这里只是把今天这一笔记下来。 */
  const dailyBeat = dailyRun && recordDaily(score);

  const remembered = loadName();
  const { rank, id } = practice ? { rank: 0, id: null }
    : recordScore({ score, level, combo: maxComboSeen, won, name: remembered });
  if (!practice && !dailyRun) recordRecentScore({runId:currentRunId,
    score, level, maxCombo:maxComboSeen, won:!!won, playedAt:Date.now()});
  lastRunId = id;
  justAddedId = id;      // 给它挂一个「新」徽章，开下一局就取消
  if (!practice){
    lastCloudEntry = {
      playerId:getPlayerId(), runId:currentRunId,
      name:remembered, score, level, maxCombo:maxComboSeen, won,
      durationMs:Math.max(1000,Math.round(runActiveSeconds*1000)),
      deaths:deathsThisRun, ghostsEaten:ghostsEatenThisRun, sweeps:sweepsThisRun,
    };
    submitCloudScore(lastCloudEntry);
  }

  if (won) Audio2.victory(); else if (isNewBest) Audio2.newBest(); else Audio2.gameOver();
  const practiceCleared = practice && pelletsLeft <= 0;
  document.getElementById('overTitle').textContent =
      dailyRun        ? ('每日挑战' + (practiceCleared ? '完成' : '结束') + ' · 第 ' + level + ' 关')
    : practiceCleared ? ('练习完成 · 第 ' + level + ' 关')
    : practice        ? ('练习结束 · 第 ' + level + ' 关')
    : won             ? ('通关！全 ' + MAX_LEVEL + ' 关')
    :                   '游戏结束';
  lastFinalScore = score;
  document.getElementById('finalScore').textContent = fmtNum(score);
  document.getElementById('overSub').innerHTML =
    dailyRun ? '每日挑战仅记录本机当日同关最高分，不计入正式排行榜。'
    : practice ? buildPracticeSummary(practiceCleared) : buildSummary(won, rank, prevBest, isNewBest);
  const overOverlay = document.getElementById('overOverlay');
  overOverlay.classList.remove('hidden');
  // 结算层上次滑到了底部时，浏览器会记住 scrollTop。新一局必须回到
  // 顶部，否则就算保存区已经提前，玩家打开时仍可能直接看到底部。
  overOverlay.scrollTop = 0;
  notifyAdOpportunity('post_game');
  // 破纪录也放礼花：这是除了通关之外，唯一值得停下来庆祝一下的时刻
  if (isNewBest && !won && prevBest > 0) startFireworks(6000);

  /* 星星和今日成绩都变了，开始页那两处得跟着重画。
     这里不重画的话，玩家要刷新页面才看得到刚拿到的星星 —— 而拿到的那一刻
     正是他最想看见它的时候。 */
  renderLevelSelect();
  renderDaily();
  if (dailyBeat) setTimeout(()=>toast('今日挑战新纪录！'), 700);

  const recordBox = document.getElementById('recordBox');
  const recordRank = document.getElementById('recordRank');
  const nameRow = document.getElementById('nameRow');
  nameRow.innerHTML = NAME_ROW_HTML;
  bindNameRow();
  recordBox.classList.toggle('hidden', rank === 0);
  nameRow.classList.toggle('hidden', rank === 0);
  recordRank.textContent = rank > 0 ? `· 本机第 ${rank} 名` : '';
  if (rank > 0){
    const input = document.getElementById('nameInput');
    input.value = remembered;
    // Autofocus is skipped on a win: the fireworks are the moment, and popping
    // a mobile keyboard over them buries the celebration.
    if (!won) setTimeout(()=>input.focus(), 60);
  }

  /* 「练习这一关」只在**正式挑战里失败**时出现：
     - 通关了不该出现（该去看评级、再挑战一次刷分）
     - 本来就在练习里也不出现（重开就是同一关，「再来一局」已经够了）
     - 第一关失败也不出现（重开就是第一关，练习没有任何区别） */
  const pb = document.getElementById('practiceBtn');
  if (pb){
    const offer = !practice && !won && level > 1;
    pb.classList.toggle('hidden', !offer);
    pb.textContent = offer ? `练习第 ${level} 关` : '练习这一关';
    /* 关卡号存在变量里，不写 dataset —— 微信两个版本的元素是垫片造的假节点，
       上面**没有 dataset**，赋值会直接抛异常。而这行在 endGame 里，一抛就是
       "死一条命后黑屏"那种表现。同样的坑之前踩过一次（roundRect）。 */
    practiceOfferLevel = level;
  }
  const ob = document.getElementById('overBoard');
  if (ob) ob.classList.toggle('hidden', practice);   // 练习跟排行榜无关，不摆出来
  if (!practice) renderScoreboard('overBoard', rank > 0 ? id : null);
  if (window.NeonCompetition) window.NeonCompetition.resultMode(practice);
  if (won) startFireworks();
}

let lastRunId = null;
const NAME_ROW_HTML =
  '<input id="nameInput" class="name-input" type="text" maxlength="8" ' +
  'placeholder="输入名字（可选）" autocomplete="off" spellcheck="false">' +
  '<button class="btn btn-sm" id="nameSaveBtn">保存名字</button>';

function commitName(){
  const input = document.getElementById('nameInput');
  if (!input) return;
  const name = cleanName(input.value);
  if (!name) { input.focus(); return; }
  saveName(name);
  renameScore(lastRunId, name);
  if (lastCloudEntry){
    lastCloudEntry.name = name;
    if (window.NeonCompetition) window.NeonCompetition.rename(name);
  }
  renderScoreboard('overBoard', lastRunId);
  document.getElementById('nameRow').innerHTML =
    `<div class="name-done">已记录为 ${name}</div>`;
}

function bindNameRow(){
  const btn = document.getElementById('nameSaveBtn');
  const input = document.getElementById('nameInput');
  if (btn) btn.addEventListener('click', commitName);
  if (input) input.addEventListener('keydown', e => {
    // The game reads arrow keys and WASD globally; while the player is typing
    // their name those are just letters, so the field swallows everything.
    e.stopPropagation();
    if (e.key === 'Enter') commitName();
  });
}

/** Score breakdown + placing, so the number on screen is explainable. */
/**
 * 通关评级 S / A / B / C。
 *
 * 为什么要有：六关打完只给一个分数，玩家不知道这算好还是不好——十万分是高
 * 是低，第一次通关的人心里没有尺子。一个字母就是尺子。而且它天然制造二周目：
 * 拿到 B 的小孩下一句一定是"怎么才能拿 S"。
 *
 * 评的是**打法**不是分数。分数已经由排行榜和 BEST 负责了，再按分数评一次
 * 等于同一件事说两遍；而且分数受运气影响很大（水果刷不刷得出来）。这里四项
 * 都是玩家自己控制得了的：少死、敢吃幽灵、连得住、全灭过几次。
 *
 * 门槛按"一个认真打完六关的人大概能做到什么"来定，不是拍脑袋：
 * 满分 100，S 要 85 分以上——必须几乎不死 + 主动追幽灵，光苟着通关是拿不到的。
 */
function gradeRun(){
  let pts = 0;
  // 少死（40 分）：全程无伤满分，每死一次扣 8 分
  pts += Math.max(0, 40 - deathsThisRun * 8);
  // 敢打（25 分）：吃满 18 只幽灵给满分，约等于每关吃三只
  pts += Math.min(25, ghostsEatenThisRun / 18 * 25);
  // 连得住（20 分）：最高连击 30 给满分
  pts += Math.min(20, maxComboSeen / 30 * 20);
  // 全灭（15 分）：三次给满分
  pts += Math.min(15, sweepsThisRun / 3 * 15);
  /* 分档：S 85 / A 65 / B 45。
     A 线原本定在 68，实测"死一次 + 吃 12 只 + 连击 20 + 全灭 1 次"算出来 67，
     差一分掉到 B —— 那是一局打得挺好的游戏，卡在这种地方只会让人觉得系统
     在刁难。评级的边界宁可松半档，也不要让明显不错的一局吃亏。 */
  return pts >= 85 ? 'S' : pts >= 65 ? 'A' : pts >= 45 ? 'B' : 'C';
}

/**
 * 练习模式的结算。
 * 刻意做得比正式结算**朴素**：没有排名、没有评级、没有"差多少破纪录"。
 * 那些都是正式挑战的东西，在练习页上摆一份缩水版只会让人分不清两种模式。
 * 这里只回答一句话：这一关你过去了没有。
 */
function buildPracticeSummary(cleared){
  const lines = [];
  lines.push('<div class="sum-grid">'
    + `<div class="sum-row"><span class="sum-k">关卡</span> <span class="sum-v">第 ${level} 关 · ${levelName(level)}</span></div>`
    + `<div class="sum-row"><span class="sum-k">最高连击</span> <span class="sum-v">x${maxComboSeen}</span></div>`
    + `<div class="sum-row"><span class="sum-k">反击敌人</span> <span class="sum-v">${ghostsEatenThisRun} 只</span></div>`
    + '</div>');
  lines.push(cleared
    ? '<span style="color:var(--cyan)">这一关拿下了，回去正式挑战试试</span>'
    : '<span style="color:var(--amber)">再练一次，或者回去正式挑战</span>');
  lines.push('<span class="bonus-hint">练习不计分，也不进本机纪录</span>');
  return lines.join('<br>');
}

/* 同一种奖励可能在一局里触发很多次（例如「全灭对手」 22 次）。
   原来把 22 条原样铺开，直接把保存区挤到折叠线下面。按名称聚合后显示
   「全灭对手 ×22 +2,860,000」，总分不变、信息也不丢，但只占一行。 */
function summarizeBonuses(bonuses){
  const grouped = [];
  const byLabel = new Map();
  for (const bonus of bonuses){
    let item = byLabel.get(bonus.label);
    if (!item){
      item = { label:bonus.label, count:0, points:0 };
      byLabel.set(bonus.label, item);
      grouped.push(item);
    }
    item.count++;
    item.points += bonus.points;
  }
  return grouped.map(item =>
    `${item.label}${item.count > 1 ? ` ×${item.count}` : ''} +${fmtNum(item.points)}`
  ).join('　');
}

function buildSummary(won, rank, prevBest, isNewBest){
  const lines = [];

  /* 战绩排成「项目 · 数值」两列，而不是挤成一行句子。
     玩家在结算页真正想知道的是"我这局到底打得怎么样"，一行流水账要逐字读；
     排成表格能一眼扫完，也让"幽灵击杀"这种新数字有地方放。 */
  // 通关才评级：半路死掉评个 C 只是补一刀，没有任何用处
  if (won){
    const gd = gradeRun();
    lines.push(`<div class="grade grade-${gd}"><span class="grade-k">评级</span>`
             + `<span class="grade-v">${gd}</span></div>`);
  }

  const stats = [
    ['到达关卡', won ? `全 ${MAX_LEVEL} 关通关` : `第 ${level} 关 · ${levelName(level)}`],
    ['最高连击', `x${maxComboSeen}`],
    ['反击敌人', `${ghostsEatenThisRun} 只`],
  ];
  if (won) stats.push(['无伤关卡', `${perfectLevelsThisRun} / ${MAX_LEVEL}`]);
  if (sweepsThisRun) stats.push(['全灭对手', `${sweepsThisRun} 次`]);
  if (prevBest > 0)  stats.push(['最高纪录', fmtNum(prevBest)]);
  /* 每一行**必须**自己包一个 div，不能把 span 直接摊在网格里。
     微信那两个版本读的是 stripTags 之后的纯文本，而 stripTags 只把 <br> 和
     </div> 换成换行，<span> 是直接删掉的 —— 摊着写出来就是
     "到达关卡第 3 关 · 虫洞交错最高连击x1吃掉小夜枭0 只" 这样一长串糊在一起。
     display:contents 让这层 div 在网页版布局上等于不存在，两列网格照常，
     但 HTML 里它是真实存在的，纯文本那边就有换行了。
     k 和 v 之间那个空格同理，不然纯文本里两者会贴死。 */
  lines.push('<div class="sum-grid">' +
    stats.map(([k,v])=>`<div class="sum-row"><span class="sum-k">${k}</span> <span class="sum-v">${v}</span></div>`).join('') +
    '</div>');

  if (runBonuses.length){
    const total = runBonuses.reduce((s,b)=>s+b.points, 0);
    const detail = summarizeBonuses(runBonuses);
    lines.push(`<span style="color:var(--amber)">奖励分 +${fmtNum(total)}</span><br>${detail}`);
  }
  /* 结算页最后必须留下一个**再来一局的理由**。
     "没能进前 8 名，再来一局"是句空话——它没告诉玩家差多少、也没给目标。
     换成跟自己纪录的距离：破了就大声说，没破就报差额。差额是个具体的、
     看得见够得着的数，比名次更能让人手指头再点一次「再来一局」。 */
  if (isNewBest && prevBest > 0){
    lines.push(`<span class="new-best">🎉 新纪录！比上次高 ${fmtNum(score - prevBest)} 分</span>`);
  } else if (isNewBest){
    lines.push(`<span class="new-best">🎉 第一条纪录，就是它了</span>`);
  } else if (score === prevBest){
    // 打平要单独说：写成"差 0 分打破自己的纪录"读着像出了 bug。
    // 挑战那边早先修过一模一样的问题，这是同一类。
    lines.push('<span style="color:var(--amber)">和自己的纪录打平，一分不差</span>');
  } else {
    lines.push(`<span style="color:var(--amber)">差 ${fmtNum(prevBest - score)} 分打破自己的纪录</span>`);
  }
  if (rank > 0) lines.push(`<span class="bonus-hint">本机纪录第 ${rank} 名，留下你的名字</span>`);

  /* 六关全通才出现的一句话。
   *
   * 只放在这里，别处一个字都不提，理由有三：
   *   - 通关是玩家唯一愿意停下来读字的时刻。半路死掉的人只想立刻再来一局，
   *     这时候跟他讲游戏的来由，是在挡路。
   *   - 它得是**挣来**的。谁都能看到的话就不值钱；打穿六关的人看到，才会觉得
   *     这句是说给自己听的。
   *   - 一句就够，不加感叹号。"一个爸爸和儿子一起做的小游戏"这几个字本身分量就够，
   *     再堆形容词只会把它变轻。
   */
  if (won){
    lines.push('<span class="warm">这游戏最早只是儿子的一个念头，谢谢你把它玩到最后。</span>');
  }

  /* 收到挑战时，结算页第一件事就是回答"我超了没" —— 这是对方发链接给你的
     全部意义，藏在一堆明细里就白发了。 */
  if (challenge){
    const diff = score - challenge.score;
    // 平局单独说一句：写成"超过 0 分"读着像出了 bug
    const line = diff > 0 ? `<span style="color:var(--cyan)">超过${challenge.name} ${fmtNum(diff)} 分，赢了！</span>`
               : diff === 0 ? `<span style="color:var(--amber)">和${challenge.name}打平，一分不差</span>`
               : `<span style="color:var(--danger)">离${challenge.name}还差 ${fmtNum(-diff)} 分</span>`;
    lines.unshift(line);
  }
  return lines.join('<br>');
}

let maxComboSeen = 1;

/**
 * 连击条显示的是**还剩多久断**，不是连击等级。
 *
 * 原来画的是 combo/20：玩家看着它涨，却完全不知道那 1.15 秒的窗口何时耗尽，
 * 连击总是"突然断的"。连击是本作最大的分数来源（能连到 x100 以上），让它变得
 * 可预期，玩家才会主动去够下一颗豆，而不是事后才发现断了。
 *
 * 必须每帧调用 —— updateHud 只在得分时触发，而这根条是在没得分的时候才需要
 * 动。这也是它单独拆出来的唯一原因。
 */
function updateComboBar(){
  // 分母要用**当前**窗口：窗口会随连击变宽，拿固定值当分母的话，
  // 高连击时条永远填不满，看起来像刚吃就快断了。
  const left = combo > 1 ? Math.max(0, comboTimer) / comboWindow() : 0;
  /* 去抖：这函数每帧都跑，元素引用缓存一次；变化不到 1% 不写入。
     用 transform 而不是 width，避免每帧 layout invalidate；urgent 类
     也记住上次状态，变了才 toggle。 */
  if (!comboFillEl) comboFillEl = document.getElementById('comboFill');
  const scale = Math.round(left * 100) / 100;
  if (Math.abs(scale - comboBarLastScale) >= 0.01){
    comboFillEl.style.transform = 'scaleX(' + scale + ')';
    comboBarLastScale = scale;
  }
  const urgent = left > 0 && left < 0.35;   // 快断了变红
  if (urgent !== comboBarLastUrgent){
    comboFillEl.classList.toggle('urgent', urgent);
    comboBarLastUrgent = urgent;
  }
}
let comboFillEl = null, comboBarLastScale = -1, comboBarLastUrgent = null;

/* 幽灵悬赏把分数推到了六七位数，"1283000" 这种一长串瞟一眼是读不出来的。
   自己加千分位，不用 toLocaleString('en-US')：那个要靠 Intl，微信小游戏在
   iOS 上跑的是 JavaScriptCore，精简构建里 Intl 可能没有、或者直接忽略 locale
   参数。手写的话四个端（网页 / 小游戏 / 小程序 / iOS）出来的字符一模一样。
   注意：小程序的榜单读的是存档原始数字，那边 pages/game/game.js 里另有一份
   同规则的 fmtNum，改这里记得一并改。 */
function fmtNum(n){
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '-' : '';
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+$)/g, ',');
}

let lastComboShown = 1;   // 只在连击真的变了时才弹，见下面
let comboBumpFlip = false;
let hudScoreEl=null,hudLevelEl=null,hudLivesEl=null,hudHighEl=null,hudComboEl=null;
let hudLastScore='',hudLastLevel='',hudLastLives=null,hudLastHigh='';
function updateHud(){
  if (!hudScoreEl){
    hudScoreEl=document.getElementById('scoreVal');hudLevelEl=document.getElementById('levelVal');
    hudLivesEl=document.getElementById('livesVal');hudHighEl=document.getElementById('highScoreVal');
    hudComboEl=document.getElementById('comboLabel');
  }
  const scoreText=fmtNum(score),levelText=level+'/'+MAX_LEVEL;
  if (scoreText!==hudLastScore){hudScoreEl.textContent=scoreText;hudLastScore=scoreText;}
  if (levelText!==hudLastLevel){hudLevelEl.textContent=levelText;hudLastLevel=levelText;}
  if (lives!==hudLastLives){
    hudLivesEl.innerHTML=Array.from({length:Math.max(lives,0)}).map(()=>
      '<svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17.2 3.1 10.8C-.4 7.5 1.9 2.2 6.3 2.2c1.6 0 3 .8 3.7 2 0.7-1.2 2.1-2 3.7-2 4.4 0 6.7 5.3 3.2 8.6L10 17.2Z" fill="'+cssVar('--pink')+'"/></svg>'
    ).join('');
    hudLastLives=lives;
  }
  const highText=fmtNum(Math.max(score,bestScore()));
  if (hudHighEl&&highText!==hudLastHigh){hudHighEl.textContent=highText;hudLastHigh=highText;}
  const cl=hudComboEl;
  if (combo!==lastComboShown) cl.textContent='连击 x'+combo;
  /* 连击的画面反馈**只在 HUD 上**：玩家这时候正贴着幽灵跑，在迷宫上糊特效
     等于害他送命。一行字变个色，看得见又挡不着。 */
  /* 两个同形动画交替，不再用 offsetWidth 强制同步回流。 */
  if (combo > 1 && combo !== lastComboShown){
    comboBumpFlip=!comboBumpFlip;
    cl.classList.remove('bump-a','bump-b');
    cl.classList.add(comboBumpFlip?'bump-a':'bump-b');
  }
  lastComboShown = combo;
  cl.style.color = combo >= 100 ? cssVar('--amber')
                 : combo >= 50  ? cssVar('--tang')
                 : combo >= 25  ? cssVar('--cyan')
                 : cssVar('--text-dim');
  // combo is uncapped, so the bar tracks progress toward x20 and pins full beyond
  updateComboBar();
  maxComboSeen = Math.max(maxComboSeen, combo);
}

/* ---------- fruit ---------- */
function updateFruit(dt){
  if (!fruit.active){
    fruit.nextAt -= dt;
    return;
  }
  fruit.timer -= dt;
  if (fruit.timer<=0){ fruit.active=false; return; }
  const fdx = fruit.x-player.x, fdy = fruit.y-player.y;
  if (fdx*fdx + fdy*fdy < 0.36){   // 0.6 格，平方比较不开根号
    fruit.active = false;
    addComboScore(300*combo);
    player.phase = FRUIT_PHASE_SECONDS;
    toast('相位晶石！' + FRUIT_PHASE_SECONDS + ' 秒穿墙');
    Audio2.fruit();
  }
}
function maybeSpawnFruit(){
  if (fruit.active) return;
  if (fruit.nextAt<=0){
    fruit.active = true; fruit.timer = 10; fruit.x=9; fruit.y=13;
    /* 9999 秒 ≈ 不会再到 —— 每关只刷一次是**设计意图**，不是随手填的大数：
       穿墙是最强道具，一关给第二次，"什么时候吃"这条决策就不值钱了。
       resetLevel 会把 nextAt 重置回 60，下一关重新计。 */
    fruit.nextAt = 9999;
  }
}

/* ---------- input ---------- */
const keyMap = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
  w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right' };

/** Stamps the press with the odometer so the turn buffer can age it out. */
function requestDir(dir){
  // An unknown name must be ignored, not stored. Assigning DIRS[dir] blindly
  // puts `undefined` into player.want, and the crash then surfaces several
  // frames later inside the movement resolver, pointing at code that is fine.
  // The keyboard can only ever produce the four valid names, but the WeChat
  // build feeds this from touch handling, where a typo is a plausible source.
  const d = DIRS[dir];
  if (!d) return;
  player.want = d;
  player.wantAtDist = player.distTravelled;
}

/* 只在**游戏真的掌握控制权**时才拦键盘。
 *
 * 原来是无条件拦方向键，于是玩法说明打开时——那是一份要上下滚的长文档——
 * 方向键被游戏吃掉，键盘用户滚不动它。空格同理。
 *
 * 反过来也不能一个都不拦：正常游玩时方向键若走浏览器默认行为，页面会跟着
 * 滚（现在 body 是 overflow:hidden 所以看不出来，但一旦哪天改了布局就会冒出来），
 * 而且长按空格在很多浏览器上有翻页语义。
 *
 * 判断标准就一条：说明开着、或者光标在输入框里，游戏就没有控制权。 */
function gameHasKeyboard(){
  if (docPanelOpen()) return false;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return false;
  return true;
}

/** 当前是哪一屏。Enter 的含义完全由它决定，不同位置各写一个监听必然打架。 */
function currentScreen(){
  if (!helpOverlay.classList.contains('hidden')) return 'help';
  if (!aboutOverlay.classList.contains('hidden')) return 'about';
  if (owlOverlay && !owlOverlay.classList.contains('hidden')) return 'codex';
  if (!document.getElementById('overOverlay').classList.contains('hidden')) return 'over';
  if (!document.getElementById('pauseOverlay').classList.contains('hidden')) return 'paused';
  if (!document.getElementById('startOverlay').classList.contains('hidden')) return 'start';
  return 'playing';
}

/* Enter 快捷键：开始 / 继续 / 再来一局，都走各自按钮的 click，
   这样恢复逻辑只有一份，不会出现"按 Enter 和点按钮走了两条路"。 */
function handleEnter(e){
  // 中文输入法正在组词时，Enter 是「上屏」，不是游戏指令
  if (e.isComposing || e.keyCode === 229) return false;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')){
    // 昵称框自己会处理 Enter（记录），这里绝不能顺手再重开一局
    return false;
  }
  const click = (id)=>{ const b=document.getElementById(id); if (b) b.click(); return true; };
  switch (currentScreen()){
    case 'start':  return click('startBtn');
    case 'paused': return click('resumeBtn');
    case 'over':   return click('restartBtn');
    // 说明页刻意不接 Enter：读到一半误按就关掉，比不支持更烦
    default: return false;
  }
}

window.addEventListener('keydown', (e)=>{
  if (window.NeonCompetition && window.NeonCompetition.isOpen()) return;
  Audio2.unlock();
  // Escape 任何时候都能关掉盖在上面的文档页 —— 这是玩家唯一的逃生键。
  // 两个都关：两者不会同时打开，各调一次比先判断谁开着更省事，也不会漏。
  if (e.key==='Escape'){ closeHelp(); closeAbout(); closeOwl(); return; }
  if (e.key==='Enter'){ if (handleEnter(e)) e.preventDefault(); return; }
  if (!gameHasKeyboard()) return;      // 说明在读、名字在输，都不归游戏管

  const dir = keyMap[e.key];
  if (dir){ requestDir(dir); e.preventDefault(); }
  else if (e.key===' ' || e.key==='Spacebar'){ e.preventDefault(); }  // 空格别翻页
  if (e.key==='p' || e.key==='P'){ togglePause(); }
});
document.querySelectorAll('[data-dir]').forEach(btn=>{
  btn.addEventListener('click', ()=>{ Audio2.unlock(); requestDir(btn.dataset.dir); });
});

/* ---------- 手机滑动 ----------
 * 分享出去的链接绝大多数是在手机上打开的，而屏幕下方那个方向键在窄屏上只有
 * 32px —— 能用，但边跑边点太慢，转向老是慢半拍。滑动才是手机上该有的操作。
 *
 * 只在真正开打时才接管手势。开始页、暂停页、结算页都盖在同一个 .stage 里，
 * 不加这道判断的话：点"开始"时手指的一点点位移会被当成转向，更糟的是下面
 * 那个 preventDefault 会把排行榜的滚动一起挡掉 —— 榜单是能上下滑的，玩家会
 * 发现自己划不动。
 *
 * 阈值用的是 CSS 像素而不是格子数 —— 这里量的是手指的动作，不是游戏世界的
 * 距离，跟玩家速度无关。14px 在手机上能既避开点击误触，又不必划过一整格才响应。
 */
/* ---------- 锁死缩放 ----------
 * 玩的时候误触双击 / 双指，整个画面突然放大，是最败兴的一种手感问题。
 *
 * 光靠 viewport 里的 user-scalable=no 和 maximum-scale=1 不够：iOS Safari
 * 从 10 起就故意忽略这两个值（出于无障碍考虑），双击照样放大。真正管用的是
 * 两件事——
 *   1. CSS 的 touch-action，见样式表里的 html/body 和 .stage；
 *   2. Safari 私有的 gesture* 事件，双指缩放走的是这条路，必须显式拦掉。
 * 再补一道双击兜底时必须只管正在游玩的棋盘：文档级 touchend 拦截会把
 * 300ms 内第二次按钮点击也一起吃掉（例如快速点两次静音只生效一次）。
 */
['gesturestart','gesturechange','gestureend'].forEach(t=>{
  document.addEventListener(t, e => e.preventDefault(), { passive:false });
});

const SWIPE_MIN_PX = 14;
const SWIPE_AXIS_RATIO = 1.16;
let swipeFrom = null;
const stage = document.getElementById('mazeCanvas').parentElement;

function touchId(t){ return t && Number.isFinite(t.identifier) ? t.identifier : null; }
function matchingTouch(list, id){
  if (!list) return null;
  if (id == null) return list.length === 1 ? list[0] : null;
  for (let i=0;i<list.length;i++) if (list[i].identifier === id) return list[i];
  return null;
}
function clearSwipe(){ swipeFrom = null; }

/* 第二指可能落在 HUD 或页面别处，那次 touchstart 不会冒泡经过 .stage。
   在 document 捕获阶段只做“取消旧棋盘手势”这一件事，确保多指无论落在哪都
   不会让第一指带着陈旧起点继续控制。这里不 preventDefault，不影响按钮点击。 */
function cancelSwipeOnMultitouch(e){
  if (swipeFrom && (!e.touches || e.touches.length !== 1)) clearSwipe();
}
document.addEventListener('touchstart', cancelSwipeOnMultitouch, { passive:true, capture:true });
document.addEventListener('touchmove', cancelSwipeOnMultitouch, { passive:true, capture:true });

/* 老 Safari 的双击缩放兜底只作用于正在游玩的棋盘。按钮都在这条规则之外，
   因而快速连点不会再丢第二次 click；棋盘本身仍由 touch-action:none 主防。 */
let lastStageTouchEnd = 0;
stage.addEventListener('touchend', (e)=>{
  if (gameState !== 'playing') return;
  const now = Date.now();
  if (now - lastStageTouchEnd < 300) e.preventDefault();
  lastStageTouchEnd = now;
}, { passive:false });

stage.addEventListener('touchstart', (e)=>{
  Audio2.unlock();
  /* 新触摸先放弃旧手势；第二指加入时 TouchList 会重排，不能沿用旧坐标。 */
  clearSwipe();
  const list = e.touches || [];
  if (gameState !== 'playing' || list.length !== 1) return;
  const t = list[0];
  swipeFrom = { x:t.clientX, y:t.clientY, id:touchId(t) };
}, { passive: true });

/* 滑过阈值就立刻转向，**不等抬手**。

   原来是在 touchend 里判定的，也就是手指抬起来之前一个转向都不会发生。
   一次滑动手势 100~250ms，而玩家速度是 5.4~6.9 格/秒 —— 手还没离开屏幕，
   人已经越过路口 0.8~1.0 格，可转角辅助只救得了 0.45 格以内。于是每次转弯
   都在跟这个延迟赛跑，手感自然不如方向键（方向键走的是 touchstart，
   按下即响应）。这一条不是"触屏天生不如按键"，只是判定时机放错了地方。

   判定之后把起点挪到当前手指位置，所以按着不放一路划就能连续拐弯，
   不必抬手再划一次。 */
function swipeDir(dx, dy){
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const lead = Math.max(ax, ay), trail = Math.min(ax, ay);
  if (lead <= SWIPE_MIN_PX) return null;
  /* 接近 45° 时先不猜，继续等手指表达出更明确的主轴。 */
  if (trail > 6 && lead < trail * SWIPE_AXIS_RATIO) return null;
  return ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

stage.addEventListener('touchmove', (e)=>{
  // 手指在画布上划动时阻止页面跟着滚 —— 否则一边玩一边整页上下弹，没法玩。
  if (!swipeFrom) return;
  if (gameState !== 'playing' || !e.touches || e.touches.length !== 1){
    clearSwipe(); return;
  }
  const t = matchingTouch(e.touches, swipeFrom.id);
  if (!t) return;
  e.preventDefault();
  const dx = t.clientX - swipeFrom.x, dy = t.clientY - swipeFrom.y;
  const dir = swipeDir(dx, dy);
  if (!dir) return;
  requestDir(dir);
  swipeFrom = { x:t.clientX, y:t.clientY, id:swipeFrom.id }; // 重置起点，支持一路连划
}, { passive: false });

stage.addEventListener('touchend', (e)=>{
  /* 兜底：极短的一甩可能整个手势里一个 touchmove 都没触发过（或者都没过阈值），
     那样上面那段不会发火，这里补一次。已经在 touchmove 里转过向的手势，
     起点已被重置，剩下的位移通常不到阈值，不会重复触发。 */
  if (!swipeFrom) return;
  if (gameState !== 'playing'){ clearSwipe(); return; }
  const t = matchingTouch(e.changedTouches, swipeFrom.id);
  /* 抬起的不是这次手势所属的触点，不得结束或转向。 */
  if (!t) return;
  const dx = t.clientX - swipeFrom.x, dy = t.clientY - swipeFrom.y;
  clearSwipe();
  const dir = swipeDir(dx, dy);
  if (dir) requestDir(dir);
}, { passive: true });
/* 下拉通知栏、系统侧滑返回会中断手势且不发 touchend。
   不清理的话，下次 touchmove 会拿旧起点算出一次“自己转向”。 */
stage.addEventListener('touchcancel', ()=>{ swipeFrom = null; }, { passive: true });

/* ---------- 手机虚拟摇杆 ----------
 *
 * 外观像动作游戏的摇杆，规则仍然是迷宫规则：只输出四个正方向，不输出斜线；
 * 松手后豆豆继续沿原方向跑。摇杆按住不动时每帧续写一次 requestDir，确保玩家
 * 在离路口较远的地方提前推方向，到了路口仍然会转，而不是被 2.2 格的转向缓存
 * 当成过期输入清掉。滑动手势保持原样，两套输入共用 requestDir，不维护第二套
 * 移动逻辑。
 */
const touchJoystick = document.getElementById('touchJoystick');
const joyKnob = document.getElementById('joyKnob');
const JOY_DEADZONE_RATIO = 0.14;
const JOY_TRAVEL_RATIO = 0.28;
const JOY_AXIS_SWITCH_RATIO = 1.18;
let joystickPointerId = null;
let joystickHeldDir = null;
let joystickLastDir = null;

function resetJoystick(){
  joystickPointerId = null;
  joystickHeldDir = null;
  joystickLastDir = null;
  if (touchJoystick && touchJoystick.classList) touchJoystick.classList.remove('active');
  if (joyKnob && joyKnob.style) joyKnob.style.transform = 'translate(0px,0px)';
}

function moveJoystick(clientX, clientY){
  if (!touchJoystick || gameState !== 'playing') return;
  const r = touchJoystick.getBoundingClientRect();
  const size = Math.max(1, Math.min(r.width || 104, r.height || 104));
  const dx = clientX - (r.left + (r.width || size) / 2);
  const dy = clientY - (r.top + (r.height || size) / 2);
  const dist = Math.sqrt(dx*dx + dy*dy);
  const travel = size * JOY_TRAVEL_RATIO;
  const scale = dist > travel ? travel / dist : 1;
  if (joyKnob && joyKnob.style){
    joyKnob.style.transform = `translate(${(dx*scale).toFixed(1)}px,${(dy*scale).toFixed(1)}px)`;
  }
  if (dist < size * JOY_DEADZONE_RATIO){
    joystickHeldDir = null;
    joystickLastDir = null;
    return;
  }

  const ax = Math.abs(dx), ay = Math.abs(dy);
  const lead = Math.max(ax,ay), trail = Math.min(ax,ay);
  let dir;
  /* 贴近 45° 时保留上一方向，避免手指轻微抖动让左右/上下每帧来回跳。 */
  if (joystickLastDir && trail > 0 && lead < trail * JOY_AXIS_SWITCH_RATIO){
    dir = joystickLastDir;
  } else {
    dir = ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  joystickHeldDir = dir;
  joystickLastDir = dir;
  requestDir(dir);
}

function beginJoystick(id, clientX, clientY){
  if (gameState !== 'playing' || joystickPointerId !== null) return false;
  Audio2.unlock();
  clearSwipe();
  joystickPointerId = id;
  touchJoystick.classList.add('active');
  moveJoystick(clientX, clientY);
  return true;
}

if (touchJoystick){
  if (typeof window.PointerEvent === 'function'){
    touchJoystick.addEventListener('pointerdown', (e)=>{
      if (e.pointerType === 'mouse' || e.isPrimary === false) return;
      if (!beginJoystick(e.pointerId, e.clientX, e.clientY)) return;
      if (typeof touchJoystick.setPointerCapture === 'function'){
        try { touchJoystick.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
    }, { passive:false });
    touchJoystick.addEventListener('pointermove', (e)=>{
      if (e.pointerId !== joystickPointerId) return;
      moveJoystick(e.clientX,e.clientY);
      e.preventDefault();
    }, { passive:false });
    const finishPointer = (e)=>{
      if (e.pointerId !== joystickPointerId) return;
      resetJoystick();
      if (e.cancelable) e.preventDefault();
    };
    touchJoystick.addEventListener('pointerup', finishPointer, { passive:false });
    touchJoystick.addEventListener('pointercancel', finishPointer, { passive:false });
    touchJoystick.addEventListener('lostpointercapture', finishPointer, { passive:false });
  } else {
    /* Pointer Events 出现前的旧版 iOS / 微信 WebView 备用路径。 */
    touchJoystick.addEventListener('touchstart', (e)=>{
      const list=e.touches||[];
      if (list.length!==1) { resetJoystick(); return; }
      const t=list[0];
      if (beginJoystick(touchId(t),t.clientX,t.clientY)) e.preventDefault();
    }, { passive:false });
    touchJoystick.addEventListener('touchmove', (e)=>{
      if (joystickPointerId===null) return;
      const t=matchingTouch(e.touches,joystickPointerId);
      if (!t) { resetJoystick(); return; }
      moveJoystick(t.clientX,t.clientY);e.preventDefault();
    }, { passive:false });
    const finishTouch=(e)=>{
      if (joystickPointerId===null) return;
      const t=matchingTouch(e.changedTouches,joystickPointerId);
      if (!t) return;
      resetJoystick();
    };
    touchJoystick.addEventListener('touchend',finishTouch,{passive:true});
    touchJoystick.addEventListener('touchcancel',()=>resetJoystick(),{passive:true});
  }
}
document.getElementById('pauseBtn').addEventListener('click', ()=>{ Audio2.unlock(); togglePause(); });
/* 静音图标是一个 SVG 里的两组线条，切换的是显隐而不是重画整段 markup ——
   每次点击都重设 innerHTML 会把 SVG 拆了重建，在低端机上看得见闪一下。 */
const muteBtn = document.getElementById('muteBtn');
function paintMute(){
  const muted = Audio2.isMuted();
  document.getElementById('soundWaves').toggleAttribute('hidden', muted);
  document.getElementById('soundCross').toggleAttribute('hidden', !muted);
  muteBtn.classList.toggle('off', muted);
  muteBtn.title = muted ? '取消静音' : '静音';
}
muteBtn.addEventListener('click', ()=>{
  Audio2.unlock();
  Audio2.setMuted(!Audio2.isMuted());
  paintMute();
});
paintMute();

/* 桌面右栏的四只怪不能只是四张头像：鼠标放上去就该知道它为什么难缠。
   用同一个短说明区承接四只，既不让窄侧栏突然长出四段文字，也让触摸和键盘
   得到同样反馈。 */
(function bindEnemyProfiles(){
  const detail = document.getElementById('enemyDetail');
  const roster = document.querySelector('.enemy-roster');
  const buttons = Array.from(document.querySelectorAll('.enemy-choice[data-enemy]'));
  if (!detail || !roster || !buttons.length) return;
  let hoveredBtn = null;
  let focusedBtn = null;
  let committedBtn = null;
  const syncEnemyProfile = ()=>{
    /* 鼠标临时预览优先，其次键盘焦点，最后回到触摸/点击确认的那只。 */
    const current = hoveredBtn || focusedBtn || committedBtn;
    buttons.forEach((item)=>{
      item.classList.toggle('is-current', item === current);
      /* aria-pressed 只表达“已经确认”，悬停不能伪装成按下状态。 */
      item.setAttribute('aria-pressed', item === committedBtn ? 'true' : 'false');
    });
    if (!current){
      detail.textContent = '悬停怪物 · 查看特点';
      detail.removeAttribute('data-enemy');
      detail.classList.remove('is-active');
      return;
    }
    detail.textContent = current.dataset.profile || '';
    detail.dataset.enemy = current.dataset.enemy || '';
    detail.classList.add('is-active');
  };
  buttons.forEach((btn)=>{
    /* 全局 Enter/空格是游戏快捷键；在图鉴按钮上要留给原生 button 激活。 */
    btn.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') e.stopPropagation();
    });
    btn.addEventListener('mouseenter', ()=>{ hoveredBtn = btn; syncEnemyProfile(); });
    btn.addEventListener('focus', ()=>{ focusedBtn = btn; syncEnemyProfile(); });
    btn.addEventListener('blur', ()=>{
      if (focusedBtn === btn) focusedBtn = null;
      syncEnemyProfile();
    });
    btn.addEventListener('click', ()=>{
      committedBtn = btn;
      syncEnemyProfile();
    }); // 宽屏触控设备的备用入口
  });
  roster.addEventListener('mouseleave', ()=>{
    /* 在四只之间移动不清空；真正离开整排后，回落到焦点或已轻触的怪物。 */
    hoveredBtn = null;
    syncEnemyProfile();
  });
})();

/* ---------- 玩法说明 ----------
 * 读说明的时候幽灵不能还在追 —— 否则玩家一边看字一边掉命，而且是看不见的
 * 死法。所以打开时挂起游戏，关闭时只在「是我挂起的」情况下才恢复：玩家完全
 * 可能是先自己按了暂停、再点开说明的，那种情况下关掉说明该回到暂停画面，
 * 而不是把他直接丢回赛场。
 */
const helpOverlay = document.getElementById('helpOverlay');
const aboutOverlay = document.getElementById('aboutOverlay');
let helpPausedByUs = false;

/**
 * 有没有整屏的文档页盖在游戏上（玩法说明 / 关于这个游戏）。
 *
 * 单独抽出来是因为有六处行为都取决于这一件事：键盘归谁、Enter 是什么意思、
 * 标题栏要不要动、切走要不要自动暂停、按 P 管不管用、还要不要渲染。
 * 原来六处各写一遍 `!helpOverlay.classList.contains('hidden')`，加第二个
 * 文档页时就得记得改六个地方 —— 漏掉任何一个都不会报错，只会变成一个很难
 * 复现的怪毛病（比如说明开着按 P，幽灵在背后跑起来）。
 */
function docPanelOpen(){
  return !helpOverlay.classList.contains('hidden')
      || !aboutOverlay.classList.contains('hidden')
      || !!(owlOverlay && !owlOverlay.classList.contains('hidden'));
}

let helpSync = null;   // 由下面那段初始化；打开说明时重算滚动提示

function openHelp(){
  if (!helpOverlay.classList.contains('hidden')) return;
  closeAbout(); closeOwl();   // 文档页互斥
  helpPausedByUs = (gameState === 'playing');
  if (helpPausedByUs){ resetJoystick(); gameState = 'paused'; }
  helpOverlay.classList.remove('hidden');
  // 弹层刚显示出来，这一帧才量得到真实高度
  if (helpSync) setTimeout(helpSync, 0);
}
function closeHelp(){
  helpOverlay.classList.add('hidden');
  if (helpPausedByUs && gameState === 'paused') gameState = 'playing';
  helpPausedByUs = false;
}
/* 三个入口都通到同一处说明：标题旁的「?」、开始页的按钮、暂停页的按钮。
   从暂停页点进来时 gameState 已经是 paused，openHelp 里的 helpPausedByUs
   会是 false，所以关掉说明不会把游戏偷偷恢复 —— 玩家还停在暂停页上。 */
['helpBtn', 'startHelpBtn', 'pauseHelpBtn'].forEach(id=>{
  const b = document.getElementById(id);
  if (b) b.addEventListener('click', ()=>{ Audio2.unlock(); openHelp(); });
});

/* ---------- 关于《豆豆迷宫》 ----------
 * 和玩法说明各占一页，互不嵌套。行为上和说明有一处**故意不同**：
 *
 *   说明关掉后会把游戏恢复（你是查规则，查完接着打）；
 *   关于关掉后**停在暂停页，不自动继续**。
 *
 * 因为这两页的性质不一样。查规则是打到一半的一个动作，读作者的话是离开游戏
 * 去读一段文字 —— 读完抬头，手指未必已经回到键盘上，这时候直接把幽灵放出来
 * 就是白掉一条命。让玩家自己按「继续」。
 *
 * 所以打开时如果正在玩，顺手把暂停页也显示出来：关掉这一页，底下露出的就是
 * 暂停画面，玩家自然会去点「继续」。
 */
let aboutOpener = null;    // 从哪个元素点进来的，关掉要把焦点还回去

function openAbout(){
  if (!aboutOverlay.classList.contains('hidden')) return;
  /* 两页互斥。docPanelOpen() 和小游戏那边的绘制顺序都假设"最多只开一页"，
     两页同时打开会叠在一起，而且关掉一页之后另一页还盖着。
     与其到处判断，不如让这个前提在开的时候就成立。 */
  closeHelp();
  closeOwl();
  /* 记住是谁把它打开的。用键盘的人关掉弹层后，焦点必须回到刚才那个按钮上，
     否则焦点掉回 body，再按 Tab 是从整页最开头重新数起。 */
  aboutOpener = (typeof document.activeElement === 'object') ? document.activeElement : null;
  if (gameState === 'playing'){
    resetJoystick();
    gameState = 'paused';
    const po = document.getElementById('pauseOverlay');
    if (po) po.classList.remove('hidden');   // 关掉这一页后露出的就是暂停页
  }
  aboutOverlay.classList.remove('hidden');
  /* 焦点移进弹层本身，而不是「知道了」按钮上 —— 按钮拿到焦点后，Enter 就等于
     关闭，而读到一半误按 Enter 把它关掉，比不支持这个键更烦。
     微信那两版的元素是垫片造的假节点，没有 focus，所以要能安全跳过。 */
  if (typeof aboutOverlay.focus === 'function') aboutOverlay.focus();
}

function closeAbout(){
  if (aboutOverlay.classList.contains('hidden')) return;
  aboutOverlay.classList.add('hidden');
  // 不恢复 gameState：从哪儿进来的就停在哪儿（开始页 / 暂停页 / 结算页）
  if (aboutOpener && typeof aboutOpener.focus === 'function') aboutOpener.focus();
  aboutOpener = null;
}

/* 两个入口通到同一页：标题旁的「♡ 关于」，和开始页那句故事。
   故事那句是情感入口（读到就想点），胶囊是功能入口（找得到）—— 它们出现在
   同一屏但角色不同，不算重复。 */
['aboutBtn', 'storyLine'].forEach(id=>{
  const b = document.getElementById(id);
  if (b) b.addEventListener('click', ()=>{ Audio2.unlock(); openAbout(); });
});

const aboutCloseBtn = document.getElementById('aboutCloseBtn');
if (aboutCloseBtn) aboutCloseBtn.addEventListener('click', ()=>{ Audio2.unlock(); closeAbout(); });

/* 点弹层外面也关。判断"点的是不是底"用 e.target === aboutOverlay：
   点在正文上时 target 是那个 <p>，冒泡上来的事件不会误伤 —— 否则在正文里
   选几个字都会把弹层关掉。 */
if (aboutOverlay.addEventListener) aboutOverlay.addEventListener('click', (e)=>{
  if (e.target === aboutOverlay) closeAbout();
});

/* ---------- 分享成绩 ----------
 * 排行榜只存在各人自己的浏览器里，互相看不见 —— 做真正的跨用户榜单要有后端，
 * 那是另一件事。但"把成绩发出去"这件事本身不需要后端：一句带分数的话就够了，
 * 而且比一个光秃秃的链接有说服力得多。
 *
 * 优先用系统分享面板（手机上一步到位，能直接发微信）；桌面浏览器没有的话
 * 退回剪贴板；再不行就把文字选中，让用户自己复制 —— 每退一步都还能用。
 */
/**
 * 挑战链接：把「谁、多少分」编进 URL。
 *
 * 真正的跨用户排行榜需要一台服务器，那是另一个量级的事（还要考虑作弊、隐私、
 * 运维）。但玩家真正想要的其实不是一张全球榜单，而是**跟认识的人比**——
 * 那个不需要后端：把成绩放进链接，对方打开就看到「XXX 向你挑战 43 万分」，
 * 打完直接告诉他有没有超过。一来一回，竞争闭环就成立了。
 *
 * 分数是明文的，改一改就能伪造 —— 无所谓，这是朋友之间的玩笑，不是天梯。
 * 真要防作弊，那正是需要服务器的时候。
 */
/* 挑战分走 lastFinalScore 这个数字，不去读结算页上的文本：那串文本带千分位，
   Number("431,070") 是 NaN，链接会静悄悄地失效。 */
let lastFinalScore = 0;

/* 分享链接要落到哪个地址。
 *
 * 默认用当前地址，自己的网站上这是对的。但在 itch.io 这类**把游戏放进 iframe**
 * 的平台上，location.href 是 CDN 上那个 html 文件的地址
 * （html-classic.itch.zone/html/…/index.html）—— 把它分享出去，别人打开看到的
 * 是一个没有介绍、没有作者、随时可能换地址的裸游戏页。
 * 所以留一个口子：宿主页面可以用 window.DOUDOU_SHARE_URL 指定正式落地页。
 * 没指定就是原来的行为，网页版一切照旧。 */
function shareBase(){
  try {
    if (typeof window !== 'undefined' && window.DOUDOU_SHARE_URL) return window.DOUDOU_SHARE_URL;
  } catch (e) {}
  return location.href;
}

function challengeURL(){
  const s = lastFinalScore;
  let who = '';
  try { who = localStorage.getItem(NAME_KEY) || ''; } catch (e) {}
  const u = new URL(shareBase());
  u.searchParams.set('c', s);
  if (who) u.searchParams.set('n', who);
  return u.toString();
}

function shareText(){
  const won = document.getElementById('overTitle').textContent.indexOf('通关') >= 0;
  const s = fmtNum(lastFinalScore);
  const head = won ? `我和豆豆通关了 Neon Maze 全 6 关，${s} 分！敢不敢来超？`
                   : `我在 Neon Maze 拿了 ${s} 分，来比比？`;
  return head + '\n' + challengeURL();
}

/* 收到挑战：开始页顶部显示「谁 · 多少分」，通关/结算时告诉玩家超没超过。 */
let challenge = null;
(function readChallenge(){
  try {
    const q = new URL(location.href).searchParams;
    const sc = Number(q.get('c'));
    if (Number.isFinite(sc) && sc > 0){
      challenge = { score: sc, name: cleanName(q.get('n') || '') || '一位朋友' };
    }
  } catch (e) { /* 链接畸形就当没有挑战 */ }
})();

/* 挑战的来源在网页版是 URL 查询串，可微信那两版**根本没有 URL** —— 小程序的
   启动参数在 onLoad(options) 里，小游戏在 wx.getLaunchOptionsSync()。所以这里
   开一个口子让外壳把它传进来，而不是让核心去猜自己跑在什么环境里。
   传进来之后一切照旧：开始页的横幅、结算页那句"超过谁多少分"都是现成的。 */
function setChallenge(score, name){
  const sc = Number(score);
  if (!Number.isFinite(sc) || sc <= 0){ challenge = null; return null; }
  challenge = { score: sc, name: cleanName(name || '') || '一位朋友' };
  renderChallengeBanner();
  return challenge;
}

/** 开始页那条每日挑战。和选关同一个门槛：打到第二关才出现。 */
function renderDaily(){
  const box = document.getElementById('dailyBox');
  if (!box) return;
  if (maxLevelReached() < 2){ box.classList.add('hidden'); return; }
  const lv = dailyLevel(), best = dailyBest();
  box.classList.remove('hidden');
  box.innerHTML = `<span class="daily-k">今日挑战</span>`
    + `<span class="daily-lv">第 ${lv} 关 · ${levelName(lv)}</span>`
    /* 没成绩时写"还没打"而不是"0 分"。0 是一个成绩，"还没打"是一个空位——
       今天这一栏要邀请人来填，不是先给他记一笔难看的账。 */
    + `<span class="daily-best">${best ? '今天最好 ' + fmtNum(best) : '今天还没打'}</span>`
    + `<button class="daily-go" id="dailyGo">开始</button>`;
  const go = document.getElementById('dailyGo');   // 理由同 renderLevelSelect 里那条
  if (go) go.addEventListener('click', ()=>{
    Audio2.unlock();
    document.getElementById('startOverlay').classList.add('hidden');
    startDaily();
  });
}

function startDaily(){
  const d = todayKey(), lv = dailyLevel();
  startPractice(lv,'daily');
  /* 必须在 startPractice 之后 —— 它里面的 resetLevel(true) 会把这个标记清掉。
     顺序反了的话每日挑战永远不记成绩，而且不会报错。 */
  dailyRun = {d,lv};
}

/* ---------- 对手图鉴弹层 ---------- */
const owlOverlay = document.getElementById('owlOverlay');
let owlOpener = null;

function renderOwlList(){
  const el = document.getElementById('owlList');
  if (!el) return;
  el.innerHTML = owlCodexView().map(o=>{
    if (!o.met){
      return `<div class="owl-row locked"><div class="owl-head">`
        + `<span class="owl-dot"></span><span class="owl-name">???</span></div>`
        + `<p class="owl-how">还没见过它</p></div>`;
    }
    /* 只报"抓到你"和"被你吃"两个数。遇见次数不报：它每关都涨，涨得毫无悬念，
       放上去只会把真正有意思的那两个数挤淡。 */
    const tally = `抓到你 ${o.caught} 次　你反杀 ${o.ate} 次`;
    return `<div class="owl-row"><div class="owl-head">`
      + `<span class="owl-dot" style="background:var(${o.color})"></span>`
      + `<span class="owl-name" style="color:var(${o.color})">${o.name}</span>`
      + `<span class="owl-tally">${tally}</span></div>`
      + `<p class="owl-how">${o.how.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p></div>`;
  }).join('');
}

function openOwl(){
  if (!owlOverlay || !owlOverlay.classList.contains('hidden')) return;
  closeHelp(); closeAbout();     // 三页互斥，理由见 openAbout
  owlOpener = document.activeElement;
  /* 和「关于」同一套：正在玩就先暂停，并把暂停页也显示出来，这样关掉图鉴之后
     露出的是暂停画面，玩家自己按「继续」。跟「玩法说明」的行为是反的，那是
     故意的 —— 查规则是打到一半的一个动作，读图鉴是离开游戏去看一页东西，
     看完抬头手指未必回到屏幕上，直接把对手放出来就是白掉一条命。 */
  if (gameState === 'playing'){
    resetJoystick();
    gameState = 'paused';
    const po = document.getElementById('pauseOverlay');
    if (po) po.classList.remove('hidden');
  }
  renderOwlList();
  owlOverlay.classList.remove('hidden');
  document.getElementById('owlBtn')?.setAttribute('aria-expanded','true');
  document.getElementById('owlList').scrollTop = 0;
  if (typeof owlOverlay.focus === 'function') owlOverlay.focus({preventScroll:true});
}
function closeOwl(){
  if (!owlOverlay || owlOverlay.classList.contains('hidden')) return;
  owlOverlay.classList.add('hidden');
  document.getElementById('owlBtn')?.setAttribute('aria-expanded','false');
  if (owlOpener?.isConnected !== false && typeof owlOpener?.focus === 'function') owlOpener.focus({preventScroll:true});
  owlOpener = null;
}
(function(){
  const b = document.getElementById('owlCloseBtn');
  if (b) b.addEventListener('click', ()=>{ Audio2.unlock(); closeOwl(); });
  if (owlOverlay) owlOverlay.addEventListener('click', (e)=>{ if (e.target === owlOverlay) closeOwl(); });
  if (owlOverlay) owlOverlay.addEventListener('keydown', e=>{
    if (e.key !== 'Tab') return;
    const list = document.getElementById('owlList'), active = document.activeElement;
    if (e.shiftKey && (active === list || active === owlOverlay)){ e.preventDefault(); b.focus(); }
    else if (!e.shiftKey && active === b){ e.preventDefault(); list.focus(); }
  });
})();

function renderChallengeBanner(){
  if (!challenge) return;
  const box = document.getElementById('challengeBox');
  if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `<b>${challenge.name}</b> 向你挑战`
    + `<span class="ch-score">${fmtNum(challenge.score)}</span>分`;
}

document.getElementById('shareBtn').addEventListener('click', async ()=>{
  const btn = document.getElementById('shareBtn');
  const text = shareText();
  const done = (msg)=>{ btn.textContent = msg; setTimeout(()=>btn.textContent='分享成绩', 1800); };
  try {
    if (navigator.share){ await navigator.share({ text }); return; }
    if (navigator.clipboard){ await navigator.clipboard.writeText(text); done('已复制'); return; }
    throw new Error('no share api');
  } catch (e) {
    // 用户自己取消分享也会走到这里，那种情况什么都不该提示
    if (e && e.name === 'AbortError') return;
    done('请手动复制');
  }
});
(function(){
  const pb = document.getElementById('practiceBtn');
  if (!pb) return;
  pb.addEventListener('click', ()=>{
    Audio2.unlock();
    stopFireworks();
    document.getElementById('overOverlay').classList.add('hidden');
    startPractice(practiceOfferLevel);
  });
})();

(function(){
  const hp = document.getElementById('hudPauseBtn');
  if (hp) hp.addEventListener('click', ()=>{ Audio2.unlock(); togglePause(); });
})();

/* 「↓ 下面还有」滚到底就收起来。
   用 .hidden 会被那条全局 display:none 直接干掉，没有淡出，所以这里单独
   切一个类只改透明度 —— 它是提示，不该硬闪。 */
(function(){
  const doc = document.querySelector('.help-doc');
  const more = document.getElementById('helpMore');
  if (!doc || !more) return;
  const sync = ()=>{
    // 差 8px 以内就算到底了：小数缩放下 scrollTop 很难精确等于差值
    const atEnd = doc.scrollTop + doc.clientHeight >= doc.scrollHeight - 8;
    const noScroll = doc.scrollHeight <= doc.clientHeight + 1;
    more.classList.toggle('hidden', atEnd || noScroll);
  };
  doc.addEventListener('scroll', sync, { passive:true });
  // 打开说明时内容和高度才定下来，所以每次开都要重算一次
  helpSync = sync;
  sync();
})();

document.getElementById('helpCloseBtn').addEventListener('click', closeHelp);

/** 开打时收起标题，回到任何弹层时再露出来。 */
let chromeInGame = null;
function syncChrome(){
  /* 说明盖着的时候，**什么都别动**。
   *
   * 打开说明会把 gameState 变成 paused，于是这里摘掉 in-game、标题展开；
   * 点「知道了」又变回 playing，标题再收回去。两次都是 280ms 的过渡，
   * 而后一次正好发生在玩家刚点完按钮的那一刻 —— 整页还在动，看起来就像
   * "点了没反应、没有立刻回到原来的界面"。玩家报的就是这个。
   *
   * 而说明本身是 position:fixed inset:0 整屏盖住的，它开着时底下长什么样
   * 根本看不见，压根没有理由跟着变。开之前什么样，关掉还是什么样，
   * 零动画、零位移。 */
  if (docPanelOpen()) return;
  const next = gameState === 'playing';
  if (next === chromeInGame) return;
  document.body.classList.toggle('in-game', next);
  chromeInGame = next;
}

/* ---------- 切走标签页自动暂停 ----------
 *
 * 网页版特有的一种"冤死"：玩到一半去回个微信、看一眼别的标签，回来发现
 * 已经没了两条命 —— 而这十几秒里他根本不在场。手机上尤其常见。
 *
 * 注意**光靠浏览器节流是不够的**：页面隐藏时 rAF 会被停掉，看起来游戏也停了；
 * 可各家浏览器的节流策略并不一致（有的降到 1Hz 而不是完全停），一旦还在跑，
 * dt 被 Math.min(0.033) 夹住，游戏就在后台慢动作前进 —— 玩家回来时状态已经
 * 变了。所以必须显式暂停，不能指望环境。
 *
 * 回来之后**不自动继续**：他的手大概率还没回到键盘上，自动恢复等于刚回来
 * 就送一条命。停在暂停页，由他自己按键或点按钮。
 */
let pausedByBlur = false;

/** 两个入口共用一套逻辑，且**同一次失焦只处理一遍** ——
 *  切标签时 visibilitychange 和 blur 往往一起来，不去重会走两遍。 */
function autoPause(){
  if (gameState !== 'playing') return;                     // 只在真的在玩时
  if (docPanelOpen()) return;                              // 文档页开着本来就是暂停态
  if (pausedByBlur) return;                                // 已经自动暂停过了
  pausedByBlur = true;
  clearSwipe();                                            // 系统中断后不能留下旧触点
  resetJoystick();
  gameState = 'paused';
  document.getElementById('pauseOverlay').classList.remove('hidden');
  const why = document.getElementById('pauseWhy');
  if (why) why.textContent = '你切走了，游戏替你按了暂停　按 P / Enter 或点「继续游戏」';
}

document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){ autoPause(); return; }
  /* 回到前台重算每日挑战。开始页那一条只在初始化和每局结束时画过，页面挂着
     过了零点再回来就还显示昨天那一关 —— 而"今天大家打同一关"正是这条功能
     唯一的意义。 */
  renderDaily();
});
/* blur 是必需的第二道：切到**另一个应用**（而不是另一个标签页）时，标签仍然
   算「可见」，visibilitychange 根本不触发，只有窗口失焦。手机上切出去、
   桌面上点到别的程序，都是走这条。 */
window.addEventListener('blur', autoPause);

function togglePause(){
  // 说明开着的时候 gameState 已经是 paused，此时按 P 会把游戏恢复成 playing
  // 而说明还盖在上面 —— 玩家看着一张静止的说明页，幽灵却已经在后面跑了。
  if (docPanelOpen() || (window.NeonCompetition && window.NeonCompetition.isOpen())) return;
  if (gameState==='playing'){
    clearSwipe();
    resetJoystick();
    gameState='paused';
    document.getElementById('pauseOverlay').classList.remove('hidden');
  }
  else if (gameState==='paused'){
    gameState='playing';
    document.getElementById('pauseOverlay').classList.add('hidden');
    if (pausedByBlur){
      pausedByBlur = false;
      const why = document.getElementById('pauseWhy');
      if (why) why.textContent = '按 P、Enter 或点「继续游戏」回到游戏';
    }
  }
}

document.getElementById('startBtn').addEventListener('click', ()=>{
  Audio2.unlock();
  startLevelIntro();   // 第一关也要报名字，六关才是一个完整的序列
  // 以前这里弹一行"滑动屏幕 或 按方向键移动"。换成画在主角身上的滑动手势，
  // 不认字也看得懂，而且玩家一动就消失。见 drawSwipeHint。
  startSwipeHint();
  document.getElementById('startOverlay').classList.add('hidden');
  gameState='playing';
  Analytics.track('game_start',{mode:'normal',level:1});
});
document.getElementById('resumeBtn').addEventListener('click', ()=>{ Audio2.unlock(); togglePause(); });
document.getElementById('restartBtn').addEventListener('click', ()=>{
  Audio2.unlock();
  stopFireworks();
  document.getElementById('overOverlay').classList.add('hidden');
  /* 练习里的「再来一局」= 再练这一关。回到第一关的话，这个按钮就正好
     做了玩家最不想要的那件事 —— 而"不想从头再来"正是练习模式的由来。 */
  if (practiceLevel){ startPractice(practiceLevel); return; }
  fullNewGame();
  // 必须在 fullNewGame 之后：它内部会 resetLevel，而 resetLevel 会把卡片清零
  startLevelIntro();
  gameState='playing';
  Analytics.track('game_start',{mode:'normal',level:1});
});

/* ---------- update loop ---------- */
function update(dt){
  elapsed += dt;
  runActiveSeconds += dt;
  if (invuln>0) invuln -= dt;
  if (player.phase>0){
    const was = player.phase;
    player.phase -= dt;
    /* 3、2、1 各响一声，一声比一声高。穿墙到期的那一下最容易翻车 ——
       人正在墙里抄近路，规则突然变回来就卡在墙中间（靠 rescueFromWall 弹出来，
       但那一下很懵）。声音提前三秒开始数，玩家才有机会往走廊里靠。 */
    for (const mark of [3, 2, 1]){
      if (was > mark && player.phase <= mark) Audio2.phaseTick(mark);
    }
    if (was > 0 && player.phase <= 0) Audio2.phaseEnd();
  }
  checkPowerPelletNearby();
  if (comboTimer>0){
    // 在跑就慢扣，停下就快扣 —— 见 COMBO_WINDOW 上面那段说明
    const moving = !!(player.dir.x || player.dir.y);
    comboTimer -= dt * (moving ? 1 : COMBO_IDLE_DECAY);
    if (comboTimer<=0){ combo=1; updateHud(); }
  }

  // one global fright countdown for every ghost — see the power mode block
  if (frightTimer>0){
    frightTimer -= dt;
    if (frightTimer<=0) endPowerMode();
  }
  // portal cooldowns tick in simulation time so they freeze correctly on pause
  if (player.warpCd>0) player.warpCd -= dt;
  resumeAfterWarp();
  ghosts.forEach(g=>{ if (g.warpCd>0) g.warpCd -= dt; });
  rescueFromWall();

  // a 180 needs no junction, and a perpendicular turn may start just short of
  // one — both are resolved before the step so they land on this frame
  // Snapshot the heading BEFORE any turn handling. applyCornerAssist rewrites
  // player.dir itself, so capturing after it would make a corner-assisted turn
  // look like "no turn happened" and let the momentum survive it — which is
  // most turns, since corner assist is the usual path.
  const beforeDir = { x: player.dir.x, y: player.dir.y };

  applyInstantReversal(player);
  applyCornerAssist(player);

  const beforeX = player.x, beforeY = player.y;
  applySpeedModifiers(); // momentum changes every frame, so re-derive speed here
  stepEntity(player, dt, choosePlayerDir, (ent)=>{
    eatPelletAt(Math.round(ent.x), Math.round(ent.y));
    checkPortal(ent);
  });
  // advance the odometer, ignoring portal jumps so a warp doesn't instantly
  // age out a turn the player just pressed
  const moved = Math.abs(player.x - beforeX) + Math.abs(player.y - beforeY);
  if (moved < 1.5) player.distTravelled += moved;

  // momentum: any change of heading (including being stopped by a wall) spends it
  const turned = player.dir.x !== beforeDir.x || player.dir.y !== beforeDir.y;
  if (turned || !(player.dir.x || player.dir.y)) player.straightTiles = 0;
  else if (moved < 1.5) player.straightTiles += moved;

  // motion trail, longer the faster we're going
  const wind = (momentumMult() - 1) / (MOMENTUM_MAX - 1); // 0..1
  /* 冲刺是全场最隐形的一条规则：速度确实在涨，但玩家只看到自己身后多了道尾巴，
     没人会把它和"直着走别拐弯"联系起来。等他第一次真的冲到满速，再告诉他这是
     怎么来的 —— 那时候屏幕上正好有他自己造出来的证据。 */
  if (wind >= 0.999) hintOnce('dash', '冲刺：直线连走不拐弯会越跑越快', 0);
  /* 尾迹按**距离**采样，不按帧。
     原来是每帧存一个点，最多 7 个 —— 第六关满冲刺是 8.37 格/秒，60 帧下相邻两点
     只差 0.14 格，七个点总共铺开 0.84 格，正好等于豆豆自己的直径。那不是一条
     尾巴，是七个几乎完全叠在角色身上的半透明圆盘，手机上棋盘再一缩就糊成一团，
     业主的原话是"看起来有点晕"。而且按帧采样意味着 120Hz 手机上间距再减半，
     同一份代码在不同手机上观感不一样。
     按距离采之后，间距恒定 0.34 格、五个点铺开 1.4 格，是看得出方向的一条尾巴，
     且和帧率无关。 */
  if (wind > 0.15 && moved < 1.5){
    if (player.distTravelled - player.trailAt >= TRAIL_SPACING){
      player.trail.push({ x: beforeX, y: beforeY });
      player.trailAt = player.distTravelled;
      while (player.trail.length > TRAIL_MAX) player.trail.shift();
    }
  } else if (player.trail.length){
    player.trail.shift();
    player.trailAt = player.distTravelled;
  }

  ghosts.forEach((g,i)=>{
    if (g.state==='house'){
      g.wobble += dt*3;
      // homeY 是它自己走进来停下的位置；开局时没有这个值，就用出生点
      g.y = (g.homeY === null ? SPAWN.ghosts[i].y : g.homeY) + Math.sin(g.wobble)*0.18;
      if (elapsed >= g.releaseAt){
        /* 出巢前必须先回到格子正中。
           上一行的上下浮动会把 y 停在 ±0.18 的任意位置，而 stepEntity 只在
           **格子正中**才会去问下一步走哪儿（不在正中又没有方向，它直接 break）。
           带着 10.13 这种坐标转成 'exiting'，这只幽灵就永远定在那儿不动了：
           后面能量豆一来它变可吃、被吃掉变成眼睛，还是不动——就是玩家看到的
           "幽灵卡在一块地方"。老巢这个状态以前是死代码，从没跑过，所以这个坑
           一直没露出来。 */
        g.x = Math.round(g.x); g.y = Math.round(g.y);
        g.state='exiting';
      }
      return;
    }
    /* 兜底：没有方向、又不在格子正中的幽灵是**动不了**的——stepEntity 只在正中
       重新选方向，其余时候没方向就直接 break，于是永远僵在那里。
       上面出巢那处已经堵掉了已知的来源，这里再兜一道：这种"幽灵定住不动"的
       故障玩家一眼就能看见，而代价不过是每帧两个比较。 */
    if (!g.dir.x && !g.dir.y && !(nearCenter(g.x) && nearCenter(g.y))){
      g.x = Math.round(g.x); g.y = Math.round(g.y);
    }
    stepEntity(g, dt, chooseGhostDir, checkPortal);
  });

  handleGhostCollisions();
  updateFruit(dt);
  maybeSpawnFruit();

  if (pelletsLeft<=0){
    // Award before resetLevel(), which clears the per-level counters this reads.
    const perfect = deathsThisLevel === 0;
    if (perfect){ perfectLevelsThisRun++; awardBonus(`第 ${level} 关无伤`, BONUS.PERFECT_LEVEL * level); }
    const earned = levelBonuses.slice();
    /* 星星必须在 resetLevel() 之前结，它读的 deathsThisLevel /
       ghostsEatenThisLevel 都会被那一句清掉。和上面那条奖励是同一个理由。 */
    const newStars = awardStars(level);
    const starMsg = newStars ? '　★ 新星星 ×' + newStars : '';
    Analytics.track('level_complete',{mode:currentAnalyticsMode(),level});

    /* 练习只打这一关。清掉之后直接进结算，**不推进到下一关**——
       否则从第五关练起、连着清掉五和六，看起来就跟通关一样了，
       而通关必须是六关连打不死才算。 */
    /* 练习/每日挑战这一路不经过下面那条 toast，星星要在这儿自己报。
       报完再进结算页 —— endGame 不发 toast，所以这条能留在屏幕上。 */
    if (practiceLevel){ if (starMsg) toast('第 ' + level + ' 关' + starMsg.trim()); endGame(false); return; }
    if (level >= MAX_LEVEL){ endGame(true); return; }
    level++;
    noteLevelReached(level);
    resetLevel(false);
    lives++; // clearing a level is rewarded with an extra life
    updateHud();
    startLevelIntro();
    /* 卡片报"是哪一关"，toast 报"拿到了什么"，两者不重复。
       关名已经在卡片上大字写着了，toast 里就不再念一遍。 */
    const extra = earned.length ? '　' + earned.map(b=>b.label+' +'+fmtNum(b.points)).join('　') : '';
    toast('生命 +1' + extra + starMsg);
    Audio2.levelUp();
  }
}

/* ---------- rendering ---------- */
function drawMaze(){
  // 逻辑尺寸，不是 canvas.width —— 加了缩放变换之后那个数是设备像素
  ctx.clearRect(0, 0, COLS*TILE, ROWS*TILE);
  /* 穿墙期间墙自己"虚掉"：变淡、变虚线、颜色偏向穿墙紫。
     这是这个道具最值钱的一秒 —— 玩家真正要看懂的不是"我获得了穿墙"，而是
     **"墙不算数了"**。让墙自己变样，比在角色身上加特效直接得多：他一眼看到
     的是整张地图的规则变了，而不是自己身上多了层光。
     最后 2 秒只轻轻提高亮度；红色倒计时条和 3/2/1 音效已经足够说明时间，
     整张迷宫不该再用硬切闪烁抢走玩家视线。 */
  const phasing = player && player.phase > 0;
  const ending  = phasing && player.phase < 2;
  const wallPulse = ending && !prefersReducedMotion()
    ? 0.48 + 0.10 * (0.5 + 0.5 * Math.sin(elapsed * PHASE_WALL_WARNING_HZ * Math.PI * 2))
    : 0.48;
  if (phasing){
    // 穿墙这几秒墙是虚线并带轻微呼吸，不走缓存，现画
    const wallColor = cssVar('--phase');
    ctx.save();
    ctx.globalAlpha = ending ? wallPulse : 0.42;
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = wallColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = wallColor;
    ctx.shadowBlur = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i=0;i<wallEdges.length;i+=4){
      ctx.moveTo(wallEdges[i], wallEdges[i+1]);
      ctx.lineTo(wallEdges[i+2], wallEdges[i+3]);
    }
    ctx.stroke();
    ctx.restore();

    // ghost house door（穿墙时门不变样，照画）
    ctx.save();
    ctx.strokeStyle = cssVar('--pink');
    ctx.lineWidth = 2;
    [[9,8],[9,12]].forEach(([x,y])=>{
      ctx.beginPath();
      ctx.moveTo(x*TILE+3, y*TILE+TILE/2);
      ctx.lineTo(x*TILE+TILE-3, y*TILE+TILE/2);
      ctx.stroke();
    });
    ctx.restore();
  } else {
    /* 常态：墙走离屏缓存，每帧一次 drawImage（见 buildWallEdges 旁的说明）。
       缓存按设备像素渲染，所以贴的时候要回到单位矩阵。 */
    if (wallCacheDirty || !wallCache || wallCache.width !== canvas.width) rebuildWallCache();
    if (wallCache){
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(wallCache, 0, 0);
      ctx.restore();
    } else {
      drawWallsNormal(ctx);   // 离屏不可用时的退路
    }
  }

  /* ---------- 豆子 ----------
     所有小豆子的半径和光晕是**同一个值** —— 它们只跟"还剩几颗"和时间有关，
     跟位置无关。所以整张图的豆子可以攒成一条路径、一次 fill 画完：
     175 次带阴影的绘制变成 1 次。shadowBlur 是 canvas 2D 里最贵的操作，
     而在手机上这一项就是掉帧的主因。

     每段 arc 之前必须先 moveTo：arc 会从当前点连一条线过来，不另起子路径
     就会在豆子之间连出线段。
     唯一的差别是光晕重叠处：分开画时两团光会叠加变亮，合成一条路径则不会。
     正常间距（26px）下光晕只有 2px，根本碰不到；只有剩最后几颗、光晕涨到
     7.5px 且刚好相邻时才可能有极轻微的差别，这个代价换 175 倍的绘制量值得。 */
  let glow = PELLET_GLOW;
  if (pelletsLeft <= LAST_PELLET_HINT){
    /* 剩最后几颗时让豆子自己"喘气"。
       这是吃豆类通病：前 90% 一路吃得很爽，剩最后一两颗突然变成满地图找，
       节奏一下垮掉。目的不是降低难度 —— 豆子在哪儿本来就不是难点，
       **找它的那段时间纯粹是无聊**，把无聊删掉而已。
       两档：10 颗以内轻微呼吸，3 颗以内明显跳动，越少越显眼。

       只让**光晕**跳，不动半径：半径一变就会撞上能量豆的尺寸区间，
       而那正是之前那个 bug —— 详见文件上方 PELLET_R 那段。 */
    const urgency = pelletsLeft <= LAST_PELLET_LOUD ? 1 : 0.45;
    const beat = (Math.sin(elapsed * (5 + urgency*3)) + 1) / 2;   // 0..1
    glow = PELLET_GLOW + beat * (PELLET_GLOW_SWING * urgency + PELLET_GLOW_BASE_SWING);
  }
  const amber = cssVar('--amber');
  const pulse = POWER_R + Math.sin(elapsed*6) * POWER_R_SWING;
  let anyPower = false;

  /* 大多数时间普通豆子直接贴离屏层；最后十颗才需要每帧改变光晕。 */
  if (pelletsLeft > LAST_PELLET_HINT){
    if (dotCacheDirty || !dotCache || dotCache.width !== canvas.width) rebuildDotCache();
    if (dotCache){
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.drawImage(dotCache,0,0);
      ctx.restore();
    } else {
      drawRegularDots(ctx, PELLET_GLOW);
    }
  } else {
    drawRegularDots(ctx, glow);
  }

  /* 能量星：五角形轮廓与参考界面一致，机制仍是原来的能量豆。
     数量很少，但仍合并到同一条路径中，只做一次 fill + stroke。 */
  ctx.fillStyle = amber; ctx.shadowColor = amber;
  ctx.shadowBlur = POWER_GLOW;
  ctx.beginPath();
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++){
    if (grid[y][x] !== 'o') continue;
    const cxp = x*TILE+TILE/2, cyp = y*TILE+TILE/2;
    for (let i=0;i<10;i++){
      const a = -Math.PI/2 + i*Math.PI/5;
      const sr = i%2===0 ? pulse*1.24 : pulse*.54;
      const sx = cxp + Math.cos(a)*sr, sy = cyp + Math.sin(a)*sr;
      if (i===0) ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy);
    }
    ctx.closePath(); anyPower = true;
  }
  if (anyPower){
    ctx.fillStyle = amber;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = .68 + .2*Math.sin(elapsed*6);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 传送门只有四格，而且每个都要单独旋转，照旧一个一个画；
  // 但坐标从建关时存好的 portalTiles 取，不再每帧全图扫描。
  for (const ch of ['1','2']){
    for (const p of portalTiles[ch]){
      const cxp = p.x*TILE+TILE/2, cyp = p.y*TILE+TILE/2;
      const col = ch==='1' ? cssVar('--cyan') : cssVar('--pink');
        /* 冷却中的传送门画暗、且不再旋转。
           踩上去之后有 1 秒冷却，这期间再踩没反应 —— 之前门看起来一切正常，
           玩家只会以为卡住了或者门坏了。让"暂时不能用"这件事看得见。 */
        // 只有正在冷却的那个颜色变暗；另一种颜色照常发光转动，
        // 玩家一眼就能看出"红的要等，蓝的现在能走"
        const cooling = player.warpCd > 0 && player.warpCdCh === ch;
        ctx.save();
        ctx.translate(cxp,cyp);
        if (cooling) ctx.globalAlpha = 0.32;
        ctx.strokeStyle = col; ctx.shadowColor=col; ctx.shadowBlur = cooling ? 0 : 5;
        ctx.lineWidth=1.6;
        ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.stroke();
        // 外圈画一段随冷却缩短的弧，等于一个小进度条
        if (cooling){
          ctx.globalAlpha = 0.75;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(0, 0, 10.5, -Math.PI/2,
                  -Math.PI/2 + Math.PI*2*(player.warpCd / PORTAL_COOLDOWN_SECONDS));
          ctx.stroke();
          ctx.globalAlpha = 0.32;
        }
        ctx.rotate(cooling ? 0 : -elapsed*2.4);
        ctx.setLineDash([3.5,3.5]);
        ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.arc(0,0,5.2,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0,0,1.8,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
  }
  ctx.shadowBlur=0;
}

function drawFruit(){
  if (!fruit.active) return;
  const cxp = fruit.x*TILE+TILE/2, cyp = fruit.y*TILE+TILE/2 + Math.sin(elapsed*8)*2;
  ctx.save();
  ctx.translate(cxp,cyp);
  ctx.fillStyle = cssVar('--cyan');
  ctx.strokeStyle = '#e9ffff';
  ctx.shadowColor = cssVar('--cyan'); ctx.shadowBlur=8;
  ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.moveTo(0,-10);ctx.lineTo(8,-3);ctx.lineTo(0,10);ctx.lineTo(-8,-3);ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.globalAlpha=.62;
  ctx.beginPath();
  ctx.moveTo(0,-10);ctx.lineTo(0,10);
  ctx.moveTo(-8,-3);ctx.lineTo(8,-3);
  ctx.moveTo(-8,-3);ctx.lineTo(0,2);ctx.lineTo(8,-3);
  ctx.stroke();
  ctx.restore();
}

/* 吃豆的动作放在角色前方，不再靠把整只豆豆撑大。
   两粒小能量点既能在 20px 左右的小角色上看清，也不会遮住前面的路。 */
function drawPlayerBiteSpark(bite){
  if (bite <= 0.12) return;
  let dx=player.dir.x, dy=player.dir.y;
  if (!dx && !dy) dy=-1;
  const sideX=-dy, sideY=dx;
  const reach=PLAYER_SPRITE_SIZE*0.42;
  const spread=1.7+bite*1.1;
  ctx.save();
  ctx.globalAlpha*=bite*0.72;
  ctx.fillStyle=cssVar('--amber');
  ctx.shadowColor=cssVar('--amber');ctx.shadowBlur=3;
  ctx.beginPath();
  ctx.arc(dx*reach+sideX*spread,dy*reach+sideY*spread,0.62+bite*0.24,0,Math.PI*2);
  ctx.arc(dx*reach-sideX*spread,dy*reach-sideY*spread,0.48+bite*0.18,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

const DOUDOU_FACING = {
  up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0}
};

function directionFacing(dir, fallback){
  if (dir && dir.x < 0) return 'left';
  if (dir && dir.x > 0) return 'right';
  if (dir && dir.y < 0) return 'up';
  if (dir && dir.y > 0) return 'down';
  return fallback || 'down';
}

/* 方向改变时先把身体压窄，再换到侧脸/背脸。逻辑坐标已经转过弯，
   这里只用 120ms 补上“看得见的转身”，不改碰撞和移动。 */
function updateDoudouFacing(){
  const target = directionFacing(player.dir, player.visualFacingTarget);
  if (!player.visualFacingTarget){
    player.visualFacing = player.visualFacingFrom = player.visualFacingTarget = target;
    player.visualTurnT = 1;
  } else if (target !== player.visualFacingTarget){
    const shown = player.visualTurnT < 0.5 ? player.visualFacingFrom : player.visualFacingTarget;
    const a = DOUDOU_FACING[shown] || DOUDOU_FACING.down;
    const b = DOUDOU_FACING[target] || DOUDOU_FACING.down;
    player.visualFacingFrom = shown;
    player.visualFacingTarget = target;
    player.visualTurnSign = Math.sign(a.x*b.y-a.y*b.x) || b.x || -b.y || 1;
    player.visualTurnT = 0;
  }
  if (player.visualTurnT < 1){
    player.visualTurnT = Math.min(1, player.visualTurnT + visualFrameDt/PLAYER_TURN_SECONDS);
  }
  player.visualFacing = player.visualTurnT < 0.5
    ? player.visualFacingFrom : player.visualFacingTarget;
  return player.visualFacing;
}

/* 尾焰永远拖在身后，是四方向最醒目的不对称标记。能量星期间尾焰也一起
   变成金色，避免只有身体中央换色、移动时仍被读成普通形态。 */
function drawDoudouTail(facing,powered){
  const f = DOUDOU_FACING[facing] || DOUDOU_FACING.down;
  const bx=-f.x*8.1, by=-f.y*7.1+1.2;
  const sx=-f.y, sy=f.x;
  ctx.save();
  ctx.globalAlpha*=.9;
  ctx.fillStyle=powered?'#fff0a2':'#86ffe2';
  ctx.shadowColor=powered?cssVar('--amber-hot'):cssVar('--cyan');ctx.shadowBlur=5;
  ctx.beginPath();
  ctx.moveTo(bx+sx*2.1,by+sy*2.1);
  ctx.quadraticCurveTo(bx-f.x*5.4,by-f.y*5.4,bx-sx*1.6,by-sy*1.6);
  ctx.quadraticCurveTo(bx-f.x*1.5,by-f.y*1.5,bx+sx*2.1,by+sy*2.1);
  ctx.fill();
  ctx.restore();
}

function drawDoudouDiamond(x,y,size,powered){
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);
  ctx.fillStyle=powered?'#fff9db':'#e9ffff';
  ctx.shadowColor=powered?cssVar('--amber-hot'):cssVar('--cyan');ctx.shadowBlur=5;
  ctx.fillRect(-size/2,-size/2,size,size);ctx.restore();
}

function fillDoudouOval(x,y,rx,ry){
  ctx.save();ctx.translate(x,y);ctx.scale(rx/ry,1);
  ctx.beginPath();ctx.arc(0,0,ry,0,Math.PI*2);ctx.fill();ctx.restore();
}

/* 正面、背面和侧面不是同一张脸平移：这样一转弯，玩家不用看尾迹也知道朝向。
   powered 会把背影和侧脸的青色块同步换成金色，四个方向都不会漏回普通配色。 */
function drawDirectionalDoudouFace(facing, joy, powered){
  ctx.save();ctx.shadowBlur=0;
  if (facing==='up'){
    ctx.fillStyle=powered?'#d7781d':'#157c86';
    fillDoudouOval(0,-.4,5.6,6.6);
    ctx.strokeStyle=powered?'#fff1a6':'#9fffea';ctx.lineWidth=.85;ctx.lineCap='round';
    ctx.beginPath();ctx.arc(0,-.3,4.1,.15*Math.PI,.85*Math.PI);ctx.stroke();
    drawDoudouDiamond(0,2.2,2.6,powered);
  } else if (facing==='left' || facing==='right'){
    const side=facing==='right'?1:-1;
    /* 向前突出的脸和单眼让左右转向一眼可读；另一只眼被身体挡住。 */
    ctx.fillStyle=powered?'#ffc933':'#45d9c7';
    ctx.beginPath();ctx.arc(side*7.2,-.2,2.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#07152b';fillDoudouOval(side*3.1,-2.1,1.8,2.25);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(side*3.65,-2.75,.55,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=cssVar('--pink');ctx.globalAlpha*=.78;
    ctx.beginPath();ctx.arc(side*5.5,1.35,1.05,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha/= .78;
    ctx.strokeStyle='#123449';ctx.lineWidth=1.15;ctx.lineCap='round';
    ctx.beginPath();
    if (joy>.28) ctx.arc(side*6.7,1.7,1.45,side>0?.55*Math.PI:-.45*Math.PI,side>0?1.45*Math.PI:.45*Math.PI);
    else {ctx.moveTo(side*5.9,1.7);ctx.lineTo(side*7.5,1.55);}
    ctx.stroke();
    drawDoudouDiamond(-side*1.4,4.9,2.15,powered);
  } else {
    [[-3.45,-2.05],[3.45,-2.05]].forEach(([x,y])=>{
      ctx.fillStyle='#07152b';fillDoudouOval(x,y,1.65,2.05);
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-.42,y-.62,.55,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle=cssVar('--pink');ctx.globalAlpha*=.82;
    ctx.beginPath();ctx.arc(-6.2,1.3,1.25,0,Math.PI*2);ctx.arc(6.2,1.3,1.25,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha/= .82;
    if (joy>.28){
      ctx.fillStyle='#4d1235';ctx.beginPath();ctx.arc(0,1.8,1.85,0,Math.PI);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ff739b';ctx.beginPath();ctx.arc(0,2.5,.8,0,Math.PI);ctx.fill();
    } else {
      ctx.strokeStyle='#123449';ctx.lineWidth=1.15;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(0,1.2,2.0,.15*Math.PI,.85*Math.PI);ctx.stroke();
    }
    drawDoudouDiamond(0,5.1,2.5,powered);
  }
  ctx.restore();
}

/* 转弯只有 120ms，靠脸型变化仍可能在高速时一闪而过。两道短弧像角色把空气
   划开，只在转身中段出现；它跟逻辑方向、碰撞体和输入时机完全无关。 */
function drawDoudouTurnSwoosh(turning){
  if (turning<=.08) return;
  const sign=player.visualTurnSign || 1;
  const start=sign>0 ? -.82*Math.PI : .22*Math.PI;
  const end=sign>0 ? -.22*Math.PI : .82*Math.PI;
  ctx.save();
  ctx.globalAlpha*=turning*.38;
  ctx.strokeStyle=cssVar('--cyan');
  ctx.shadowColor=cssVar('--cyan');ctx.shadowBlur=2.5;
  ctx.lineCap='round';
  [[12.2,.9],[9.8,.62]].forEach(([radius,width],i)=>{
    const inset=i*.08*Math.PI;
    ctx.lineWidth=width;
    ctx.beginPath();
    /* 两边都是短的 0.6π 弧；只镜像角度，不反转绘制方向，避免左转绕成长圆。 */
    ctx.arc(0,0,radius,start+inset,end-inset);
    ctx.stroke();
  });
  ctx.restore();
}

/* 大星星不能只改变敌人：豆豆自身先出现一圈紧致金光，配合整只角色换成金色。
   最后 1.8 秒只让这圈光柔和呼吸，不用频闪，也不扩大角色的碰撞视觉。 */
function drawDoudouPowerAura(powered,powerAura){
  if (!powered) return;
  const gold=cssVar('--amber');
  ctx.save();
  ctx.globalAlpha*=.48+.34*powerAura;
  ctx.strokeStyle=gold;ctx.shadowColor=gold;ctx.shadowBlur=5;
  ctx.lineWidth=1.15;
  ctx.beginPath();ctx.arc(0,0,11.7,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff4ad';ctx.shadowBlur=3;
  [[0,-11.8],[11.8,0],[0,11.8],[-11.8,0]].forEach(([x,y])=>{
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);
    ctx.fillRect(-.75,-.75,1.5,1.5);ctx.restore();
  });
  ctx.restore();
}

function drawPlayer(){
  const cxp = player.x*TILE+TILE/2, cyp = player.y*TILE+TILE/2;
  const moving = player.dir.x||player.dir.y;
  const powered = frightTimer > 0;

  // Momentum has to be legible, or a silent speed change just reads as the
  // controls being inconsistent. The trail lengthens and the glow tightens as
  // the player winds up, so "I'm charging" is visible before it's felt.
  const wind = (momentumMult() - 1) / (MOMENTUM_MAX - 1); // 0..1
  if (wind > 0.15 && player.trail && player.trail.length){
    ctx.save();
    const col = player.phase>0 ? cssVar('--phase') : powered ? '#fff1a0' : cssVar('--amber');
    player.trail.forEach((p, i)=>{
      const k = (i + 1) / player.trail.length;      // oldest -> newest
      ctx.globalAlpha = (0.04 + k * 0.14) * wind;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x*TILE+TILE/2, p.y*TILE+TILE/2, TILE*0.42*(0.30 + k*0.30), 0, Math.PI*2);
      ctx.fill();
    });
    ctx.restore();
  }

  /* 吃豆只做一记短促动作。高速时两颗豆间隔约 104ms，动作比它更长就会被
     不停重置，看起来像一直肿着；所以 100ms 内完整收回。 */
  let joy=0;
  if (player.chompT !== undefined && player.chompT < 1){
    player.chompT = Math.min(1, player.chompT + visualFrameDt/CHOMP_SECONDS);
    joy = Math.sin(player.chompT * Math.PI);
  }
  /* 无敌和穿墙都靠"闪"来表示，但原来两处都是**硬切**：穿墙 5Hz、无敌 7Hz，
     在 0.4 和 1 之间跳。WCAG 给的上限是每秒 3 次，而穿墙状态一持续就是 10 秒 ——
     十秒钟的 5Hz 频闪盯着看，人是会不舒服的（业主说"看起来有点晕"，当时我
     只归因到尾迹，其实这里更严重）。
     改成正弦脉动：频率压到 3Hz 以内，下限抬高，信息一点没少 —— 穿墙本来就已经
     整个换成青色了，闪只是补充；无敌那 2.4 秒仍然明显在呼吸。
     用 sin 而不是方波，是因为方波的边沿本身就是刺激源，同样频率下方波比正弦
     难受得多。 */
  const pulse = (hz, lo) => lo + (1 - lo) * (0.5 + 0.5 * Math.sin(elapsed * hz * 2 * Math.PI));
  /* 步态跟走过的距离绑定，而不是跟屏幕刷新率或绝对时间绑定。
     同一段路在 30/60/120Hz 上都是同样两三步，高关跑快时动作才自然加快。 */
  const gaitPhase = player.distTravelled * Math.PI * 2 / PLAYER_GAIT_TILES;
  const stride = moving ? Math.sin(gaitPhase) : 0;
  const hop = moving ? -Math.abs(stride)*PLAYER_HOP_PX : 0;
  const sway = moving ? stride*PLAYER_SWAY_PX : 0;
  const leanTarget = player.dir.x*PLAYER_LEAN_RAD;
  if (!Number.isFinite(player.visualLean)) player.visualLean=0;
  player.visualLean += (leanTarget-player.visualLean) * (1-Math.exp(-visualFrameDt*14));
  /* 能量星的金色优先级最高；若同时拥有相位能力，外层青色状态环仍会保留。 */
  const body = powered ? cssVar('--amber') : player.phase>0 ? cssVar('--phase') : cssVar('--lantern');
  const powerEnding = powered && frightTimer < 1.8;
  const powerAura = powerEnding ? pulse(GHOST_WARNING_HZ,.35) : 1;
  const facing = updateDoudouFacing();
  const turning = player.visualTurnT < 1 ? Math.sin(player.visualTurnT*Math.PI) : 0;
  ctx.save();
  ctx.translate(cxp-player.dir.y*sway,
                cyp+player.dir.x*sway*.35+hop-joy*.45);
  ctx.rotate(player.visualLean+player.visualTurnSign*turning*.06);
  /* 吃豆时微微收窄；转身中段再压窄一点，侧身变化能被眼睛捕捉到。 */
  ctx.scale((1-joy*.018)*(1-turning*.14),(1+joy*.025)*(1+turning*.035));
  ctx.globalAlpha = player.phase > 0 ? pulse(PHASE_PULSE_HZ, 0.62)
                  : invuln > 0       ? pulse(INVULN_PULSE_HZ, 0.45)
                  : 1;

  /* 手脚先画在身体后面，轮廓不超过半格，碰撞判定不变。 */
  drawDoudouPowerAura(powered,powerAura);
  drawDoudouTurnSwoosh(turning);
  drawDoudouTail(facing,powered);
  ctx.fillStyle=powered?'#d97920':'#168f96';
  ctx.beginPath();ctx.arc(-6.1,7.7,2.7,0,Math.PI*2);ctx.arc(6.1,7.7,2.7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=body;
  ctx.beginPath();ctx.arc(-9.1,1.5,2.35,0,Math.PI*2);ctx.arc(9.1,1.5,2.35,0,Math.PI*2);ctx.fill();

  ctx.shadowColor=body;ctx.shadowBlur=6+wind*8;
  ctx.beginPath();
  ctx.moveTo(0,-9.1);
  ctx.bezierCurveTo(6.4,-9.2,9.5,-4.9,9.2,1.2);
  ctx.bezierCurveTo(8.9,7.4,5.3,9.3,0,9.25);
  ctx.bezierCurveTo(-5.3,9.3,-8.9,7.4,-9.2,1.2);
  ctx.bezierCurveTo(-9.5,-4.9,-6.4,-9.2,0,-9.1);
  ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle=powered?'rgba(255,249,215,.96)':'rgba(207,255,247,.72)';ctx.lineWidth=.72;
  ctx.stroke();

  /* 三片能量芽是 Doudou 的剪影识别点。 */
  ctx.shadowBlur=5;ctx.fillStyle=powered?'#fff0a0':'#78f3bc';
  [[0,-10.1,1.7,3.1,0],[-3,-9.4,1.55,2.7,-.65],[3,-9.4,1.55,2.7,.65]].forEach(([x,y,rx,ry,a])=>{
    ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.scale(rx/ry,1);
    ctx.beginPath();ctx.arc(0,0,ry,0,Math.PI*2);ctx.fill();ctx.restore();
  });

  drawDirectionalDoudouFace(facing,joy,powered);
  if (player.phase>0 || invuln>0){
    ctx.globalAlpha=.82;
    ctx.strokeStyle=player.phase>0?cssVar('--phase'):cssVar('--amber');
    ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(0,0,PLAYER_SPRITE_SIZE*.46,0,Math.PI*2);ctx.stroke();
  }
  drawPlayerBiteSpark(joy);
  ctx.restore();
}

function enemyThreatLevel(g){
  if (g.state!=='chase' || frightTimer>0) return 0;
  const dx=player.x-g.x,dy=player.y-g.y;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const near=Math.max(0,Math.min(1,(ENEMY_THREAT_TILES-dist)/(ENEMY_THREAT_TILES-1)));
  return ENEMY_THREAT_BASE+(1-ENEMY_THREAT_BASE)*near;
}

/* 圆润怪物靠大眼、嘴形和颜色区分，追击态不再给每只套一圈假尖刺。三道短尾流
   放在运动反方向，只表达“它正在扑来”，不会遮住脸或改变碰撞范围。 */
function drawEnemyThreatAura(g,threat,scale){
  if (threat<=0) return;
  const hot=cssVar('--danger');
  let dx=g.dir.x||0,dy=g.dir.y||0;
  if (!dx&&!dy) dy=1;
  const sx=-dy,sy=dx;
  ctx.save();
  ctx.globalAlpha=.22+threat*.28;
  ctx.strokeStyle=hot;ctx.shadowColor=hot;ctx.shadowBlur=3+threat*5;
  ctx.lineWidth=1.15/scale;ctx.lineCap='round';
  ctx.beginPath();
  [-1,0,1].forEach((lane)=>{
    const off=lane*4.2;
    ctx.moveTo(-dx*9+sx*off,-dy*9+sy*off);
    ctx.lineTo(-dx*(14+threat*3)+sx*off*.82,-dy*(14+threat*3)+sy*off*.82);
  });
  ctx.stroke();
  ctx.restore();
}

/* 四只怪物已经各有大小不一的眼睛和脸型。追击时只在角色外画四角锁定框，
   不用额外眉眼盖掉实时转向的黑瞳孔。 */
function drawEnemyThreatFace(g,threat,scale){
  if (threat<=0) return;
  const hot=cssVar('--danger');
  ctx.save();
  const lock=17.2+threat*1.6,arm=3.7;
  ctx.strokeStyle=hot;ctx.globalAlpha=.30+threat*.40;ctx.lineWidth=1/scale;
  ctx.lineCap='round';
  ctx.shadowColor=hot;ctx.shadowBlur=4+threat*6;
  ctx.beginPath();
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>{
    ctx.moveTo(x*lock,y*(lock-arm));ctx.lineTo(x*lock,y*lock);ctx.lineTo(x*(lock-arm),y*lock);
  });
  ctx.stroke();
  ctx.restore();
}

function drawGhost(g){
  const cxp = g.x*TILE+TILE/2, cyp = g.y*TILE+TILE/2;
  /* 颜色在 spawn 时就从 GHOST_DEFS 铺到了 g.color 上，cssVar 自己也有缓存 ——
     不再需要每帧 GHOST_DEFS.find 一次。 */
  let color = cssVar(g.color);
  let eyesOnly=false, dozing=false, edibleVisual=false;
  if (g.state==='eaten'){
    eyesOnly=true;                      // 只剩一根羽毛飘回老巢，不参与变色
  } else if (isEdible(g)){
    edibleVisual=true;
    /* 颜色跟着 isEdible 走，而不是跟着 state。
       按 state==='frightened' 上色时，刚从老巢出来（state 还是 'exiting'）
       的幽灵明明已经可以吃了，却画成原来的颜色 —— 玩家看到一只红幽灵冲出来
       会本能躲开，白白错过。画面必须和判定同源。
       受惊的小夜枭是打瞌睡的奶白色（--doze），最后 1.8 秒以 2Hz 柔和提示。 */
    const ending = frightTimer < 1.8 && Math.sin(elapsed * GHOST_WARNING_HZ * Math.PI * 2) > 0;
    color = ending ? '#ffffff' : cssVar('--doze');
    dozing = !ending;
  }
  const scale = 1;
  const threat = eyesOnly || edibleVisual ? 0 : enemyThreatLevel(g);
  ctx.save();
  ctx.translate(cxp,cyp);
  if (threat>0){
    const lunge=threat*(.28+.22*(.5+.5*Math.sin(elapsed*9)));
    ctx.translate(g.dir.x*lunge,g.dir.y*lunge);
  }
  ctx.scale(scale,scale);
  drawEnemyThreatAura(g,threat,scale);
  const r = TILE*0.42;
  const R = r*.88;
  const spriteMode=edibleVisual?(dozing?'doze':'warning'):'normal';
  if (!eyesOnly && drawCharacterSprite(g.id,ENEMY_SPRITE_SIZE,spriteMode)){
    if (edibleVisual){
      ctx.globalAlpha=.42;
      ctx.fillStyle=dozing?'#bdefff':'#ffffff';
      ctx.beginPath();ctx.arc(0,0,16.2,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
      ctx.strokeStyle='#27305f';ctx.lineWidth=1.9/scale;ctx.lineCap='round';
      [[-4.2,-1.5],[4.2,-1.5]].forEach(([ex,ey])=>{
        ctx.beginPath();ctx.moveTo(ex-2,ey-2);ctx.lineTo(ex+2,ey+2);
        ctx.moveTo(ex+2,ey-2);ctx.lineTo(ex-2,ey+2);ctx.stroke();
      });
    } else {
      drawCharacterTrackingEyes(g,ENEMY_SPRITE_SIZE,threat);
    }
    drawEnemyThreatFace(g,threat,scale);
    ctx.restore();
    return;
  }
  if (!eyesOnly){
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    /* 四种 AI 不只换颜色，轮廓也能一眼认出。这里只是表现层，id 和 AI 状态机完全不动。 */
    if (g.id==='chaser'){
      /* 闪闪：圆润独眼能量兽 + 天线。 */
      ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.strokeStyle=color;ctx.lineWidth=1.8/scale;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(0,-R*.88);ctx.quadraticCurveTo(R*.08,-R*1.18,R*.32,-R*1.16);ctx.stroke();
      ctx.beginPath();ctx.arc(R*.34,-R*1.16,1.35/scale,0,Math.PI*2);ctx.fill();
    } else if (g.id==='ambush'){
      /* 狐狐：两只尖耳与宽额，适合表达“预判截路”。 */
      ctx.beginPath();
      ctx.moveTo(-R*.78,-R*.42);ctx.lineTo(-R*.62,-R*1.08);ctx.lineTo(-R*.18,-R*.78);
      ctx.lineTo(R*.18,-R*.78);ctx.lineTo(R*.62,-R*1.08);ctx.lineTo(R*.78,-R*.42);
      ctx.quadraticCurveTo(R*.92,R*.65,0,R*.92);ctx.quadraticCurveTo(-R*.92,R*.65,-R*.78,-R*.42);
      ctx.closePath();ctx.fill();
    } else if (g.id==='shy'){
      /* 软软：圆角方块身体 + 小芽，跟其他圆形彻底拉开。 */
      ctx.beginPath();
      ctx.moveTo(-R*.78,-R*.78);ctx.quadraticCurveTo(-R,-R*.78,-R,-R*.55);
      ctx.lineTo(-R,R*.62);ctx.quadraticCurveTo(-R,R*.9,-R*.72,R*.9);
      ctx.lineTo(R*.72,R*.9);ctx.quadraticCurveTo(R,R*.9,R,R*.62);
      ctx.lineTo(R,-R*.55);ctx.quadraticCurveTo(R,-R*.78,R*.78,-R*.78);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle=color;
      ctx.save();ctx.translate(-1,-R*.95);ctx.rotate(-.7);ctx.scale(.45,1);
      ctx.beginPath();ctx.arc(0,0,R*.3,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.save();ctx.translate(2,-R*.96);ctx.rotate(.7);ctx.scale(.45,1);
      ctx.beginPath();ctx.arc(0,0,R*.3,0,Math.PI*2);ctx.fill();ctx.restore();
    } else {
      /* 慢慢：水母般的半圆顶和波浪底，对应循环巡逻。 */
      ctx.beginPath();ctx.arc(0,-R*.08,R,Math.PI,0,false);
      ctx.lineTo(R,R*.55);
      for (let i=0;i<4;i++){
        const x0=R-(2*R/4)*i,xm=R-(2*R/4)*(i+.5),x1=R-(2*R/4)*(i+1);
        ctx.quadraticCurveTo(xm,i%2===0?R*.95:R*.56,x1,R*.55);
      }
      ctx.closePath();ctx.fill();
    }
  }
  ctx.shadowBlur=0;
  if (eyesOnly){
    /* 被吃掉后只剩能量核返回老巢，状态读取清楚且不再是幽灵眼睛。 */
    ctx.save();ctx.rotate(elapsed*2.4);
    ctx.fillStyle='#ffffff';ctx.shadowColor=cssVar('--cyan');ctx.shadowBlur=10;
    ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(5,0);ctx.lineTo(0,6);ctx.lineTo(-5,0);ctx.closePath();ctx.fill();
    ctx.strokeStyle=cssVar('--cyan');ctx.lineWidth=1/scale;ctx.stroke();ctx.restore();
  } else if (dozing){
    /* 能量模式统一用“晕晕眼”，轮廓仍保留各自类型。 */
    ctx.strokeStyle = '#26205a';
    ctx.lineWidth = 1.6/scale;
    ctx.lineCap = 'round';
    [[-r*.34,-1],[r*.34,-1]].forEach(([ex,ey])=>{
      ctx.beginPath();ctx.moveTo(ex-2,ey-2);ctx.lineTo(ex+2,ey+2);ctx.moveTo(ex+2,ey-2);ctx.lineTo(ex-2,ey+2);ctx.stroke();
    });
  } else {
    const lookX = g.dir.x, lookY=g.dir.y;
    if (g.id==='chaser'){
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,-1,R*.43,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#1c1744';ctx.beginPath();ctx.arc(lookX*1.5,-1+lookY*1.5,R*.2,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#4f1533';ctx.lineWidth=1.1/scale;ctx.beginPath();ctx.arc(0,R*.47,R*.28,.12*Math.PI,.88*Math.PI);ctx.stroke();
    } else {
      const spread=g.id==='shy'?R*.32:R*.38;
      [[-spread,0],[spread,0]].forEach(([ex,ey])=>{
      ctx.fillStyle='#fff';
      ctx.beginPath();
      /* 老微信基础库没有 ctx.ellipse：用 scale 压出同一个椭圆兜底。 */
      if (typeof ctx.ellipse === 'function'){
        ctx.ellipse(ex,ey-2,4.2,5.2,0,0,Math.PI*2);
      } else {
        ctx.save(); ctx.translate(ex,ey-2); ctx.scale(4.2/5.2,1);
        ctx.arc(0,0,5.2,0,Math.PI*2); ctx.restore();
      }
      ctx.fill();
      ctx.fillStyle = '#26205a';
        ctx.beginPath(); ctx.arc(ex+lookX*1.5, ey-2+lookY*1.5, 2.0,0,Math.PI*2); ctx.fill();
      });
      if (g.id==='ambush'){
        ctx.strokeStyle='#5c2a17';ctx.lineWidth=1.2/scale;
        ctx.beginPath();ctx.moveTo(-R*.65,-R*.52);ctx.lineTo(-R*.14,-R*.36);ctx.moveTo(R*.65,-R*.52);ctx.lineTo(R*.14,-R*.36);ctx.stroke();
      } else if (g.id==='patrol'){
        ctx.strokeStyle='#30205d';ctx.lineWidth=1.3/scale;
        ctx.beginPath();ctx.moveTo(-R*.72,-R*.37);ctx.lineTo(-R*.08,-R*.32);ctx.moveTo(R*.72,-R*.37);ctx.lineTo(R*.08,-R*.32);ctx.stroke();
      }
    }
    drawEnemyThreatFace(g,threat,scale);
  }
  ctx.restore();
}

function render(){
  /* 说明整屏盖着时，底下这一整套（迷宫、幽灵、主角、各种条）画了也看不见。
     每帧白烧一次，在弱一点的手机上就是实打实的掉帧 —— 而掉帧的直接后果，
     就是点按钮之后要等下一帧才有反应。 */
  if (docPanelOpen()) return;
  applyMazeTransform();
  drawMaze();
  drawFruit();
  ghosts.forEach(drawGhost);
  drawPlayer();
  drawFrightBar();
  drawPhaseBar();
  drawSwipeHint();
  drawDeathFlash();
  drawLevelIntro();
  updateComboBar();   // 倒计时条要每帧动，而 updateHud 只在得分时触发
  syncChrome();
}

/**
 * 能量豆剩余时间。
 *
 * 六关都是 9 秒；倒计时条让玩家能判断"还够不够追那只"，不必只靠最后的闪烁。
 *
 * 画在棋盘顶端而不是 HUD 里：追幽灵的时候视线在棋盘上，扫一眼 HUD 的代价
 * 恰恰是最紧张的那半秒。
 */
function drawFrightBar(){
  if (frightTimer <= 0) return;
  const total = frightSeconds();
  const left = Math.max(0, Math.min(1, frightTimer / total));
  const h = 5, pad = TILE * 0.6;
  const w = (COLS*TILE - pad*2) * left;
  ctx.save();
  ctx.globalAlpha = 0.9;
  // 最后 1.5 秒转红，和幽灵开始闪白同步，两个信号互相印证
  ctx.fillStyle = frightTimer < 1.5 ? cssVar('--danger') : cssVar('--cyan');
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
  ctx.fillRect(pad, 3, w, h);
  ctx.restore();
}

/* 穿墙的倒计时。
   能量豆有条，穿墙却什么都没有——而穿墙恰恰是最需要计时的一个：它彻底改写了
   "墙不能过"这条规则，玩家会一头扎进墙里绕远路，效果一到期人就卡死在墙中间
   （靠 rescueFromWall 救出来，但那一下很懵）。给它一条自己的条，画在恐惧条
   下面一点，颜色用主角穿墙时的青色，两者同时生效也不会混。 */
function drawPhaseBar(){
  if (player.phase <= 0) return;
  const left = Math.max(0, Math.min(1, player.phase / FRUIT_PHASE_SECONDS));
  const h = 4, pad = TILE * 0.6;
  const w = (COLS*TILE - pad*2) * left;
  const y = frightTimer > 0 ? 11 : 3;   // 两条都在时不要叠在一起
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = player.phase < 2 ? cssVar('--danger') : cssVar('--mega');
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
  ctx.fillRect(pad, y, w, h);
  ctx.restore();
}

/* ---------- main loop ---------- */
let lastT = performance.now();
let visualFrameDt = 1/60;
/* 一帧要做的事全在这儿，loop 只负责算 dt 和排下一帧。
 *
 * 抽出来是为了让测试能跑**同一份代码**。之前测试里手抄了一份一模一样的
 * tick()，结果是：把这里的分支删掉，测试照样全绿 —— 它测的是自己那份抄件。
 * 同样的坑连着踩了三次（syncChrome、键盘作用域、死亡定格），根子都是
 * "测试验的不是真实路径"。共用一个函数，这类假绿就不可能再发生。 */
function stepFrame(dt){
  visualFrameDt = Math.max(0,Math.min(0.05,dt));
  // Pause can arrive between frames. Keep the DOM controls in sync even when
  // the static canvas does not need repainting.
  syncChrome();
  const wasPlaying = gameState === 'playing';
  const hadDeathFlash = deathFlash > 0;
  if (gameState==='playing'){
    if (joystickHeldDir) requestDir(joystickHeldDir);
    // 关卡卡片期间整局冻住：不跑 update，elapsed 就不走，幽灵、恐惧倒计时、
    // 复活计时全部停在原地。玩家有个空拍看清这是哪一关。
    if (introTimer > 0) introTimer -= dt;
    else if (deathPause > 0) deathPause -= dt;   // 死亡定格，幽灵一起停
    else update(dt);
  }
  // 红闪自己走，不受定格影响 —— 它就是用来填这段定格的
  if (deathFlash > 0) deathFlash -= dt;
  if (wasPlaying || gameState==='playing' || hadDeathFlash || deathFlash>0 || staticFrameDirty){
    render();
    staticFrameDirty = false;
  }
}

function loop(t){
  const dt = Math.min(0.033, (t-lastT)/1000);
  lastT = t;
  stepFrame(dt);
  requestAnimationFrame(loop);
}

fullNewGame();
// Web-only adapter. Native WeChat builds keep their existing local scoreboard.
window.NeonGame = {
  cloud: CloudLeaderboard,
  recentScores: recentScoreState,
  playerId: getPlayerId,
  name: loadName,
  saveName: name => {
    const cleaned=cleanName(name); saveName(cleaned);
    if (lastCloudEntry) lastCloudEntry.name = cleaned;
    if (lastRunId) {renameScore(lastRunId,cleaned);renderScoreboard('overBoard',lastRunId);}
  },
  state: () => gameState,
  practice: () => !!practiceLevel,
  pause: () => { if (gameState === 'playing') togglePause(); },
  challenge: () => {
    if (gameState === 'paused') document.getElementById('resumeBtn').click();
    else if (gameState === 'ready') document.getElementById('startBtn').click();
    else if (gameState === 'over') {
      practiceLevel = 0; dailyRun = false;
      document.getElementById('restartBtn').click();
    }
  },
};
// 占位预览只验证版式；真正广告接入必须另行实现并重新做政策/误触检查。
(function initAdPlaceholder(){
  try {
    const cfg = window.NEON_MAZE_CONFIG && window.NEON_MAZE_CONFIG.ads;
    if (!cfg || cfg.showPlaceholders !== true) return;
    const slot = document.getElementById('adSlotRail');
    if (!slot) return;
    slot.classList.remove('hidden');
    slot.setAttribute('aria-hidden','false');
  } catch (e) {}
})();
renderScoreboard('startBoard');
renderBest(); renderWelcome();
renderLevelSelect();
renderDaily();
renderChallengeBanner();
requestAnimationFrame(loop);

  // 供外壳驱动的入口。用 getter 是因为 gameState / level / score 这些是会
  // 变的顶层变量，直接取值只会拿到创建那一刻的快照。
  return {
    get gameState(){ return gameState; },
    set gameState(v){ gameState = v; },
    get level(){ return level; },
    get score(){ return score; },
    get lives(){ return lives; },
    get combo(){ return combo; },
    get player(){ return player; },
    get ghosts(){ return ghosts; },
    MAX_LEVEL,
    requestDir, togglePause, fullNewGame, render, update, Audio2, releaseCaches,
    renderScoreboard, loadScores, recordScore, renameScore, cleanName,
    // 玩法说明的开关。小游戏的 game.js 会调它们来响应「?」和「知道了」——
    // 漏导出的话点下去就是 undefined is not a function，游戏直接崩。
    openHelp, closeHelp, openAbout, closeAbout,
    commitName,
    // 挑战：微信两版没有 URL，只能由外壳从启动参数传进来
    setChallenge,
    // 练习模式。外壳自己画那排关卡按钮（小游戏没有 DOM，core 里 renderLevelSelect
    // 挂的那些 click 监听在垫片上根本不会触发），所以点中之后要能直接调进来。
    // maxLevelReached 一起导出：哪几关解锁了只有逻辑层知道。
    startPractice, maxLevelReached,
    /* 每日挑战 + 对手图鉴。外壳同样是自己画的，点中之后要能调进来。
       openOwl 还负责在打开前重画一次图鉴内容（renderOwlList），漏了它外壳
       就会显示上一次的战绩 —— 而战绩每局都在变。
       owlCodexView 直接给结构化数据：不让外壳去正则拆 owlList 的 innerHTML，
       那等于把「HTML 长什么样」当成一份没人声明过的接口。 */
    startDaily, openOwl, closeOwl,
    renderDaily, renderLevelSelect,
    owlCodexView,
  };
}

module.exports = { createGame };
