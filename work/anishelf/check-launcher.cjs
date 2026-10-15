'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const L=require('../../outputs/launch-AniShelf.cjs'),service=require('../../outputs/serve.cjs');
function response(handler,url,method='GET'){return new Promise(resolve=>{let status,headers;handler({url,method},{writeHead(s,h){status=s;headers=h;return this},end(body){resolve({status,headers,body:String(body||'')})}})})}
function requestStub({data,status=200,error,chunks,hang=false}={}){return (options,onResponse)=>{
 assert.equal(options.hostname,'127.0.0.1');assert.equal(options.port,43871);assert.equal(options.path,'/.anishelf/health');
 const req=new EventEmitter();req.destroy=()=>{};req.end=()=>{if(hang)return;queueMicrotask(()=>{if(error){req.emit('error',Object.assign(Error(error),{code:error}));return}const res=new EventEmitter();res.statusCode=status;res.destroy=()=>{};onResponse(res);for(const chunk of chunks||[JSON.stringify(data)])res.emit('data',Buffer.from(chunk));res.emit('end')})};return req;
}}
const ready=()=>({kind:'ready'}),offline=()=>({kind:'offline'});
async function main(){
 const health=await response(service,service.healthPath);assert.equal(health.status,200);assert.deepEqual(JSON.parse(health.body),{app:'AniShelf',protocol:1,instance:service.instance,ready:true});assert.equal((await response(service,service.healthPath,'HEAD')).body,'');assert.equal((await response(service,'/other')).status,404);assert.equal((await response(service,'/','POST')).status,405);
 const missing=service.createHandler(path.join(__dirname,'does-not-exist-launcher.html'));assert.equal((await response(missing,service.healthPath)).status,503);
 const data=JSON.parse(health.body);assert.deepEqual(await L.probe({request:requestStub({data})}),ready());
 assert.equal((await L.probe({request:requestStub({data:{...data,instance:'other'}})})).kind,'other-copy');
 assert.equal((await L.probe({request:requestStub({data:{...data,ready:false,error:'HTML_UNAVAILABLE'},status:503})})).kind,'unready');
 for(const reply of [{chunks:['not JSON'],status:404},{data:{app:'Other'}},{chunks:['x'.repeat(9000)]}])assert.equal((await L.probe({request:requestStub(reply)})).kind,'occupied');
 assert.deepEqual(await L.probe({request:requestStub({error:'ECONNREFUSED'})}),offline());assert.equal((await L.probe({request:requestStub({error:'EACCES'})})).kind,'blocked');assert.equal((await L.probe({request:requestStub({hang:true}),timeout:5})).reason,'TIMEOUT');
 let starts=0,opens=0;await L.startAndOpen({check:async()=>ready(),tryLock:()=>{throw Error('should not acquire')},spawnService:async()=>starts++,open:async()=>opens++});assert.equal(starts,0);assert.equal(opens,1);
 const sequence=[offline(),offline(),offline(),ready()];let releaseCount=0;const order=[];await L.startAndOpen({check:async()=>{const value=sequence.shift();order.push(value.kind);return value},tryLock:()=>()=>releaseCount++,spawnService:async()=>{starts++;order.push('spawn')},wait:async()=>{},open:async()=>{opens++;order.push('open')}});assert.equal(starts,1);assert.equal(releaseCount,1);assert.ok(order.indexOf('ready')<order.indexOf('open'));
 for(const kind of ['occupied','other-copy','unready','blocked']){let spawned=false,opened=false;await assert.rejects(()=>L.startAndOpen({check:async()=>({kind}),tryLock:()=>()=>{},spawnService:async()=>{spawned=true},open:async()=>{opened=true}}));assert.equal(spawned,false);assert.equal(opened,false)}
 let clock=0,released=false,opened=false;await assert.rejects(()=>L.startAndOpen({check:async()=>offline(),tryLock:()=>()=>released=true,spawnService:async()=>{},now:()=>clock,timeout:5,wait:async()=>{clock++},open:async()=>{opened=true}}),e=>e.code==='START_TIMEOUT');assert.equal(released,true);assert.equal(opened,false);
 await assert.rejects(()=>L.ensureReady({check:async()=>offline(),tryLock:()=>()=>released=true,spawnService:async()=>{throw Error('spawn denied')}}),/spawn denied/);
 // A real exclusive filesystem lock coordinates two simultaneous launcher requests.
 const directory=fs.mkdtempSync(path.join(__dirname,'launcher-test-')),tryLock=L.createLock(directory);let alive=false,concurrentStarts=0;
 const options={check:async()=>alive?ready():offline(),tryLock,spawnService:async()=>{concurrentStarts++;await new Promise(r=>setTimeout(r,5));alive=true},wait:async()=>new Promise(r=>setTimeout(r,1))};
 await Promise.all([L.ensureReady(options),L.ensureReady(options)]);assert.equal(concurrentStarts,1);assert.equal(fs.existsSync(path.join(directory,'startup.lock')),false);
 fs.writeFileSync(path.join(directory,'startup.lock'),JSON.stringify({pid:99999999,token:'old'}));const stale=L.createLock(directory,{processAlive:()=>false});assert.equal(stale(),null);const unlock=stale();assert.equal(typeof unlock,'function');unlock();
 const unlockOld=tryLock();fs.writeFileSync(path.join(directory,'startup.lock'),JSON.stringify({pid:process.pid,token:'replacement'}));unlockOld();assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'startup.lock'))).token,'replacement');fs.unlinkSync(path.join(directory,'startup.lock'));
 const edge=L.browserCommand({platform:'win32',app:null,env:{'ProgramFiles(x86)':'C:\\Program Files (x86)'},exists:()=>true});assert.match(edge.file,/msedge\.exe$/);assert.deepEqual(edge.args,[L.URL]);assert.match(L.browserCommand({platform:'win32',app:null,env:{WINDIR:'C:\\Windows'},exists:()=>false}).file,/explorer\.exe$/);
 const spawnEvents=[];const spawn=(file,args,settings)=>{spawnEvents.push({file,args,settings});const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child};
 await L.spawnBackground(path.join(directory,'service.log'),{spawn});assert.equal(spawnEvents[0].settings.windowsHide,true);assert.equal(spawnEvents[0].settings.detached,true);assert.equal(spawnEvents[0].args.length,1);assert.match(spawnEvents[0].args[0],/serve\.cjs$/);
 await L.openBrowser({spawn,command:edge});assert.equal(spawnEvents[1].settings.windowsHide,false);assert.deepEqual(spawnEvents[1].args,[L.URL]);
 const failedSpawn=()=>{const child=new EventEmitter();queueMicrotask(()=>child.emit('error',Error('denied')));return child};await assert.rejects(()=>L.openBrowser({spawn:failedSpawn,command:edge}),e=>e.code==='BROWSER_FAILED');await assert.rejects(()=>L.spawnBackground(path.join(directory,'service.log'),{spawn:failedSpawn}),e=>e.code==='SPAWN_FAILED');
 console.log('PASS: health identity/readability, HTTP probe/error/size/timeout handling, reuse without spawn, readiness before browser open, foreign/legacy port rejection, bounded startup, simultaneous launch locking, stale lock recovery, ownership-safe release, hidden background spawn and readable launch errors. HTTP/browser/process actions simulated; lock files are real.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
