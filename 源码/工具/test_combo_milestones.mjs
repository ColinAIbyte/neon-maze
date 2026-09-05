// Real source execution, no cloud traffic or production debug hooks.
import assert from 'node:assert/strict';
import {boot} from './hall_test_harness.mjs';
let passed=0;
const prefix=`
 const __samples={frequency:[],gain:[],sounds:[],randomCalls:0};
 const Math=Object.create(globalThis.Math);
 Math.random=()=>{__samples.randomCalls++;return 0.5;};
 window.AudioContext=class {
   currentTime=0;state='running';destination={};resume(){}
   createOscillator(){return {frequency:{setValueAtTime:v=>__samples.frequency.push(v),
     exponentialRampToValueAtTime:v=>__samples.frequency.push(v)},connect:x=>x,start(){},stop(){},disconnect(){}};}
   createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime:v=>__samples.gain.push(v)},connect:x=>x,disconnect(){}};}
 };
`;
const suffix=`
 const __realMilestone=Audio2.comboMilestone;
 Audio2.comboMilestone=m=>{__samples.sounds.push(m);__realMilestone(m);};
 window.milestoneTest={samples:__samples,Audio2,checkComboMilestone,update,sustainCombo,setPresentation,
  fire:m=>{fxRunning=false;startComboFx(m);},
  get particles(){return fxParticles;},
  set combo(v){combo=v;},get combo(){return combo;},
  set timer(v){comboTimer=v;},get timer(){return comboTimer;},
  get hit(){return comboMilestoneHit;}};
`;
function app(mutator=s=>s){const a=boot({enabled:false,withBridge:false,mutate:s=>prefix+mutator(s)+suffix});return {...a,t:a.win.milestoneTest};}
function run(mutator=s=>s,quiet=false){
 let n=0;
 const check=(name,fn)=>{fn();n++;if(!quiet)console.log('✓ '+name);};
 check('10/20/50 and every 50 afterwards, with no artificial ceiling',()=>{
   const a=app(mutator),t=a.t;
   for(let c=1;c<=251;c++){t.combo=c;t.checkComboMilestone();t.checkComboMilestone();}
   assert.deepEqual(t.samples.sounds,[10,20,50,100,150,200,250]);
   t.combo=1_000_000;t.checkComboMilestone();
   assert.equal(t.samples.sounds.at(-1),1_000_000);
   assert.equal(t.samples.sounds.length,8,'large jump reports one milestone, not every skipped tier');
 });
 check('strict boundary checks do not round early or repeat an already-reported threshold',()=>{
   for(const m of [10,20,50,100,150,200,10000]){
     const a=app(mutator),t=a.t;t.combo=m-1;t.checkComboMilestone();const count=t.samples.sounds.length;
     t.combo=m;t.checkComboMilestone();assert.equal(t.samples.sounds.length,count+1);assert.equal(t.hit,m);
     t.combo=m+1;t.checkComboMilestone();assert.equal(t.samples.sounds.length,count+1);
   }
 });
 check('a real timeout preserves per-run deduplication; a new run resets it',()=>{
   const a=app(mutator),t=a.t;t.combo=100;t.checkComboMilestone();t.timer=.001;
   t.update(.01);assert.equal(t.combo,1);t.combo=100;t.checkComboMilestone();
   assert.deepEqual(t.samples.sounds,[100]);
   a.game.fullNewGame();t.combo=100;t.checkComboMilestone();assert.deepEqual(t.samples.sounds,[100,100]);
 });
 check('real sustain path emits 100 without modifying its window or score',()=>{
   const a=app(mutator),t=a.t;t.combo=99;const score=a.game.score;
   t.sustainCombo();assert.equal(t.combo,100);assert.deepEqual(t.samples.sounds,[100]);
   assert.equal(a.game.score,score);assert(Math.abs(t.timer-2.75)<1e-9);
 });
 check('all high-tier frequencies are finite and high-tier note counts stay bounded',()=>{
   for(const m of [50,100,150,200,10000,1_000_000]){
     const a=app(mutator),t=a.t;t.Audio2.comboMilestone(m);
     assert.equal(t.samples.frequency.length,10);
     assert(t.samples.frequency.every(v=>Number.isFinite(v)&&v>0&&v<24000));
     assert(t.samples.gain.every(Number.isFinite));
   }
 });
 check('muting suppresses notes but preserves milestone detection',()=>{
   const a=app(mutator),t=a.t;t.Audio2.setMuted(true);t.combo=200;t.checkComboMilestone();
   assert.deepEqual(t.samples.sounds,[200]);assert.equal(t.samples.frequency.length,0);
 });
 check('reduced motion skips particles but still reports the achieved milestone',()=>{
   const a=app(mutator),t=a.t;t.setPresentation('reduceMotion','reduce');
   t.combo=200;t.checkComboMilestone();assert.deepEqual(t.samples.sounds,[200]);assert.equal(t.particles.length,0);
 });
 check('new milestones use at most 26 particles and no gameplay random calls',()=>{
   const a=app(mutator),t=a.t;
   for(const m of [100,200,10000]){
     const before=t.samples.randomCalls;t.fire(m);assert.equal(t.samples.randomCalls,before);
     assert.equal(t.particles.length,26);assert(t.particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.vx)));
   }
 });
 check('existing low milestones preserve their previous visual random-call budget',()=>{
   const a=app(mutator),t=a.t;const before=t.samples.randomCalls;t.fire(50);
   assert.equal(t.samples.randomCalls-before,26*6);
 });
 check('non-finite values cannot reach the sound engine',()=>{
   const a=app(mutator),t=a.t;
   for(const value of [NaN,Infinity,-Infinity]){t.combo=value;t.checkComboMilestone();}
   assert.equal(t.samples.sounds.length,0);
 });
 return n;
}
passed=run();
const mutants=[
 ['stop at 50',s=>s.replace('Math.floor(combo / COMBO_MILESTONE_STEP) * COMBO_MILESTONE_STEP','50')],
 ['early threshold',s=>s.replace('Math.floor(combo / COMBO_MILESTONE_STEP)','Math.ceil(combo / COMBO_MILESTONE_STEP)')],
 ['repeat threshold',s=>s.replace('m <= comboMilestoneHit','m < comboMilestoneHit')],
 ['unbounded audio index',s=>s.replace('m>=50 ? 2 : m>=20 ? 1 : 0','Math.floor(m / 50)')],
 ['extra gameplay randomness',s=>s.replace('milestone > 50 ? visualRandom : Math.random','Math.random')],
];
for(const [name,mutate] of mutants){assert.throws(()=>run(mutate,true),undefined,'surviving mutant: '+name);}
console.log(`Milestones: ${passed}/${passed} checks; ${mutants.length}/${mutants.length} in-memory mutants rejected.`);
