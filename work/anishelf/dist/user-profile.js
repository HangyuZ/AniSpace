/* Local identity only: no account service or changes to library records. */
const UserProfile=(()=>{
 const KEY='anishelf-user-profile-v1';
 const words={heading:['用户资料','User profile'],username:['用户名','Username'],avatar:['头像','Avatar'],choose:['选择头像','Choose avatar'],reset:['恢复默认','Restore default'],save:['保存用户名','Save username'],help:['用户名最多 40 个字符，头像和用户名保存在当前资料库。头像支持 PNG、JPEG、WebP，最大 5 MB。','Usernames support up to 40 characters. Your avatar and username stay in the selected data store. PNG, JPEG and WebP images up to 5 MB are supported.'],saved:['用户名已保存','Username saved'],error:['无法保存用户资料，浏览器存储空间可能已满。','Could not save your profile. Browser storage may be full.'],imageError:['请选择不超过 5 MB 的 PNG、JPEG 或 WebP 图片。','Choose a PNG, JPEG or WebP image no larger than 5 MB.'],loadError:['无法读取这张头像，请换一张图片。','Could not read this avatar. Please choose another image.']};
 const text=key=>words[key][I18n.getLanguage()==='en-US'?1:0];
 function normalize(raw){const out={};if(!raw||typeof raw!=='object')return out;
  if(typeof raw.username==='string'){const name=Array.from(raw.username.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim()).slice(0,40).join('');if(name)out.username=name}
  if(typeof raw.avatar==='string'&&raw.avatar.length<=300000&&/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(raw.avatar))out.avatar=raw.avatar;
  return out;
 }
 let profile={};try{profile=normalize(JSON.parse(AppStorage.getItem(KEY)||'{}'))}catch{}
 let generation=0;
 const name=()=>profile.username||(I18n.getLanguage()==='en-US'?'User':'用户');
 const initial=()=>Array.from(name())[0].toLocaleUpperCase(I18n.getLanguage());
 const greeting=base=>base+(I18n.getLanguage()==='en-US'?', ':'，')+name();
 function paint(image,letter){if(!image||!letter)return;image.hidden=!profile.avatar;letter.hidden=!!profile.avatar;letter.textContent=initial();if(profile.avatar){image.src=profile.avatar;image.onerror=()=>{image.hidden=true;letter.hidden=false}}else{image.removeAttribute('src');image.onerror=null}}
 function syncSidebar(){const button=$('#profileEntry');if(!button)return;const label=name()+' · '+t('设置与数据');button.setAttribute('aria-label',label);button.setAttribute('title',label);const username=$('#sidebarUsername');if(username)username.textContent=name();paint($('#sidebarAvatar'),$('#sidebarInitial'))}
 function apply(){syncSidebar();WatchSchedule.clock()}
 function save(next){next=normalize(next);try{AppStorage.setItem(KEY,JSON.stringify(next));profile=next;apply();return true}catch{toast(text('error'));return false}}
 function reset(key){generation++;const next={...profile};delete next[key];return save(next)}
 function settings(){const section=document.createElement('section');section.className='profile-settings';
  section.innerHTML='<h3>'+text('heading')+'</h3><p>'+text('help')+'</p><div class="profile-settings-avatar"><div class="profile-avatar profile-avatar-preview" aria-hidden="true"><img id="profilePreview" alt="" hidden><b id="profilePreviewInitial"></b></div><div class="profile-settings-actions"><button type="button" id="chooseAvatar">'+text('choose')+'</button><button type="button" id="resetAvatar">'+text('reset')+'</button><input type="file" id="profileAvatarFile" accept="image/png,image/jpeg,image/webp" hidden></div></div><form id="profileNameForm"><label for="profileUsername">'+text('username')+'</label><div class="profile-name-controls"><input id="profileUsername" type="text" maxlength="80" autocomplete="nickname" spellcheck="false"><button type="submit">'+text('save')+'</button><button type="button" id="resetUsername">'+text('reset')+'</button></div></form>';
  $('#extraSection .settings-panel').prepend(section);
  const input=section.querySelector('#profileUsername');input.value=profile.username||'';input.placeholder=name();
  const refresh=()=>paint(section.querySelector('#profilePreview'),section.querySelector('#profilePreviewInitial'));
  section.querySelector('#profileNameForm').onsubmit=e=>{e.preventDefault();if(save({...profile,username:input.value})){input.value=profile.username||'';input.placeholder=name();refresh();toast(text('saved'))}};
  section.querySelector('#resetUsername').onclick=()=>{if(reset('username')){input.value='';input.placeholder=name();refresh()}};
  section.querySelector('#resetAvatar').onclick=()=>{if(reset('avatar'))refresh()};
  const fileInput=section.querySelector('#profileAvatarFile');section.querySelector('#chooseAvatar').onclick=()=>fileInput.click();
  fileInput.onchange=async()=>{const file=fileInput.files[0];fileInput.value='';if(!file)return;const current=++generation;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){toast(text('imageError'));return}try{const avatar=await Personalization.imageData(file,{size:256,square:true});if(current!==generation)return;if(avatar.length>300000)throw Error('Avatar too large');if(save({...profile,avatar}))refresh()}catch{if(current===generation)toast(text('loadError'))}};
  refresh();
 }
 const baseSettings=renderSettings;renderSettings=function(){baseSettings();settings()};
 syncSidebar();return {name,greeting,syncSidebar,save,reset,normalize,get:()=>JSON.parse(JSON.stringify(profile))};
})();
WatchSchedule.clock();
