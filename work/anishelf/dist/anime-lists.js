/* Lists own references and order, never the library records themselves. */
const AniLists=(()=>{
 const key='anishelf-lists-v1';let lists=null,selected=null,previousSort={key:'title',direction:'asc'},started=false,editingId=null,dragged=null;
 const unique=values=>[...new Set(values)];
 function validate(value){if(!Array.isArray(value)||value.length>200)throw Error('Invalid lists');const ids=new Set();return value.map(list=>{
  if(!list||typeof list.id!=='string'||!list.id||list.id.length>120||ids.has(list.id)||typeof list.name!=='string'||!list.name.trim()||list.name.length>80||!Array.isArray(list.animeIds)||list.animeIds.length>5000||list.animeIds.some(id=>!['number','string'].includes(typeof id)))throw Error('Invalid list');ids.add(list.id);return {id:list.id,name:list.name.trim(),animeIds:unique(list.animeIds)};
 });}
 try{const saved=AppStorage.getItem(key);if(saved!==null)lists=validate(JSON.parse(saved));}catch{lists=[];}
 function persist(next){const valid=validate(next);AppStorage.setItem(key,JSON.stringify(valid));lists=valid;}
 function ensure(items){if(lists!==null)return;const defaults=['治愈','冒险'].map((name,i)=>({id:'default-'+i,name:t(name),animeIds:items.filter(a=>a.tag===name||String(a.genre||'').includes(name)).map(a=>a.id)}));try{persist(defaults);}catch{lists=defaults;}}
 const current=()=>lists?.find(list=>list.id===selected)||null;
 const members=(items,list=current(),byId=new Map(items.map(a=>[a.id,a])))=>list?list.animeIds.map(id=>byId.get(id)).filter(Boolean):[];
 const exportLists=()=>lists?.map(list=>({...list,animeIds:[...list.animeIds]}))||[];
 function create(name){name=String(name||'').trim();if(!name||name.length>80)return null;const list={id:'list-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),name,animeIds:[]};persist([...(lists||[]),list]);return list.id;}
 function rename(id,name){name=String(name||'').trim();if(!name||name.length>80)return;persist(lists.map(list=>list.id===id?{...list,name}:list));}
 function setMembers(id,animeIds){persist(lists.map(list=>list.id===id?{...list,animeIds:unique(animeIds)}:list));}
 function removeAnime(id,animeId){const list=lists.find(l=>l.id===id);if(list)setMembers(id,list.animeIds.filter(item=>item!==animeId));}
 function removeList(id){const index=lists.findIndex(l=>l.id===id);if(index<0)return null;const removed=lists[index];persist(lists.filter(l=>l.id!==id));return {removed,index};}
 function restore(snapshot){if(!snapshot||lists.some(l=>l.id===snapshot.removed.id))return;const next=exportLists();next.splice(Math.min(snapshot.index,next.length),0,snapshot.removed);persist(next);}
 function moveList(id,delta){const next=exportLists(),index=next.findIndex(l=>l.id===id),target=index+delta;if(index<0||target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];persist(next);}
 function moveAnime(id,animeId,delta,items){const list=lists.find(l=>l.id===id);if(!list)return;const visible=members(items,list).map(a=>a.id),index=visible.indexOf(animeId),target=index+delta;if(index<0||target<0||target>=visible.length)return;[visible[index],visible[target]]=[visible[target],visible[index]];setMembers(id,[...visible,...list.animeIds.filter(item=>!visible.includes(item))]);}
 function merged(incoming){if(incoming===undefined)return exportLists();const added=validate(incoming),next=exportLists();for(const list of added){const existing=next.find(l=>l.id===list.id);if(existing)existing.animeIds=unique([...existing.animeIds,...list.animeIds]);else next.push(list);}return validate(next);}
 function importLists(incoming){persist(merged(incoming));}
 function applyImport(incoming,commit){if(incoming===undefined){commit();return;}const next=merged(incoming),before=AppStorage.getItem(key);AppStorage.setItem(key,JSON.stringify(next));try{commit();lists=next;}catch(error){try{if(before===null)AppStorage.removeItem(key);else AppStorage.setItem(key,before);}catch{}throw error;}}
 function select(id){if(!lists.some(l=>l.id===id))return;if(!selected)previousSort={key:$('#sort').value==='manual'?'title':$('#sort').value,direction:$('#sortDirection').value};if(selected!==id)editingId=null;selected=id;page='library';filter='all';tag='';$('#search').value='';$('#sort').value='manual';$('#sortDirection').value='asc';render();}
 function clearSelection(){editingId=null;clearDrag();selected=null;if($('#sort').value==='manual'){$('#sort').value=previousSort.key;$('#sortDirection').value=previousSort.direction;}}
 let memberPositions=new Map(),rawPositions=new Map();
 function sidebar(items){const byId=new Map(items.map(a=>[a.id,a])),list=current();memberPositions=new Map(members(items,list,byId).map((a,i)=>[a.id,i]));rawPositions=new Map((list?.animeIds||[]).map((id,i)=>[id,i]));
  const rows=(lists||[]).map((list,index)=>'<div class="collection-row"><button class="collection'+(page==='library'&&list.id===selected?' selected':'')+'" data-list-open="'+index+'" title="'+esc(list.name)+'"'+(page==='library'&&list.id===selected?' aria-current="page"':'')+'><span class="collection-name">'+esc(list.name)+'</span><span class="collection-count">'+members(items,list,byId).length+'</span></button><button class="collection-more" data-list-more="'+index+'" aria-label="'+t('片单操作')+' · '+esc(list.name)+'" aria-haspopup="dialog" aria-controls="listContextMenu" aria-expanded="false">⋯</button></div>').join('');
  $('#collections').innerHTML=rows;$('#compactListRows').innerHTML=rows||'<p class="detail-empty">'+t('暂无片单')+'</p>';$('#compactLists').classList.toggle('active',page==='library'&&!!list);
 }
 const isEditing=()=>page==='library'&&!!current()&&editingId===selected;
 function cardAttributes(a){return isEditing()?' draggable="true" data-list-edit-index="'+rawPositions.get(a.id)+'"':'';}
 function cardActions(a){if(!isEditing())return '';const index=rawPositions.get(a.id);return '<div class="list-card-actions"><button class="list-edit-remove" data-list-edit-remove="'+index+'" aria-label="'+t('移出片单')+' '+esc(a.title)+'">'+t('移出片单')+'</button></div>';}
 function openMembers(){const list=current();if(!list)return;const choices=[...library],selectedIds=new Set(list.animeIds);
  $('#listDialogTitle').textContent=t('添加 / 管理动漫')+' · '+list.name;
  $('#listMemberSearch').value='';$('#listMemberRows').innerHTML=choices.length?choices.map((a,index)=>'<label class="list-member-row" data-member-row="'+index+'"><input type="checkbox" data-member-index="'+index+'"'+(selectedIds.has(a.id)?' checked':'')+'><span>'+esc(a.title)+'</span></label>').join(''):'<p class="detail-empty">'+t('资料库暂无动漫，请先添加动漫。')+'</p>';
  $('#listMemberSearch').oninput=()=>{const query=$('#listMemberSearch').value.trim().toLowerCase();$$('[data-member-row]').forEach(row=>{const a=choices[Number(row.dataset.memberRow)];row.hidden=!((a.title+' '+(a.en||'')).toLowerCase().includes(query));});};
  $('#saveListMembers').onclick=()=>{const checked=new Set($$('[data-member-index]').filter(input=>input.checked).map(input=>choices[Number(input.dataset.memberIndex)].id));const ordered=[...list.animeIds.filter(id=>checked.has(id)),...choices.map(a=>a.id).filter(id=>checked.has(id)&&!list.animeIds.includes(id))];try{setMembers(list.id,ordered);$('#listDialog').close();render();$('#manageListMembers').focus();toast(t('片单已保存'));}catch{toast(t('片单保存失败'));}};
  $('#listDialog').showModal();$('#listMemberSearch').focus();
 }
 function bindTools(){const list=page==='library'?current():null;if(!list)editingId=null;const editing=isEditing();$('#listTools').hidden=!list;$('#manualListOrder').hidden=!list;$('#manualListOrder').disabled=!list;$('#sort').disabled=editing;$('#listEditHint').hidden=!editing;$('#editList').textContent=t(editing?'完成编辑':'编辑');$('#editList').setAttribute('aria-pressed',String(editing));if(!list)return;
  $('#editList').onclick=()=>{closeMenus();clearDrag();editingId=editing?null:list.id;if(!editing){$('#sort').value='manual';$('#sortDirection').value='asc';$('#search').value='';filter='all';}render();$('#editList').focus();};
  $('#manageListMembers').onclick=openMembers;
  $('#renameList').onclick=()=>renameInteractive(list.id);
  $('#deleteList').onclick=()=>deleteInteractive(list.id);
 }
 let dropCard=null;
 function clearDrop(){if(dropCard){dropCard.classList.remove('list-drop-before','list-drop-after');dropCard=null;}}
 function clearDrag(){dragged=null;clearDrop();$$('#animeGrid .is-dragging').forEach(card=>card.classList.remove('is-dragging'));}
 function focusEdit(index){const button=document.querySelector('[data-list-reorder-index="'+index+'"]');if(button&&index>=0)button.focus();else $('#editList').focus();}
 function reorderAnime(listId,animeId,targetId,after){const list=lists.find(l=>l.id===listId);if(!list||animeId===targetId||!list.animeIds.includes(animeId)||!list.animeIds.includes(targetId))return false;const next=list.animeIds.filter(id=>id!==animeId),index=next.indexOf(targetId)+(after?1:0);next.splice(index,0,animeId);if(JSON.stringify(next)===JSON.stringify(list.animeIds))return false;setMembers(listId,next);return true;}
 function bindEditCards(){
  clearDrag();const grid=$('#animeGrid');grid.classList.toggle('list-editing',isEditing());
  grid.ondragstart=grid.ondragover=grid.ondrop=grid.ondragend=grid.onkeydown=null;if(!isEditing())return;
  $$('#animeGrid img').forEach(img=>img.draggable=false);$$('#animeGrid .poster').forEach(button=>{button.tabIndex=0;button.dataset.listReorderIndex=button.closest('[data-list-edit-index]').dataset.listEditIndex;button.setAttribute('aria-describedby','listEditHint');button.setAttribute('title',t('拖拽排序，或使用 Alt + 方向键'));});
  const cardAt=e=>{const card=e.target.closest?.('[data-list-edit-index]');return card&&grid.contains(card)?card:null;};
  const idAt=card=>current()?.animeIds[Number(card.dataset.listEditIndex)];
  const afterAt=(card,e)=>{const rect=card.getBoundingClientRect();return view==='list'?e.clientY>rect.top+rect.height/2:e.clientX>rect.left+rect.width/2;};
  grid.ondragstart=e=>{const card=cardAt(e),list=current();if(!isEditing()||!card||e.target.closest?.('[data-list-edit-remove]')){e.preventDefault();return;}const animeId=idAt(card);if(animeId===undefined){e.preventDefault();return;}dragged={listId:list.id,animeId};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','AniShelf list item');card.classList.add('is-dragging');};
  grid.ondragover=e=>{const card=cardAt(e);if(!isEditing()||!dragged||dragged.listId!==current()?.id||!card)return;e.preventDefault();e.dataTransfer.dropEffect='move';clearDrop();if(idAt(card)===dragged.animeId)return;dropCard=card;card.classList.add(afterAt(card,e)?'list-drop-after':'list-drop-before');};
  grid.ondrop=e=>{const card=cardAt(e);if(!isEditing()||!dragged||dragged.listId!==current()?.id||!card)return;e.preventDefault();const {listId,animeId}=dragged;try{const changed=reorderAnime(listId,animeId,idAt(card),afterAt(card,e));clearDrag();if(changed){render();focusEdit(current().animeIds.indexOf(animeId));toast(t('片单顺序已保存'));}}catch{clearDrag();toast(t('片单保存失败'));}};
  grid.ondragend=clearDrag;
  grid.onkeydown=e=>{const handle=e.target.closest?.('[data-list-reorder-index]');if(!isEditing()||!handle||!e.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const list=current(),animeId=list.animeIds[Number(handle.dataset.listReorderIndex)],ids=members(library).map(a=>a.id),delta=['ArrowUp','ArrowLeft'].includes(e.key)?-1:1,index=ids.indexOf(animeId);if(index<0||index+delta<0||index+delta>=ids.length)return;try{moveAnime(list.id,animeId,delta,library);render();focusEdit(current().animeIds.indexOf(animeId));toast(t('片单顺序已保存'));}catch{toast(t('片单保存失败'));}};
 }
 let pickerOpen=false,contextOpen=false,contextId=null,contextTrigger=null,contextInPicker=false;
 function showPopup(node,anchor){node.inert=false;node.hidden=false;if(typeof node.showPopover==='function')node.showPopover();const r=anchor.getBoundingClientRect(),box=node.getBoundingClientRect();const x=Math.max(8,Math.min(r.right+6,window.innerWidth-box.width-8)),y=Math.max(8,Math.min(r.top,window.innerHeight-box.height-8));node.style.left=x+'px';node.style.top=y+'px';}
 function hidePopup(node){node.inert=true;if(typeof node.hidePopover==='function'){try{node.hidePopover();}catch{}}node.hidden=true;}
 function hideContext(){if(!contextOpen)return;hidePopup($('#listContextMenu'));contextTrigger?.setAttribute('aria-expanded','false');contextOpen=false;contextId=null;}
 function hidePicker(){if(!pickerOpen)return;hideContext();hidePopup($('#listPicker'));$('#compactLists').setAttribute('aria-expanded','false');pickerOpen=false;}
 function focusContextTrigger(id){const index=lists.findIndex(l=>l.id===id);const compact=document.body.classList.contains('sidebar-collapsed')||(!document.body.classList.contains('sidebar-expanded')&&window.innerWidth<=800);if(compact&&!pickerOpen){$('#compactLists').focus();return;}const button=document.querySelector((contextInPicker&&pickerOpen?'#compactListRows ':'#collections ')+'[data-list-more="'+index+'"]');if(button)button.focus();else $('#compactLists').focus();}
 function openContext(id,trigger){if(contextOpen&&contextId===id){hideContext();trigger.focus();return;}hideContext();contextId=id;contextTrigger=trigger;contextInPicker=!!trigger.closest('#listPicker');const index=lists.findIndex(l=>l.id===id);$('#contextListName').textContent=lists[index].name;$('#contextMoveUp').disabled=index===0;$('#contextMoveDown').disabled=index===lists.length-1;showPopup($('#listContextMenu'),trigger);contextOpen=true;trigger.setAttribute('aria-expanded','true');$('#contextRename').focus();}
 function renameInteractive(id){const list=lists.find(l=>l.id===id);if(!list)return;const name=prompt(t('片单名称'),list.name);if(name===null)return;try{rename(id,name);hideContext();render();focusContextTrigger(id);}catch{toast(t('片单保存失败'));}}
 function deleteInteractive(id){try{const snapshot=removeList(id);if(!snapshot)return;hideContext();hidePicker();if(selected===id)clearSelection();render();toast(t('片单已删除，资料库保留'));clearTimeout(window.toastTimer);$('#toast').innerHTML=esc(t('片单已删除，资料库保留'))+' <button id="undoListDelete">'+t('撤销')+'</button>';$('#undoListDelete').onclick=()=>{try{restore(snapshot);render();toast(t('片单已恢复'));}catch{toast(t('片单保存失败'));}};window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),8000);}catch{toast(t('片单保存失败'));}}
 function bindMenus(){
  $('#compactLists').onclick=()=>{if(pickerOpen){hidePicker();$('#compactLists').focus();return;}showPopup($('#listPicker'),$('#compactLists'));pickerOpen=true;$('#compactLists').setAttribute('aria-expanded','true');$('#pickerNewList').focus();};
  $('#pickerNewList').onclick=()=>{hidePicker();$('#newCollection').onclick();};
  $('#contextRename').onclick=()=>renameInteractive(contextId);$('#contextDelete').onclick=()=>deleteInteractive(contextId);
  for(const [selector,delta]of [['#contextMoveUp',-1],['#contextMoveDown',1]])$(selector).onclick=()=>{const id=contextId;try{moveList(id,delta);hideContext();render();focusContextTrigger(id);}catch{toast(t('片单保存失败'));}};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(contextOpen||pickerOpen)){e.preventDefault();e.stopImmediatePropagation();if(contextOpen){const id=contextId;hideContext();focusContextTrigger(id);}else{hidePicker();$('#compactLists').focus();}}},true);
  document.addEventListener('focusin',e=>{if(contextOpen&&!e.target.closest('#listContextMenu')&&!e.target.closest('[data-list-more]'))hideContext();if(pickerOpen&&!contextOpen&&!e.target.closest('#listPicker')&&!e.target.closest('#compactLists'))hidePicker();});
  window.addEventListener?.('resize',closeMenus);
 }

 function start(){if(started)return;started=true;bindMenus();
  $('#newCollection').onclick=()=>{const name=prompt(t('片单名称'));if(!name?.trim())return;try{const id=create(name);if(id)select(id);}catch{toast(t('片单保存失败'));}};
  document.addEventListener('click',e=>{const open=e.target.closest('[data-list-open]'),more=e.target.closest('[data-list-more]'),remove=e.target.closest('[data-list-edit-remove]');try{
   if(remove&&isEditing()){const list=current(),index=Number(remove.dataset.listEditRemove);removeAnime(list.id,list.animeIds[index]);render();focusEdit(Math.min(index,current().animeIds.length-1));toast(t('已移出片单，资料库保留'));return;}
   if(open){const list=lists[Number(open.dataset.listOpen)];if(list){select(list.id);hideContext();hidePicker();$('#manageListMembers').focus();}return;}
   if(more){const list=lists[Number(more.dataset.listMore)];if(list)openContext(list.id,more);return;}
   if(e.target.closest('#listContextMenu'))return;
   if(!e.target.closest('#listContextMenu'))hideContext();
   if(!e.target.closest('#listPicker')&&!e.target.closest('#compactLists'))hidePicker();
  }catch{toast(t('片单保存失败'));}});
 }
 function closeMenus(){hideContext();hidePicker();}
 return {validate,replaceLists:next=>{lists=validate(next);editingId=null;clearDrag()},ensure,current,members,create,rename,setMembers,removeAnime,removeList,restore,moveList,moveAnime,merged,importLists,applyImport,exportLists,select,clearSelection,sidebar,cardActions,cardAttributes,isEditing,bindEditCards,bindTools,start,closeMenus};
})();
