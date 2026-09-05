import assert from 'node:assert/strict';
import {boot,noop} from './hall_test_harness.mjs';
const make=()=>boot({enabled:false,withBridge:false,mutate:s=>
  'window.innerWidth=390;window.PointerEvent=function(){};\n'+s+
  '\nwindow.inputTest={gameHasKeyboard,get pointer(){return joystickPointerId;},get held(){return joystickHeldDir;}};'});
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('✓ '+name);}catch(e){failed++;console.error('✗ '+name+': '+e.message);}}
const key=(a,key,extra={})=>a.win.emit('keydown',{key,preventDefault:noop,...extra});
check('holding P pauses once instead of repeatedly toggling',()=>{
  const a=make();a.el('startBtn').click();key(a,'p');assert.equal(a.game.state,'paused');
  for(let i=0;i<10;i++){key(a,'p',{repeat:true});assert.equal(a.game.state,'paused');}
});
check('holding Enter cannot resume a paused run',()=>{
  const a=make();a.el('startBtn').click();key(a,'p');key(a,'Enter',{repeat:true});assert.equal(a.game.state,'paused');
});
check('Enter on a real UI button does not also start a game',()=>{
  const a=make(),button=a.el('muteBtn');button.tagName='BUTTON';button.focus();
  key(a,'Enter',{target:button});assert.equal(a.game.state,'ready');
});
check('Space on a UI button retains native button activation',()=>{
  const a=make(),button=a.el('muteBtn');button.tagName='BUTTON';button.focus();let blocked=false;
  key(a,' ',{target:button,preventDefault(){blocked=true;}});assert.equal(blocked,false);
});
check('select and editable text retain their navigation keys',()=>{
  const a=make();
  for(const target of [{tagName:'SELECT'},{tagName:'DIV',isContentEditable:true}]){
    a.doc.activeElement=target;assert.equal(a.win.inputTest.gameHasKeyboard(),false);
  }
});
check('direction auto-repeat still refreshes the existing turn buffer',()=>{
  const a=make();a.el('startBtn').click();a.doc.activeElement={tagName:'BODY'};
  key(a,'ArrowRight',{repeat:true});assert.deepEqual(a.game.player.want,{x:1,y:0});
});
function hold(a){a.el('startBtn').click();a.el('touchJoystick').dispatch('pointerdown',{
  pointerType:'touch',isPrimary:true,pointerId:11,clientX:100,clientY:50,preventDefault:noop});
  assert.equal(a.win.inputTest.pointer,11);}
check('rotation clears held direction and pointer ownership',()=>{
  const a=make();hold(a);a.win.emit('orientationchange');
  assert.equal(a.win.inputTest.pointer,null);assert.equal(a.win.inputTest.held,null);
});
check('viewport width changes clear touch input; browser-bar height changes do not',()=>{
  const a=make();hold(a);a.win.emit('resize');assert.equal(a.win.inputTest.pointer,11);
  a.win.innerWidth=844;a.win.emit('resize');assert.equal(a.win.inputTest.pointer,null);
});
console.log(`Input safety: ${passed} passed, ${failed} failed (isolated event/DOM tests, not phone input-latency measurements).`);
if(failed)process.exitCode=1;
