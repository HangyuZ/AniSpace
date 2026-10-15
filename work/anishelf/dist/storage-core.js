/* Local folder repository. Immutable snapshots are published by one manifest commit.
   Staging is synchronous for existing UI transactions; flush() is the durable async boundary. */
(function(root){
'use strict';
const LIB='anishelf-library-v1',HISTORY='anishelf-watch-history-v1',LISTS='anishelf-lists-v1',ARCHIVE='anishelf-series-archive-v1',JOURNAL='anishelf-season-transaction-v1';
const PREFS=['anishelf-theme','anishelf-language','anishelf-sort','anishelf-sidebar-collapsed','anishelf-personalization-v1','anishelf-user-profile-v1','anishelf-no-demo-v1'];
const KEYS=[LIB,HISTORY,LISTS,ARCHIVE,...PREFS],PRIVATE='anishelf-tmdb-credential';
const META=['overview','cast','crew','episodeDetails','episodeLanguages','allSeasons','seasons'];
const DOCUMENTS=['library','history','lists','archive','preferences','images'];
const encoder=new TextEncoder(),clone=value=>JSON.parse(JSON.stringify(value));
const safety=root.DataSafety||(typeof require==='function'?require('./data-safety.js'):null);
const fail=(code,message)=>Object.assign(Error(message),{code});
async function hash(data){const bytes=typeof data==='string'?encoder.encode(data):data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function validPath(path){if(typeof path!=='string'||path.length>240||!path.split('/').every(p=>/^[a-zA-Z0-9_.-]+$/.test(p)&&p!=='.'&&p!=='..'))throw fail('INVALID','Invalid repository path');return path.split('/');}
async function handleAt(dir,path,create=false){const parts=validPath(path);for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create});return dir.getFileHandle(parts.at(-1),{create});}
async function read(dir,path,limit=80*1024*1024){const file=await (await handleAt(dir,path)).getFile();if(file.size>limit)throw fail('INVALID','Repository file is too large');return file.text();}
async function optionalRead(dir,path){try{return await read(dir,path)}catch(e){if(e.name==='NotFoundError')return null;throw e;}}
async function write(dir,path,data){const handle=await handleAt(dir,path,true),stream=await handle.createWritable();try{await stream.write(data);await stream.close()}catch(error){try{await stream.abort()}catch{}throw error;}}
function validateValues(values,validated=null){
 const changed=key=>!validated||values[key]!==validated[key];
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(k=>!KEYS.includes(k)))throw fail('INVALID','Unknown stored data');
 for(const [key,value]of Object.entries(values)){if(typeof value!=='string')throw fail('INVALID','Invalid stored value');if(changed(key)&&[LIB,HISTORY,LISTS,ARCHIVE].includes(key)){const rows=JSON.parse(value);if(!Array.isArray(rows)||rows.length>(key===HISTORY?100000:10000))throw fail('INVALID','Invalid record collection');}}
 const inspect=(value,depth=0)=>{if(depth>40)throw fail('INVALID','Data is nested too deeply');if(value&&typeof value==='object'){for(const [key,child]of Object.entries(value)){if(['__proto__','constructor','prototype','_anishelfDetail'].includes(key))throw fail('INVALID','Reserved data property');inspect(child,depth+1)}}};
 for(const key of [LIB,HISTORY,LISTS,ARCHIVE,'anishelf-personalization-v1','anishelf-user-profile-v1','anishelf-sort'])if(changed(key)&&values[key])inspect(JSON.parse(values[key]));
 const items=changed(LIB)?JSON.parse(values[LIB]||'[]'):[],ids=new Set();safety.validateCatalog(items);
 function entry(a){if(!a||typeof a.title!=='string'||!['string','number'].includes(typeof a.id)||!['planned','watching','rewatching','completed','paused','dropped'].includes(a.status)||!Number.isInteger(a.episodes)||a.episodes<1||a.episodes>9999||!Number.isInteger(a.progress)||a.progress<0||a.progress>a.episodes||!Number.isFinite(a.rating)||a.rating<0||a.rating>10||!Number.isInteger(a.year))throw fail('INVALID','Invalid library entry');const id=typeof a.id+':'+a.id;if(ids.has(id))throw fail('INVALID','Duplicate library ID');ids.add(id);if(a.seasonEntries){if(!Array.isArray(a.seasonEntries)||!a.seasonEntries.length)throw fail('INVALID','Invalid season group');a.seasonEntries.forEach(entry)}}items.forEach(entry);
 const history=changed(HISTORY)?JSON.parse(values[HISTORY]||'[]'):[];for(const r of history){if(!r||!['number','string'].includes(typeof r.animeId)||typeof r.title!=='string'||r.title.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')||!Number.isFinite(new Date(r.date+'T12:00:00Z').getTime())||new Date(r.date+'T12:00:00Z').toISOString().slice(0,10)!==r.date||!Number.isInteger(r.episode)||r.episode<1||r.episode>9999||!Number.isFinite(r.minutes)||r.minutes<0||r.minutes>1440||(r.minutes===0&&!r.unknown)||r.cycle!==undefined&&(!Number.isInteger(r.cycle)||r.cycle<0||r.cycle>999))throw fail('INVALID','Invalid watch history');}
 const listIds=new Set();for(const list of (changed(LISTS)?JSON.parse(values[LISTS]||'[]'):[])){if(!list||typeof list.id!=='string'||listIds.has(list.id)||typeof list.name!=='string'||!list.name.trim()||list.name.length>80||!Array.isArray(list.animeIds)||list.animeIds.some(id=>!['string','number'].includes(typeof id)))throw fail('INVALID','Invalid custom list');listIds.add(list.id)}
 for(const r of (changed(ARCHIVE)?JSON.parse(values[ARCHIVE]||'[]'):[])){if(!r||typeof r.id!=='string'||!r.source||typeof r.source.title!=='string'||!Array.isArray(r.history)||!Array.isArray(r.seasonIds))throw fail('INVALID','Invalid series archive');safety.validateCatalog([r.source]);}
 if(values['anishelf-theme']&&!['system','light','dark'].includes(values['anishelf-theme']))throw fail('INVALID','Invalid theme');
 if(values['anishelf-language']&&!['zh-CN','en-US'].includes(values['anishelf-language']))throw fail('INVALID','Invalid language');
 for(const key of ['anishelf-personalization-v1','anishelf-user-profile-v1','anishelf-sort'])if(changed(key)&&values[key]){const obj=JSON.parse(values[key]);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw fail('INVALID','Invalid preferences')}
 return values;
}
class FolderRepository{
 constructor(dir,{fetcher=root.fetch?.bind(root),createURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url)}={}){this.dir=dir;this.fetcher=fetcher;this.createURL=createURL;this.revokeURL=revokeURL;this.urls=new Map();this.imageLoads=new Map();this.imageWaiters=[];this.activeImages=0;this.disposed=false;this.manifest=null;this.cacheImages=false;this.assetErrors=[];this.assetWarnings=new Set();this.failedImages=new Set();this.imageIndex={};this.written=new Set();}
 async manifestText(){return optionalRead(this.dir,'manifest.json')}
 parseManifest(raw){
  const m=JSON.parse(raw);if(!m||m.app!=='AniShelf'||![1,2].includes(m.formatVersion)||typeof m.libraryId!=='string'||!m.libraryId||!/^r-[a-zA-Z0-9-]+$/.test(m.revision)||!m.files||!m.integrity||typeof m.savedAt!=='string'||!Number.isFinite(Date.parse(m.savedAt)))throw fail('INVALID','Unsupported AniShelf folder');
  if(Object.keys(m.files).length!==DOCUMENTS.length||Object.keys(m.integrity).length!==DOCUMENTS.length)throw fail('INVALID','Invalid snapshot documents');
  for(const name of DOCUMENTS){const file=m.files[name];validPath(file);const parts=file.split('/');if(parts.length!==3||parts[0]!=='.snapshots'||!/^r-[a-zA-Z0-9-]+$/.test(parts[1])||parts[2]!==name+'.json'||m.formatVersion===1&&parts[1]!==m.revision)throw fail('INVALID','Invalid snapshot reference');if(!/^[a-f0-9]{64}$/.test(m.integrity[name]))throw fail('INVALID','Missing integrity hash')}
  return m;
 }
 async permission(request=false){const options={mode:'readwrite'};let p=await this.dir.queryPermission(options);if(p!=='granted'&&request)p=await this.dir.requestPermission(options);if(p!=='granted')throw fail('PERMISSION','Folder permission is required');}
 async load(raw){raw=raw??await this.manifestText();if(!raw)throw fail('EMPTY','This folder has no AniShelf library');const m=this.parseManifest(raw),data={};
  for(const name of DOCUMENTS){const text=await read(this.dir,m.files[name]);if(await hash(text)!==m.integrity[name])throw fail('CORRUPT','Snapshot checksum mismatch: '+name);data[name]=JSON.parse(text)}
  this.cacheImages=false;this.imageIndex=data.images||{};for(const [url,ref]of Object.entries(this.imageIndex)){if(typeof url!=='string'||!ref||!['posters','episode-stills','assets'].some(p=>ref.path?.startsWith(p+'/'))||!/^[a-f0-9]{64}$/.test(ref.hash)||!['image/png','image/jpeg','image/webp'].includes(ref.type))throw fail('INVALID','Invalid image reference');validPath(ref.path)}
  const walk=async (value,depth=0)=>{if(depth>40)throw fail('INVALID','Data is nested too deeply');if(Array.isArray(value))return Promise.all(value.map(v=>walk(v,depth+1)));if(value&&typeof value==='object'){const out={};if(value._anishelfDetail){const path=value._anishelfDetail;if(!/^details\/[a-f0-9]{64}\.json$/.test(path))throw fail('INVALID','Invalid detail reference');const text=await read(this.dir,path);if(await hash(text)!==path.slice(8,-5))throw fail('CORRUPT','Detail checksum mismatch');Object.assign(out,await walk(JSON.parse(text),depth+1))}for(const [k,v]of Object.entries(value))if(k!=='_anishelfDetail'){if(['__proto__','constructor','prototype'].includes(k))throw fail('INVALID','Unsafe data property');out[k]=await walk(v,depth+1)};return out;}if(typeof value==='string'&&value.startsWith('anishelf-asset:')){const path=value.slice(15);const ref=Object.values(this.imageIndex).find(r=>r.path===path);if(!ref)throw fail('CORRUPT','Missing custom image reference');try{const file=await (await handleAt(this.dir,path)).getFile();if(file.size>16*1024*1024)throw fail('INVALID','Image is too large');if(await hash(await file.arrayBuffer())!==ref.hash)throw fail('CORRUPT','Custom image checksum mismatch');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return 'data:'+ref.type+';base64,'+btoa(binary)}catch{this.assetWarnings.add(path);return value}}return value;};
  const values={...await walk(data.preferences),[LIB]:JSON.stringify(await walk(data.library)),[HISTORY]:JSON.stringify(data.history),[LISTS]:JSON.stringify(data.lists),[ARCHIVE]:JSON.stringify(await walk(data.archive))};
  // Preferences contain raw storage strings, with custom images represented inside JSON.
  for(const key of ['anishelf-personalization-v1','anishelf-user-profile-v1'])if(values[key]){const pref=JSON.parse(values[key]);values[key]=JSON.stringify(await walk(pref))}
  validateValues(values);this.manifest=m;this.committedValues={...values};return {values,manifest:m};
 }
 async putImmutable(path,data){if(this.written.has(path))return;const existing=await optionalRead(this.dir,path);if(existing!==null){if(existing!==data)throw fail('CORRUPT','Immutable data differs: '+path)}else await write(this.dir,path,data);this.written.add(path);}
 async image(value,category){
  if(typeof value!=='string')return value;
  const embedded=/^data:image\/(png|jpeg|webp);base64,/i.test(value),remote=/^https:\/\/image\.tmdb\.org\/t\/p\//i.test(value);
  if(!embedded&&(!remote||!this.cacheImages||this.cancelImages||this.failedImages.has(value)))return value;
  // Remote URL keys stay short; embedded source data must never enter the image index.
  const key=embedded?'embedded:'+await hash(value):value;if(this.imageIndex[key]){const ref=this.imageIndex[key];try{const file=await (await handleAt(this.dir,ref.path)).getFile();if(file.size>16*1024*1024||await hash(await file.arrayBuffer())!==ref.hash)throw Error('Bad cached image');return embedded?'anishelf-asset:'+ref.path:value}catch{delete this.imageIndex[key]}}
  try{const {bytes,type}=await this.fetchImage(value,embedded);const digest=await hash(bytes),ext=type==='image/jpeg'?'jpg':type.split('/')[1],path=(embedded?'assets':category)+'/'+digest+'.'+ext;await write(this.dir,path,bytes);this.assetWarnings.delete(path);this.imageIndex[key]={path,hash:digest,type};this.onImage?.(++this.imageCount,this.assetErrors.length);return embedded?'anishelf-asset:'+path:value;
  }catch(error){if(embedded||['QuotaExceededError','NotAllowedError','NoModificationAllowedError','NotFoundError'].includes(error.name))throw error;this.failedImages.add(value);this.assetErrors.push(value);this.onImage?.(++this.imageCount,this.assetErrors.length);return value;}
 }
 async fetchImage(value,embedded){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);if(!embedded)this.imageController=controller;
  try{const response=await this.fetcher(value,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});if(!response.ok)throw Error('Image HTTP '+response.status);const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase(),limit=16*1024*1024;if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Unsupported image type');if(Number(response.headers.get('content-length'))>limit)throw Error('Image exceeds 16 MB');let bytes;if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>limit){await reader.cancel();throw Error('Image exceeds 16 MB')}chunks.push(result.value)}}finally{reader.releaseLock()}bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}}else{bytes=await response.arrayBuffer();if(bytes.byteLength>limit)throw Error('Image exceeds 16 MB')}return {bytes,type};
  }finally{clearTimeout(timer);if(this.imageController===controller)this.imageController=null}
 }
 async encodeEntry(a){if(this.commitMetrics)this.commitMetrics.encodedEntries++;const copy=clone(a);if(copy.seasonEntries){const children=[];for(const child of copy.seasonEntries)children.push(await this.encodeEntry(child));copy.seasonEntries=children;}
  const transform=async(value,key='',category='assets')=>{if(Array.isArray(value)){const out=[];for(const item of value)out.push(await transform(item,key,category));return out}if(value&&typeof value==='object'){const out={};for(const [k,v]of Object.entries(value))out[k]=await transform(v,k,k==='allSeasons'||k==='seasons'?'posters':k==='episodeDetails'?'episode-stills':category);return out}if(typeof value==='string'&&(key==='image'||key==='heroImage'||key==='titleLogo'||key==='seriesImage'))return this.image(value,category);return value;};
  for(const key of ['image','heroImage','seriesImage','titleLogo'])if(copy[key])copy[key]=await this.image(copy[key],key==='titleLogo'?'assets':'posters');
  const metadata={};for(const key of META)if(key in copy){metadata[key]=copy[key];delete copy[key]}
  // Episode stills have their own folder; other remote people images use assets.
  if(metadata.episodeDetails){for(const rows of Object.values(metadata.episodeDetails))for(const e of rows||[])if(e.image)e.image=await this.image(e.image,'episode-stills')}
  const transformed=await transform(metadata);if(Object.keys(transformed).length){const text=JSON.stringify(transformed),path='details/'+await hash(text)+'.json';await this.putImmutable(path,text);copy._anishelfDetail=path}return copy;
 }
 async commit(values,expected,{newLibrary=false}={}){
  // Capture immutable string values once; edits made while saving belong to the next pass.
  values={...values};await this.permission();const beforeRaw=await this.manifestText(),before=beforeRaw?this.parseManifest(beforeRaw):null;
  if((before?.revision??null)!==expected||(!before&&!newLibrary)||this.manifest&&before?.libraryId!==this.manifest.libraryId)throw fail('CONFLICT','Folder changed elsewhere. Reopen it before saving.');
  if(before&&this.manifest?.revision===before.revision&&JSON.stringify(this.manifest)!==JSON.stringify(before))throw fail('CONFLICT','Folder index changed without a new revision. Reopen it before saving.');
  const baseline=before&&this.manifest?.revision===before.revision?this.committedValues:null;
  validateValues(values,baseline);
  const previousTexts={};
  // Reused documents are still read and verified. Reuse never bypasses disk integrity checks.
  if(before)for(const name of DOCUMENTS){const text=await read(this.dir,before.files[name]);if(await hash(text)!==before.integrity[name])throw fail('CORRUPT','The current disk snapshot was modified externally');previousTexts[name]=text}
  const changed=key=>!baseline||values[key]!==baseline[key],forceImages=this.cacheImages;
  const revision='r-'+Date.now().toString(36)+'-'+crypto.randomUUID(),libraryId=before?.libraryId||crypto.randomUUID(),folder='.snapshots/'+revision+'/';
  const stats={documentsWritten:[],reusedDocuments:[],documentBytes:0,encodedEntries:0,noop:false},started=Date.now();
  const previousIndex=this.imageIndex;this.imageIndex=clone(previousIndex);this.assetErrors=[];this.commitMetrics=stats;
  let published=false;
  try{
   const texts={...previousTexts};
   if(forceImages||PREFS.some(changed)){
    const prefs=Object.fromEntries(PREFS.filter(k=>values[k]!==undefined).map(k=>[k,values[k]]));
    const oldPrefs=before?JSON.parse(previousTexts.preferences):{};
    for(const key of ['anishelf-personalization-v1','anishelf-user-profile-v1'])if(prefs[key]){
     if(!forceImages&&!changed(key)&&oldPrefs[key]!==undefined){prefs[key]=oldPrefs[key];continue}
     const obj=JSON.parse(prefs[key]),old=baseline?.[key]?JSON.parse(baseline[key]):{},encoded=oldPrefs[key]?JSON.parse(oldPrefs[key]):{};
     for(const field of ['background','avatar'])if(obj[field])obj[field]=!forceImages&&obj[field]===old[field]&&encoded[field]?encoded[field]:await this.image(obj[field],'assets');prefs[key]=JSON.stringify(obj);
    }
    texts.preferences=JSON.stringify(prefs);
   }
   if(forceImages||changed(LIB)){const library=[];for(const entry of JSON.parse(values[LIB]||'[]'))library.push(await this.encodeEntry(entry));texts.library=JSON.stringify(library)}
   if(forceImages||changed(ARCHIVE)){const archive=[];for(const record of JSON.parse(values[ARCHIVE]||'[]'))archive.push({...record,source:await this.encodeEntry(record.source)});texts.archive=JSON.stringify(archive)}
   if(changed(HISTORY))texts.history=JSON.stringify(JSON.parse(values[HISTORY]||'[]'));
   if(changed(LISTS))texts.lists=JSON.stringify(JSON.parse(values[LISTS]||'[]'));
   texts.images=JSON.stringify(this.imageIndex);
   const files={},integrity={};
   for(const name of DOCUMENTS){const text=texts[name];if(typeof text!=='string')throw fail('INVALID','Missing snapshot document');
    if(before&&text===previousTexts[name]){files[name]=before.files[name];integrity[name]=before.integrity[name];stats.reusedDocuments.push(name);continue}
    files[name]=folder+name+'.json';integrity[name]=await hash(text);await write(this.dir,files[name],text);if(await read(this.dir,files[name])!==text)throw fail('CORRUPT','Snapshot verification failed');stats.documentsWritten.push(name);stats.documentBytes+=encoder.encode(text).byteLength;
   }
   if(await this.manifestText()!==beforeRaw)throw fail('CONFLICT','Folder changed during save');
   if(before&&!stats.documentsWritten.length){stats.noop=true;this.manifest=before;this.committedValues={...values};published=true;this.lastCommitStats={...stats,durationMs:Date.now()-started};return before}
   const next={app:'AniShelf',formatVersion:2,libraryId,revision,previousRevision:expected,savedAt:new Date(Math.max(Date.now(),before?Date.parse(before.savedAt)+1:0)).toISOString(),files,integrity};
   if(before){const backup='backups/'+before.revision+'.json',text=JSON.stringify(before),existing=await optionalRead(this.dir,backup);if(existing===null)await write(this.dir,backup,text);else if(existing!==text)throw fail('CORRUPT','Backup index differs from the published revision')}
   // The new revision is visible only after every changed document has been verified.
   const nextText=JSON.stringify(next,null,2);await write(this.dir,'manifest.json',nextText);if(await this.manifestText()!==nextText)throw fail('CONFLICT','Another writer published a different revision');
   this.manifest=next;this.committedValues={...values};published=true;this.lastCommitStats={...stats,durationMs:Date.now()-started};
   try{await this.prune()}catch(error){this.retentionWarning=error.message}return next;
  }finally{this.commitMetrics=null;if(!published)this.imageIndex=previousIndex}
 }
 async prune(){
  // A revision folder can contain documents shared by many newer revisions.
  // Parse ALL retained indexes before deleting anything; an unreadable index pauses cleanup.
  this.retentionWarning=null;const currentRaw=await this.manifestText();if(!currentRaw)return;
  const current=this.parseManifest(currentRaw),dir=await this.dir.getDirectoryHandle('backups',{create:true}),automatic=[],protectedManifests=[current];
  for await(const [name,h]of dir.entries())if(h.kind==='file'&&name.endsWith('.json')){
   let m;try{const file=await h.getFile();if(file.size>80*1024*1024)throw Error('Backup index is too large');m=this.parseManifest(await file.text());if(m.libraryId!==current.libraryId)throw Error('Backup belongs to another library')}
   catch{this.retentionWarning='Backup cleanup paused: an index could not be verified';return}
   if(/^r-[a-zA-Z0-9-]+\.json$/.test(name)){if(name!==m.revision+'.json'){this.retentionWarning='Backup cleanup paused: revision name mismatch';return}automatic.push({name,m})}else protectedManifests.push(m);
  }
  automatic.sort((a,b)=>b.m.savedAt.localeCompare(a.m.savedAt)||b.m.revision.localeCompare(a.m.revision));
  const retained=automatic.slice(0,5),expired=automatic.slice(5),referenced=new Set([...protectedManifests,...retained.map(r=>r.m)].flatMap(m=>DOCUMENTS.map(name=>m.files[name])));
  if(await this.manifestText()!==currentRaw)throw fail('CONFLICT','Folder changed during backup cleanup');
  for(const old of expired)await dir.removeEntry(old.name);
  let snapshots;try{snapshots=await this.dir.getDirectoryHandle('.snapshots')}catch(error){if(error.name==='NotFoundError')return;throw error}
  // Only files named by expired, verified indexes are candidates. Failed unpublished writes stay intact.
  const candidates=new Set(expired.flatMap(r=>DOCUMENTS.map(name=>r.m.files[name]))),touched=new Set();
  for(const file of candidates)if(!referenced.has(file)){
   const parts=validPath(file),name=parts[1];let revisionDir;
   try{revisionDir=await snapshots.getDirectoryHandle(name);await revisionDir.removeEntry(parts[2]);touched.add(name)}catch(error){if(error.name!=='NotFoundError')throw error}
  }
  for(const name of touched){try{const revisionDir=await snapshots.getDirectoryHandle(name);let empty=true;for await(const _ of revisionDir.entries()){empty=false;break}if(empty)await snapshots.removeEntry(name)}catch(error){if(error.name!=='NotFoundError')throw error}}
 }
 async backups(){const dir=await this.dir.getDirectoryHandle('backups',{create:true}),rows=[];for await(const [name,h]of dir.entries())if(h.kind==='file'&&/^r-[a-zA-Z0-9-]+\.json$/.test(name)){try{const raw=await (await h.getFile()).text(),m=this.parseManifest(raw);rows.push({name,date:m.savedAt,raw})}catch{}}return rows.sort((a,b)=>b.date.localeCompare(a.date));}
 resolveImage(url){return this.urls.get(url)||url}
 async loadImage(url){if(this.urls.has(url))return this.urls.get(url);if(this.imageLoads.has(url))return this.imageLoads.get(url);const ref=this.imageIndex[url];if(!ref||url.startsWith('embedded:'))return url;
  const task=(async()=>{if(this.activeImages>=4)await new Promise(resolve=>this.imageWaiters.push(resolve));else this.activeImages++;try{if(this.disposed)return url;const file=await (await handleAt(this.dir,ref.path)).getFile();if(file.size>16*1024*1024||await hash(await file.arrayBuffer())!==ref.hash)throw Error('Invalid cached image');if(this.disposed)return url;const local=this.createURL(file);this.urls.set(url,local);return local}catch{this.assetWarnings.add(ref.path);return url}finally{const next=this.imageWaiters.shift();if(next)next();else this.activeImages--}})();this.imageLoads.set(url,task);try{return await task}finally{this.imageLoads.delete(url)}
 }
 async prepareImages(){await Promise.all(Object.keys(this.imageIndex).filter(url=>!url.startsWith('embedded:')).map(url=>this.loadImage(url)))}
 dispose(){this.disposed=true;for(const url of this.urls.values())this.revokeURL(url);this.urls.clear()}
}
class StagedStore{
 constructor(browser,{pending,lock=(name,fn)=>fn(),onState=()=>{},schedule=fn=>queueMicrotask(fn)}={}){this.browser=browser;this.pending=pending;this.lock=lock;this.onState=onState;this.schedule=schedule;this.mode='browser';this.values={};this.repo=null;this.sequence=0;this.savedSequence=0;this.running=null;this.error=null;this.queued=false;this.state='browser';this.keyVersions=new Map();}
 snapshotBrowser(){const out={};for(const k of KEYS){const value=this.browser.getItem(k);if(value!==null)out[k]=value}return out}
 getItem(key){if(this.mode==='browser'||key===PRIVATE)return this.browser.getItem(key);return this.values[key]??null}
 setItem(key,value){if(this.switching)throw fail('BUSY','A data source transfer is in progress');value=String(value);if(this.mode==='browser'||key===PRIVATE){this.browser.setItem(key,value);return}if(!KEYS.includes(key)&&key!==JOURNAL)throw fail('INVALID','Unknown data key');if(this.error?.code==='CONFLICT')throw this.error;if(this.values[key]===value)return;this.values[key]=value;this.changed(key)}
 removeItem(key){if(this.switching)throw fail('BUSY','A data source transfer is in progress');if(this.mode==='browser'||key===PRIVATE){this.browser.removeItem(key);return}if(this.error?.code==='CONFLICT')throw this.error;if(!(key in this.values))return;delete this.values[key];this.changed(key)}
 attach(repo,values){this.repo?.dispose();this.repo=repo;this.values={...values};this.mode='folder';this.sequence=this.savedSequence=0;this.error=null;this.keyVersions.clear();this.emit('saved')}
 changed(key){this.sequence++;if(key)this.keyVersions.set(key,this.sequence);this.emit('pending');if(!this.queued){this.queued=true;this.schedule(async()=>{this.queued=false;try{await this.checkpoint();await this.flush()}catch(error){if(this.dirty){this.error=error;this.emit('error')}}})}}
 async checkpoint(){if(this.mode!=='folder'||!this.dirty||this.values[JOURNAL])return;const values={...this.values};delete values[JOURNAL];await this.pending.put({libraryId:this.repo.manifest.libraryId,baseRevision:this.repo.manifest.revision,values,sequence:this.sequence,updatedAt:new Date().toISOString()})}
 emit(state){this.state=state;this.onState({state,mode:this.mode,error:this.error,dirty:this.dirty,name:this.repo?.dir.name})}
 get dirty(){return this.sequence!==this.savedSequence}
 async flush(){if(this.mode==='folder'&&this.error?.code==='CONFLICT')throw this.error;if(this.mode!=='folder'||!this.dirty)return;if(this.running)return this.running;this.running=this.drain();try{return await this.running}finally{this.running=null;if(this.dirty&&!this.error&&!this.queued){this.queued=true;this.schedule(async()=>{this.queued=false;try{await this.checkpoint();await this.flush()}catch(error){if(this.dirty){this.error=error;this.emit('error')}}})}}}
 async drain(){while(this.dirty){const sequence=this.sequence,versions=new Map(this.keyVersions),values={...this.values};if(values[JOURNAL]){this.error=fail('RECOVERY','An unfinished season transaction must recover before saving');this.emit('error');throw this.error}delete values[JOURNAL];const base=this.repo.manifest.revision;
  try{this.emit('saving');await this.pending.put({libraryId:this.repo.manifest.libraryId,baseRevision:base,values,sequence,updatedAt:new Date().toISOString()});await this.lock('anishelf-folder-'+this.repo.manifest.libraryId,()=>this.repo.commit(values,base));this.savedSequence=sequence;for(const [key,version]of versions)if(this.keyVersions.get(key)===version)this.keyVersions.delete(key);this.error=null;try{if(!this.dirty)await this.pending.remove()}catch{/* Disk is committed; startup can identify this stale pending copy by value. */}this.emit(this.dirty?'pending':'saved')}
  catch(error){this.error=error;this.emit('error');throw error}}
 }
 async durable(action){const result=await action();await this.flush();return result}
}
const canonical=value=>JSON.stringify(value&&typeof value==='object'?(Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))]))):value);
function sameValues(a,b){return KEYS.every(k=>{if(a[k]===b[k])return true;try{return canonical(JSON.parse(a[k]))===canonical(JSON.parse(b[k]))}catch{return false}})}
const api={sameValues,KEYS,PREFS,LIB,HISTORY,LISTS,ARCHIVE,JOURNAL,PRIVATE,FolderRepository,StagedStore,hash,read,write,validateValues,fail};if(typeof module!=='undefined')module.exports=api;else root.StorageCore=api;
})(globalThis);
