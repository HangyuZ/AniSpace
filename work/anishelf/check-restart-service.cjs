'use strict';
const assert=require('node:assert/strict'),R=require('../../outputs/restart-AniShelf.cjs');
(async()=>{
 let called=false;await R.stopOwnService({execute:async(file,args,options)=>{called=true;assert.equal(file,'powershell.exe');assert.equal(options.windowsHide,true);assert.ok(options.env.ANISHELF_SERVE_PATH.endsWith('outputs\\serve.cjs'));assert.ok(args.includes('-NoProfile'));assert.match(R.stopScript,/Get-NetTCPConnection -LocalPort 43871/);assert.match(R.stopScript,/Get-CimInstance Win32_Process/);assert.match(R.stopScript,/CommandLine -notmatch/);assert.match(R.stopScript,/regex\]::Escape\(\$target\)/);assert.match(R.stopScript,/Stop-Process -Id \$owners\[0\]/)}});
 assert.equal(called,true);await assert.rejects(()=>R.stopOwnService({execute:async()=>{throw Error('CIM denied')}}),/CIM denied/);
 console.log('PASS: restart checks exact listener/process/script path, hidden PowerShell, no shell path interpolation, refuses on inspection failure. No process stopped.');
})().catch(e=>{console.error(e);process.exitCode=1});
