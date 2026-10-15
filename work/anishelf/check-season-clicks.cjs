const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let core=fs.readFileSync('check.cjs','utf8');core=core.slice(0,core.indexOf('const a=boot();'))+'\nglobalThis.harness=boot();';core=core.replace('addEventListener(){},createElement','addEventListener(type,fn,options){(this.listeners??=[]).push({type,fn,options})},createElement');
const context={require,console,Blob,URL,AbortController,structuredClone};vm.createContext(context);vm.runInContext(core,context);const h=context.harness;
h.run(fs.readFileSync('dist/season-model.js','utf8'));h.run("let tmdbCredential='';");h.run(fs.readFileSync('dist/tmdb-api.js','utf8'));h.run(fs.readFileSync('dist/details.js','utf8'));
const base={genre:'动画',episodes:12,progress:2,status:'watching',rating:0,year:2026,favorite:true,entryType:'season',seasonNumber:2,seriesTitle:'Example',detailsVersion:3,seasons:[{number:2,episodes:12}],watchDays:[0,1,2,3,4,5,6]};
const items=[{...base,id:'tv-900-s02',title:'Season 2'},{...base,id:99,title:'Numeric ID',entryType:undefined,seasonNumber:undefined},{...base,id:'99',title:'Numeric-looking string ID'},{...base,id:'x"><img src=x onerror=alert(1)>',title:'Escaped ID'}];h.run('library='+JSON.stringify(items));
const click=h.context.document.listeners.find(entry=>entry.type==='click'&&String(entry.fn).includes('resolveEntryId'));assert.ok(click,'test must exercise the actual delegated click handler');
function activate(id){click.fn({target:{closest:selector=>selector==='[data-detail]'?{dataset:{detail:JSON.stringify(id)}}:null}});assert.equal(h.run('selectedId'),id);assert.equal(h.get('#detailDialog').open,true);assert.match(h.get('#detailBody').innerHTML,new RegExp(items.find(a=>a.id===id).title));}
for(const page of ['library','favorites','watching']){h.run('page='+JSON.stringify(page)+';render()');activate('tv-900-s02');}
h.run("page='library';view='list';render()");activate('tv-900-s02');assert.match(h.get('#animeGrid').innerHTML,/data-detail="&quot;tv-900-s02&quot;"/);
const gallery=h.run('GalleryView.markup(library)');assert.match(gallery,/data-detail="&quot;tv-900-s02&quot;"/);activate('tv-900-s02');activate(99);activate('99');activate(items[3].id);
assert.doesNotMatch(h.get('#animeGrid').innerHTML,/data-detail="x"><img/);assert.equal(h.run('resolveEntryId("does-not-exist")'),undefined);assert.equal(h.run('resolveEntryId("null")'),undefined);
const previous=h.run('selectedId');click.fn({target:{closest:selector=>selector==='[data-detail]'?{dataset:{detail:'does-not-exist'}}:null}});assert.equal(h.run('selectedId'),previous);
h.run("page='library';const listId=AniLists.create('Seasons');AniLists.setMembers(listId,['tv-900-s02']);AniLists.select(listId)");activate('tv-900-s02');
assert.ok(fs.readFileSync('../../outputs/AniShelf.html','utf8').includes(fs.readFileSync('dist/app.js','utf8')));
console.log('PASS: actual card click delegation opens season details from Library/Favorites/Watching/list/gallery markup and custom lists; numeric and numeric-looking string IDs remain distinct; attributes are escaped; missing IDs are ignored. DOM events mocked.');
