'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),A=require('./dist/discover-api.js');
assert.equal(A.normalize({id:1,title:'Romaji',alternative_titles:{en:'English',ja:'日本語'}}).title,'English');
assert.equal(A.normalize({id:1,title:'Romaji',alternative_titles:{en:''}}).title,'Romaji');assert.equal(A.normalize({id:1,title:'Adult',nsfw:'black'}),null);
assert.equal(A.season(new Date(2026,9,15)).season,'fall');
assert.equal(A.chooseSeason({year:2026,title:'Show Season 2'},[{number:1,airDate:'2024-01-01'},{number:2,airDate:'2026-01-01'}]).number,2);
assert.equal(A.chooseSeason({year:2026,title:'Show'},[{number:1,airDate:'2026-01-01'},{number:2,airDate:'2026-10-01'}]),null);
let core=fs.readFileSync('check.cjs','utf8');core=core.slice(0,core.indexOf('const a=boot();'))+'\nglobalThis.harness=boot();';
const ctx={require,console,Blob,URL,AbortController,structuredClone};vm.createContext(ctx);vm.runInContext(core,ctx);const h=ctx.harness;
h.context.document.createElement=()=>({innerHTML:'',querySelector:s=>h.get(s),querySelectorAll:()=>[],append(){},click(){}});
h.context.document.querySelector=s=>{const n=h.get(s);n.querySelectorAll=()=>[];return n};h.context.location={origin:'http://127.0.0.1:43871'};
h.context.localStorage.setItem('anishelf-mal-client-id','a'.repeat(32));h.context.localStorage.setItem('anishelf-mal-session','browser-only-session');
const calls=[];
h.context.fetch=async(url,options)=>{
 calls.push({url:String(url),options});
 if(String(url).startsWith('/.anishelf/mal/')){const input=JSON.parse(options.body);if(String(url).endsWith('auth/status'))return {ok:true,json:async()=>({connected:true})};const offset={ranking:0,season:10,suggestions:20}[input.kind];return {ok:true,json:async()=>({data:Array.from({length:10},(_,i)=>({node:{id:offset+i+1,title:'Romaji '+(offset+i+1),alternative_titles:{en:i===0&&offset===0?'':'English '+(offset+i+1)},media_type:offset+i+1===11?'tv':'movie',start_date:'2026-01-01',mean:8,nsfw:'white'}}))})}}
 const u=new URL(url);if(u.pathname.includes('/search/')){const name=u.searchParams.get('query'),id=Number(name.match(/\d+/)?.[0]);return {ok:true,json:async()=>({results:[{id:1000+id,title:name,original_title:name,genre_ids:[16],release_date:'2026-01-01'}]})}}
 if(u.pathname.includes('/season/'))return {ok:true,json:async()=>({air_date:'2026-01-01',episodes:Array.from({length:12},(_,i)=>({episode_number:i+1,name:'Episode '+(i+1),runtime:24})),credits:{cast:[],crew:[]}})};
 const id=Number(u.pathname.split('/').at(-1));return {ok:true,json:async()=>({id,name:'TMDb title '+id,title:'TMDb title '+id,original_title:'Original',first_air_date:'2026-01-01',release_date:'2026-01-01',number_of_episodes:12,seasons:[{season_number:1,episode_count:12,air_date:'2026-01-01'}],runtime:100,poster_path:'/poster.jpg',genres:[{name:'Animation'}],overview:'TMDb overview',credits:{cast:[],crew:[]}})};
};
for(const file of ['season-model.js','tmdb-api.js','tmdb-ui.js','details.js','discover-api.js','discover.js'])h.run(fs.readFileSync('dist/'+file,'utf8'));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const beforeLibrary=h.run('AppStorage.getItem("anishelf-library-v1")'),beforeHistory=h.run('AppStorage.getItem("anishelf-watch-history-v1")');
 h.run('tmdbCredential="test-token";page="discover";render()');
 for(let i=0;i<200;i++){await turn();if(h.run('Discover.records.size===30&&[...Discover.records.values()].every(r=>r.state==="ready")'))break}
 assert.equal(h.run('Discover.records.size'),30);assert.equal(h.run('[...Discover.records.values()].filter(r=>r.state==="ready").length'),30);
 assert.equal(h.run('AppStorage.getItem("anishelf-library-v1")'),beforeLibrary);assert.equal(h.run('AppStorage.getItem("anishelf-watch-history-v1")'),beforeHistory);
 assert.match(h.get('#discover-ranking').innerHTML,/Romaji 1/);assert.doesNotMatch(h.get('#discover-ranking').innerHTML,/TMDb title/);assert.equal(h.get('.section-toolbar').hidden,true);
 h.run('Discover.open(2)');const markup=h.get('#detailBody').innerHTML;assert.match(markup,/addDiscoverToLibrary/);assert.match(markup,/TMDb overview/);assert.doesNotMatch(markup,/ratingStars|detailRating|detailStatus|episodeValue|saveDetail|deleteAnime|favorite"/);
 h.run('Discover.add(2)');assert.equal(h.run('library.length'),1);assert.equal(h.run('library[0].title'),'English 2');assert.equal(h.run('library[0].rating'),0);assert.equal(h.run('library[0].progress'),0);assert.equal(h.run('library[0].status'),'planned');h.run('Discover.add(2)');assert.equal(h.run('library.length'),1);
 assert.equal(h.run('Discover.records.get(11).candidate.seasonNumber'),1);h.run('Discover.add(11)');assert.equal(h.run('library.length'),2);assert.equal(h.run('library[0].id'),'tv-1011-s01');h.run('Discover.add(11)');assert.equal(h.run('library.length'),2);
 assert.equal(h.run('AppStorage.getItem("anishelf-watch-history-v1")'),beforeHistory);
 const requestBodies=calls.filter(c=>c.url.startsWith('/.anishelf/mal')).map(c=>JSON.parse(c.options.body));for(const body of requestBodies){assert.ok(!('library' in body));assert.ok(!('rating' in body));assert.ok(!('notes' in body));assert.ok(!('title' in body))}
 h.run('renderSettings()');h.get('#discoverEnabled').checked=false;h.get('#discoverEnabled').onchange({target:h.get('#discoverEnabled')});assert.equal(h.run('Discover.enabled'),false);assert.equal(h.get('#discoverNav').hidden,true);assert.equal(h.run('Discover.records.size'),0);
 const C=require('./dist/storage-core.js');assert.ok(!C.KEYS.includes('anishelf-mal-client-id'));assert.ok(!C.KEYS.includes('anishelf-mal-session'));assert.ok(!C.KEYS.includes('anishelf-discover-enabled'));
 console.log('PASS: English/Romaji titles, season ambiguity, 10+10+10 MAL sections, TMDb-only artwork/overview, read-only preview, explicit add/dedup with zero progress/history, no library payloads to MAL, discover-off hidden/cleared, browser-only config excluded from folder keys. Mock API/DOM.');
})().catch(error=>{console.error(error);process.exitCode=1});
