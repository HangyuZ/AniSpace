const fs=require('node:fs'),assert=require('node:assert/strict');
const tokens=fs.readFileSync('dist/design-tokens.css','utf8'),css=fs.readFileSync('dist/fluent.css','utf8'),layout=fs.readFileSync('dist/layout.css','utf8'),html=fs.readFileSync('dist/index.html','utf8');
function vars(source){return Object.fromEntries([...source.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));}
const light=vars(tokens.split('body.dark')[0]),dark={...light,...vars(tokens.split('body.dark')[1])};
function rgb(value){if(value.startsWith('#'))return value.slice(1).match(/../g).map(x=>parseInt(x,16));return value.match(/[\d.]+/g).slice(0,3).map(Number);}
function luminance(c){return c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(rgb(a)),y=luminance(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [name,t]of [['light',light],['dark',dark]]){
 for(const bg of ['ui-canvas','ui-surface','ui-surface-secondary','material-sidebar','material-bar','material-control'])for(const fg of ['ui-text','ui-text-secondary','ui-accent'])assert.ok(contrast(t[fg],t[bg])>=4.5,`${name} ${fg}/${bg}: ${contrast(t[fg],t[bg])}`);
 for(const bg of ['ui-accent','ui-accent-hover','ui-accent-pressed'])assert.ok(contrast(t['ui-on-accent'],t[bg])>=4.5);
 for(const bg of ['ui-accent-soft','ui-selected-hover','ui-selected-pressed'])assert.ok(contrast(t['ui-accent'],t[bg])>=4.5,`${name} selected ${bg}`);
}
for(const key of ['ui-canvas','ui-surface','ui-surface-secondary','material-sidebar','material-bar','material-control','material-sheet','material-protected']){const [r,g,b]=rgb(dark[key]);assert.ok(b>g&&g>r,`${key} must be blue-grey`);}
assert.ok(!/environment-|material-glint|mask-composite|radial-gradient|feDisplacementMap/.test(tokens+css+layout));
assert.ok(!/#[\da-f]{3,8}\b/i.test(layout.replace(/fill: #fff9; stroke: #fff;/,'')));
assert.ok(!/background|backdrop-filter|border-radius|box-shadow/.test(layout));
for(const s of ['prefers-reduced-motion','prefers-contrast','forced-colors','prefers-reduced-transparency',':focus-visible','ButtonFace','GrayText'])assert.ok(css.includes(s));
const componentVars=vars(css);
for(const ref of [...(tokens+css+layout).matchAll(/var\(--([\w-]+)/g)])assert.ok(ref[1]in light||ref[1]in dark||ref[1]in componentVars,`unresolved ${ref[1]}`);
for(const theme of [light,dark])for(let n=0;n<=5;n++)assert.ok(contrast(n>=4?theme['calendar-high-text']:theme['ui-text'],theme['calendar-'+n])>=4.5,'calendar text contrast');
for(const theme of [light,dark])for(const state of ['watching','planned','completed','paused','dropped'])for(const amount of [0,.08,.14]){const ink=theme['status-'+state+'-ink'],fill=rgb(theme['status-'+state+'-fill']),mixed=fill.map((value,i)=>value*(1-amount)+rgb(ink)[i]*amount);assert.ok(contrast(ink,'rgb('+mixed.join(',')+')')>=4.5,`${state} selected-state contrast (${amount})`);}
for(const state of ['watching','planned','completed','paused','dropped'])for(const material of ['fill','bar'])assert.ok(luminance(rgb(dark['status-'+state+'-'+material]))<luminance(rgb(light['status-'+state+'-'+material])),`${state} ${material} dark tint`);
assert.deepEqual([...html.matchAll(/href="([\w.-]+\.css)"/g)].map(m=>m[1]),['design-tokens.css','layout.css','fluent.css','personalization.css','storage.css']);
const previous=fs.readFileSync('../../outputs/backup-before-fluent/AniShelf.html','utf8');
const scripts=content=>[...content.matchAll(/<script(?: data-app-script type="application\/x-anishelf")?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const current=scripts(fs.readFileSync('../../outputs/AniShelf.html','utf8')),prior=scripts(previous);
assert.ok(current.some(script=>script.replace(/\r\n/g,'\n')===prior[1].replace(/\r\n/g,'\n')));assert.ok(current.includes(fs.readFileSync('dist/tmdb-ui.js','utf8')));
console.log('PASS: sort unchanged and current TMDb UI packaged; complete blue-grey dark surfaces; >=4.5:1 text and action contrast; one visual system; focus, motion, contrast and forced-colors paths present. Browser rendering not tested.');
