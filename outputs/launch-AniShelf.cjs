/* One-click coordinator: fixed origin, identified readiness, exclusive startup lock.
   Importing this file does not start a service or open a browser. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
let service;try{service=require('./serve.cjs')}catch{/* main reports a readable missing/damaged service-file error. */}
const URL='http://127.0.0.1:43871/',PROBE_TIMEOUT=1000,START_TIMEOUT=15000;
const failure=(code,message)=>Object.assign(Error(message),{code});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function probe({request=http.request,timeout=PROBE_TIMEOUT}={}){
 return new Promise(resolve=>{
  let settled=false;const finish=result=>{if(!settled){settled=true;clearTimeout(timer);resolve(result)}};
  let req,timer=setTimeout(()=>{finish({kind:'blocked',reason:'TIMEOUT'});req?.destroy()},timeout);
  try{req=request({hostname:'127.0.0.1',port:43871,path:service.healthPath,method:'GET',agent:false,headers:{Accept:'application/json'}},res=>{
   let text='',length=0;res.on('data',chunk=>{length+=Buffer.byteLength(chunk);if(length>8192){finish({kind:'occupied'});res.destroy();return}text+=chunk});
   res.on('error',()=>finish({kind:'blocked',reason:'RESPONSE_ERROR'}));res.on('end',()=>{
    let data;try{data=JSON.parse(text)}catch{finish({kind:'occupied'});return}
    if(data.app!=='AniShelf'||data.protocol!==1){finish({kind:'occupied'});return}
    if(data.instance!==service.instance){finish({kind:'other-copy'});return}
    finish(res.statusCode===200&&data.ready===true?{kind:'ready'}:{kind:'unready',reason:data.error});
   });
  });req.on('error',error=>finish(error.code==='ECONNREFUSED'?{kind:'offline'}:{kind:'blocked',reason:error.code||'CONNECTION_ERROR'}));req.end();}
  catch(error){finish({kind:'blocked',reason:error.code||'CONNECTION_ERROR'})}
 });
}

function rejectUnexpected(state){
 if(state.kind==='ready'||state.kind==='offline')return;
 if(state.kind==='other-copy')throw failure('OTHER_COPY','43871 端口正在运行另一份目录中的 AniShelf。请先关闭那份服务，再启动此版本。启动器不会自动终止现有程序。');
 if(state.kind==='unready')throw failure('HTML_UNAVAILABLE','AniShelf 服务已运行，但 AniShelf.html 缺失或为空。请把完整 HTML 放回启动器所在文件夹后重试。');
 if(state.kind==='occupied')throw failure('PORT_OCCUPIED','43871 端口已被其他程序或旧版 AniShelf 服务占用。若之前手动运行过 serve.cjs，请关闭原命令窗口后重试。不会自动更换端口或结束现有进程。');
 throw failure('CONNECTION_BLOCKED','无法检查本地服务（'+(state.reason||'未知连接错误')+'）。请确认安全软件允许访问 127.0.0.1:43871；若端口被无响应的程序占用，请先关闭该程序。');
}

function createLock(directory,{processAlive=pid=>{try{process.kill(pid,0);return true}catch(error){return error.code!=='ESRCH'}},now=Date.now}={}){
 const file=path.join(directory,'startup.lock');
 return ()=>{
  const token=crypto.randomUUID();let handle;
  try{handle=fs.openSync(file,'wx');fs.writeFileSync(handle,JSON.stringify({pid:process.pid,token,created:now()}));fs.closeSync(handle);handle=undefined;}
  catch(error){
   if(handle!==undefined)try{fs.closeSync(handle)}catch{}
   if(error.code!=='EEXIST')throw failure('LOCK_FAILED','无法创建启动锁，请检查临时目录写入权限：'+directory);
   try{const stat=fs.statSync(file);let record;try{record=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
    const expired=now()-stat.mtimeMs>START_TIMEOUT+10000,dead=Number.isInteger(record?.pid)&&!processAlive(record.pid);
    if(expired||dead){fs.unlinkSync(file);return null}
   }catch(error){if(error.code!=='ENOENT')throw failure('LOCK_FAILED','无法读取启动锁，请稍后重试。')}
   return null;
  }
  return ()=>{try{const current=JSON.parse(fs.readFileSync(file,'utf8'));if(current.token===token)fs.unlinkSync(file)}catch{}};
 };
}

async function ensureReady({check=probe,tryLock,spawnService,wait=delay,now=Date.now,timeout=START_TIMEOUT}={}){
 const first=await check();if(first.kind==='ready')return {reused:true};rejectUnexpected(first);
 const deadline=now()+timeout;
 while(now()<deadline){
  const release=tryLock();
  if(release){
   try{
    const state=await check();if(state.kind==='ready')return {reused:true};rejectUnexpected(state);
    await spawnService();
    while(now()<deadline){const result=await check();if(result.kind==='ready')return {reused:false};rejectUnexpected(result);await wait(150)}
   }finally{release()}
   break;
  }
  const state=await check();if(state.kind==='ready')return {reused:true};rejectUnexpected(state);await wait(150);
 }
 throw failure('START_TIMEOUT','AniShelf 在 15 秒内未能就绪。请查看下方日志；检查 HTML 是否存在、端口是否被占用，以及安全软件是否阻止 Node.js。');
}

async function spawnBackground(logFile,{spawn=cp.spawn}={}){
 const descriptor=fs.openSync(logFile,'a');let child;
 try{child=spawn(process.execPath,[path.join(__dirname,'serve.cjs')],{cwd:__dirname,detached:true,windowsHide:true,stdio:['ignore',descriptor,descriptor]});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});child.unref();
 }catch(error){throw failure('SPAWN_FAILED','无法启动本地服务：'+error.message)}finally{fs.closeSync(descriptor)}
}

