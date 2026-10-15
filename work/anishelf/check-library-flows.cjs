const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let core=fs.readFileSync('check.cjs','utf8');core=core.slice(0,core.indexOf('const a=boot();'))+'\nglobalThis.harness=boot();';
let exported;const fakeURL={createObjectURL:blob=>{exported=blob;return 'blob:test'},revokeObjectURL(){}};
const ctx={require,console,Blob,URL:fakeURL,AbortController,structuredClone};vm.createContext(ctx);vm.runInContext(core,ctx);const h=ctx.harness;
const fixture={id:701,title:'Alpha',en:'Alpha',genre:'动画',tag:'',episodes:12,progress:3,status:'watching',rating:8,year:2026,image:'',favorite:true,note:'Record',startDate:'2026-10-01'};
(async()=>{
 h.run('library='+JSON.stringify([fixture])+';render()');
 assert.match(h.get('#animeGrid').innerHTML,/poster-favorite/);
 h.run("view='list';render()");assert.match(h.get('#animeGrid').className,/list/);assert.match(h.get('#animeGrid').innerHTML,/Alpha/);
 h.run("view='grid';render()");assert.doesNotMatch(h.get('#animeGrid').className,/list/);
 h.run("page='favorites';render()");assert.match(h.get('#animeGrid').innerHTML,/Alpha/);
 h.run('renderSettings()');h.get('#exportData').onclick();const backup=JSON.parse(await exported.text());assert.equal(backup.version,1);assert.equal(backup.library[0].note,'Record');assert.equal(backup.library[0].startDate,'2026-10-01');assert.equal(h.get('created').download,'anishelf-backup.json');
 const updated={...fixture,progress:9,note:'Updated'},next={...fixture,id:702,title:'Beta'};
 await h.get('#importFile').onchange({target:{files:[{size:1024,text:async()=>JSON.stringify({version:1,library:[updated,next]})}],value:'test'}});
 assert.equal(h.run('library.length'),2);assert.equal(h.run('library.find(a=>a.id===701).progress'),9);assert.equal(h.run('library.find(a=>a.id===701).note'),'Updated');
 h.run("page='library';render()");h.run('deleteAnime(701)');assert.equal(h.run('library.length'),1);h.get('#undoDelete').onclick();assert.equal(h.run('library.length'),2);assert.equal(h.run('library.find(a=>a.id===701).note'),'Updated');
 console.log('PASS: grid/list rendering, favorites, version-1 backup export, import merge and watch records, delete/undo restoration. DOM mocked; actual download UI not tested.');
})().catch(e=>{console.error(e);process.exitCode=1});
