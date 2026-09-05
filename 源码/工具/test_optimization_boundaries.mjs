// Release guardrails captured from the approved 4d3d6aa baseline, not a
// permanent ban on future rule changes. Update only with explicit rule approval.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
const maps=[
 'c8e24c9931c316de73a4135a2ec19472808f78fd586b73fa9c9cf1d6a0a87052',
 'abe1df8c82db793c73f49e98e8972f320bdfed712d9235628dc454a27ea0f8fd',
 '7de3af3c208f8917246cf71d029131c32f11a2450432759eddc8bf688932b632',
 '3aee0158f5546a83037bc447ea7b6ad5d8e2bfc12f21708199c93ddafd688473',
 'b34e215c81dba24c77c9931fe3f18f67838d945f35fdcd4714e410038dcef6b9',
 'c379b1f9f4f077f072217d32ee39c74888ebd997ba9ed8d760e3eaf1c1435d85',
];
for(const [i,expected] of maps.entries()){
 const match=source.match(new RegExp('const MAZE_LEVEL_'+(i+1)+' = \\[[\\s\\S]*?\\];'));
 assert(match);assert.equal(hash(match[0]),expected,'map '+(i+1)+' changed');
}
assert.match(source,/const MAX_LEVEL = 6/);
const functions={
 chooseGhostDir:'9079ea79a72f66f719e0dcc81980b0adbb0d194625bbd8b78ecb3feec442de71',
 stepEntity:'8138d0f6ab2f3b87c2bbb4deba251e627881edfb5c134b8bcc7cfbaaef2d635f',
 applyCornerAssist:'5a28fcba06d80a6e2c29a99b44d3ba05dfef0a109ae1e604d945a401a42ee263',
 requestDir:'f8500cdda82592fbba3c374ac356c2cac859deaf81017daf27a7dead09d49218',
 applySpeedModifiers:'290973b40fb3dd30a389a5444ef030f0b1af4371525fd38979d115e661451550',
 addScore:'4f15ce375efd5e24608d3022c504790faeba18dfeda261f73151127947bafb35',
 addComboScore:'a1c64f4e8311d09db83aa660e99ec07a7bd77a033efa95dc144e2f6731e7c450',
};
for(const [name,expected] of Object.entries(functions)){
 const m=source.match(new RegExp('^function '+name+'\\([^\\n]*\\)\\{(?:[^\\n]*\\}[^\\n]*$|[\\s\\S]*?^\\})','m'));
 assert(m);assert.equal(hash(m[0]),expected,name+' changed');
}
const files={
 'supabase/migrations/001_leaderboard.sql':'41d5db781cb650aeaeebf6551bccbabb8aa78f481613bd1c76c814565e37a6c1',
 'supabase/migrations/002_basic_anti_cheat.sql':'a7671d71511f2169d62df3d40334d0bc4454e06e84a54fc8af0c5f7860197708',
 'supabase/migrations/003_public_view_readonly.sql':'ff581ff1ba075ccd9c58c6f583c070165c2797029fe47b59efc9455bcac06e49',
 'supabase/migrations/004_leaderboard_hall.sql':'ff0b8ee3b91e6cc22f7608ff21a117cf9f5417a9162eeed34abcb54604e80b9a',
 'config.js':'942cb7c07468b5e12710f02f19a53d922df96019c550fa01afb1790e616e09a2',
};
for(const [file,expected] of Object.entries(files))assert.equal(hash(readFileSync(new URL('../../'+file,import.meta.url))),expected,file+' changed');
assert.match(source,/const CLIENT_VERSION = 'web-2026\.09\.04'/);
assert.match(source,/const dt = Math.min\(0\.033, \(t-lastT\)\/1000\)/);
console.log('Optimization boundaries: 6 maps, 7 movement/AI/scoring functions, 5 service files, rule version and simulation timestep unchanged. Parameter values are additionally covered by test_help_accuracy and test_combo_balance.');
