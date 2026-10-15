'use strict';
const assert=require('node:assert/strict'),C=require('./dist/storage-core.js');
const {Dir,values,fetcher,entry}=require('./check-folder-storage.cjs');
const documentWrites=dir=>dir.log.filter(p=>p.startsWith('.snapshots/')).map(p=>p.split('/').at(-1)).sort();
async function main(){
 const dir=new Dir(),repo=new C.FolderRepository(dir,{fetcher});let state=values();
 await repo.commit(state,null,{newLibrary:true});assert.equal(repo.manifest.formatVersion,2);assert.equal(repo.lastCommitStats.documentsWritten.length,6);
 const first=await repo.manifestText(),initial=repo.manifest,initialLibrary=initial.files.library;
 await C.write(dir,'backups/broken-preserved.json',first);
 dir.log=[];state={...state,'anishelf-theme':'light'};await repo.commit(state,repo.manifest.revision);
 assert.deepEqual(documentWrites(dir),['preferences.json']);assert.equal(repo.lastCommitStats.encodedEntries,0);assert.equal(repo.manifest.files.library,initialLibrary);assert.equal(repo.manifest.files.images,initial.files.images);
 dir.log=[];const stable=await repo.manifestText();await repo.commit({...state},repo.manifest.revision);assert.equal(await repo.manifestText(),stable);assert.equal(dir.log.length,0);assert.equal(repo.lastCommitStats.noop,true);
 state={...state,[C.LISTS]:JSON.stringify([{id:'l',name:'Renamed',animeIds:[entry.id]}])};dir.log=[];await repo.commit(state,repo.manifest.revision);assert.deepEqual(documentWrites(dir),['lists.json']);assert.equal(repo.lastCommitStats.encodedEntries,0);
 state={...state,[C.LIB]:JSON.stringify([{...entry,progress:2}]),[C.HISTORY]:JSON.stringify([{animeId:entry.id,title:entry.title,date:'2026-10-15',episode:2,minutes:24}])};dir.log=[];await repo.commit(state,repo.manifest.revision);assert.deepEqual(documentWrites(dir),['history.json','library.json']);assert.equal(dir.log.some(p=>p.startsWith('details/')),false);
 // A different raw JSON layout must not create an identical disk document twice.
 state={...state,[C.LIB]:JSON.stringify(JSON.parse(state[C.LIB]),null,2)};dir.log=[];await repo.commit(state,repo.manifest.revision);assert.equal(repo.lastCommitStats.noop,true);assert.equal(dir.log.length,0);
 // A manual image-cache pass must still run even when all stored values are unchanged.
 repo.cacheImages=true;await repo.commit(state,repo.manifest.revision);repo.cacheImages=false;
 assert.deepEqual(repo.lastCommitStats.documentsWritten,['images']);assert.ok(Object.keys(repo.imageIndex).some(key=>key.startsWith('https://image.tmdb.org')));
 // Reverted edits acknowledge their sequence without publishing another revision.
 const browser={getItem:()=>null,setItem(){},removeItem(){}},store=new C.StagedStore(browser,{pending:{put:async()=>{},remove:async()=>{}},schedule:()=>{}});
 store.attach(repo,state);store.setItem('anishelf-theme','dark');store.setItem('anishelf-theme',state['anishelf-theme']);dir.log=[];await store.flush();assert.equal(store.dirty,false);assert.equal(store.keyVersions.size,0);assert.equal(repo.lastCommitStats.noop,true);assert.equal(dir.log.length,0);
 // An edit arriving after publication but before the save callback returns must survive acknowledgement.
 const commit=repo.commit.bind(repo);let release,finished,hold=true;const firstFinished=new Promise(resolve=>finished=resolve);
 repo.commit=async(...args)=>{const result=await commit(...args);if(hold){hold=false;finished();await new Promise(resolve=>release=resolve)}return result};
 store.setItem('anishelf-theme','dark');const saving=store.flush();await firstFinished;store.setItem('anishelf-theme','system');const latestVersion=store.keyVersions.get('anishelf-theme');release();await saving;repo.commit=commit;
 assert.ok(latestVersion>1);assert.equal(store.dirty,false);assert.equal(store.keyVersions.size,0);assert.equal((await new C.FolderRepository(dir,{fetcher}).load()).values['anishelf-theme'],'system');state={...store.values};
 const safe=await repo.manifestText();await assert.rejects(()=>repo.commit({...state,[C.LIB]:JSON.stringify([{...entry,runtime:'<img src=x onerror=alert(1)>'}])},repo.manifest.revision));assert.equal(await repo.manifestText(),safe);
 // Simulate the legacy v1 layout with its actual six same-revision documents.
 const legacyDir=new Dir(),legacy=new C.FolderRepository(legacyDir,{fetcher});await legacy.commit(values(),null,{newLibrary:true});const v1={...legacy.manifest,formatVersion:1};await C.write(legacyDir,'manifest.json',JSON.stringify(v1));
 const upgraded=new C.FolderRepository(legacyDir,{fetcher});const loaded=await upgraded.load();assert.equal(upgraded.manifest.formatVersion,1);assert.ok(C.sameValues(loaded.values,values()));
 await upgraded.commit({...loaded.values,'anishelf-theme':'light'},v1.revision);assert.equal(upgraded.manifest.formatVersion,2);assert.equal(upgraded.manifest.files.library,v1.files.library);assert.equal((await upgraded.backups()).length,1);
 assert.throws(()=>upgraded.parseManifest(JSON.stringify({...upgraded.manifest,formatVersion:1})),e=>e.code==='INVALID');
 assert.throws(()=>upgraded.parseManifest(JSON.stringify({...upgraded.manifest,files:{...upgraded.manifest.files,library:'.snapshots/r-other/history.json'}})),e=>e.code==='INVALID');
 // Keep a manually preserved old index while automatic backup indexes expire.
 for(let i=0;i<10;i++){state={...state,'anishelf-sort':JSON.stringify({key:'title',direction:'asc',test:i})};await repo.commit(state,repo.manifest.revision)}
 assert.equal((await repo.backups()).length,5);assert.equal(repo.manifest.files.library.includes(repo.manifest.revision),false);
 for(const backup of await repo.backups()){const reader=new C.FolderRepository(dir,{fetcher});await reader.load(backup.raw)}
 await new C.FolderRepository(dir,{fetcher}).load();await new C.FolderRepository(dir,{fetcher}).load(first);
 assert.ok(await C.read(dir,initialLibrary));assert.ok(await C.read(dir,initial.files.preferences));
 const restore=new C.FolderRepository(dir,{fetcher});const previous=await restore.load((await repo.backups()).at(-1).raw);await repo.commit(previous.values,repo.manifest.revision);assert.ok(C.sameValues((await repo.load()).values,previous.values));
 // Reused documents cannot bypass checksum verification, even on preference-only saves.
 const libraryPath=repo.manifest.files.library,originalLibrary=await C.read(dir,libraryPath);await C.write(dir,libraryPath,'[]');const beforeCorrupt=await repo.manifestText();
 await assert.rejects(()=>repo.commit({...repo.committedValues,'anishelf-theme':'system'},repo.manifest.revision),e=>e.code==='CORRUPT');assert.equal(await repo.manifestText(),beforeCorrupt);await C.write(dir,libraryPath,originalLibrary);
 // Invalid indexes pause retention BEFORE any automatic index/file is removed.
 const normalPrune=repo.prune.bind(repo);repo.prune=async()=>{};
 for(let i=0;i<7;i++)await repo.commit({...repo.committedValues,'anishelf-sort':JSON.stringify({test:'unpruned-'+i})},repo.manifest.revision);
 await C.write(dir,'backups/broken-invalid.json','{bad json');const backupsDir=await dir.getDirectoryHandle('backups'),count=backupsDir.children.size;await normalPrune();assert.equal(backupsDir.children.size,count);assert.ok(repo.retentionWarning);
 console.log('PASS: preference/list/history change scope, zero entry encoding for preferences/lists, no-op/JSON-equivalent/reverted saves, manual image-cache pass, in-flight edit version acknowledgement, v1 read/v2 upgrade, strict reference validation, shared-document retention across expired revisions, protected indexes, all retained backups restore, corruption check on reused documents, cleanup pause on unreadable index. In-memory filesystem.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
module.exports={documentWrites};
