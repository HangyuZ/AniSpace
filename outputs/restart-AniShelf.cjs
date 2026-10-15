'use strict';
/* Explicit service restart. Refuses to stop any listener outside this exact checkout. */
const cp=require('node:child_process'),path=require('node:path'),{promisify}=require('node:util');
const L=require('./launch-AniShelf.cjs'),run=promisify(cp.execFile);
const stopScript=`$ErrorActionPreference='Stop'
$target=[Environment]::GetEnvironmentVariable('ANISHELF_SERVE_PATH')
$owners=@(Get-NetTCPConnection -LocalPort 43871 -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
if($owners.Count -ne 1){throw 'Cannot identify one AniShelf service process. No process was stopped.'}
$item=Get-CimInstance Win32_Process -Filter ('ProcessId='+$owners[0]) -ErrorAction Stop
$pattern='(?i)(?:^|\\s)"?'+[regex]::Escape($target)+'"?\\s*$'
if($item.Name -ne 'node.exe' -or -not $item.CommandLine -or $item.CommandLine -notmatch $pattern){throw 'Port 43871 is not this AniShelf service. No process was stopped.'}
Stop-Process -Id $owners[0] -ErrorAction Stop`;
async function stopOwnService({execute=run}={}){await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',stopScript],{windowsHide:true,env:{...process.env,ANISHELF_SERVE_PATH:path.join(__dirname,'serve.cjs')}})}
async function main(){try{const state=await L.probe();L.rejectUnexpected(state);if(state.kind==='ready'){console.log('正在重启当前目录的 AniShelf 本地服务…');await stopOwnService();let attempts=0;while((await L.probe()).kind!=='offline'&&attempts++<30)await new Promise(r=>setTimeout(r,100));if(attempts>30)throw Error('服务尚未停止，请稍后重试。')}
 const child=cp.spawn(process.execPath,[path.join(__dirname,'launch-AniShelf.cjs')],{stdio:'inherit',windowsHide:false});child.on('error',error=>{console.error(error.message);process.exitCode=1});child.on('exit',code=>{process.exitCode=code||0});
 }catch(error){console.error('未能安全重启：'+error.message);process.exitCode=1}}
module.exports={stopOwnService,stopScript};if(require.main===module)main();
