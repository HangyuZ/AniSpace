'use strict';
/* Real files in a fresh, bounded workspace test directory; never opens a user library. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const C=require('./dist/storage-core.js'),{values,fetcher,entry}=require('./check-folder-storage.cjs');
class Directory{
 constructor(directory,root=directory,log=[]){this.path=directory;this.root=root;this.log=log;this.name=path.basename(directory);this.kind='directory'}
 child(name){if(typeof name!=='string'||path.basename(name)!==name||['.','..'].includes(name))throw Error('Unsafe test path');return path.join(this.path,name)}
 async queryPermission(){return 'granted'}async requestPermission(){return 'granted'}
 async getDirectoryHandle(name,{create=false}={}){const target=this.child(name);try{if(create)await fs.mkdir(target);else if(!(await fs.stat(target)).isDirectory())throw Error('Not directory')}catch(e){if(e.code==='ENOENT')e.name='NotFoundError';else if(!(create&&e.code==='EEXIST'))throw e;if(e.name==='NotFoundError')throw e}return new Directory(target,this.root,this.log)}
 async getFileHandle(name,{create=false}={}){const target=this.child(name);try{await fs.access(target)}catch(e){if(!create){e.name='NotFoundError';throw e}await fs.writeFile(target,'',{flag:'wx'})}
  const dir=this;return {kind:'file',name,async getFile(){return new Blob([await fs.readFile(target)])},async createWritable(){let bytes;return {async write(value){bytes=value},async close(){const temporary=dir.child(name+'.tmp-'+crypto.randomUUID());await fs.writeFile(temporary,bytes);await fs.rename(temporary,target);dir.log.push(path.relative(dir.root,target).split(path.sep).join('/'))},async abort(){}}}};
 }
 async *entries(){for(const d of await fs.readdir(this.path,{withFileTypes:true})){if(d.isDirectory())yield [d.name,new Directory(this.child(d.name),this.root,this.log)];else yield [d.name,await this.getFileHandle(d.name)]}}
 async removeEntry(name){const target=this.child(name);try{const stat=await fs.stat(target);if(stat.isDirectory())await fs.rmdir(target);else await fs.unlink(target)}catch(e){if(e.code==='ENOENT')e.name='NotFoundError';throw e}}
}
async function main(){
 const root=await fs.mkdtemp(path.join(__dirname,'incremental-fs-test-')),dir=new Directory(root),repo=new C.FolderRepository(dir,{fetcher});let state=values();
 await repo.commit(state,null,{newLibrary:true});const originalLibrary=repo.manifest.files.library,first=await repo.manifestText();
 dir.log.length=0;state={...state,'anishelf-theme':'light'};await repo.commit(state,repo.manifest.revision);
 assert.deepEqual(dir.log.filter(p=>p.startsWith('.snapshots/')).map(p=>p.split('/').at(-1)),['preferences.json']);assert.equal(repo.lastCommitStats.encodedEntries,0);
 const preferenceStats=repo.lastCommitStats;
 for(let i=0;i<9;i++){state={...state,'anishelf-sort':JSON.stringify({key:'title',direction:'asc',test:i})};await repo.commit(state,repo.manifest.revision)}
 assert.equal((await repo.backups()).length,5);assert.equal(repo.manifest.files.library,originalLibrary);assert.ok((await C.read(dir,originalLibrary)).includes(entry.id));
 for(const backup of await repo.backups())await new C.FolderRepository(dir,{fetcher}).load(backup.raw);
 const fresh=new C.FolderRepository(dir,{fetcher});assert.ok(C.sameValues((await fresh.load()).values,state));
 // Unchanged saves perform zero writes, including index/backup writes.
 dir.log.length=0;await fresh.commit(fresh.committedValues,fresh.manifest.revision);assert.equal(dir.log.length,0);
 // The first preference document may expire, while the library in its folder remains referenced.
 const firstManifest=JSON.parse(first);await assert.rejects(()=>C.read(dir,firstManifest.files.preferences),e=>e.name==='NotFoundError');assert.ok(await C.read(dir,firstManifest.files.library));
 console.log(JSON.stringify({passed:true,testDirectory:root,preferenceDocumentWrites:preferenceStats.documentsWritten,preferenceDocumentBytes:preferenceStats.documentBytes,encodedEntries:preferenceStats.encodedEntries,retainedBackups:5,realFilesystem:true}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
