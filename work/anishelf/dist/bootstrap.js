/* Start business modules only after the selected data source has loaded. */
(async()=>{
 document.body.classList.add('storage-starting');let startupError=null;const capture=event=>{if(event.error||event.message)startupError=event.error||Error(event.message)};window.addEventListener('error',capture);
 try{await AppStorage.ready;for(const source of document.querySelectorAll('script[data-app-script]')){const script=document.createElement('script');if(source.textContent.trim()){script.textContent=source.textContent;document.body.append(script);if(startupError)throw startupError}else{script.src=source.getAttribute('src');await new Promise((resolve,reject)=>{script.onload=()=>startupError?reject(startupError):resolve();script.onerror=()=>reject(Error('Unable to load '+script.src));document.body.append(script)})}}document.body.classList.remove('storage-starting');}
 catch(error){const panel=document.createElement('section');panel.className='storage-startup';const p=document.createElement('p');p.textContent='AniShelf could not start: '+error.message;panel.append(p);document.body.append(panel)}finally{window.removeEventListener('error',capture)}
})();
