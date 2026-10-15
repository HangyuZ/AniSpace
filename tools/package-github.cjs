'use strict';
// Copy only known source/runtime files. Never traverse outputs or a data folder.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const runtimeFiles=['start-AniShelf.cmd','launch-AniShelf.cjs','serve.cjs','mal-service.cjs','restart-AniShelf.cmd','restart-AniShelf.cjs'];
const excludedTests=new Set(['check-edge-app.cjs','check-folder-browser.cjs']); // Local app binding / local runtime path.
const timestamp=new Date().toISOString().replace(/[-:]/g,'').replace('T','-').replace(/\.\d+Z$/,'')+'-'+crypto.randomBytes(3).toString('hex');
const destination=path.join(root,'artifacts','github-'+timestamp),repo=path.join(destination,'repository'),runtime=path.join(destination,'AniShelf-Windows');
function copy(from,to){const stat=fs.lstatSync(from);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Expected a regular file: '+from);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to)}
function archive(from,to){
 if(process.platform!=='win32')throw Error('ZIP creation currently requires Windows tar.exe; prepared directories remain available.');
 const tar=path.join(process.env.SystemRoot||'C:\\Windows','System32','tar.exe');
 cp.execFileSync(tar,['-a','-c','-f',to,'-C',path.dirname(from),path.basename(from)],{windowsHide:true,stdio:'pipe'});
}
try{
 fs.mkdirSync(destination,{recursive:true});fs.mkdirSync(repo);fs.mkdirSync(runtime);
 for(const file of ['README.md','.gitignore','tools/package-github.cjs'])copy(path.join(root,file),path.join(repo,file));
 const notices=['LICENSE','LICENSE.md','LICENSE.txt','NOTICE','NOTICE.md','THIRD_PARTY_NOTICES.md'].filter(file=>fs.existsSync(path.join(root,file)));
 for(const file of notices)copy(path.join(root,file),path.join(repo,file));
 const source=path.join(root,'work','anishelf'),target=path.join(repo,'work','anishelf');
 for(const file of fs.readdirSync(path.join(source,'dist'))){if(/\.(?:html|css|js)$/.test(file))copy(path.join(source,'dist',file),path.join(target,'dist',file))}
 for(const file of fs.readdirSync(source)){if(file==='package.cjs'||(/^check.*\.cjs$/.test(file)&&!excludedTests.has(file)))copy(path.join(source,file),path.join(target,file))}
 for(const file of runtimeFiles)copy(path.join(root,'outputs',file),path.join(repo,'outputs',file));
 // Build in the staged repository: the live installation is never overwritten/restarted.
 cp.execFileSync(process.execPath,['package.cjs'],{cwd:target,stdio:'inherit'});
 const html=fs.readFileSync(path.join(repo,'outputs','AniShelf.html'),'utf8');
 if(!html.includes('id="appSidebar"')||/<script src=|<link rel="stylesheet"/.test(html))throw Error('Standalone HTML validation failed.');
 for(const file of [...runtimeFiles,'AniShelf.html'])copy(path.join(repo,'outputs',file),path.join(runtime,file));
 copy(path.join(root,'README.md'),path.join(runtime,'README.md'));
 for(const file of notices)copy(path.join(root,file),path.join(runtime,file));
 const sourceZip=path.join(destination,'AniShelf-GitHub-'+timestamp+'.zip'),runtimeZip=path.join(destination,'AniShelf-Windows-'+timestamp+'.zip');
 archive(repo,sourceZip);archive(runtime,runtimeZip);
 const checksums=[sourceZip,runtimeZip].map(file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')+'  '+path.basename(file)).join('\n')+'\n';
 fs.writeFileSync(path.join(destination,'SHA256SUMS.txt'),checksums);
 console.log('Ready: '+destination);console.log('Repository: '+repo);console.log('Windows ZIP: '+runtimeZip);console.log('No upload performed. Review LICENSE and file contents before publication.');
}catch(error){console.error('Packaging failed: '+error.message);process.exitCode=1}
