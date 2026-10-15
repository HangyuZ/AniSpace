'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const Safety=require('./dist/data-safety.js'),C=require('./dist/storage-core.js');
const {Dir,entry,values,fetcher}=require('./check-folder-storage.cjs');
const payload='<img src=x onerror="globalThis.reviewProbe=true">';
const bad=[
 {...entry,runtime:payload},
 {...entry,seasonCount:payload},
 {...entry,seasons:[{number:'1" onmouseover="reviewProbe=true',episodes:12}]},
 {...entry,seasons:[{number:1,episodes:payload}]},
 {...entry,episodeDetails:{1:[{number:1,runtime:payload}]}},
 {...entry,episodeDetails:{1:[{number:payload}]}},
 {...entry,cast:[{name:'Actor',role:{bad:true}}]},
 {...entry,episodeDetails:[]},
 {...entry,seasonEntries:[{...entry,id:'nested',runtime:payload}]},
 JSON.parse('{"id":1,"constructor":{"prototype":{"reviewProbe":true}}}')
];
for(const a of bad){assert.throws(()=>Safety.validateCatalog([a]));assert.throws(()=>C.validateValues({[C.LIB]:JSON.stringify([a])}))}
for(const runtime of [null,0,24,23.5,1440])Safety.validateCatalog([{...entry,runtime}]);
for(const runtime of [-1,1441,Infinity,'24'])assert.throws(()=>Safety.validateCatalog([{...entry,runtime}]));
let core=fs.readFileSync('check.cjs','utf8');core=core.slice(0,core.indexOf('const a=boot();'))+'\nglobalThis.harness=boot();';
const ctx={require,console,Blob,URL,AbortController,structuredClone};vm.createContext(ctx);vm.runInContext(core,ctx);const h=ctx.harness;
h.context.document.createElement=()=>({innerHTML:'',querySelector:s=>h.get(s),querySelectorAll:()=>[],append(){},click(){}});
for(const file of ['season-model.js','tmdb-api.js','tmdb-ui.js','details.js','season-manager.js'])h.run(fs.readFileSync('dist/'+file,'utf8'));
(async()=>{
 h.run('library='+JSON.stringify([entry])+';save()');
 const before=h.run('AppStorage.getItem("anishelf-library-v1")');
 for(const a of bad){
  await h.get('#importFile').onchange({target:{files:[{size:2000,text:async()=>JSON.stringify({version:1,library:[a]})}],value:'test'}});
  assert.equal(h.run('AppStorage.getItem("anishelf-library-v1")'),before,'rejected backup must not change storage');
  assert.equal(h.run('library[0].id'),entry.id);
 }
 const literal={...entry,note:payload,overview:payload,cast:[{name:payload,role:payload}]};
 await h.get('#importFile').onchange({target:{files:[{size:2000,text:async()=>JSON.stringify({version:1,library:[literal]})}],value:'test'}});
 assert.equal(h.run('library[0].note'),payload,'preserve legitimate text unchanged in storage');
 h.run('openDetail('+JSON.stringify(entry.id)+')');
 assert.ok(h.get('#detailBody').innerHTML.includes('&lt;img'));assert.ok(!h.get('#detailBody').innerHTML.includes(payload));
 // Rendering is independently safe if old metadata bypasses the import boundary.
 const legacy={...entry,runtime:payload,seasons:[{number:'1" onmouseover="reviewProbe=true',episodes:12}]};
 h.run('library='+JSON.stringify([legacy])+';openDetail('+JSON.stringify(entry.id)+')');
 assert.ok(!h.get('#detailBody').innerHTML.includes(payload));
 assert.ok(!h.get('#detailBody').innerHTML.includes('onmouseover="reviewProbe=true'));
 assert.ok(!h.run('episodeMarkup('+JSON.stringify([{number:1,name:payload,runtime:payload},{number:payload}])+')').includes(payload));
 assert.throws(()=>h.run('SeasonManager.withArchive('+JSON.stringify([{id:'archive',source:{...entry,runtime:payload},history:[],seasonIds:[]}])+',()=>{})'));
 const dir=new Dir(),repo=new C.FolderRepository(dir,{fetcher});await repo.commit(values(),null,{newLibrary:true});const manifest=await repo.manifestText();
 await assert.rejects(()=>repo.commit({...values(),[C.LIB]:JSON.stringify([{...entry,runtime:payload}])},repo.manifest.revision));
 assert.equal(await repo.manifestText(),manifest);
 const html=fs.readFileSync('../../outputs/AniShelf.html','utf8');
 assert.ok(html.includes(fs.readFileSync('dist/data-safety.js','utf8')));
 assert.ok(html.indexOf('Shared boundary validation')<html.indexOf('Local folder repository'));
 console.log('PASS: nested metadata/type/prototype checks, native import rejection without writes, literal text preservation and escaping, legacy render defense, archive rejection, folder publication unchanged on rejection, packaged validation load order. Mock DOM/filesystem; no active payload executed.');
})().catch(error=>{console.error(error);process.exitCode=1});
