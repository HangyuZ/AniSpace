const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let core=fs.readFileSync('check.cjs','utf8');core=core.slice(0,core.indexOf('const a=boot();'))+'\nglobalThis.harness=boot();';const ctx={require,console,Blob,URL,AbortController,structuredClone};vm.createContext(ctx);vm.runInContext(core,ctx);const h=ctx.harness;
h.run(fs.readFileSync('dist/tmdb-api.js','utf8'));h.run(fs.readFileSync('dist/tmdb-ui.js','utf8'));
h.run('library=[{id:888,title:"Old pending import",genre:"动画",year:2026,episodes:1,progress:0,status:"planned",rating:0,tmdbImportState:"pending"}]');
h.run(fs.readFileSync('dist/external-import.js','utf8'));assert.equal(h.get('#importSummary').hidden,true);
h.run('page="settings";render()');assert.match(h.get('created').innerHTML,/resumePendingMetadata/);assert.equal(h.get('#importSummary').hidden,true);
h.run('page="library";render()');assert.equal(h.get('#importSummary').hidden,true);
const world='WorldEnd: What are you doing at the end of the world? Are you busy? Will you save us?';
const payload={app:'ignored',entries:[{title:world,watchStatus:'planned',favorite:false,notes:'Keep this note',dateSaved:'2026-07-15T18:41:14Z',animeType:'ignored',releaseYear:1901,detailsURL:'https://do-not-fetch.example'},{title:'Your Name.',watchStatus:'watched',favorite:false,notes:'Imported note',dateSaved:'2026-06-20T11:11:35Z'}],entryCount:2,formatVersion:1};
const fixture={id:999,title:'君の名は。',en:'Kimi no Na wa.',tmdbId:20,tmdbType:'movie',genre:'动画',year:2016,episodes:1,progress:1,runtime:106,status:'completed',rating:9,note:'Existing note',favorite:true};
h.run('library='+JSON.stringify([fixture])+';save()');
let calls=[];h.context.fetch=async url=>{const u=new URL(url);calls.push(u);let body;
 if(u.pathname.includes('/search/tv'))body={results:u.searchParams.get('query').startsWith('WorldEnd')?[{id:10,name:'WorldEnd: What do you do at the end of the world? Are you busy? Will you save us?',original_name:'WorldEnd',genre_ids:[16]}]:[]};
 else if(u.pathname.includes('/search/movie'))body={results:u.searchParams.get('query')==='Your Name.'?[{id:20,title:'Your Name.',genre_ids:[16]}]:[]};
 else body={id:10,name:'末日时在做什么？',original_name:'WorldEnd',number_of_episodes:12,episode_run_time:[24],first_air_date:'2017-04-10',poster_path:'/poster.jpg',overview:'Overview',genres:[{name:'动画'}],status:'Ended',aggregate_credits:{cast:[],crew:[]},images:{logos:[]}};
 return {ok:true,json:async()=>body};
};
(async()=>{
 const mapped=h.run('ExternalImport.parse('+JSON.stringify(payload)+')');assert.equal(mapped[0].startDate,h.run('WatchSchedule.dateKey(new Date("2026-07-15T18:41:14Z"))'));assert.equal(mapped[1].status,'completed');assert.equal(mapped[0].note,'Keep this note');
 for(const [external,internal]of [['planned','planned'],['watched','completed'],['watching','watching'],['dropped','dropped'],['on_hold','paused']])assert.equal(h.run('ExternalImport.parse({entries:[{title:"Status",watchStatus:"'+external+'"}]})[0].status'),internal);
 // Without credentials, save personal data and allow explicit later enrichment.
 await h.run('ExternalImport.importEntries('+JSON.stringify(payload)+')');assert.equal(calls.length,0);assert.equal(h.run('library.length'),3);assert.equal(h.get('#retryImportedMetadata').hidden,false);
 h.run('tmdbCredential="'+'a'.repeat(32)+'"');await h.get('#retryImportedMetadata').onclick();
 assert.equal(h.run('library.length'),2);assert.equal(h.run('JSON.stringify(library.find(a=>a.id===999))'),JSON.stringify(fixture));
 assert.equal(h.run('library.find(a=>a.tmdbId===10).runtime'),24);assert.equal(h.run('library.find(a=>a.tmdbId===10).episodes'),12);assert.equal(h.run('library.find(a=>a.tmdbId===10).year'),2017);assert.equal(h.run('library.find(a=>a.tmdbId===10).note'),'Keep this note');assert.equal(h.run('library.find(a=>a.tmdbId===10).title'),world);assert.equal(h.run('library.find(a=>a.tmdbId===10).status'),'planned');assert.equal(h.run('WatchHistory.exportRecords().length'),0);
 assert.ok(calls.every(u=>u.hostname==='api.themoviedb.org'));assert.ok(!calls.some(u=>u.pathname.endsWith('/movie/20')));assert.equal(h.get('#retryImportedMetadata').hidden,true);
 const before=calls.length;await h.run('ExternalImport.importEntries('+JSON.stringify(payload)+')');assert.equal(calls.length,before+2); // Localized existing title is caught by its TMDb ID, after search only.
 assert.equal(h.run('library.length'),2);assert.match(h.get('#importSummaryText').textContent,/2 跳过重复/);
 const duplicate=h.run('ExternalImport.stage([{title:"Repeat",status:"planned"},{title:"repeat",status:"planned"}],library)');assert.equal(duplicate.added.length,1);assert.equal(duplicate.skipped,1);
 assert.equal(h.run('ExternalImport.choose("Same",[{id:1,name:"Same",media_type:"tv",genre_ids:[16]},{id:2,title:"Same",media_type:"movie",genre_ids:[16]}])'),null);
 // Completed entries acquire the true episode count but generate no viewing sessions.
 h.context.fetch=async url=>{const u=new URL(url);return {ok:true,json:async()=>u.pathname.includes('/search/')?{results:u.pathname.includes('/tv')?[{id:30,name:'Completed Series',genre_ids:[16]}]:[]}:{id:30,name:'Completed Series',number_of_episodes:8,episode_run_time:[23],first_air_date:'2020-01-01',genres:[{name:'动画'}]}};};
 await h.run('ExternalImport.importEntries({entries:[{title:"Completed Series",watchStatus:"watched",favorite:true}]})');assert.equal(h.run('library.find(a=>a.tmdbId===30).progress'),8);assert.equal(h.run('library.find(a=>a.tmdbId===30).favorite'),true);assert.equal(h.run('WatchHistory.exportRecords().length'),0);
 const length=h.run('library.length');await assert.rejects(h.run('ExternalImport.importEntries({entries:[{title:"Invalid",watchStatus:"invalid"}]})'));assert.equal(h.run('library.length'),length);
 const duplicateFile={files:[{size:500,text:async()=>JSON.stringify({entries:[{title:world,watchStatus:'planned'}]})}],value:'selected'};await h.get('#importFile').onchange({target:duplicateFile});assert.equal(duplicateFile.value,'');assert.equal(h.run('library.length'),length);
 const native={...fixture,id:777,title:'Native Backup',note:'Native note'};const nativeFile={files:[{size:500,text:async()=>JSON.stringify({version:1,library:[native]})}],value:'selected'};await h.get('#importFile').onchange({target:nativeFile});assert.equal(nativeFile.value,'');assert.equal(h.run('library.find(a=>a.id===777).note'),'Native note');
 // Invalid credentials stop the batch instead of repeatedly requesting every title.
 let failures=0;h.context.fetch=async()=>{failures++;return {ok:false,status:401}};await h.run('ExternalImport.importEntries({entries:[{title:"Auth Failure One",watchStatus:"watching"},{title:"Auth Failure Two",watchStatus:"dropped"}]})');assert.equal(failures,2);assert.equal(h.run('library.find(a=>a.title==="Auth Failure One").tmdbImportState'),'failed');assert.equal(h.run('library.find(a=>a.title==="Auth Failure Two").tmdbImportState'),'pending');
 assert.equal(h.get('#retryFailedMetadata').hidden,false);
 await h.get('#retryImportedMetadata').onclick();assert.equal(failures,4);assert.equal(h.run('library.find(a=>a.title==="Auth Failure Two").tmdbImportState'),'failed');assert.equal(h.get('#retryImportedMetadata').hidden,true);
 const stoppedRequests=failures;await h.get('#retryImportedMetadata').onclick();assert.equal(failures,stoppedRequests);
 let emptySearches=0;h.context.fetch=async()=>{emptySearches++;return {ok:true,json:async()=>({results:[]})}};
 await h.get('#retryFailedMetadata').onclick();assert.equal(emptySearches,4);assert.equal(h.get('#retryImportedMetadata').hidden,true);assert.equal(h.get('#retryFailedMetadata').hidden,true);assert.match(h.get('#importSummaryText').textContent,/匹配已结束/);assert.match(h.get('#importSummaryText').textContent,/2 需要确认/);assert.match(h.get('#importSummaryText').textContent,/0 未处理/);assert.match(h.get('#toast').textContent,/匹配已结束/);
 await h.get('#retryImportedMetadata').onclick();await h.get('#retryFailedMetadata').onclick();assert.equal(emptySearches,4);
 h.get('#closeImportSummary').onclick();h.run('render()');assert.equal(h.get('#importSummary').hidden,true);h.run('page="settings";render()');assert.equal(h.get('#importSummary').hidden,true);
 console.log('PASS: external schema/status/date/note/favorite mapping, ignored fields, title and TMDb duplicate skip without overwriting existing data, automatic enrichment/resume, completed progress, no fake viewing history, ambiguity handling, validation and auth-stop. Mock API responses.');
})().catch(error=>{console.error(error);process.exitCode=1});
