/* Loopback-only HTML + narrow MAL transport. Library access remains in the browser. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createMalHandler}=require('./mal-service.cjs');
const html=path.join(__dirname,'AniShelf.html'),port=43871,healthPath='/.anishelf/health';
function identity(directory=__dirname){const canonical=fs.realpathSync(directory);return crypto.createHash('sha256').update(process.platform==='win32'?canonical.toLowerCase():canonical).digest('hex')}
const instance=identity();
function createHandler(htmlFile=html,id=instance,{mal=createMalHandler()}={}){return function handler(req,res){
 let pathname;try{pathname=new URL(req.url,'http://127.0.0.1').pathname}catch{res.writeHead(400).end();return}
 if(pathname.startsWith('/.anishelf/mal/')){return mal(req,res,new URL(req.url,'http://127.0.0.1:43871'))}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return}
 if(pathname===healthPath){
  fs.open(htmlFile,'r',(openError,fd)=>{if(openError){respond(false);return}fs.fstat(fd,(error,stat)=>{fs.close(fd,()=>respond(!error&&stat.isFile()&&stat.size>0))});});
  function respond(ready){
   const body=JSON.stringify({app:'AniShelf',protocol:1,instance:id,ready,...(!ready?{error:'HTML_UNAVAILABLE'}:{})});
   res.writeHead(ready?200:503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  }return;
 }
 if(pathname!=='/'&&pathname!=='/AniShelf.html'){res.writeHead(404).end();return}
 fs.readFile(htmlFile,(error,data)=>{if(error){res.writeHead(500).end('AniShelf.html is missing');return}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data)});
}}
const handler=createHandler();
module.exports=handler;
Object.assign(module.exports,{createHandler,identity,instance,port,healthPath});
if(require.main===module){
 const server=http.createServer(handler);
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'ANI_PORT_IN_USE: 127.0.0.1:43871 already has a listener.':error.message);process.exitCode=1});
 server.listen(port,'127.0.0.1',()=>console.log('AniShelf ready at http://127.0.0.1:43871/ . HTML and MAL transport; library stays in the browser.'));
}
