/* Season identity and migration planning. No network or implicit migration. */
(function(root){
 const keys=['anishelf-library-v1','anishelf-watch-history-v1','anishelf-lists-v1','anishelf-series-archive-v1'],journal='anishelf-season-transaction-v1';
 const isSeason=a=>a?.entryType==='season'&&Number.isInteger(a.seasonNumber)&&a.seasonNumber>=0;
 const label=n=>(typeof I18n!=='undefined'&&I18n.getLanguage()==='en-US'?(n===0?'Specials':'Season '+n):(n===0?'特别篇':'第 '+n+' 季'));
 const seriesKey=a=>a.tmdbId?'tv-'+a.tmdbId:(a.seriesKey||'local-'+a.id);
 const identity=(a,n=a.seasonNumber)=>seriesKey(a)+'-s'+String(n).padStart(2,'0');
 const noteSeparator='\n\n---\n\n';
 function mergeNotes(...values){const parts=[],seen=new Set();for(const value of values){if(typeof value!=='string')continue;for(const part of value.replace(/\r\n?/g,'\n').split(noteSeparator)){const note=part.trim();if(note&&!seen.has(note)){seen.add(note);parts.push(part)}}}return parts.join(noteSeparator)}
 const isMerged=a=>a?.entryType==='series'&&Array.isArray(a.seasonEntries)&&a.seasonEntries.length>0;
 const leaves=items=>items.flatMap(a=>isMerged(a)?a.seasonEntries:[a]);
 const find=(items,id)=>items.find(a=>a.id===id)||leaves(items).find(a=>a.id===id);
 function refreshMerged(a){if(!isMerged(a))return a;const children=[...a.seasonEntries].sort((x,y)=>x.seasonNumber-y.seasonNumber),episodes=children.reduce((sum,c)=>sum+c.episodes,0),progress=children.reduce((sum,c)=>sum+((c.rewatchCount||0)>0?c.episodes:c.progress),0);
  const status=['watching','rewatching','planned','dropped','paused'].find(status=>children.some(c=>c.status===status))||(children.every(c=>c.status==='completed')?'completed':'planned');
  const starts=children.map(c=>c.startDate).filter(Boolean).sort(),finishes=children.map(c=>c.finishDate).filter(Boolean).sort();return {...a,seasonEntries:children,episodes,progress,rewatchCount:0,status,startDate:starts[0]||'',finishDate:status==='completed'&&finishes.length===children.length?finishes.at(-1):'',note:mergeNotes(...children.map(c=>c.note),a.seriesNote),seasons:children.map(c=>({number:c.seasonNumber,episodes:c.episodes,name:c.seasonName||label(c.seasonNumber),airDate:c.airDate||''})),episodeDetails:{},watchDays:[...new Set(children.flatMap(c=>c.watchDays||[]))]};
 }
 function patch(items,id,changes){return items.map(a=>a.id===id?(isMerged(a)?refreshMerged({...a,...changes}):{...a,...changes}):isMerged(a)&&a.seasonEntries.some(c=>c.id===id)?refreshMerged({...a,seasonEntries:a.seasonEntries.map(c=>c.id===id?{...c,...changes}:c)}):a)}
 function mergePlan(selected,items,history,lists){if(selected.length<2||selected.some(a=>!isSeason(a))||new Set(selected.map(seriesKey)).size!==1||new Set(selected.map(a=>a.seasonNumber)).size!==selected.length)throw Error('Select at least two seasons from the same series');
  const first=[...selected].sort((a,b)=>a.seasonNumber-b.seasonNumber)[0],id='series:'+seriesKey(first),existing=items.find(a=>a.id===id);if(existing&&(!isMerged(existing)||existing.seasonEntries.some(c=>!selected.some(s=>s.id===c.id))))throw Error('Select all seasons already in the merged series');if(selected.some(a=>!find(items,a.id)))throw Error('Season no longer exists');if(selected.reduce((sum,a)=>sum+a.episodes,0)>9999)throw Error('Too many episodes in a merged series');
  const parent=refreshMerged({...first,...(existing||{}),id,entryType:'series',seasonNumber:undefined,seasonEntries:selected.map(a=>({...a})),title:first.seriesTitle||first.title,seriesNote:existing?.seriesNote||'',shuffleExcluded:existing?.shuffleExcluded??false,image:existing?.image||first.seriesImage||first.image,heroImage:existing?.heroImage||first.seriesImage||first.image,rating:existing?.rating||0,tmdbRating:0,tmdbVoteCount:0,scoreScope:'series',startDate:'',finishDate:'',favorite:selected.some(a=>a.favorite)}),ids=new Set(selected.map(a=>a.id));let placed=false;
  const library=items.flatMap(a=>!ids.has(a.id)&&a.id!==id?[a]:placed?[]:(placed=true,[parent]));return {library,history,lists:lists.map(l=>({...l,animeIds:[...new Set(l.animeIds.map(ref=>ids.has(ref)?id:ref))]})),parent};
 }
 function splitMergedPlan(parent,items,history,lists,archive=[]){if(!isMerged(parent))throw Error('Not a merged series');const children=parent.seasonEntries.map(a=>a.seasonNumber===1?{...a,note:mergeNotes(a.note,parent.seriesNote)}:{...a});if(children.some(c=>items.some(a=>a.id===c.id)))throw Error('Duplicate season');
  const snapshot={id:parent.id+'-'+Date.now(),source:{id:parent.id,title:parent.title,tmdbId:parent.tmdbId,seriesKey:parent.seriesKey,note:parent.seriesNote||'',rating:parent.rating},history:[],lists:lists.filter(l=>l.animeIds.includes(parent.id)),seasonIds:children.map(c=>c.id),createdAt:new Date().toISOString()};
  return {library:items.flatMap(a=>a.id===parent.id?children:[a]),history,lists:lists.map(l=>({...l,animeIds:[...new Set(l.animeIds.flatMap(id=>id===parent.id?children.map(c=>c.id):[id]))]})),archive:[...archive,snapshot]};
 }
 function validateCatalog(items){const ids=new Set(),seasons=new Set();for(const a of [...items,...items.filter(isMerged).flatMap(a=>a.seasonEntries)]){if(!a||!['number','string'].includes(typeof a.id)||ids.has(typeof a.id+':'+a.id))throw Error('Duplicate or invalid entry ID');ids.add(typeof a.id+':'+a.id);if(a.entryType==='series'&&(!isMerged(a)||a.seasonEntries.length>1000||a.seasonEntries.some(c=>!isSeason(c)||seriesKey(c)!==seriesKey(a))))throw Error('Invalid merged series');if(a.entryType==='season'){if(!isSeason(a)||a.seasonNumber>999||typeof a.title!=='string'||a.title.length>100||!Number.isInteger(a.episodes)||a.episodes<1||a.episodes>9999||!Number.isInteger(a.progress)||a.progress<0||a.progress>a.episodes||!['planned','watching','rewatching','completed','paused','dropped'].includes(a.status)||!Number.isFinite(a.rating)||a.rating<0||a.rating>10||!Number.isInteger(a.year)||!Number.isInteger(a.rewatchCount??0)||(a.rewatchCount??0)<0||(a.rewatchCount??0)>999)throw Error('Invalid season');const key=identity(a);if(seasons.has(key))throw Error('Duplicate season');seasons.add(key)}}}
 function from(base,s,details=null){
  const n=s.number,count=details?.episodes?.length||Number(s.episodes)||0;if(!Number.isInteger(n)||n<0||n>999||!Number.isInteger(count)||count<0||count>9999)throw Error('Invalid season data');
  const episodes=details?.episodes?.map(e=>({number:e.episode_number,name:e.name||'',overview:e.overview||'',airDate:e.air_date||'',runtime:e.runtime||null,image:root.TMDB.imageUrl(e.still_path,'w342')}))||base.episodeDetails?.[n]||[];
  const dates=episodes.map(e=>e.airDate).filter(Boolean).sort(),today=new Date().toISOString().slice(0,10),airDate=details?.air_date||s.airDate||'',endDate=dates.length===count&&count>0&&dates.at(-1)<=today?dates.at(-1):'';
  const poster=details?.poster_path?root.TMDB.imageUrl(details.poster_path,'w500'):(s.image||''),seriesTitle=base.seriesTitle||base.title;
  const credits=details&&root.TMDB.metadata(details,'tv');
  return {...base,id:identity(base,n),entryType:'season',seasonNumber:n,seriesKey:seriesKey(base),seriesTitle,seriesImage:base.seriesImage||base.image,seasonName:details?.name||s.name||label(n),title:(seriesTitle.slice(0,97-label(n).length)+' · '+label(n)),en:(base.seriesOriginalTitle||base.en||'')+' · Season '+n,seriesOriginalTitle:base.seriesOriginalTitle||base.en||'',
   image:base.usingCustomPoster?base.image:poster||base.seriesImage||base.image,heroImage:base.usingCustomPoster?base.image:poster||base.seriesImage||base.heroImage||base.image,
   episodes:count||1,episodeCountUnknown:!count,progress:0,status:'planned',rating:0,note:'',rewatchCount:0,startDate:'',finishDate:'',watchDays:[],watchDay:null,
   airDate,endDate,year:Number(airDate.slice(0,4))||base.year||new Date().getFullYear(),genre:base.genre||'未分类',tag:base.tag||'',favorite:!!base.favorite,broadcastStatus:endDate?'Ended':airDate&&airDate>today?'Planned':'',overview:details?.overview||base.overview||'',tmdbRating:details?.vote_average||0,tmdbVoteCount:details?.vote_count??null,scoreScope:'season',
   cast:credits?.cast?.length?credits.cast:base.cast,crew:credits?.crew?.length?credits.crew:base.crew,
   allSeasons:base.allSeasons||base.seasons||[],seasons:[{...s,number:n,episodes:count}],episodeDetails:{[n]:episodes},episodeLanguages:{[n]:details?(typeof I18n!=='undefined'?I18n.getLanguage():'zh-CN'):(base.episodeLanguages?.[n]||'zh-CN')},detailsVersion:3};
 }
 function suggestions(source,seasons){let offset=0;return seasons.filter(s=>s.number>0&&s.episodes>0).sort((a,b)=>a.number-b.number).map(s=>{const progress=Math.max(0,Math.min(s.episodes,(Number(source.progress)||0)-offset)),active=source.progress>=offset&&source.progress<offset+s.episodes&&['watching','rewatching','paused','dropped'].includes(source.status),rewatchCount=offset+s.episodes<=source.episodes?(source.rewatchCount||0):0;offset+=s.episodes;const status=progress===s.episodes?'completed':progress>0||active?(rewatchCount?'rewatching':['paused','dropped'].includes(source.status)?source.status:'watching'):'planned';return {number:s.number,progress,status,rewatchCount,startDate:'',finishDate:''}})}
 // Record-level inverse patches avoid copying the entire library/history into AppStorage.
 const itemKey=(key,item)=>key==='anishelf-watch-history-v1'?JSON.stringify([typeof item.animeId,item.animeId,item.cycle||0,item.episode]):typeof item.id+':'+item.id;
 function undoPatch(key,before,after){
  if(before===null)return {kind:'raw',value:null};
  try{const old=JSON.parse(before),next=JSON.parse(after);if(!Array.isArray(old)||!Array.isArray(next))throw Error();
   const oldMap=new Map(old.map(item=>[itemKey(key,item),item])),newMap=new Map(next.map(item=>[itemKey(key,item),item]));if(oldMap.size!==old.length||newMap.size!==next.length)throw Error();
   const commonOld=old.map(item=>itemKey(key,item)).filter(id=>newMap.has(id)),commonNew=next.map(item=>itemKey(key,item)).filter(id=>oldMap.has(id));if(JSON.stringify(commonOld)!==JSON.stringify(commonNew))throw Error();
   const restore=[];old.forEach((item,index)=>{const id=itemKey(key,item);if(!newMap.has(id)||JSON.stringify(item)!==JSON.stringify(newMap.get(id)))restore.push({index,item})});
   return {kind:'array',restore,added:[...newMap.keys()].filter(id=>!oldMap.has(id))};
  }catch{return {kind:'raw',value:before}}
 }
 function undoValue(key,patch,current){
  if(patch.kind==='raw'){if(patch.value!==null&&typeof patch.value!=='string')throw Error('Invalid season recovery data');return patch.value}
  if(patch.kind!=='array'||!Array.isArray(patch.restore)||!Array.isArray(patch.added)||patch.added.some(id=>typeof id!=='string')||patch.restore.some(r=>!r||!Number.isInteger(r.index)||r.index<0||!r.item||typeof r.item!=='object'))throw Error('Invalid season recovery data');
  const items=JSON.parse(current);if(!Array.isArray(items))throw Error('Invalid season recovery data');const touched=new Set([...patch.added,...patch.restore.map(r=>itemKey(key,r.item))]);
  const restored=items.filter(item=>!touched.has(itemKey(key,item)));for(const r of [...patch.restore].sort((a,b)=>a.index-b.index))restored.splice(r.index,0,r.item);return JSON.stringify(restored);
 }
 function restoreUndo(storage,undo){
  if(!undo||typeof undo!=='object'||Array.isArray(undo)||Object.keys(undo).some(key=>!keys.includes(key)))throw Error('Invalid season recovery data');
  const changes=Object.entries(undo).map(([key,patch])=>{const current=storage.getItem(key),value=undoValue(key,patch,current);return {key,value,freed:(current?.length||0)-(value?.length||0)}});
  // Release newly allocated data first, so rollback itself does not need extra quota.
  changes.sort((a,b)=>b.freed-a.freed);for(const {key,value}of changes)value===null?storage.removeItem(key):storage.setItem(key,value);
 }
 function transaction(values,storage=root.AppStorage||root.localStorage){
  if(Object.keys(values).some(key=>!keys.includes(key)))throw Error('Invalid transaction key');
  if(storage.getItem(journal))recover(storage);
  const undo={},changes=[];for(const [key,value]of Object.entries(values)){const before=storage.getItem(key);if(before!==value){undo[key]=undoPatch(key,before,value);changes.push([key,value])}}
  if(!changes.length)return;
  // Failure to reserve the small journal occurs before any application records change.
  storage.setItem(journal,JSON.stringify({version:2,undo}));
  try{for(const [key,value]of changes)storage.setItem(key,value);storage.removeItem(journal)}catch(error){try{restoreUndo(storage,undo);storage.removeItem(journal)}catch{error.recoveryPending=true}throw error}
 }
 function recover(storage){const raw=storage.getItem(journal);if(!raw)return;const data=JSON.parse(raw);
  if(data.version===2)restoreUndo(storage,data.undo);
  else if(data.version===1&&data.before&&Object.keys(data.before).every(key=>keys.includes(key))&&Object.values(data.before).every(value=>value===null||typeof value==='string')){const undo=Object.fromEntries(Object.entries(data.before).map(([key,value])=>[key,{kind:'raw',value}]));restoreUndo(storage,undo)}
  else throw Error('Invalid season recovery data');storage.removeItem(journal);
 }
 function plan(source,entries,library,history,lists,archive=[],allowTotalChange=false){
  if(!library.some(a=>a.id===source.id)||isSeason(source))throw Error('Original series no longer exists');
  const nums=new Set();for(const a of entries){if(!isSeason(a)||nums.has(a.seasonNumber)||library.some(b=>b.id!==source.id&&isSeason(b)&&identity(b)===identity(a)))throw Error('Duplicate season');nums.add(a.seasonNumber);if(!Number.isInteger(a.episodes)||a.episodes<1||a.episodes>9999||a.seasonNumber>999||!Number.isInteger(a.progress)||a.progress<0||a.progress>a.episodes||!Number.isInteger(a.rewatchCount)||a.rewatchCount<0||a.rewatchCount>999||!['watching','rewatching','planned','completed','paused','dropped'].includes(a.status)||a.status==='rewatching'&&!a.rewatchCount||a.status==='completed'&&a.progress!==a.episodes||a.startDate&&a.finishDate&&a.finishDate<a.startDate)throw Error('Invalid season tracking');}
  if(!entries.length)throw Error('Select at least one season');
  // Keep the original note on Season 1 only; never guess that another selected season is Season 1.
  entries=entries.map(a=>a.seasonNumber===1?{...a,note:mergeNotes(a.note,source.note)}:a);
  const ordered=[...(source.allSeasons||source.seasons||[])].filter(s=>s.number>0).sort((a,b)=>a.number-b.number);let offset=0;const ranges=ordered.map(s=>{const r={number:s.number,start:offset+1,end:offset+s.episodes};offset+=s.episodes;return r});
  if(ordered.some(s=>!Number.isInteger(s.episodes)||s.episodes<0)||new Set(ordered.map(s=>s.number)).size!==ordered.length)throw Error('Invalid season boundaries');
  const originals=history.filter(r=>r.animeId===source.id),mapped=[];for(const r of originals){const range=ranges.find(s=>r.episode>=s.start&&r.episode<=s.end),entry=entries.find(a=>a.seasonNumber===range?.number);if(entry)mapped.push({...r,animeId:entry.id,title:entry.title,episode:r.episode-range.start+1});else throw Error('A season containing watch history must be selected')}
  // A changed total requires explicit correction, including new or changed TMDb season counts.
  if(!allowTotalChange&&entries.reduce((sum,a)=>sum+a.rewatchCount*a.episodes+a.progress,0)!==(source.rewatchCount||0)*source.episodes+source.progress)throw Error('Season totals differ from the original. Review the preview and explicitly confirm a total correction.');
  const next=library.flatMap(a=>a.id===source.id?entries:[a]),nextHistory=history.filter(r=>r.animeId!==source.id).concat(mapped),nextLists=lists.map(l=>({...l,animeIds:[...new Set(l.animeIds.flatMap(id=>id===source.id?entries.map(a=>a.id):[id]))]}));
  const snapshot={id:String(source.id)+'-'+Date.now(),source,history:originals,lists:lists.filter(l=>l.animeIds.includes(source.id)),createdAt:new Date().toISOString(),seasonIds:entries.map(a=>a.id)};
  return {library:next,history:nextHistory,lists:nextLists,archive:[...archive,snapshot]};
 }
 const api={validateCatalog,isSeason,isMerged,leaves,find,refreshMerged,patch,mergePlan,splitMergedPlan,label,seriesKey,identity,mergeNotes,from,suggestions,transaction,recover,plan};root.SeasonModel=api;if(typeof module!=='undefined')module.exports=api;
 if(root.AppStorage||root.localStorage)recover(root.AppStorage||root.localStorage);
})(globalThis);
