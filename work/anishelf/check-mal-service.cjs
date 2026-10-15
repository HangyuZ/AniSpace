'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {createMalHandler,query,CALLBACK}=require('../../outputs/mal-service.cjs');
assert.equal(query({kind:'ranking'}).hostname,'api.myanimelist.net');assert.equal(query({kind:'ranking'}).searchParams.get('limit'),'10');
assert.throws(()=>query({kind:'https://evil.example'}));assert.throws(()=>query({kind:'season',year:2026,season:'../users'}));assert.throws(()=>query({kind:'details',id:'1/../../users'}));
const calls=[];let clock=100000,tokenCount=0;
const fetcher=async(url,options)=>{calls.push({url,options});if(String(url).includes('/oauth2/token'))return new Response(JSON.stringify({access_token:'secret-access-'+(++tokenCount),refresh_token:'secret-refresh',expires_in:120}),{headers:{'content-type':'application/json'}});return new Response(JSON.stringify({data:[{node:{id:1,title:'Romaji',alternative_titles:{en:'English 日本語'},nsfw:'white'}}]}),{headers:{'content-type':'application/json'}})};
const handler=createMalHandler({fetcher,now:()=>clock});const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://127.0.0.1:43871')));
function request(port,url,body,headers={},method=body===undefined?'GET':'POST'){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{Host:'127.0.0.1:43871',Origin:'http://127.0.0.1:43871','Content-Type':'application/json','X-AniShelf-Request':'discover-v1',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text,json:()=>JSON.parse(text)}))});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body))})}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,base={clientId:'a'.repeat(32)};
 try{
  for(const headers of [{Origin:'https://evil.example'},{Host:'evil.example:43871'},{'Content-Type':'text/plain'},{'X-AniShelf-Request':''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await request(port,'/.anishelf/mal/request',{...base,kind:'ranking'},headers)).status,403);
  assert.equal(calls.length,0);assert.equal((await request(port,'/.anishelf/mal/request',undefined)).status,405);
  const rank=await request(port,'/.anishelf/mal/request',{...base,kind:'ranking'});assert.equal(rank.status,200);assert.equal(rank.json().data[0].node.alternative_titles.en,'English 日本語');assert.equal(rank.headers['access-control-allow-origin'],undefined);assert.equal(calls[0].options.headers.Authorization,undefined);
  assert.equal((await request(port,'/.anishelf/mal/request',{...base,kind:'suggestions'})).status,401);
  const start=await request(port,'/.anishelf/mal/auth/start',base),auth=start.json(),url=new URL(auth.url),state=url.searchParams.get('state');
  assert.equal(url.origin,'https://myanimelist.net');assert.equal(url.searchParams.get('redirect_uri'),CALLBACK);assert.equal(url.searchParams.get('code_challenge_method'),'plain');assert.match(url.searchParams.get('code_challenge'),/^[a-f0-9]{128}$/);assert.match(auth.session,/^[a-f0-9]{64}$/);
  const input={...base,session:auth.session};assert.equal((await request(port,'/.anishelf/mal/auth/status',input)).json().pending,true);
  assert.equal((await request(port,'/.anishelf/mal/callback?code=x&state=invalid',undefined)).status,400);
  const callback=await request(port,'/.anishelf/mal/callback?code=auth-code&state='+state,undefined);assert.equal(callback.status,303);assert.ok(!callback.headers.location.includes('code='));assert.equal((await request(port,'/.anishelf/mal/callback?code=auth-code&state='+state,undefined)).status,400);
  const tokenCall=calls.find(c=>c.url.includes('/oauth2/token')),form=new URLSearchParams(tokenCall.options.body);assert.equal(form.get('code_verifier'),url.searchParams.get('code_challenge'));assert.equal(form.get('client_secret'),null);assert.equal(form.get('redirect_uri'),CALLBACK);
  const status=await request(port,'/.anishelf/mal/auth/status',input);assert.equal(status.json().connected,true);assert.ok(!status.text.includes('secret-access'));assert.ok(!status.text.includes('secret-refresh'));
  assert.equal((await request(port,'/.anishelf/mal/request',{...input,kind:'suggestions'})).status,200);assert.equal(calls.at(-1).options.headers.Authorization,'Bearer secret-access-1');
  clock+=121000;assert.equal((await request(port,'/.anishelf/mal/request',{...input,kind:'suggestions'})).status,200);assert.equal(tokenCount,2);assert.equal(calls.at(-1).options.headers.Authorization,'Bearer secret-access-2');
  assert.equal((await request(port,'/.anishelf/mal/auth/disconnect',input)).status,200);assert.equal((await request(port,'/.anishelf/mal/auth/status',input)).json().connected,false);assert.equal((await request(port,'/.anishelf/mal/request',{...input,kind:'suggestions'})).status,401);
  console.log('PASS: real loopback HTTP, strict host/origin/content-type/custom-header guards, no CORS, fixed public endpoints, OAuth PKCE/state/single-use callback, token refresh and isolation, no tokens in responses, disconnect, UTF-8 metadata. Upstream MAL responses mocked.');
 }finally{await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);process.exitCode=1});
