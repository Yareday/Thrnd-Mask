const $=id=>document.getElementById(id);
const rpc=async data=>{const r=await chrome.runtime.sendMessage({target:'worker',...data});if(!r?.ok)throw Error(r?.error||'Extension did not respond');return r.value;};
let current={groups:{violence:true,sexual:true,language:false},rules:[]},tab;
function draw(){for(const g of Object.keys(current.groups))$(g).checked=current.groups[g];$('rules').replaceChildren(...current.rules.map(r=>{const p=document.createElement('p');p.textContent=r.title+': '+r.condition;const b=document.createElement('button');b.textContent='Remove';b.onclick=()=>{current.rules=current.rules.filter(x=>x.id!==r.id);draw();};p.append(b);return p;}));}
function config(){return {key:$('key').value.trim(),model:$('model').value.trim(),consent:$('consent').checked,groups:Object.fromEntries(['violence','sexual','language'].map(g=>[g,$(g).checked])),rules:current.rules};}
async function action(id,fn){$(id).disabled=true;try{await fn();}catch(e){$('status').textContent=e.message;}finally{$(id).disabled=false;}}
$('test').onclick=()=>action('test',async()=>{const r=await rpc({op:'test',config:config()});$('model').value=r.model;$('connection').textContent='Connection ready';});
$('chat').onclick=()=>action('chat',async()=>{const p=await rpc({op:'chat',config:config(),text:$('prompt').value});$('reply').textContent=p.message;if(p.action==='apply'){current={groups:p.groups,rules:p.rules};draw();$('prompt').value='';}});
$('go').onclick=()=>action('go',async()=>{if($('prompt').value.trim())throw Error('Click Apply request before Go to include your prompt.');await rpc({op:'go',config:config(),tabId:tab.id});$('status').textContent='Armed · play the video to begin';});
$('stop').onclick=()=>action('stop',async()=>{await rpc({op:'stop',tabId:tab.id});$('status').textContent='Off · video remains paused';});
async function refresh(){try{const s=await rpc({op:'status',tabId:tab?.id});$('status').textContent=s.status||'Off';$('diagnostics').textContent=JSON.stringify(s.logs||[],null,2);}catch{}}
try{[tab]=await chrome.tabs.query({active:true,currentWindow:true});const s=await rpc({op:'settings'});if(s){current={groups:s.groups,rules:s.rules};$('key').value=s.key||'';$('model').value=s.model||'';$('consent').checked=!!s.consent;draw();}await refresh();setInterval(refresh,1500);}catch(e){$('status').textContent=e.message;}
