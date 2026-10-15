/* Organize existing controls after every settings renderer has bound its handlers.
   Move the original nodes: rebuilding their HTML would discard listeners/values. */
(()=>{
 const groups=[
  ['profile','用户与语言','Profile and language',['.profile-settings','#languageMode']],
  ['appearance','外观与材质','Appearance and materials',['#themeMode','.personalization-settings']],
  ['library','资料库与观看','Library and watching',['.shuffle-settings','.season-settings']],
  ['storage','数据与备份','Data and backups',['[data-settings-section="storage"]','#folderStorageSettings','#exportData','#importData','#resumePendingMetadata','#resumeFailedMetadata']],
  ['services','服务连接','Connected services',['.tmdb-settings-block','.discover-settings']],
  ['about','关于','About',['[data-settings-section="about"]','.tmdb-attribution']]
 ];
 function organize(){
  const panel=document.querySelector('#extraSection .settings-panel');
  if(!panel||panel.querySelector('.settings-group'))return;
  const english=I18n.getLanguage()==='en-US';
  const nav=document.createElement('nav');nav.className='settings-jump-nav';
  nav.setAttribute('aria-label',english?'Settings sections':'设置分组');
  const pending=new Set(panel.children),sections=[];
  for(const [key,zh,en,selectors] of groups){
   const nodes=[];
   for(const selector of selectors){
    let node=panel.querySelector(selector);
    // Select the direct child block, including conditional import-resume rows.
    while(node&&node.parentElement!==panel)node=node.parentElement;
    if(node&&pending.delete(node))nodes.push(node);
   }
   if(!nodes.length)continue;
   const section=document.createElement('section');section.className='settings-group';
   section.id='settings-'+key;section.setAttribute('aria-labelledby',section.id+'-title');
   const heading=document.createElement('h2');heading.id=section.id+'-title';
   heading.textContent=english?en:zh;section.append(heading,...nodes);sections.push(section);
   const link=document.createElement('a');link.href='#'+section.id;link.textContent=heading.textContent;
   // Keep keyboard users at the chosen section after a jump, without changing the route/hash.
   heading.tabIndex=-1;
   link.onclick=event=>{event.preventDefault();heading.focus({preventScroll:true});section.scrollIntoView({block:'start',behavior:'instant'})};
   nav.append(link);
  }
  panel.prepend(nav);panel.append(...sections);
  // Preserve unrecognized/future extension blocks instead of losing their controls.
  for(const node of pending)panel.append(node);
 }
 const base=renderSettings;renderSettings=function(){base();organize()};
 if(page==='settings')renderSettings();
})();
