/* Shared boundary validation. Data remains data, including nested imported metadata. */
(function(root){
'use strict';
const invalid=()=>{throw Error('Invalid anime metadata / 动漫资料格式不正确')};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function inspect(value,depth=0){
 if(depth>40)invalid();
 if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){
  if(['__proto__','constructor','prototype','_anishelfDetail'].includes(key))invalid();
  inspect(child,depth+1);
 }
}
function number(row,key,min,max,integer=false){const n=row[key];if(n!==undefined&&n!==null&&(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n)))invalid()}
function strings(row,keys){for(const key of keys)if(row[key]!==undefined&&row[key]!==null&&typeof row[key]!=='string')invalid()}
function rows(value,check,max=10000){if(!Array.isArray(value)||value.length>max)invalid();for(const row of value){if(!object(row))invalid();check(row)}}
function metadata(a){
 if(!object(a))invalid();
 if(a.status!==undefined&&!['planned','watching','rewatching','completed','paused','dropped'].includes(a.status))invalid();
 strings(a,['title','en','genre','tag','note','overview','image','heroImage','titleLogo','seriesImage','seriesTitle','seriesNote','seasonName','homepage','broadcastStatus','airDate','endDate','startDate','finishDate','metadataLanguage']);
 for(const key of ['episodes','progress'])number(a,key,0,9999,true);
 number(a,'year',0,9999,true);number(a,'rating',0,10);number(a,'runtime',0,1440);
 number(a,'seasonCount',0,9999,true);number(a,'seasonNumber',0,999,true);number(a,'rewatchCount',0,999,true);
 number(a,'tmdbRating',0,10);number(a,'tmdbVoteCount',0,Number.MAX_SAFE_INTEGER,true);
 for(const key of ['seasons','allSeasons'])if(a[key]!==undefined&&a[key]!==null)rows(a[key],s=>{
  if(!Number.isInteger(s.number)||s.number<0||s.number>999)invalid();
  number(s,'episodes',0,9999,true);strings(s,['name','airDate','image']);
 },1000);
 if(a.episodeDetails!==undefined&&a.episodeDetails!==null){
  if(!object(a.episodeDetails)||Object.keys(a.episodeDetails).length>1000)invalid();
  for(const [season,episodes]of Object.entries(a.episodeDetails)){
   if(!/^\d{1,3}$/.test(season))invalid();
   rows(episodes,e=>{if(!Number.isInteger(e.number)||e.number<0||e.number>9999)invalid();number(e,'runtime',0,1440);strings(e,['name','overview','airDate','image'])});
  }
 }
 for(const key of ['cast','crew'])if(a[key]!==undefined&&a[key]!==null)rows(a[key],p=>strings(p,['name','role','image']));
 if(a.watchSite!==undefined&&a.watchSite!==null){if(!object(a.watchSite))invalid();strings(a.watchSite,['name','url'])}
 if(a.seasonEntries!==undefined){rows(a.seasonEntries,metadata,1000)}
}
function validateCatalog(items){inspect(items);rows(items,metadata);return items}
const api={validateCatalog,inspect};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DataSafety=api;
})(globalThis);
