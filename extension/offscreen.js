import {request,testConnection,responseText,redact,explain} from './api.js';
import {compilerPrompt,validatePlan,expandGroups} from './rules.js';
import {buildPrompt,FILTERS} from './categories.js';
import {decide} from './core.js';
import {analysisBody} from './transport.js';
import {collectRows} from './decisions.js';
const jobs=new Map();let logs=[];
function report(d){logs.push(d);logs=logs.slice(-80);chrome.runtime.sendMessage({target:'log',logs}).catch(()=>{});}
async function analyze(batch,c,signal){
 if(!Array.isArray(batch)||!batch.length||batch.length>3)throw Error('Invalid batch size');
 const active=expandGroups(c.groups);for(const r of c.rules)if(r.enabled)active[r.id]=true;
 const parts=[{text:buildPrompt(active,c.rules)+' Target intervals: '+JSON.stringify(batch.map(b=>({start_time:b.start_time,end_time:b.end_time,subtitles:b.captions??null}))) }];
 for(const b of batch){if(!Number.isFinite(b.start_time)||b.start_time%2||!Array.isArray(b.frames)||b.frames.length!==4)throw Error('Invalid frame sequence');for(const f of b.frames){if(typeof f.data!=='string'||f.data.length>300000||!Number.isFinite(f.time))throw Error('Invalid image');parts.push({text:`Frame at ${f.time} seconds`},{inlineData:{mimeType:'image/jpeg',data:f.data}});}}
 report({stage:'Analysis request shape',segments:batch.length,images:batch.length*4,bytes:new Blob([JSON.stringify(analysisBody(parts))]).size});
 const body=await request(`models/${c.model}:generateContent`,c.key,analysisBody(parts),signal,report,{stage:'Browser video analysis',model:c.model});
 const rows=collectRows(responseText(body),batch);return batch.map(b=>{const row=rows.get(b.start_time);const e=decide({...b,frames:undefined,captions:undefined,entered_at_ms:performance.now()},row?.scores,active,performance.now());if(e.status!=='classified')throw Error('INCOMPLETE_DECISIONS');return {start_time:b.start_time,end_time:b.end_time,decision:e.decision,category:e.category,confidence:e.confidence};});
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m.target!=='engine'||s.id!==chrome.runtime.id||s.tab)return;
 (async()=>{
  if(m.op==='cancel'){jobs.get(m.tabId)?.abort();jobs.delete(m.tabId);return;}
  const c=m.config;if(!c?.key||!c.consent)throw Error('AI_SETUP_REQUIRED');
  if(m.op==='test')return {model:await testConnection(c.key,c.model,undefined,report)};
  if(m.op==='chat'){
   if(!m.text?.trim()||m.text.length>2000||redact(m.text,c.key)!==m.text)throw Error('Enter a request without credentials.');
   const b=await request(`models/${c.model}:generateContent`,c.key,{systemInstruction:{parts:[{text:compilerPrompt()}]},contents:[{parts:[{text:JSON.stringify({current:{groups:c.groups,rules:c.rules},request:m.text})}]}],generationConfig:{responseMimeType:'application/json',temperature:0}},undefined,report,{stage:'Chat rules',model:c.model});return validatePlan(JSON.parse(responseText(b)));
  }
  if(m.op==='analyze'){
   jobs.get(m.tabId)?.abort();const ctl=new AbortController();jobs.set(m.tabId,ctl);
   // Caption-based rules cannot silently become visual-only rules.
   const language=c.groups.language||c.rules.some(r=>r.enabled&&r.evidence==='subtitles');
   if(language&&m.batch.some(b=>b.captions===null))throw Error('MISSING_SUBTITLES');
   try{try{return await analyze(m.batch,c,ctl.signal);}catch(e){if(!['API_HTTP_400','INCOMPLETE_DECISIONS','INVALID_JSON','INVALID_RESPONSE'].includes(e.message))throw e;const out=[];for(const b of m.batch)out.push(...await analyze([b],c,ctl.signal));return out;}}finally{if(jobs.get(m.tabId)===ctl)jobs.delete(m.tabId);}
  }
 })().then(value=>reply({ok:true,value})).catch(e=>reply({ok:false,error:explain(redact(e.message,m.config?.key))}));return true;
});
