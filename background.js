let creating;
async function host(){if(!(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length){if(!creating)creating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['BLOBS'],justification:'Process sampled video frame images and Gemini responses while the popup is closed.'}).finally(()=>creating=null);await creating;}}
async function engine(data){await host();const r=await chrome.runtime.sendMessage({...data,target:'engine'});if(!r?.ok)throw Error(r?.error||'Analysis connection lost');return r.value;}
async function badge(id,status){await chrome.action.setBadgeText({tabId:id,text:status.startsWith('Active')?'ON':status.startsWith('Off')?'':status.startsWith('Armed')?'ARM':status.startsWith('Error')?'!':'WAIT'});await chrome.action.setBadgeBackgroundColor({tabId:id,color:status.startsWith('Active')?'#347449':'#8b602a'});await chrome.action.setTitle({tabId:id,title:'Thrnd · '+status});await chrome.storage.session.set({['status_'+id]:status});}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m.target==='log'&&s.url===chrome.runtime.getURL('offscreen.html')){chrome.storage.session.set({logs:m.logs});return;}
 if(m.target!=='worker')return;
 const content=!!s.tab, id=content?s.tab.id:m.tabId;
 (async()=>{
  if(content){
   if(m.op==='stopSelf'){await chrome.storage.session.set({['armed_'+id]:false});await engine({op:'cancel',tabId:id});await badge(id,'Off');return;}
   if(m.op==='state'){const v=await chrome.storage.session.get(['config','armed_'+id]);return v['armed_'+id]?{armed:true}: {armed:false};}
   const v=await chrome.storage.session.get(['config','armed_'+id]);if(!v['armed_'+id])throw Error('Filtering is off');
   if(m.op==='status'){await badge(id,String(m.status).slice(0,160));return;}
   if(m.op==='analyze')return engine({op:'analyze',tabId:id,config:v['armed_'+id],batch:m.batch});
   throw Error('Unsupported request');
  }
  if(s.url!==chrome.runtime.getURL('popup.html'))throw Error('Unsupported caller');
  if(m.op==='settings')return (await chrome.storage.session.get('config')).config;
  if(m.op==='status'){const x=await chrome.storage.session.get(['status_'+id,'logs']);return {status:x['status_'+id],logs:x.logs};}
  if(m.op==='test'||m.op==='chat'){
   if(!m.config?.consent||!m.config.key)throw Error('Enter your key and check consent.');
   const value=await engine(m);if(m.op==='test')await chrome.storage.session.set({config:{...m.config,model:value.model}});return value;
  }
  if(m.op==='go'){
   if(!Object.values(m.config.groups).some(Boolean)&&!m.config.rules.some(r=>r.enabled))throw Error('Choose a filter or add a rule first.');
   const saved=(await chrome.storage.session.get('config')).config;
   if(!m.config?.consent||!saved||m.config.key!==saved.key||m.config.model!==saved.model)throw Error('Test this key and model first.');
   await chrome.storage.session.set({config:m.config,['armed_'+id]:m.config});
   await engine({op:'cancel',tabId:id});
   await chrome.scripting.executeScript({target:{tabId:id},files:['browser-content.js']});
   await chrome.tabs.sendMessage(id,{op:'start'});await badge(id,'Armed · play to analyze');return;
  }
  if(m.op==='stop'){await chrome.storage.session.set({['armed_'+id]:false});await engine({op:'cancel',tabId:id});await chrome.tabs.sendMessage(id,{op:'stop'}).catch(()=>{});await badge(id,'Off');return;}
  throw Error('Unknown request');
 })().then(value=>reply({ok:true,value})).catch(e=>reply({ok:false,error:e.message}));return true;
});
chrome.tabs.onRemoved.addListener(id=>{chrome.storage.session.remove(['armed_'+id,'status_'+id]);});
