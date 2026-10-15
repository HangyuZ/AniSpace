/* Narrow MAL transport and public-client OAuth. No library access or token files. */
'use strict';
const crypto=require('node:crypto');
const ORIGIN='http://127.0.0.1:43871',PREFIX='/.anishelf/mal',CALLBACK=ORIGIN+PREFIX+'/callback';
const FIELDS='alternative_titles,start_date,media_type,num_episodes,mean,nsfw';
const fail=(status,message)=>Object.assign(Error(message),{status});
function client(value){if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{8,128}$/.test(value))throw fail(400,'Invalid MAL Client ID');return value}
function query(input){
 const u=new URL('https://api.myanimelist.net/v2/');
 if(input.kind==='ranking'){u.pathname+='/anime/ranking';u.searchParams.set('ranking_type','all')}
 else if(input.kind==='season'){if(!Number.isInteger(input.year)||input.year<1900||input.year>2100||!['winter','spring','summer','fall'].includes(input.season))throw fail(400,'Invalid season');u.pathname+='/anime/season/'+input.year+'/'+input.season;u.searchParams.set('sort','num_list_users')}
 else if(input.kind==='suggestions')u.pathname+='/anime/suggestions';
 else if(input.kind==='details'){if(!Number.isSafeInteger(input.id)||input.id<1)throw fail(400,'Invalid anime ID');u.pathname+='/anime/'+input.id}
 else throw fail(400,'Unsupported MAL request');
 u.pathname=u.pathname.replace('/v2//','/v2/');u.searchParams.set('fields',FIELDS);u.searchParams.set('nsfw','false');
 if(input.kind!=='details')u.searchParams.set('limit','10');return u;
}
function createMalHandler({fetcher=globalThis.fetch,now=Date.now}={}){
 const sessions=new Map(),flows=new Map();let active=0;
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data))};
 async function upstream(url,options={}){
  if(active>=4)throw fail(429,'Too many MAL requests. Please retry shortly.');active++;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetcher(url,{...options,redirect:'error',signal:controller.signal});let text='',size=0;const decoder=new TextDecoder();
   if(response.body?.getReader){const reader=response.body.getReader();try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024){await reader.cancel();throw fail(502,'MAL response is too large')}text+=decoder.decode(part.value,{stream:true})}}finally{reader.releaseLock()}text+=decoder.decode()}
   else{text=await response.text();if(Buffer.byteLength(text)>2*1024*1024)throw fail(502,'MAL response is too large')}
   if(!response.ok)throw fail(response.status===429?429:response.status===401||response.status===403?401:502,response.status===429?'MAL rate limit. Please retry later.':response.status===401||response.status===403?'MAL authentication failed. Check the Client ID or reconnect.':'MAL request failed.');
   try{return JSON.parse(text)}catch{throw fail(502,'Invalid MAL response')}
  }catch(error){if(error.status)throw error;throw fail(502,error.name==='AbortError'?'MAL request timed out.':'Cannot connect to MAL. Check your connection.')}
  finally{clearTimeout(timer);active--}
 }
 function cleanup(){for(const [id,s]of sessions)if(now()-s.touched>24*60*60*1000||!s.access&&now()-s.created>10*60*1000)sessions.delete(id);for(const [id,f]of flows)if(now()-f.created>10*60*1000)flows.delete(id)}
 function session(input,required=true){const s=typeof input.session==='string'&&sessions.get(input.session);if(s&&s.clientId===input.clientId){s.touched=now();return s}if(required)throw fail(401,'Connect your MAL account first.');return null}
 async function token(s,params){const data=await upstream('https://myanimelist.net/v1/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({client_id:s.clientId,...params}).toString()});
  if(typeof data.access_token!=='string'||data.access_token.length>8192||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw fail(502,'Invalid MAL token response');
  s.access=data.access_token;if(typeof data.refresh_token==='string'&&data.refresh_token.length<=8192)s.refresh=data.refresh_token;s.expires=now()+Math.min(data.expires_in,365*86400)*1000;s.error='';
 }
 async function access(s){if(!s.access)throw fail(401,s.error||'Complete MAL authorization first.');if(s.expires<now()+60000){if(!s.refresh)throw fail(401,'MAL session expired. Reconnect.');if(!s.refreshing)s.refreshing=token(s,{grant_type:'refresh_token',refresh_token:s.refresh}).finally(()=>{s.refreshing=null});try{await s.refreshing}catch(error){s.access=null;throw error}}return s.access}
 async function callback(req,res,url){
  const state=url.searchParams.get('state'),flow=flows.get(state);if(!flow||now()-flow.created>10*60*1000){json(res,400,{error:'Authorization expired or invalid. Start again from AniShelf.'});return}
  flows.delete(state);const s=sessions.get(flow.session);if(!s){json(res,400,{error:'Authorization session no longer exists.'});return}
  const code=url.searchParams.get('code');
  try{if(url.searchParams.has('error')||!code||code.length>4096)throw fail(400,'MAL authorization was cancelled.');await token(s,{grant_type:'authorization_code',code,redirect_uri:CALLBACK,code_verifier:flow.verifier})}
  catch(error){s.error=error.message}
  res.writeHead(303,{Location:PREFIX+'/connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();
 }
 async function handle(req,res,url){
  if(!url.pathname.startsWith(PREFIX+'/'))return false;
  cleanup();
  // Only the fixed loopback host is accepted. No CORS headers are emitted.
  if(req.headers.host!=='127.0.0.1:43871'){json(res,403,{error:'Invalid local host'});return true}
  if(url.pathname===PREFIX+'/callback'&&req.method==='GET'){await callback(req,res,url);return true}
  if(url.pathname===PREFIX+'/connected'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});res.end('<!doctype html><meta charset="utf-8"><title>AniShelf · MAL</title><h1>Return to AniShelf</h1><p>Authorization finished. You can close this window. Check the connection status in AniShelf settings.</p>');return true}
  if(req.method!=='POST'){json(res,405,{error:'POST required'});return true}
  if(req.headers.origin!==ORIGIN||req.headers['x-anishelf-request']!=='discover-v1'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')||req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'){json(res,403,{error:'Same-origin AniShelf request required'});return true}
  let body='',size=0;
  try{
   for await(const part of req){size+=Buffer.byteLength(part);if(size>12000)throw fail(413,'Request too large');body+=part}
   let input;try{input=JSON.parse(body)}catch{throw fail(400,'Invalid JSON')}
   if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'Invalid request');client(input.clientId);
   if(url.pathname===PREFIX+'/auth/start'){
    if(sessions.size>=32)throw fail(429,'Too many local MAL sessions. Restart the local service.');
    const id=crypto.randomBytes(32).toString('hex'),state=crypto.randomBytes(32).toString('hex'),verifier=crypto.randomBytes(64).toString('hex');
    sessions.set(id,{clientId:input.clientId,created:now(),touched:now(),access:null,error:''});flows.set(state,{session:id,verifier,created:now()});
    const auth=new URL('https://myanimelist.net/v1/oauth2/authorize');for(const [key,value]of Object.entries({response_type:'code',client_id:input.clientId,redirect_uri:CALLBACK,code_challenge:verifier,code_challenge_method:'plain',state}))auth.searchParams.set(key,value);
    json(res,200,{session:id,url:auth.href,redirectURI:CALLBACK});return true;
   }
   if(url.pathname===PREFIX+'/auth/status'){const s=session(input,false);json(res,200,{connected:!!s?.access,error:s?.error||'',pending:!!s&&!s.access&&!s.error});return true}
   if(url.pathname===PREFIX+'/auth/disconnect'){if(session(input,false))sessions.delete(input.session);json(res,200,{disconnected:true});return true}
   if(url.pathname!==PREFIX+'/request')throw fail(404,'Unknown MAL route');
   const endpoint=query(input),headers={Accept:'application/json','X-MAL-CLIENT-ID':input.clientId};
   if(input.kind==='suggestions')headers.Authorization='Bearer '+await access(session(input));
   const data=await upstream(endpoint.href,{headers});json(res,200,data);return true;
  }catch(error){json(res,error.status||500,{error:error.status?error.message:'MAL request could not be completed.'});return true}
 }
 return (req,res,url)=>handle(req,res,url).catch(()=>{if(!res.headersSent)json(res,500,{error:'MAL service error'});else res.end();return true});
}
module.exports={createMalHandler,query,CALLBACK};
