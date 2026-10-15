/* Episode picks do not change progress or viewing history. Native modal and form controls. */
const Shuffle=(()=>{
 let generation=0,previous=null;const requests=new Map();
 const available=()=>['library','watching','favorites'].includes(page);
 function pool(){return available()?collectionEntries().filter(a=>a.shuffleExcluded!==true).flatMap(a=>Array.isArray(a.seasonEntries)?a.seasonEntries.filter(child=>page!=='watching'||WatchSchedule.matches(child,WatchSchedule.selectedDate())):[a]).filter(a=>a.shuffleExcluded!==true&&!a.episodeCountUnknown&&Number.isInteger(a.episodes)&&a.episodes>0&&(page!=='watching'||a.progress<a.episodes)):[];}
 function pick(items,watching=false,last=null,random=Math.random){
  let total=0,excluded=-1;const ranges=items.map(a=>{const start=watching?Math.max(0,Number(a.progress)||0)+1:1,count=watching?1:a.episodes,offset=total;total+=count;if(last?.animeId===a.id&&last.number>=start&&last.number<start+count)excluded=offset+last.number-start;return {a,start,count,offset};});
  if(!total)return null;let ticket=Math.floor(random()*(total-(excluded>=0&&total>1?1:0)));if(excluded>=0&&total>1&&ticket>=excluded)ticket++;
  const range=ranges.find(r=>ticket<r.offset+r.count);return {animeId:range.a.id,number:range.start+ticket-range.offset};
 }
 function location(a,number){if(Number.isInteger(a.seasonNumber))return {season:a.seasonNumber,number};let offset=0;for(const season of [...(a.seasons||[])].filter(s=>s.number>0).sort((x,y)=>x.number-y.number)){const count=Number(season.episodes)||0;if(number<=offset+count)return {season:season.number,number:number-offset};offset+=count;}return {season:1,number};}
 function cache(id,patch){const current=findLibraryEntry(id);if(!current)return;const next=patchLibraryEntry(id,patch);AppStorage.setItem('anishelf-library-v1',JSON.stringify(next));library=next;}
 async function episode(id,number){
  let a=findLibraryEntry(id);if(!a)return null;if(a.tmdbType==='movie')return {name:a.title,image:a.heroImage||a.image,overview:a.overview||'',movie:true};
  const credential=typeof tmdbCredential==='string'?tmdbCredential:'',language=I18n.getLanguage();
  if(a.tmdbId&&credential&&!Number.isInteger(a.seasonNumber)&&!(a.seasons||[]).some(s=>s.number>0)){
   const key='series:'+id;let task=requests.get(key);if(!task){task=TMDB.request('tv/'+a.tmdbId,credential).then(data=>cache(id,{seasons:(data.seasons||[]).map(s=>({number:s.season_number,name:s.name||'',episodes:s.episode_count||0,airDate:s.air_date||''}))}));requests.set(key,task);task.finally(()=>requests.delete(key)).catch(()=>{});}await task;a=findLibraryEntry(id);if(!a)return null;
  }
  const pos=location(a,number),cached=a.episodeDetails?.[pos.season]?.find(e=>e.number===pos.number),sameLanguage=(a.episodeLanguages?.[pos.season]||'zh-CN')===language;
  if(cached&&(!credential||sameLanguage))return {...cached,...pos};
  if(!a.tmdbId||!credential)return cached?{...cached,...pos}:null;
  const key=id+':'+pos.season+':'+language;let task=requests.get(key);
  if(!task){task=TMDB.request('tv/'+a.tmdbId+'/season/'+pos.season,credential).then(data=>{const current=findLibraryEntry(id);if(!current)return;const episodes=(data.episodes||[]).map(e=>({number:e.episode_number,name:e.name||'',overview:e.overview||'',airDate:e.air_date||'',runtime:e.runtime||null,image:TMDB.imageUrl(e.still_path,'w780')}));cache(id,{episodeDetails:{...current.episodeDetails,[pos.season]:episodes},episodeLanguages:{...current.episodeLanguages,[pos.season]:language}});});requests.set(key,task);task.finally(()=>requests.delete(key)).catch(()=>{});}await task;
  const found=findLibraryEntry(id)?.episodeDetails?.[pos.season]?.find(e=>e.number===pos.number);return found?{...found,...pos}:null;
 }
 function showResult(result,details=null){const a=findLibraryEntry(result.animeId);if(!a)return;
  $('#shuffleTitle').textContent=a.title;let label=I18n.getLanguage()==='en-US'?'Episode '+result.number:'第 '+result.number+' 集';if(details?.season&&details.season>1)label+=' · '+(I18n.getLanguage()==='en-US'?'Season '+details.season+', Episode '+details.number:'第 '+details.season+' 季，第 '+details.number+' 集');$('#shuffleEpisode').textContent=label;
  $('#shuffleEpisodeTitle').textContent=details?.name||'';$('#shuffleImage').onerror=e=>{e.target.onerror=null;e.target.src=placeholder;};$('#shuffleImage').src=safeImage(details?.image||a.heroImage||a.image);$('#shuffleImage').alt=a.title+' · '+label;$('#shuffleImageHint').textContent=details?.image?'':t('暂无本集缩略图，使用动漫海报');$('#shuffleOverview').textContent=details?.overview||t('暂无本集简介');
  const url=normalizeWatchURL(a.watchSite?.url),name=String(a.watchSite?.name||'').trim(),labelWatch=I18n.getLanguage()==='en-US'?'Watch with '+name:'在 '+name+' 观看';
  $('#shuffleWatch').innerHTML=url&&name?'<a class="primary" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(labelWatch)+'</a>':'<button class="primary" disabled>'+t('未设置观看站点')+'</button>';
  $('#shuffleDetails').onclick=()=>{$('#shuffleDialog').close();openDetail(a.id);};
 }
 async function draw(){
  const result=pick(pool(),page==='watching',previous);if(!result){toast(t('没有可抽取的集数，请检查筛选、排除设置或观看进度'));return;}previous=result;const ticket=++generation,dialog=$('#shuffleDialog');showResult(result);$('#shuffleStatus').textContent=t('加载分集资料');if(!dialog.open)dialog.showModal();
  try{const data=await episode(result.animeId,result.number);if(ticket!==generation||!dialog.open)return;showResult(result,data);$('#shuffleStatus').textContent=data?'':t('离线或缺少分集资料，可在详情页补全');}catch(error){if(ticket===generation&&dialog.open)$('#shuffleStatus').textContent=t('分集资料加载失败')+' · '+error.message;}
 }
 function sync(){$('#shuffle').hidden=!available();$('#shuffle').disabled=available()&&pool().length===0;$('#shuffle').setAttribute('title',t($('#shuffle').disabled?'没有可抽取的集数，请检查筛选、排除设置或观看进度':'随机抽取'));}
 function setExcluded(id,excluded){const current=findLibraryEntry(id);if(!current)return;cache(id,{shuffleExcluded:!!excluded});sync();}
 function settings(){const choices=LibrarySort.sort(library,'title'),section=document.createElement('section');section.className='shuffle-settings';section.innerHTML='<h3>'+t('随机抽取排除名单')+'</h3><p>'+t('勾选的动漫不会参与随机抽取。')+'</p><input id="shuffleExcludeSearch" class="list-member-search" placeholder="'+t('搜索收藏')+'" aria-label="'+t('搜索动漫')+'"><div class="shuffle-exclusions">'+(choices.length?choices.map((a,index)=>'<label class="list-member-row" data-shuffle-row="'+index+'"><input type="checkbox" data-shuffle-exclude="'+index+'"'+(a.shuffleExcluded===true?' checked':'')+'><span>'+esc(a.title)+'</span></label>').join(''):'<p class="detail-empty">'+t('资料库暂无动漫，请先添加动漫。')+'</p>')+'</div>';$('#extraSection .settings-panel').append(section);
  $('#shuffleExcludeSearch').oninput=()=>{const query=$('#shuffleExcludeSearch').value.trim().toLowerCase();$$('[data-shuffle-row]').forEach(row=>{const a=choices[Number(row.dataset.shuffleRow)];row.hidden=!(a.title+' '+(a.en||'')).toLowerCase().includes(query);});};
  $$('[data-shuffle-exclude]').forEach(input=>input.onchange=()=>{try{setExcluded(choices[Number(input.dataset.shuffleExclude)].id,input.checked);}catch{input.checked=!input.checked;toast(t('保存失败，请检查存储空间'));}});
 }
 const baseSettings=renderSettings;renderSettings=function(){baseSettings();settings();};
 $('#shuffle').onclick=draw;$('#shuffleAgain').onclick=draw;$('#shuffleDialog').addEventListener('close',()=>{generation++;previous=null;});$('#shuffleImage').onerror=e=>{e.target.onerror=null;e.target.src=placeholder;};sync();
 return {pick,pool,location,episode,draw,sync,setExcluded};
})();
