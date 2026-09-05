// Source guards only; actual scroll geometry is verified in the browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toEnglish} from './i18n_en.mjs';
const html=readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
function rule(selector,source=css){
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=source.match(new RegExp('(?:^|\\n)\\s*'+escaped+'\\s*\\{([^}]*)\\}'));
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
check('daily challenge and all seven practice controls stay in a single grid row',()=>{
  assert.match(rule('.daily'),/display:grid/);
  assert.match(rule('.daily'),/grid-template-columns:auto minmax\(3\.8ch,1fr\) minmax\(0,max-content\) auto/);
  assert.match(rule('.levelsel'),/repeat\(6,minmax\(24px,1fr\)\) 38px/);
  for(const property of ['min-width:0','max-width:100%','white-space:nowrap'])assert(rule('.daily > span').includes(property),property);
  assert.match(rule('.daily-go'),/min-height:28px/);
  assert.match(rule('.levelsel .lv'),/min-width:24px;height:38px/);
});
check('compact mode follows the actual card width and never hides action buttons',()=>{
  assert.match(rule('.start-card'),/container: start-menu \/ inline-size/);
  assert.match(css,/@container start-menu \(max-width:340px\)/);
  assert.match(rule('.daily-level-name,.daily-best-prefix'),/display:none/);
  assert.match(css,/@container start-menu \(max-width:280px\)/);
  assert.match(rule('.levelsel-label'),/clip-path:inset\(50%\)/);
  assert.doesNotMatch(rule('.levelsel-label'),/display:none|visibility:hidden/);
});
check('English menu uses concise copy while retaining full challenge and level titles',()=>{
  const english=toEnglish(html);
  assert(english.includes('title="DAILY CHALLENGE">DAILY</span>'));
  assert(english.includes('<span class="daily-level-number">Lv. ${lv}</span>'));
  assert(english.includes('title="Level ${lv} · ${levelName(lv)}"'));
  assert(english.includes('<span class="daily-best-prefix">Best </span>'));
  assert(english.includes('<span class="levelsel-label">PRACTICE </span>'));
  assert.doesNotMatch(english,/Not played today/);
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
  for(const selector of ['.start-card','#startOverlay .start-card > *','#startOverlay .start-actions','.daily','.daily > span','.levelsel','.levelsel .lv','.best-line','.start-tools']){
    assert.equal(declarations(rule(selector,englishCss)),declarations(rule(selector)),selector);
  }
});
console.log(`Start menu layout guards: ${passed}/${passed} passed (browser geometry tested separately).`);
