import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boot,noop} from './hall_test_harness.mjs';
const KEY='doudou.presentation.v1';
const prefix=`
 const __clock={t:0,now(){return this.t;}};
 const __stats={frequency:[],gains:[],random:0};
 const Math=Object.create(globalThis.Math);Math.random=()=>{__stats.random++;return .5;};
 const __motion={matches:false,addEventListener(type,fn){this.listener=fn;}};
 window.matchMedia=()=>__motion;
 window.AudioContext=class {currentTime=0;state='running';destination={};resume(){}
   createOscillator(){return {frequency:{setValueAtTime:v=>__stats.frequency.push(v),exponentialRampToValueAtTime:v=>__stats.frequency.push(v)},connect:x=>x,start(){},stop(){},disconnect(){}};}
   createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime:v=>__stats.gains.push(v)},connect:x=>x,disconnect(){}};}
 };
`;
const suffix=`
 window.presentationTest={normalizePresentation,setPresentation,openPreferences,closePreferences,openHelp,openOwl,openAbout,
   prefersReducedMotion,docPanelOpen,Audio2,enemyMark,emitFeedback,drawFeedback,clearFeedback,resetLevel,
   clock:__clock,stats:__stats,motion:__motion,
   get prefs(){return presentation;},get particles(){return feedbackParticles;},get shake(){return shakeUntil;},
   physics(){return JSON.stringify({score,combo,comboTimer,elapsed,frightTimer,level,lives,
     player:[player.x,player.y,player.phase,player.speed,player.dir,player.want],
     ghosts:ghosts.map(g=>[g.x,g.y,g.speed,g.state,g.dir])});}};
`;
function make(options={}){const a=boot({enabled:false,withBridge:false,...options,
  mutate:s=>prefix+s.replaceAll('performance.now()','__clock.now()')+suffix});return {...a,t:a.win.presentationTest};}
