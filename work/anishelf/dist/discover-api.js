/* Discovery data is transient; no AppStorage or library writes in this module. */
(function(root){
'use strict';
const titleKey=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function normalize(node){
 if(!node||!Number.isSafeInteger(node.id)||node.id<1)return null;
 const roman=typeof node.title==='string'?node.title.trim():'',english=typeof node.alternative_titles?.en==='string'?node.alternative_titles.en.trim():'';
 if(!english&&!roman||node.nsfw&&node.nsfw!=='white')return null;
 return {malId:node.id,title:(english||roman).slice(0,300),romanTitle:roman.slice(0,300),startDate:typeof node.start_date==='string'?node.start_date:'',year:Number(String(node.start_date||'').slice(0,4))||0,mediaType:node.media_type==='movie'?'movie':'tv',episodes:Number.isInteger(node.num_episodes)?node.num_episodes:0,score:typeof node.mean==='number'&&Number.isFinite(node.mean)?node.mean:null};
}
function rows(data){const seen=new Set();return (Array.isArray(data?.data)?data.data:[]).map(row=>normalize(row?.node)).filter(a=>a&&!seen.has(a.malId)&&(seen.add(a.malId),true)).slice(0,10)}
function season(date=new Date()){return {year:date.getFullYear(),season:['winter','spring','summer','fall'][Math.floor(date.getMonth()/3)]}}
function baseTitle(title){return String(title).replace(/\b(?:season\s+\d+|\d+(?:st|nd|rd|th)\s+season)\b/ig,'').replace(/\s*[:\-]\s*$/,'').trim()}
function chooseMatch(anime,candidates){
 const aliases=[anime.title,anime.romanTitle,baseTitle(anime.title),baseTitle(anime.romanTitle)].map(titleKey).filter(Boolean);
 const ranked=candidates.filter(c=>!c.adult&&Array.isArray(c.genre_ids)&&c.genre_ids.includes(16)).map(c=>{
  const names=[c.name,c.title,c.original_name,c.original_title].map(titleKey).filter(Boolean),year=Number((c.first_air_date||c.release_date||'').slice(0,4));
  const exact=names.some(n=>aliases.includes(n));return {candidate:c,score:exact?1+(anime.year===year?.04:0):0};
 }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
 return ranked.length&&(!ranked[1]||ranked[0].score-ranked[1].score>=.03)?ranked[0].candidate:null;
}
function chooseSeason(anime,seasons){const list=seasons.filter(s=>Number.isInteger(s.number)&&s.number>0),explicit=anime.title.match(/\b(?:season\s+(\d+)|(\d+)(?:st|nd|rd|th)\s+season)\b/i);
 if(explicit){const n=Number(explicit[1]||explicit[2]),found=list.find(s=>s.number===n);return found&&(!anime.year||!found.airDate||Math.abs(Number(found.airDate.slice(0,4))-anime.year)<=1)?found:null}
 const exact=list.filter(s=>anime.startDate&&s.airDate===anime.startDate);if(exact.length===1)return exact[0];
 const inYear=list.filter(s=>anime.year&&Number((s.airDate||'').slice(0,4))===anime.year);if(inYear.length===1)return inYear[0];return list.length===1?list[0]:null;
}
async function request(route,input,{fetcher=root.fetch?.bind(root),signal}={}){
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(abort,22000);
 try{const response=await fetcher('/.anishelf/mal/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-AniShelf-Request':'discover-v1'},credentials:'omit',referrerPolicy:'no-referrer',body:JSON.stringify(input),signal:controller.signal});let data;try{data=await response.json()}catch{throw Error('Start AniShelf with the updated local launcher / 请使用新版本地启动器')}
  if(!response.ok){const error=Error(typeof data.error==='string'?data.error:'MAL request failed');error.status=response.status;throw error}return data;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
const api={normalize,rows,season,chooseMatch,chooseSeason,baseTitle,titleKey,request};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DiscoverAPI=api;
})(globalThis);
