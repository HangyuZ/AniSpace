require('./check-fluent.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');const source=fs.readFileSync('dist/design-tokens.css','utf8'),css=fs.readFileSync('dist/fluent.css','utf8');
const read=text=>Object.fromEntries([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));const light=read(source.split('body.dark')[0]),dark={...light,...read(source.split('body.dark')[1])};
function channels(s){if(s[0]==='#')return s.slice(1).match(/../g).map(v=>parseInt(v,16));return s.match(/[\d.]+/g).map(Number);}
function luminance(c){const rgb=c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function composite(s,b){const c=channels(s),alpha=c[3]??1;return c.slice(0,3).map((value,i)=>value*alpha+b[i]*(1-alpha));}
for(const [name,theme]of [['light',light],['dark',dark]]){
 for(const fill of ['frost-control','frost-field','frost-panel','material-sheet'])for(const backdrop of [[0,0,0],[255,255,255]])for(const ink of ['ui-text','ui-text-secondary','ui-accent'])assert.ok(ratio(channels(theme[ink]),composite(theme[fill],backdrop))>=4.5,`${name} ${fill}/${ink} over ${backdrop[0]}`);
 for(const backdrop of [[0,0,0],[255,255,255]])assert.ok(ratio(channels(theme['ui-on-accent']),composite(theme['frost-accent'],backdrop))>=4.5,`${name} accent text`);
 for(const backdrop of [[0,0,0],[255,255,255]])assert.ok(ratio(channels(theme['ui-text']),composite(theme['frost-toolbar-control'],backdrop))>=4.5,`${name} translucent toolbar text`);
 for(const ink of ['ui-text','ui-text-secondary'])assert.ok(ratio(channels(theme[ink]),composite(theme['frost-navigation'],channels(theme['material-sidebar'])))>=4.5,`${name} navigation text`);
}
assert.ok(css.includes('#detailDialog { --frost-drawer-surface:var(--material-sheet); background:var(--material-sheet); backdrop-filter:var(--frost-drawer-filter); }'));
assert.ok(css.includes(':is(#addDialog,#shuffleDialog,#listDialog,.list-popup,#detailDialog,.view-tools) :is(button,input,select,textarea,.search,.detail-action) { backdrop-filter:none; }'));
assert.ok(css.includes('--frost-small-filter:none; --frost-flyout-filter:none;'));
assert.ok(css.includes('--material-sheet:Canvas;'));assert.ok(css.includes('--frost-field:Field;'));
assert.ok(!/\.toolbar\s*\{[^}]*backdrop-filter/.test(css));assert.ok(!/\.(?:anime-card|gallery-card|detail-cover-art)\s*\{[^}]*backdrop-filter/.test(css));
console.log('PASS: composited light/dark text >=4.5:1 over black/white for control, field, panel, flyout and accent fills; frosted drawer with protected reading surfaces; no nested modal/toolbar blur; no full-toolbar/poster/card blur; reduced-transparency and forced-color token fallbacks. Browser rendering/performance not verified.');
