/* Compatibility import. Personal records are saved first; metadata lookup is optional enhancement. */
const ExternalImport=(()=>{
 const states={planned:'planned',watched:'completed',watching:'watching',dropped:'dropped',paused:'paused',on_hold:'paused'};
 const titleKey=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const aliases=a=>[a.title,a.en,a.externalSourceTitle,a.tmdbTitle].map(titleKey).filter(Boolean);
 let busy=false,cancelled=false,dismissed=false,notificationActive=false,initialized=false,phase='ready',last={added:0,skipped:0,enriched:0,total:0,processed:0},lastError='';
 function parse(data){if(!data||!Array.isArray(data.entries)||data.entries.length>5000)throw Error(t('导入格式不正确'));
  return data.entries.map(entry=>{if(!entry||typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>100||!Object.hasOwn(states,entry.watchStatus)||(entry.favorite!==undefined&&typeof entry.favorite!=='boolean')||(entry.notes!==undefined&&typeof entry.notes!=='string'))throw Error(t('导入格式不正确'));
   let startDate='';if(entry.dateSaved){const date=new Date(entry.dateSaved);if(!Number.isFinite(date.getTime()))throw Error(t('导入格式不正确'));startDate=WatchSchedule.dateKey(date);}
   return {title:entry.title.trim(),status:states[entry.watchStatus],favorite:entry.favorite===true,note:String(entry.notes||'').slice(0,2000),startDate};
  });
 }
 function stage(entries,existing){const known=new Set(existing.flatMap(aliases)),used=new Set(existing.map(a=>a.id));let id=Date.now(),skipped=0;const added=[];
  for(const entry of entries){const canonical=titleKey(entry.title);if(known.has(canonical)){skipped++;continue;}known.add(canonical);while(used.has(id))id++;used.add(id);
   added.push({id:id++,en:'',year:0,yearUnknown:true,episodes:1,episodeCountUnknown:true,progress:0,rating:0,image:'',genre:t('未分类'),tag:'',...entry,externalSourceTitle:entry.title,tmdbImportState:'pending'});
  }return {added,skipped};
 }
 function similarity(title,candidate){const values=[candidate.name,candidate.title,candidate.original_name,candidate.original_title].filter(Boolean);if(values.some(v=>titleKey(v)===titleKey(title)))return 1;
  const words=value=>new Set(String(value).normalize('NFKD').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]),source=words(title);
  return Math.max(0,...values.map(value=>{const target=words(value),common=[...source].filter(word=>target.has(word)).length;return 2*common/(source.size+target.size||1);}));
 }
 function choose(title,candidates){const unique=[...new Map(candidates.filter(a=>!a.adult&&a.genre_ids?.includes(16)).map(a=>[a.media_type+':'+a.id,a])).values()],ranked=unique.map(a=>({a,score:similarity(title,a)})).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return null;const first=ranked[0],second=ranked[1];return first.score>=.82&&(!second||first.score-second.score>=.12)?first.a:null;
 }
 async function find(title,credential){const search=async query=>{const responses=await Promise.all(['tv','movie'].map(async type=>{const data=await TMDB.request('search/'+type,credential,{query,language:'en-US',include_adult:false,page:1});return (data.results||[]).map(a=>({...a,media_type:type}));}));return responses.flat();};
  let candidates=await search(title),match=choose(title,candidates);if(match)return match;
  const prefix=title.split(/[:：]/)[0].trim();if(prefix!==title&&prefix.length>=4){candidates=[...candidates,...await search(prefix)];match=choose(title,candidates);}return match;
 }
 const pending=()=>library.filter(a=>a.tmdbImportState==='pending');
 const failed=()=>library.filter(a=>a.tmdbImportState==='failed');
 const ambiguous=()=>library.filter(a=>a.tmdbImportState==='ambiguous');
 function resultText(){return last.skipped+' '+t('跳过重复')+' · '+last.enriched+' '+t('已补全')+' · '+ambiguous().length+' '+t('需要确认')+' · '+failed().length+' '+t('请求失败')+' · '+pending().length+' '+t('未处理');}
 function report(){const remaining=pending().length;$('#importSummary').hidden=!notificationActive||dismissed;$('#importSummaryText').textContent=t(phase==='finished'?'匹配已结束':phase==='stopped'?'匹配已停止':phase==='blocked'?'匹配已中断':'导入结果')+': '+last.added+' '+t('新增')+' · '+resultText()+(busy?' · '+last.processed+' / '+last.total:'')+(lastError?' · '+lastError:'');$('#retryImportedMetadata').hidden=busy||remaining===0;$('#retryFailedMetadata').hidden=busy||failed().length===0;$('#cancelImportLookups').hidden=!busy;$('#cancelImportLookups').disabled=cancelled;}
 function persist(items){AppStorage.setItem('anishelf-library-v1',JSON.stringify(items));library=items;render();}
 function mark(id,state){const record=library.find(a=>a.id===id);if(record)persist(library.map(a=>a.id===id?{...a,tmdbImportState:state}:a));}
 async function enrich(ids,mode='pending'){if(busy)return;mode=mode==='failed'?'failed':'pending';ids=[...new Set(ids)].filter(id=>library.some(a=>a.id===id&&a.tmdbImportState===mode));
  if(!ids.length){report();return;}
  notificationActive=true;dismissed=false;
  const credential=tmdbCredential;
  if(!credential){lastError=t('请先在设置中配置 TMDb，再补全资料');report();return;}
  busy=true;cancelled=false;dismissed=false;phase='running';last.total=ids.length;last.processed=0;lastError='';let consecutiveFailures=0;report();
  try{for(const id of ids){if(tmdbCredential!==credential)cancelled=true;if(cancelled)break;const initial=library.find(a=>a.id===id);if(!initial||initial.tmdbImportState!==mode)continue;
   try{const match=await find(initial.externalSourceTitle||initial.title,credential);if(cancelled)break;if(!library.some(a=>a.id===id))continue;
    if(!match){mark(id,'ambiguous');lastError=t('部分标题无法唯一匹配，请使用在线搜索确认');consecutiveFailures=0;continue;}
    const duplicate=library.find(a=>a.id!==id&&a.tmdbId===match.id&&a.tmdbType===match.media_type&&!Number.isInteger(a.seasonNumber));
    if(duplicate){persist(library.filter(a=>a.id!==id));last.skipped++;last.added=Math.max(0,last.added-1);consecutiveFailures=0;continue;}
    const data=await TMDB.request(match.media_type+'/'+match.id,credential,{append_to_response:match.media_type==='movie'?'images,credits':'images,aggregate_credits',include_image_language:'zh,ja,en,null'});if(cancelled)break;const current=library.find(a=>a.id===id);if(!current)continue;
    // Recheck after the network request, since another import may have completed meanwhile.
    if(library.some(a=>a.id!==id&&a.tmdbId===match.id&&a.tmdbType===match.media_type&&!Number.isInteger(a.seasonNumber))){persist(library.filter(a=>a.id!==id));last.skipped++;last.added=Math.max(0,last.added-1);continue;}
    const metadata=TMDB.normalize(data,match.media_type),next={...metadata,...current,...TMDB.metadata(data,match.media_type),id:current.id,tmdbId:match.id,tmdbType:match.media_type,tmdbTitle:data.name||data.title||'',en:data.original_name||data.original_title||'',year:metadata.year,yearUnknown:!(data.first_air_date||data.release_date),episodes:metadata.episodes,episodeCountUnknown:metadata.episodeCountUnknown,image:metadata.image,progress:current.status==='completed'?metadata.episodes:Math.min(current.progress,metadata.episodes),tmdbImportState:'complete'};
    persist(library.map(a=>a.id===id?next:a));last.enriched++;consecutiveFailures=0;
   }catch(error){lastError=error.message;consecutiveFailures++;try{mark(id,'failed');}catch{phase='blocked';throw error;}if(error.status===401||error.status===403||error.status===429||consecutiveFailures>=3){phase='blocked';break;}}
   finally{last.processed++;report();}
  }}finally{busy=false;if(cancelled){phase='stopped';lastError=t('已停止匹配，导入条目保留');}else if(phase==='running')phase='finished';report();toast(t(phase==='finished'?'匹配已结束':phase==='stopped'?'匹配已停止':'匹配已中断')+': '+resultText());}
 }
 async function importEntries(data){if(busy)throw Error(t('正在补全资料，请稍后导入'));const mapped=parse(data),result=stage(mapped,library);notificationActive=true;dismissed=false;phase='ready';last={added:result.added.length,skipped:result.skipped,enriched:0,total:0,processed:0};lastError='';
  if(result.added.length)persist([...library,...result.added]);report();if(result.added.length)await enrich(result.added.map(a=>a.id));return {...last,pending:pending().length};
 }
 function start(){if(initialized)return;initialized=true;$('#importSummary').hidden=true;$('#closeImportSummary').onclick=()=>{dismissed=true;$('#importSummary').hidden=true;$('#search').focus();};const nativeImport=$('#importFile').onchange;
  $('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;let data;try{if(file.size>25e6)throw Error(t('导入文件过大'));data=JSON.parse(await file.text());}catch(error){toast(error.message||t('导入格式不正确'));e.target.value='';return;}
   if(!data||Array.isArray(data)||!Object.hasOwn(data,'entries')){await nativeImport(e);return;}
   try{await importEntries(data);}catch(error){toast(error.message||t('导入失败'));}finally{e.target.value='';}
  };
  $('#retryImportedMetadata').onclick=()=>enrich(pending().map(a=>a.id)).catch(error=>toast(error.message));$('#retryFailedMetadata').onclick=()=>enrich(failed().map(a=>a.id),'failed').catch(error=>toast(error.message));$('#cancelImportLookups').onclick=()=>{cancelled=true;lastError=t('正在停止匹配…');report();};
  const nativeSettings=renderSettings;renderSettings=function(){nativeSettings();const unprocessed=pending().length,errors=failed().length,review=ambiguous().length;if(!unprocessed&&!errors&&!review)return;const row=document.createElement('section');row.className='setting-row';row.innerHTML='<div><h3>'+t('导入资料')+'</h3><p>'+unprocessed+' '+t('未处理')+' · '+errors+' '+t('请求失败')+' · '+review+' '+t('需要确认')+'</p></div><div class="import-resume-actions">'+(unprocessed?'<button id="resumePendingMetadata">'+t('补全导入资料')+'</button>':'')+(errors?'<button id="resumeFailedMetadata">'+t('重试失败请求')+'</button>':'')+'</div>';$('#extraSection .settings-panel').append(row);if(unprocessed)$('#resumePendingMetadata').onclick=()=>enrich(pending().map(a=>a.id)).catch(error=>toast(error.message));if(errors)$('#resumeFailedMetadata').onclick=()=>enrich(failed().map(a=>a.id),'failed').catch(error=>toast(error.message));};
 }
 return {parse,stage,choose,similarity,importEntries,enrich,start};
})();
ExternalImport.start();