function readEdgeApp(){
 try{return JSON.parse(fs.readFileSync(path.join(__dirname,'edge-app.json'),'utf8'))}
 catch(error){if(error.code==='ENOENT')return null;throw failure('APP_CONFIG','Edge 应用配置无法读取，请恢复 edge-app.json。')}
}
function browserCommand({platform=process.platform,env=process.env,exists=fs.existsSync,app=readEdgeApp()}={}){
 if(platform!=='win32')throw failure('PLATFORM','此启动器针对 Windows 11。');
 if(app&&(!/^[a-p]{32}$/.test(app.appId)||typeof app.profileDirectory!=='string'||!app.profileDirectory.trim()||/[\\/\x00-\x1f"]/.test(app.profileDirectory)||app.url!==URL))throw failure('APP_CONFIG','Edge 应用配置无效，网址必须保持 '+URL+'，请恢复 edge-app.json。');
 if(app){
  const proxies=[env['ProgramFiles(x86)'],env.ProgramFiles,env.LOCALAPPDATA].filter(Boolean).map(base=>path.join(base,'Microsoft','Edge','Application','msedge_proxy.exe'));
  const proxy=proxies.find(candidate=>exists(candidate));
  const edges=[env['ProgramFiles(x86)'],env.ProgramFiles,env.LOCALAPPDATA].filter(Boolean).map(base=>path.join(base,'Microsoft','Edge','Application','msedge.exe'));
  const executable=proxy||edges.find(candidate=>exists(candidate));
  if(!executable)throw failure('EDGE_MISSING','找不到 Microsoft Edge，无法打开已安装的 AniShelf 应用。请恢复 Edge 后重试。');
  return {file:executable,args:['--profile-directory='+app.profileDirectory,'--app-id='+app.appId,'--app-url='+URL,'--app-launch-source=4']};
 }
 const candidates=[env['ProgramFiles(x86)'],env.ProgramFiles,env.LOCALAPPDATA].filter(Boolean).map(base=>path.join(base,'Microsoft','Edge','Application','msedge.exe'));
 const edge=candidates.find(candidate=>exists(candidate));return edge?{file:edge,args:[URL]}:{file:path.join(env.WINDIR||'C:\\Windows','explorer.exe'),args:[URL]};
}
async function openBrowser({spawn=cp.spawn,command=browserCommand()}={}){
 const child=spawn(command.file,command.args,{detached:true,windowsHide:false,stdio:'ignore'});
 try{await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});child.unref()}
 catch{throw failure('BROWSER_FAILED','服务已就绪，但无法打开 AniShelf。请尝试从 Edge 的应用列表打开，或手动访问 '+URL)}
}

async function startAndOpen({ensure=ensureReady,open=openBrowser,...options}={}){const result=await ensure(options);await open();return result}

async function main(){
 let logFile;
 try{
  for(const name of ['AniShelf.html','serve.cjs','mal-service.cjs']){const file=path.join(__dirname,name);try{const stat=fs.statSync(file);fs.accessSync(file,fs.constants.R_OK);if(!stat.isFile()||stat.size===0)throw Error()}catch{throw failure('MISSING_FILE','找不到或无法读取 '+name+'。请把启动器、serve.cjs 和完整 HTML 放在同一文件夹。')}}
  if(!service||typeof service.identity!=='function')throw failure('INVALID_SERVICE','serve.cjs 缺失、损坏或版本不匹配，请恢复交付文件后重试。');
  const runtime=path.join(os.tmpdir(),'AniShelf-launcher',service.instance.slice(0,20));try{fs.mkdirSync(runtime,{recursive:true})}catch{throw failure('TEMP_UNWRITABLE','无法写入临时目录，启动器不能安全协调服务启动。')}
  logFile=path.join(runtime,'service.log');
  console.log('正在检查 AniShelf 本地服务…');
  const result=await startAndOpen({tryLock:createLock(runtime),spawnService:()=>spawnBackground(logFile)});
  console.log(result.reused?'已复用运行中的 AniShelf。':'AniShelf 服务已就绪。');
  console.log('已请求打开 '+URL);
 }catch(error){console.error('\n启动未完成：'+error.message);if(logFile)console.error('服务日志：'+logFile);console.error('固定地址：'+URL);process.exitCode=1}
}
module.exports={probe,rejectUnexpected,createLock,ensureReady,spawnBackground,readEdgeApp,browserCommand,openBrowser,startAndOpen,URL};
if(require.main===module)main();
