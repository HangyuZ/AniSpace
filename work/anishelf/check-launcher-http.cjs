/* Uses temporary loopback ports; never stops or replaces the user's port-43871 service. */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const L=require('../../outputs/launch-AniShelf.cjs'),service=require('../../outputs/serve.cjs');
const listen=(server,port=0)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve(server.address().port)})});
const close=server=>server?.listening?new Promise(resolve=>server.close(resolve)):Promise.resolve();
const get=(port,url,method='GET')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:url,method,agent:false},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body}))});req.on('error',reject);req.end()});
async function main(){
 let active=service,server=http.createServer((req,res)=>active(req,res)),started;
 try{
  const port=await listen(server),check=()=>L.probe({request:(opts,callback)=>http.request({...opts,port},callback)});
  assert.equal((await check()).kind,'ready');assert.equal((await get(port,'/')).status,200);assert.equal((await get(port,'/private')).status,404);assert.equal((await get(port,'/','POST')).status,405);assert.equal((await get(port,'/','HEAD')).body,'');
  active=service.createHandler(path.join(__dirname,'missing-test-launcher.html'));assert.equal((await check()).kind,'unready');
  active=(_req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'AniShelf',protocol:1,instance:'other-folder',ready:true}))};assert.equal((await check()).kind,'other-copy');
  active=(_req,res)=>res.writeHead(404).end('Not found');assert.equal((await check()).kind,'occupied');
  // Reserve a test-only port, release it, then exercise cold startup and concurrent reuse.
  await close(server);assert.equal((await check()).kind,'offline');let starts=0,opens=0;
  const directory=fs.mkdtempSync(path.join(__dirname,'launcher-http-test-')),options={check,tryLock:L.createLock(directory),spawnService:async()=>{starts++;started=http.createServer(service);await listen(started,port)},open:async()=>{assert.equal((await check()).kind,'ready');opens++}};
  const results=await Promise.all([L.startAndOpen(options),L.startAndOpen(options)]);assert.equal(starts,1);assert.equal(opens,2);assert.ok(results.some(r=>r.reused));
  await L.startAndOpen(options);assert.equal(starts,1);assert.equal(opens,3);
  console.log('PASS: real loopback HTTP readiness, HTML GET/HEAD, unreadable HTML, foreign/legacy listeners, cold start, simultaneous launch and reuse, with browser opening replaced by an assertion. Existing port 43871 untouched.');
 }finally{await close(server);await close(started)}
}
main().catch(error=>{console.error(error);process.exitCode=1});
