// Source guards only; actual scroll geometry is verified in the browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toEnglish} from './i18n_en.mjs';
const html=readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
function rule(selector,source=css){
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=source.match(new RegExp('(?:^|\\n)'+escaped+'\\s*\\{([^}]*)\\}'));
  assert(match,'Missing '+selector);return match[1];
}
let passed=0;
function check(name,fn){fn();passed++;console.log('✓ '+name);}
check('start card has one scroll axis and preserves access to lower controls',()=>{
  const card=rule('.start-card');
  for(const property of ['overflow-x:hidden','overflow-y:auto','overscroll-behavior-x:none','overscroll-behavior-y:contain','touch-action:pan-y'])assert(card.includes(property),property);
  assert.doesNotMatch(card,/(?:^|;)\s*overflow\s*:/);
});
check('centred flex children cannot grow outside the card or collapse vertically',()=>{
  const children=rule('#startOverlay .start-card > *');
  for(const property of ['min-width:0','max-width:100%','flex-shrink:0'])assert(children.includes(property),property);
});
check('English daily challenge labels wrap instead of creating a horizontal scroll range',()=>{
  assert.match(rule('.daily'),/flex-wrap:wrap/);
  for(const property of ['max-width:100%','white-space:normal','overflow-wrap:anywhere'])assert(rule('.daily > span').includes(property),property);
});
check('personal record and secondary controls can wrap on narrow screens',()=>{
  assert.match(rule('.best-line'),/flex-wrap:wrap/);
  assert.match(rule('.start-tools'),/flex-wrap:wrap/);
  assert.match(rule('.start-tools .help-pill'),/min-height:44px/);
});
check('short landscape cards also scroll vertically from an accessible top edge',()=>{
  const compact=css.match(/#startOverlay \.start-card\{[^}]*width:calc\(100% - 12px\)[^}]*\}/);
  assert(compact);
  assert.match(compact[0],/overflow-x:hidden;overflow-y:auto;justify-content:flex-start/);
  assert.doesNotMatch(compact[0],/overflow:hidden|justify-content:center/);
});
check('start actions do not inherit the result footer offset; result footer is unchanged',()=>{
  assert.match(rule('#startOverlay .start-actions'),/bottom:auto;padding:0/);
  assert.match(rule('.over-actions'),/position:sticky/);
  assert.match(rule('.over-actions'),/bottom:calc\(-1 \* var\(--ov-pad, 20px\)\)/);
});
check('English receives the same menu layout rules; other translated CSS text is allowed',()=>{
  const englishCss=toEnglish(html).match(/<style>([\s\S]*?)<\/style>/)[1];
  const declarations=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').trim();
  for(const selector of ['.start-card','#startOverlay .start-card > *','#startOverlay .start-actions','.daily','.daily > span','.best-line','.start-tools']){
    assert.equal(declarations(rule(selector,englishCss)),declarations(rule(selector)),selector);
  }
});
console.log(`Start menu layout guards: ${passed}/${passed} passed (browser geometry tested separately).`);
