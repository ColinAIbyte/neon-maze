import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root = readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const english = readFileSync(new URL('../../en/index.html',import.meta.url),'utf8');
const notFound = readFileSync(new URL('../../404.html',import.meta.url),'utf8');
const cname = readFileSync(new URL('../../CNAME',import.meta.url),'utf8').trim();
const allPublic = root + english + notFound;

assert.equal(cname,'playneonmaze.com');
assert.doesNotMatch(allPublic,/colinaibyte\.github\.io|href="\/neon-maze\//i);
assert.match(root,/<link rel="canonical" href="https:\/\/playneonmaze\.com\/">/);
assert.match(root,/hreflang="en" href="https:\/\/playneonmaze\.com\/en\/">/);
assert.match(root,/<meta property="og:url" content="https:\/\/playneonmaze\.com\/">/);
assert.match(english,/<link rel="canonical" href="https:\/\/playneonmaze\.com\/en\/">/);
const baseHref = english.match(/<base href="([^"]+)"/)?.[1] || './';
const configSrc = english.match(/<script src="([^"]*config\.js)"/)?.[1];
assert.ok(configSrc,'英文页必须加载云榜公开配置');
assert.equal(new URL(configSrc,new URL(baseHref,'https://playneonmaze.com/en/')).href,
  'https://playneonmaze.com/config.js');
assert.match(notFound,/<a href="https:\/\/playneonmaze\.com\/">/);

console.log('✓ canonical、hreflang、分享 URL、英文配置与 404 返回路径均指向正式域名');
