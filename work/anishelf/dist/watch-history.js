/* Actual saved viewing progress only. Weekly plans and imports never create sessions. */
const WatchHistory=(()=>{
 const key='anishelf-watch-history-v1',libraryKey='anishelf-library-v1';
 const animeKey=id=>typeof id+':'+id;
 const recordKey=r=>animeKey(r.animeId)+':'+(r.cycle||0)+':'+r.episode;
 const cycle=a=>Number.isInteger(a.rewatchCount)&&a.rewatchCount>=0&&a.rewatchCount<=999?a.rewatchCount:a.status==='rewatching'?1:0;
 const watchedEpisodes=a=>Array.isArray(a.seasonEntries)?a.seasonEntries.reduce((sum,c)=>sum+watchedEpisodes(c),0):cycle(a)*(Number(a.episodes)||0)+(Number(a.progress)||0);
 function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00');return Number.isFinite(d.getTime())&&WatchSchedule.dateKey(d)===value;}
 function validate(value){if(!Array.isArray(value)||value.length>100000)throw Error('Invalid watch history');return value.map(r=>{
  if(!r||!['number','string'].includes(typeof r.animeId)||typeof r.title!=='string'||r.title.length>100||!validDate(r.date)||!Number.isInteger(r.episode)||r.episode<1||r.episode>9999||!Number.isFinite(r.minutes)||r.minutes<0||(r.minutes===0&&!r.unknown)||r.minutes>1440)throw Error('Invalid watch record');
  if(r.cycle!==undefined&&(!Number.isInteger(r.cycle)||r.cycle<0||r.cycle>999))throw Error('Invalid watch cycle');
  return {animeId:r.animeId,title:r.title,date:r.date,episode:r.episode,minutes:r.minutes,estimated:!!r.estimated,unknown:!!r.unknown,...(r.cycle===undefined?{}:{cycle:r.cycle})};
 });}
 let records=[];try{const saved=AppStorage.getItem(key);if(saved)records=validate(JSON.parse(saved));}catch{}
 const deduplicate=items=>[...new Map(items.map(r=>[recordKey(r),r])).values()];
 records=deduplicate(records);
 let totals=new Map(),knownAnime=new Map();
 function effective(r){const a=knownAnime.get(animeKey(r.animeId));if(a){const current=duration(a,r.episode);if(!current.unknown)return {...r,...current};}if(r.estimated||r.unknown)return {...r,minutes:0,estimated:false,unknown:true};return r;}
 function index(){totals=new Map();records.forEach(raw=>{const r=effective(raw);totals.set(r.date,(totals.get(r.date)||0)+r.minutes);});}index();
 function refresh(items){knownAnime=new Map((typeof SeasonModel!=='undefined'?[...items,...SeasonModel.leaves(items)]:items).map(a=>[animeKey(a.id),a]));index();}
 function duration(a,number){
  let episodeRuntime=null,offset=0;if(Number.isInteger(a.seasonNumber))episodeRuntime=a.episodeDetails?.[a.seasonNumber]?.find(e=>e.number===number)?.runtime;
  for(const season of [...(Number.isInteger(a.seasonNumber)?[]:(a.seasons||[]))].filter(s=>s.number>0).sort((x,y)=>x.number-y.number)){
   const count=Number(season.episodes)||0;
   if(number>offset&&number<=offset+count){episodeRuntime=a.episodeDetails?.[season.number]?.find(e=>e.number===number-offset)?.runtime;break;}offset+=count;
  }
  const runtime=Number(episodeRuntime)||Number(a.runtime);
  return Number.isFinite(runtime)&&runtime>0&&runtime<=1440?{minutes:runtime,estimated:false,unknown:false}:{minutes:0,estimated:false,unknown:true};
 }
 function summary(items){let minutes=0,unknown=0;for(const a of (typeof SeasonModel!=='undefined'?SeasonModel.leaves(items):items)){const rounds=cycle(a),progress=Number(a.progress)||0;for(let episode=1;episode<=Math.max(progress,rounds?(Number(a.episodes)||0):0);episode++){const multiplier=rounds+(episode<=progress?1:0),d=duration(a,episode);minutes+=d.minutes*multiplier;if(d.unknown)unknown+=multiplier;}}return {minutes,unknown};}
 function planned(a,changes,date=new Date()){
  const nextCycle=cycle({...a,...changes}),previous=cycle(a)===nextCycle?Number(a.progress)||0:0,next=Number(changes.progress)||0,id=animeKey(a.id);
  let result=records.filter(r=>animeKey(r.animeId)!==id||(r.cycle||0)!==nextCycle||r.episode<=next);
  const present=new Set(result.map(recordKey));
  for(let episode=previous+1;episode<=next;episode++){
   const record={animeId:a.id,title:String(a.title).slice(0,100),date:WatchSchedule.dateKey(date),episode,...duration(a,episode),...(nextCycle?{cycle:nextCycle}:{})};
   if(!present.has(recordKey(record)))result.push(record);
  }
  return result;
 }
 // Roll back the first write if the second fails, leaving the current in-memory state intact.
 function persist(nextLibrary,nextRecords){
  if(nextRecords.length>100000)throw Error('Watch history is full');
  const before=AppStorage.getItem(key);AppStorage.setItem(key,JSON.stringify(nextRecords));
  try{AppStorage.setItem(libraryKey,JSON.stringify(nextLibrary));}catch(error){try{if(before===null)AppStorage.removeItem(key);else AppStorage.setItem(key,before);}catch{}throw error;}
  records=nextRecords;refresh(nextLibrary);
 }
 function commit(nextLibrary,a,changes){persist(nextLibrary,planned(a,changes));}
 function mergeBackup(nextLibrary,history){const incoming=history===undefined?[]:validate(history);persist(nextLibrary,deduplicate([...incoming,...records]));}
 function groups(date){const grouped=new Map();records.filter(r=>r.date===date).map(effective).forEach(r=>{const id=animeKey(r.animeId)+':'+(r.cycle||0);if(!grouped.has(id))grouped.set(id,{animeId:r.animeId,title:r.title,cycle:r.cycle||0,minutes:0,episodes:[],unknown:0});const group=grouped.get(id);group.minutes+=r.minutes;group.episodes.push(r.episode);if(r.unknown)group.unknown++;});return [...grouped.values()].map(g=>({...g,episodes:g.episodes.sort((a,b)=>a-b)}));}
 let month=new Date(new Date().getFullYear(),new Date().getMonth(),1),day=null;
 const format=value=>I18n.formatDate(value);
 function level(minutes){return minutes<=0?0:Math.min(5,Math.ceil(Math.min(100,minutes)/20));}
 function markup(){
  if(day){const list=groups(day);return '<section class="watch-calendar"><button id="historyBack" class="history-control">← '+t('返回日历')+'</button><h2>'+format(day)+'</h2><p class="history-summary">'+(totals.get(day)||0)+' '+t('分钟')+'</p>'+(list.length?list.map((g,i)=>'<article class="history-entry"><div><h3>'+esc(g.title)+(g.cycle?' · '+t('重看')+' '+g.cycle:'')+'</h3><p>'+t('集数')+' '+g.episodes.join(', ')+' · '+g.minutes+' '+t('分钟')+(g.unknown?' · '+g.unknown+' '+t('集缺少时长'):'')+'</p></div>'+(findLibraryEntry(g.animeId)?'<button class="history-control" data-history-anime="'+i+'">'+t('动漫详情')+'</button>':'<span>'+t('已移除收藏')+'</span>')+'</article>').join(''):'<p class="detail-empty">'+t('当天没有观看记录')+'</p>')+'</section>';}
  const year=month.getFullYear(),m=month.getMonth(),start=new Date(year,m,1),count=new Date(year,m+1,0).getDate(),cells=Math.ceil((start.getDay()+count)/7)*7;
  const title=new Intl.DateTimeFormat(I18n.getLanguage(),{year:'numeric',month:'long'}).format(month);
  const weekdays=Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(I18n.getLanguage(),{weekday:'short'}).format(new Date(2026,9,11+i)));
  const today=WatchSchedule.dateKey(new Date());
  return '<section class="watch-calendar"><div class="calendar-heading"><h2>'+t('观看日历')+'</h2><div class="calendar-month"><button id="historyPrevious" class="history-control" aria-label="'+t('上个月')+'">‹</button><strong>'+title+'</strong><button id="historyNext" class="history-control" aria-label="'+t('下个月')+'">›</button><button id="historyToday" class="history-control">'+t('本月')+'</button></div></div><div class="calendar-weekdays" aria-hidden="true">'+weekdays.map(w=>'<span>'+w+'</span>').join('')+'</div><div class="calendar-grid">'+Array.from({length:cells},(_,i)=>{
   const date=new Date(year,m,1-start.getDay()+i),dateString=WatchSchedule.dateKey(date),minutes=totals.get(dateString)||0;
   return '<button class="calendar-day heat-'+level(minutes)+(date.getMonth()!==m?' outside-month':'')+'" data-history-date="'+dateString+'" aria-label="'+format(dateString)+' · '+minutes+' '+t('分钟')+'"'+(dateString===today?' aria-current="date"':'')+'><span>'+date.getDate()+'</span><small>'+minutes+' '+t('分钟')+'</small></button>';
  }).join('')+'</div><div class="calendar-legend"><span>0 '+t('分钟')+'</span>'+[0,1,2,3,4,5].map(n=>'<i class="heat-'+n+'" aria-hidden="true"></i>').join('')+'<span>100+ '+t('分钟')+'</span></div><p class="history-help">'+t('只记录保存后的新增已看集数；排番不计入。')+' '+t('优先使用 TMDb 分集时长，其次使用影片 runtime；缺少时长的集数不计入分钟数。')+'</p></section>';
 }
 function bind(){
  if(day){document.querySelector('#historyBack').onclick=()=>{const previousDay=day;day=null;renderStats();document.querySelector('[data-history-date="'+previousDay+'"]')?.focus();};const list=groups(day);document.querySelectorAll('[data-history-anime]').forEach(b=>b.onclick=()=>openDetail(list[Number(b.dataset.historyAnime)].animeId));return;}
  document.querySelector('#historyPrevious').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);renderStats();document.querySelector('#historyPrevious')?.focus();};
  document.querySelector('#historyNext').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);renderStats();document.querySelector('#historyNext')?.focus();};
  document.querySelector('#historyToday').onclick=()=>{month=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderStats();document.querySelector('#historyToday')?.focus();};
  document.querySelectorAll('[data-history-date]').forEach(b=>b.onclick=()=>{day=b.dataset.historyDate;renderStats();document.querySelector('#historyBack')?.focus();});
 }
 return {validate,validDate,replaceRecords:(next,items)=>{records=deduplicate(validate(next));refresh(items)},commit,mergeBackup,exportRecords:()=>records.map(r=>({...effective(r)})),groups,total:date=>totals.get(date)||0,level,markup,bind,planned,summary,refresh,cycle,watchedEpisodes};
})();