let count=0;
function check(name,fn){fn();count++;console.log('✓ '+name);}
check('defaults retain original audio gain and system motion choice',()=>{
  const a=make();assert.deepEqual(a.t.prefs,{colorAssist:false,reduceMotion:'system',screenShake:true,effectVolume:1,alertVolume:1});
  a.t.Audio2.pellet(0);assert(a.t.stats.gains.some(v=>Math.abs(v-.115)<1e-9));
});
check('legacy mute remains authoritative over both channels',()=>{
  const a=make({storage:new Map([['doudou.muted.v1','1']])});
  assert(a.t.Audio2.isMuted());a.t.Audio2.pellet(0);a.t.Audio2.comboMilestone(200);assert.equal(a.t.stats.frequency.length,0);
});
check('zero regular volume does not silence important cues, and vice versa',()=>{
  const a=make(),t=a.t;t.setPresentation('effectVolume',0);t.Audio2.pellet(0);t.Audio2.warp();assert.equal(t.stats.frequency.length,0);
  t.Audio2.comboMilestone(200);assert.equal(t.stats.frequency.length,10);
  t.setPresentation('alertVolume',0);const n=t.stats.frequency.length;t.Audio2.phaseTick(1);t.Audio2.death();assert.equal(t.stats.frequency.length,n);
  t.setPresentation('effectVolume',1);t.Audio2.warp();assert(t.stats.frequency.length>n);
  assert(t.stats.gains.every(v=>Number.isFinite(v)&&v>0));
});
check('bad types cannot become NaN gains; valid numbers are bounded',()=>{
  const t=make().t;
  assert.deepEqual(t.normalizePresentation({colorAssist:'yes',reduceMotion:'unexpected',screenShake:null,effectVolume:'bad',alertVolume:NaN}),
    {colorAssist:false,reduceMotion:'system',screenShake:true,effectVolume:1,alertVolume:1});
  assert.equal(t.normalizePresentation({effectVolume:-5}).effectVolume,0);
  assert.equal(t.normalizePresentation({alertVolume:5}).alertVolume,1);
});
check('settings persist without changing identity or game state',()=>{
  const a=make(),before=a.t.physics(),id=a.win.NeonGame.playerId();
  a.t.setPresentation('colorAssist',true);a.t.setPresentation('effectVolume',.35);
  assert.equal(a.t.physics(),before);assert.equal(a.win.NeonGame.playerId(),id);
  const b=make({storage:a.storage});assert.equal(b.t.prefs.effectVolume,.35);assert.equal(b.t.prefs.colorAssist,true);
});
check('a stale tab updates only its chosen field and preserves newer choices',()=>{
  const storage=new Map(),a=make({storage}),b=make({storage});
  a.t.setPresentation('effectVolume',.4);b.t.setPresentation('colorAssist',true);
  assert.equal(JSON.parse(storage.get(KEY)).effectVolume,.4);
  a.win.emit('storage',{key:KEY});assert.equal(a.t.prefs.colorAssist,true);
});
check('corrupt JSON is backed up and does not prevent startup',()=>{
  const a=make({storage:new Map([[KEY,'{bad']])});assert.equal(a.t.prefs.effectVolume,1);
  assert([...a.storage.keys()].some(k=>k.startsWith(KEY+'.corrupt.')));
});
check('blocked storage keeps all session choices and reports that they were not saved',()=>{
  const a=make({storageIO:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}}});
  a.t.setPresentation('colorAssist',true);a.t.setPresentation('effectVolume',.2);
  assert.equal(a.t.prefs.colorAssist,true);assert.equal(a.t.prefs.effectVolume,.2);assert.match(a.el('prefsStatus').textContent,/仅本次生效/);
});
check('system motion changes and manual reduction both stop particles and shake',()=>{
  const a=make(),t=a.t;t.emitFeedback('counter',5,5);assert(t.particles.length>0);
  t.motion.matches=true;t.motion.listener();assert(t.prefersReducedMotion());assert.equal(t.particles.length,0);assert.equal(t.shake,0);
  assert(a.doc.body.classList.contains('reduce-motion'));
  t.motion.matches=false;t.motion.listener();assert(!t.prefersReducedMotion());
  t.setPresentation('reduceMotion','reduce');assert(t.prefersReducedMotion());t.emitFeedback('warp',5,5);assert.equal(t.particles.length,0);
});
check('settings opened in play pause safely and do not resume on close',()=>{
  const a=make();a.el('startBtn').click();a.game.stepFrame(1/60);a.el('pausePrefsBtn').focus();
  const before=a.t.physics();a.t.openPreferences();assert.equal(a.game.state,'paused');
  assert(a.t.docPanelOpen());assert.equal(a.doc.activeElement,a.el('prefsOverlay'));
  a.game.stepFrame(.1);assert.equal(a.t.physics(),before);
  a.win.emit('keydown',{key:'Escape',preventDefault:noop});assert.equal(a.game.state,'paused');
  assert.equal(a.doc.activeElement,a.el('pausePrefsBtn'));
});
check('settings and existing documents are mutually exclusive',()=>{
  const a=make();for(const name of ['openPreferences','openHelp','openPreferences','openOwl','openPreferences','openAbout']){
    a.t[name]();assert.equal(['prefsOverlay','helpOverlay','owlOverlay','aboutOverlay'].filter(id=>!a.el(id).classList.contains('hidden')).length,1);
  }
});
check('Tab boundaries keep keyboard focus within settings',()=>{
  const a=make();a.t.openPreferences();
  for(const [from,shift,to] of [['prefsOverlay',false,'prefColor'],['prefColor',true,'prefsCloseBtn'],['prefsCloseBtn',false,'prefColor']]){
    a.el(from).focus();let prevented=false;a.el('prefsOverlay').dispatch('keydown',{key:'Tab',shiftKey:shift,preventDefault(){prevented=true;}});
    assert(prevented);assert.equal(a.doc.activeElement,a.el(to));
  }
});
check('feedback is bounded, expires, and consumes no gameplay randomness',()=>{
  const a=make(),t=a.t,physics=t.physics(),random=t.stats.random;
  for(let i=0;i<30;i++)t.emitFeedback('counter',5,5);
  assert.equal(t.particles.length,48);assert.equal(t.stats.random,random);assert.equal(t.physics(),physics);
  assert(t.particles.every(p=>[p.x,p.y,p.vx,p.vy,p.born].every(Number.isFinite)));
  t.clock.t=300;t.drawFeedback();assert.equal(t.particles.length,0);assert.equal(t.shake,0);
});
check('disabling shake preserves particles, and a new level clears them',()=>{
  const t=make().t;t.setPresentation('screenShake',false);t.emitFeedback('phase',5,5);
  assert.equal(t.shake,0);assert.equal(t.particles.length,8);t.resetLevel(false);assert.equal(t.particles.length,0);
});
check('enemy markings follow the four existing behavior IDs',()=>{
  const t=make().t;assert.deepEqual(['chaser','ambush','shy','patrol'].map(t.enemyMark),['A','B','C','D']);
  const s=readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
  assert.match(s,/drawContrastMark\(ch,0,0\)/);assert.match(s,/drawContrastMark\(enemyMark\(g.id\),10,11\)/);
  assert(s.includes('body.color-assist .enemy-choice[data-enemy]{position:relative;}'),'DOM markers must anchor to their own enemy buttons');
  assert(!s.includes('body.color-assist .enemy-choice::before'),'do not add an empty marker to the codex entrance');
});
console.log(`Presentation: ${count}/${count} checks passed; browser visuals and real device timing are separate gates.`);
