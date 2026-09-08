import {request,responseText,normalizeModel,redact,explain} from './api.js';
import {compilerPrompt,validatePlan} from './rules.js';
export function initChat({getState,applyState,getConnection,report,onBusy}){
 const $=id=>document.getElementById(id);let history=[],busy=false,ctl=null,revision=0;
 function say(role,text){const p=document.createElement('p');p.className='chat-'+role;p.textContent=(role==='user'?'You: ':'Thrnd: ')+text;$('chatHistory').appendChild(p);while($('chatHistory').children.length>30)$('chatHistory').firstChild.remove();p.scrollIntoView?.({block:'nearest'});}
 function render(){const state=getState();$('customRules').replaceChildren(...state.rules.map(rule=>{
  const card=document.createElement('div');card.className='rule-card';
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=rule.enabled;label.appendChild(check);label.appendChild(document.createTextNode(' '+rule.title));
  const editor=document.createElement('textarea');editor.value=rule.condition;editor.maxLength=800;editor.setAttribute('aria-label','Edit '+rule.title);
  const source=document.createElement('select');source.setAttribute('aria-label','Evidence for '+rule.title);for(const [v,t]of [['visual','Video frames'],['subtitles','Subtitles required']]){const o=document.createElement('option');o.value=v;o.textContent=t;source.appendChild(o);}source.value=rule.evidence;
  const save=document.createElement('button');save.textContent='Save rule';save.onclick=()=>{if(!editor.value.trim())return;const s=getState();s.rules=s.rules.map(r=>r.id===rule.id?{...r,condition:editor.value.trim(),evidence:source.value}:r);changed(s);};
  check.onchange=()=>{const s=getState();s.rules=s.rules.map(r=>r.id===rule.id?{...r,enabled:check.checked}:r);changed(s);};
  const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=()=>{const s=getState();s.rules=s.rules.filter(r=>r.id!==rule.id);changed(s);};
  card.append(label,editor,source,save,remove);return card;
 }));$('ruleCount').textContent=state.rules.filter(r=>r.enabled).length+' active custom rules';}
 function changed(state){revision++;ctl?.abort();applyState(state);render();}
 $('chatForm').onsubmit=async e=>{
  e.preventDefault();if(busy)return;const text=$('chatInput').value.trim();if(!text)return;
  const connection=getConnection();if(!connection.ready){say('assistant','Enter your key, check consent, and complete Test connection first.');return;}
  const safe=redact(text,connection.key);if(safe!==text){say('assistant','Please remove API keys or credentials from your message.');return;}
  const initial=getState(),token=revision;ctl=new AbortController();busy=true;$('chatSend').disabled=true;onBusy?.(true);say('user',text);$('chatInput').value='';
  try{
   const contents=[{role:'user',parts:[{text:JSON.stringify({current:initial,conversation:history.slice(-8),request:text})}]}];
   const body=await request(`models/${normalizeModel(connection.model)}:generateContent`,connection.key,{systemInstruction:{parts:[{text:compilerPrompt()}]},contents,generationConfig:{responseMimeType:'application/json',temperature:0}},ctl.signal,report,{stage:'Chat: prepare filtering rules',model:connection.model});
   if(token!==revision||ctl.signal.aborted)return;
   let parsed;try{parsed=JSON.parse(responseText(body));}catch{throw Error('INVALID_CHAT_PLAN');}
   const plan=validatePlan(parsed);history.push({role:'user',text},{role:'assistant',text:plan.message});history=history.slice(-12);
   say('assistant',redact(plan.message,connection.key));
   if(plan.action==='apply'){applyState({groups:plan.groups,rules:plan.rules});render();say('assistant','Settings applied. Review the switches and custom rules below. Video decisions are rebuilt from your current position.');}
  }catch(err){if(token===revision&&!ctl.signal.aborted)say('assistant',err.message==='INVALID_CHAT_PLAN'?'The reply was not a valid rule configuration. Nothing changed; please rephrase.':explain(err.message));}
  finally{busy=false;$('chatSend').disabled=false;onBusy?.(false);}
 };
 render();return {refresh(){revision++;ctl?.abort();render();},cancel(){revision++;ctl?.abort();}};
}
