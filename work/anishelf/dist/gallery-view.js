/* Horizontal native scrolling; no autoplay, document-wide handlers or rendering dependency. */
const GalleryView=(()=>{
 let observer=null,track=null,signature='',firstId=null;
 const available=()=>page==='library'&&!tag&&!AniLists.current();
 function destroy(){if(observer){observer.disconnect();observer=null;}track=null;}
 function sync(){destroy();const allowed=available();$('#galleryViewButton').hidden=!allowed;$('#galleryViewButton').disabled=!allowed;if(view==='gallery'&&!allowed)view='grid';$$('[data-view]').forEach(button=>{const on=button.dataset.view===view;button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on));});}
 function markup(entries){if(!entries.length)return t('<div class="empty">暂无动漫<br>点击「添加动漫」开始收藏。</div>');
  return '<section class="library-gallery" aria-label="'+t('画廊视图')+'"><div class="gallery-controls"><span id="galleryPosition" aria-live="polite"></span><button id="galleryPrevious" aria-label="'+t('上一部动漫')+'">‹</button><button id="galleryNext" aria-label="'+t('下一部动漫')+'">›</button></div><div id="galleryTrack" class="gallery-track" tabindex="0" role="region" aria-label="'+t('画廊视图，左右方向键浏览')+'">'+entries.map((a,index)=>{
   const image=safeImage(a.image).replace(/^https:\/\/image\.tmdb\.org\/t\/p\/w(?:185|342|500)\//,'https://image.tmdb.org/t/p/w780/');
   return '<article class="gallery-card" data-watch-status="'+esc(a.status)+'" data-gallery-index="'+index+'"><div class="gallery-dates"><div><span>'+t('开始日期')+'</span><strong>'+esc(a.startDate?I18n.formatDate(a.startDate):t('未记录'))+'</strong></div><span aria-hidden="true">···</span><div><span>'+t('完成日期')+'</span><strong>'+esc(a.finishDate?I18n.formatDate(a.finishDate):t('未记录'))+'</strong></div></div><button class="gallery-poster" data-detail="'+esc(JSON.stringify(a.id))+'" aria-label="'+t('查看 ')+esc(a.title)+'"><img src="'+esc(image)+'" alt="'+esc(a.title)+'" loading="lazy" decoding="async"><span class="status-badge '+a.status+'">'+statuses[a.status]+'</span><span class="gallery-favorite'+(a.favorite?' is-favorite':'')+'" aria-hidden="true">'+icon('heart')+'</span></button><h3>'+esc(a.title)+'</h3></article>';
  }).join('')+'</div></section>';
 }
 function bind(entries,nextSignature){if(nextSignature!==signature){firstId=null;signature=nextSignature;}
  track=$('#galleryTrack');if(!entries.length||!track)return;const current=track,cards=[...current.querySelectorAll('.gallery-card')];
  function index(){let closest=0,distance=Infinity;cards.forEach((card,i)=>{const value=Math.abs(card.offsetLeft-current.scrollLeft);if(value<distance){distance=value;closest=i;}});return closest;}
  function update(){if(!cards.length)return;const start=index();firstId=entries[start].id;$('#galleryPrevious').disabled=current.scrollLeft<=2;$('#galleryNext').disabled=current.scrollLeft+current.clientWidth>=current.scrollWidth-2;const visible=cards.filter(card=>card.offsetLeft+card.offsetWidth>current.scrollLeft+2&&card.offsetLeft<current.scrollLeft+current.clientWidth-2);const end=visible.length?Number(visible.at(-1).dataset.galleryIndex)+1:start+1,label=(start+1)+'–'+end+' / '+entries.length;if($('#galleryPosition').textContent!==label)$('#galleryPosition').textContent=label;}
  function go(to){to=Math.max(0,Math.min(entries.length-1,to));const reduced=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;current.scrollTo({left:cards[to].offsetLeft,behavior:reduced?'auto':'smooth'});}
  $('#galleryPrevious').onclick=()=>go(index()-1);$('#galleryNext').onclick=()=>go(index()+1);current.onscroll=update;
  current.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||e.altKey||e.ctrlKey||e.metaKey)return;e.preventDefault();const card=e.target.closest?.('[data-gallery-index]'),from=card?Number(card.dataset.galleryIndex):index(),to=e.key==='Home'?0:e.key==='End'?entries.length-1:Math.max(0,Math.min(entries.length-1,from+(e.key==='ArrowLeft'?-1:1)));go(to);if(card)cards[to].querySelector('button')?.focus({preventScroll:true});};
  const initial=entries.findIndex(a=>a.id===firstId);if(initial>=0)current.scrollLeft=cards[initial].offsetLeft;
  update();if(typeof ResizeObserver==='function'){observer=new ResizeObserver(update);observer.observe(current);}
 }
 return {available,sync,markup,bind};
})();
