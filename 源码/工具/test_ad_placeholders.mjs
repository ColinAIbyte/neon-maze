import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
const config = readFileSync(new URL('../../config.js',import.meta.url),'utf8');
const shell = readFileSync(new URL('./web_shell.mjs',import.meta.url),'utf8');

assert.match(source,/id="adSlotRail"/);
assert.match(source,/data-ad-status="placeholder"/);
assert.match(source,/@media \(min-width:1800px\)/);
assert.match(source,/body\.in-game \.ad-slot-rail\{display:none !important;\}/);
assert.match(source,/notifyAdOpportunity\('post_game'\)/);
assert.match(config,/showPlaceholders:\s*false/);
assert.doesNotMatch(source + config + shell,/adsbygoogle|pagead2\.googlesyndication|ca-pub-|data-ad-client|data-ad-slot/);

console.log('✓ 广告位仅为默认隐藏占位；游戏中/移动端不显示，且仓库没有真实 AdSense 代码');
