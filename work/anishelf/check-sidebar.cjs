const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let core=fs.readFileSync('check.cjs','utf8');core=core.slice(0,core.indexOf('const a=boot();'))+'\nglobalThis.harness=boot();globalThis.reboot=boot;';
const ctx={require,console,Blob,URL,AbortController,structuredClone};vm.createContext(ctx);vm.runInContext(core,ctx);
function prepare(h,width){const classes=new Set();h.context.window.innerWidth=width;h.context.document.body.classList={contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x)}};h.run('applySidebar()');return classes;}
const h=ctx.harness,classes=prepare(h,1400);
assert.equal(h.get('#sidebarToggle')['aria-expanded'],'true');
h.get('#sidebarToggle').onclick();assert.ok(classes.has('sidebar-collapsed'));assert.equal(h.get('#sidebarToggle')['aria-expanded'],'false');assert.equal(h.get('#sidebarToggle').title,'展开侧栏');assert.equal(h.run('localStorage.getItem("anishelf-sidebar-collapsed")'),'true');
const loaded=ctx.reboot(),restored=prepare(loaded,1400);assert.ok(restored.has('sidebar-collapsed'));
loaded.get('#sidebarToggle').onclick();assert.ok(restored.has('sidebar-expanded'));loaded.context.window.innerWidth=600;loaded.run('applySidebar()');assert.ok(restored.has('sidebar-expanded'),'explicit expansion survives resize');
loaded.run('localStorage.removeItem("anishelf-sidebar-collapsed")');const automatic=ctx.reboot(),auto=prepare(automatic,600);assert.ok(auto.has('sidebar-collapsed'));automatic.context.window.innerWidth=1400;automatic.run('applySidebar()');assert.ok(auto.has('sidebar-expanded'));
const handlers=new Map();h.context.document.addEventListener=(name,fn)=>{if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn)};
h.context.window.innerHeight=800;
for(const name of ['#listPicker','#listContextMenu','#compactLists']){const node=h.get(name);node.hidden=true;node.style={};node.getBoundingClientRect=()=>({top:100,right:72,width:280,height:200});}
h.run('AniLists.start();AniLists.create("Sidebar Test");render()');h.get('#compactLists').onclick();assert.equal(h.get('#listPicker').hidden,false);assert.match(h.get('#compactListRows').innerHTML,/Sidebar Test/);
h.get('#sidebarToggle').onclick();assert.equal(h.get('#listPicker').hidden,true);assert.equal(h.get('#compactLists')['aria-expanded'],'false');
const html=fs.readFileSync('dist/index.html','utf8');assert.ok(html.includes('id="sidebar-toggle-icon"'));assert.ok(html.includes('aria-controls="appSidebar"'));
console.log('PASS: collapse/expand, aria labels, saved preference and reload, narrow default, explicit expansion on resize, compact list access and menu cleanup on toggle. Mock DOM.');
