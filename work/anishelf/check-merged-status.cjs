const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),M=require('./dist/season-model.js');
const states=['watching','rewatching','planned','dropped','paused','completed'];
const rank={watching:0,rewatching:1,planned:2,dropped:3,paused:4,completed:5};
const child=(status,index)=>({id:`tv-55-s0${index+1}`,entryType:'season',tmdbId:55,tmdbType:'tv',seriesKey:'tv-55',seriesTitle:'Series',seasonNumber:index+1,title:`S${index+1}`,episodes:12,progress:status==='completed'?12:0,rewatchCount:status==='rewatching'?1:0,status,rating:0,year:2026});
const group=statuses=>({id:'series:tv-55',entryType:'series',tmdbId:55,tmdbType:'tv',seriesKey:'tv-55',title:'Series',genre:'Animation',rating:0,year:2026,status:'paused',seasonEntries:statuses.map(child)});
for(const x of states)for(const y of states)for(const z of states){
 const statuses=[x,y,z],best=Math.min(...statuses.map(s=>rank[s]));
 const expected=best<5?states[best]:statuses.every(s=>s==='completed')?'completed':'planned';
 const original=group(statuses),snapshot=JSON.stringify(original.seasonEntries),result=M.refreshMerged(original);
 assert.equal(result.status,expected,statuses.join(' + '));assert.equal(JSON.stringify(result.seasonEntries),snapshot);
}
const changing=group(['completed','planned']);
assert.equal(M.patch([changing],changing.seasonEntries[1].id,{status:'rewatching',rewatchCount:1})[0].status,'rewatching');
let core=fs.readFileSync('check.cjs','utf8');core=core.slice(0,core.indexOf('const a=boot();'));
core=core.replace("fs.readFileSync('dist/app.js','utf8')","fs.readFileSync('dist/season-model.js','utf8')+'\\n'+fs.readFileSync('dist/app.js','utf8')");
const fixture=group(['completed','rewatching']);
core+='\nstorage.set("anishelf-no-demo-v1","1");storage.set("anishelf-library-v1",'+JSON.stringify(JSON.stringify([fixture]))+');globalThis.harness=boot();';
const context={require,console,Blob,URL,AbortController,structuredClone};vm.createContext(context);vm.runInContext(core,context);const h=context.harness;
assert.equal(h.run('library[0].status'),'rewatching');assert.equal(h.run('library[0].rewatchCount'),0);
async function checkImport(){
 h.run('library=[]');const json=JSON.stringify({version:1,library:[{...M.refreshMerged(fixture),status:'watching'}]});
 await h.get('#importFile').onchange({target:{files:[{size:json.length,text:async()=>json}],value:'test'}});
 assert.equal(h.run('library[0].status'),'rewatching');assert.equal(h.run('library[0].seasonEntries[1].rewatchCount'),1);
 console.log('PASS: 216 status combinations, season changes, startup recomputation and backup import preserve merged rewatching. Mock DOM.');
}
checkImport().catch(error=>{console.error(error);process.exitCode=1});
