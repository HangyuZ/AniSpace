const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');let core=fs.readFileSync('check.cjs','utf8');core=core.slice(0,core.indexOf('const a=boot();'))+'\nglobalThis.harness=boot();';const context={require,console,Blob,URL,AbortController,structuredClone};vm.createContext(context);vm.runInContext(core,context);const h=context.harness;let modalCalls=0,panelCalls=0;h.get('#detailDialog').showModal=()=>modalCalls++;h.get('#detailDialog').show=()=>{panelCalls++;h.get('#detailDialog').open=true};h.get('#detailDialog').scrollTop=600;h.run("library=[{id:99,title:'测试 A',genre:'动画',episodes:12,progress:2,status:'watching',rating:8,year:2026},{id:100,title:'测试 B',genre:'动画',episodes:1,progress:0,status:'planned',rating:0,year:2025}];openDetail(99)");assert.equal(panelCalls,1);assert.equal(modalCalls,0);assert.equal(h.get('#detailDialog').scrollTop,0);assert.match(h.get('#detailBody').innerHTML,/测试 A/);h.get('#detailDialog').scrollTop=900;h.run('openDetail(100)');assert.equal(panelCalls,1);assert.equal(h.get('#detailDialog').scrollTop,0);assert.match(h.get('#detailBody').innerHTML,/测试 B/);assert.match(h.get('#detailBody').innerHTML,/删除动漫/);const html=fs.readFileSync('dist/index.html','utf8');assert.equal(html.includes('breadcrumb'),false);assert.equal(html.includes('id="crumb"'),false);console.log('PASS: breadcrumb removed, nonmodal right detail panel, switching works without reopening, controls preserved.');
// Outside clicks close the drawer; inside interaction and the opening click keep it usable.
let outsideCloses=0;const panel=h.get('#detailDialog'),inside={},outside={};h.context.document.body.classList.remove=()=>{};panel.contains=target=>target===inside;panel.close=()=>{outsideCloses++;panel.open=false};
h.context.detailClick={target:inside,composedPath:()=>[inside,panel]};h.run('closeDetailWhenOutside(detailClick)');assert.equal(panel.open,true);
h.context.detailClick={target:inside};h.run('closeDetailWhenOutside(detailClick)');assert.equal(panel.open,true);
h.context.detailClick={target:outside,composedPath:()=>[outside]};h.run('closeDetailWhenOutside(detailClick)');assert.equal(panel.open,false);assert.equal(outsideCloses,1);
h.run('closeDetailWhenOutside(detailClick)');assert.equal(outsideCloses,1);h.run('openDetail(99)');assert.equal(panel.open,true);
console.log('PASS: outside click dismissal, inside controls preserved, closed drawer no-op and reopening. Mock DOM.');
async function checkMotion(){
 h.context.getComputedStyle=()=>({transform:'matrix(1,0,0,1,0,0)',opacity:'1',getPropertyValue:()=> '180ms'});
 h.context.window.matchMedia=()=>({matches:false});
 const animations=[];
 panel.animate=(frames,options)=>{let resolve,reject;const animation={frames,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no}),cancel(){this.cancelled=true;reject(new Error('cancelled'))},complete(){resolve()}};animations.push(animation);return animation};
 h.run('closeDetailPanel()');assert.equal(panel.open,true);assert.equal(panel.inert,true);assert.equal(animations[0].frames[1].transform,'translateX(100%)');assert.equal(animations[0].frames[1].opacity,0);
 h.run('closeDetailPanel()');assert.equal(animations.length,1);
 animations[0].complete();await Promise.resolve();await Promise.resolve();assert.equal(panel.open,false);assert.equal(panel.inert,false);
 h.run('openDetail(99);closeDetailPanel();openDetail(100)');await Promise.resolve();await Promise.resolve();assert.equal(animations[1].cancelled,true);assert.equal(panel.open,true);assert.equal(panel.inert,false);assert.match(h.get('#detailBody').innerHTML,/测试 B/);
 h.context.window.matchMedia=()=>({matches:true});h.run('closeDetailPanel()');assert.equal(panel.open,false);assert.equal(animations.length,2);
 console.log('PASS: delayed close completion, repeated dismissal, reopening cancels stale exit, reduced motion closes immediately. Web Animations API mocked.');
}
checkMotion().catch(error=>{console.error(error);process.exitCode=1});
