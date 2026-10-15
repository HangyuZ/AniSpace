/* Weekly plan with multi-day selection. Legacy watchDay records remain readable. */
const WatchSchedule=(()=>{
 const days=['周日','周一','周二','周三','周四','周五','周六'],english=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 const normalize=value=>Number.isInteger(value)&&value>=0&&value<=6?value:null;
 const normalizeDays=values=>Array.isArray(values)?[...new Set(values.filter(v=>normalize(v)!==null))].sort((a,b)=>a-b):[];
 const recordDays=a=>Array.isArray(a.watchDays)?normalizeDays(a.watchDays):normalize(a.watchDay)!==null?[a.watchDay]:[];
 const locale=()=>I18n.getLanguage(),dayLabel=day=>locale()==='en-US'?english[day]:days[day];
 const dateKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
 let selectedKey=null;
 const selectedDate=()=>selectedKey?new Date(selectedKey+'T12:00:00'):new Date();
 const isToday=()=>dateKey(selectedDate())===dateKey(new Date());
 const matches=(a,date)=>{
  if(Array.isArray(a.seasonEntries))return a.seasonEntries.some(child=>matches(child,date));
  if(a.status==='completed'||a.status==='dropped')return false;
  // Compare local calendar dates, including the starting day. Old undated records remain usable.
  if(/^\d{4}-\d{2}-\d{2}$/.test(a.startDate||'')){
   const start=new Date(a.startDate+'T12:00:00');
   if(Number.isFinite(start.getTime())&&dateKey(start)===a.startDate&&dateKey(date)<a.startDate)return false;
  }
  return recordDays(a).includes(date.getDay());
 };
 const todayEntries=(items,date=new Date())=>items.filter(a=>matches(a,date));
 function checkboxes(values){const selected=normalizeDays(values);return [1,2,3,4,5,6,0].map(day=>'<label><input type="checkbox" value="'+day+'"'+(selected.includes(day)?' checked':'')+'><span>'+dayLabel(day)+'</span></label>').join('');}
 function selectDate(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(key||''))return;const date=new Date(key+'T12:00:00');if(!Number.isFinite(date.getTime())||dateKey(date)!==key)return;selectedKey=key===dateKey(new Date())?null:key;render();}
 function move(delta){const date=selectedDate();date.setDate(date.getDate()+delta);selectDate(dateKey(date));}
 function clock(now=new Date()){
  const date=selectedDate(),hour=now.getHours(),greeting=hour<12?'早上好':hour<18?'下午好':'晚上好';
  const greetingNode=document.querySelector('#watchGreeting'),dateNode=document.querySelector('#watchDate');if(!greetingNode||!dateNode)return;
  greetingNode.textContent=typeof UserProfile!=='undefined'?UserProfile.greeting(t(greeting)):t(greeting);dateNode.textContent=new Intl.DateTimeFormat(locale(),{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(now);dateNode.setAttribute('datetime',dateKey(now));
  const strip=document.querySelector('#watchDateStrip');if(!strip)return;
  strip.innerHTML=Array.from({length:7},(_,i)=>{
   const day=new Date(date);day.setDate(day.getDate()+i-3);
   const key=dateKey(day),today=key===dateKey(now),label=new Intl.DateTimeFormat(locale(),{month:'short',day:'numeric',weekday:'short'}).format(day);
   const fullDate=new Intl.DateTimeFormat(locale(),{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(day),accessible=fullDate+(today?' · '+t('今天'):'');
   return '<button type="button" data-watch-date="'+key+'" aria-label="'+accessible+'" title="'+accessible+'" aria-pressed="'+(i===3)+'"'+(today?' aria-current="date"':'')+'><span class="date-full" aria-hidden="true">'+label+'</span><span class="date-medium" aria-hidden="true">'+dayLabel(day.getDay())+' '+day.getDate()+'</span><span class="date-number" aria-hidden="true">'+day.getDate()+'</span>'+(today?'<small aria-hidden="true">'+t('今天')+'</small><i class="date-today-mark" aria-hidden="true"></i>':'')+'</button>';
  }).join('');
 }
 let started=false,lastDate='';
 function start(){if(started)return;started=true;
  document.querySelector('#watchPrevious').onclick=()=>move(-1);document.querySelector('#watchNext').onclick=()=>move(1);document.querySelector('#watchToday').onclick=()=>selectDate(dateKey(new Date()));
  const strip=document.querySelector('#watchDateStrip');strip.onclick=e=>{const button=e.target.closest('[data-watch-date]');if(button){selectDate(button.dataset.watchDate);document.querySelector('#watchDateStrip [aria-pressed="true"]')?.focus();}};
  strip.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key)||!e.target.closest('[data-watch-date]'))return;e.preventDefault();move(e.key==='ArrowLeft'?-1:1);document.querySelector('#watchDateStrip [aria-pressed="true"]')?.focus();});
  const tick=()=>{const now=new Date(),key=dateKey(now);if(typeof page!=='undefined'&&page==='watching'&&lastDate!==key)render();lastDate=key;};
  tick();if(typeof setInterval==='function')setInterval(tick,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastDate='';tick();}});
 }
 return {normalize,normalizeDays,recordDays,dayLabel,dateKey,selectedDate,isToday,matches,todayEntries,checkboxes,selectDate,move,clock,start};
})();
