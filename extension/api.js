import {CONTRACT} from './core.js';
export function redact(value,key=''){
  let s=String(value??'');
  for(const secret of [key,encodeURIComponent(key)])if(secret)s=s.split(secret).join('[REDACTED]');
  return s.replace(/AIza[\w-]+/g,'[REDACTED]').replace(/(Bearer\s+)[\w.\/-]+/gi,'$1[REDACTED]').slice(0,2000);
}
export class ApiError extends Error{
  constructor(code,diagnostic){super(code);this.diagnostic=diagnostic;}
}
export async function request(path,key,body,parent,report=()=>{},context={}){
  const ctl=new AbortController(),abort=()=>ctl.abort();
  parent?.addEventListener('abort',abort,{once:true});if(parent?.aborted)abort();
  const timer=setTimeout(abort,CONTRACT.requestTimeoutMs),start=performance.now();
  const base={stage:context.stage||'request',model:context.model||null,endpoint:'https://generativelanguage.googleapis.com/v1beta/'+path.split('?')[0],method:body?'POST':'GET'};
  // Sanitize each string separately so truncation can never corrupt JSON.
  const safePublish=fields=>{const d={...base,...fields,elapsed_ms:Math.round(performance.now()-start)};for(const [k,v]of Object.entries(d))if(typeof v==='string')d[k]=redact(v,key);report(d);return d;};
  safePublish({state:'started'});
  let status=null;
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/'+path,{method:body?'POST':'GET',signal:ctl.signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},...(body?{body:JSON.stringify(body)}:{})});status=r.status||200;
    let data;try{data=await r.json();}catch(e){if(ctl.signal.aborted||parent?.aborted)throw e;throw new ApiError(r.ok?'INVALID_JSON':`API_HTTP_${status}`,safePublish({state:'failed',http_status:status,provider_message:'The endpoint returned a non-JSON response.'}));}
    if(parent?.aborted)throw Error('CANCELLED');
    if(ctl.signal.aborted||performance.now()-start>CONTRACT.requestTimeoutMs)throw Error('REQUEST_TIMEOUT');
    if(!r.ok){
      const fields=(data.error?.details||[]).flatMap(d=>d.fieldViolations||[]).map(v=>String(v.field||'')).slice(0,20).join(', ');
      throw new ApiError(`API_HTTP_${status}`,safePublish({state:'failed',http_status:status,provider_status:String(data.error?.status||''),provider_message:String(data.error?.message||'No provider message returned.'),invalid_fields:fields}));
    }
    safePublish({state:'succeeded',http_status:status});return data;
  }catch(e){
    if(e instanceof ApiError)throw e;
    const code=parent?.aborted?'CANCELLED':ctl.signal.aborted||e.message==='REQUEST_TIMEOUT'?'REQUEST_TIMEOUT':'NETWORK_ERROR';
    throw new ApiError(code,safePublish({state:'failed',http_status:status,provider_message:code==='NETWORK_ERROR'?'No readable API response. Check network, browser restrictions or connectivity.':code==='CANCELLED'?'Request cancelled because the session or settings changed.':'Google did not finish within 90 seconds.'}));
  }finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
}
export function responseText(body){return body.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')||'';}
export function normalizeModel(model){return model.trim().replace(/^models\//,'');}
export function rankModels(models){
  return [...new Set(models.filter(m=>m.supportedGenerationMethods?.includes('generateContent')&&/^models\/gemini-/.test(m.name)&&!/image|audio|tts|live|robot|native|computer-use|embedding/.test(m.name)).map(m=>m.name.replace(/^models\//,'')))].sort((a,b)=>{
    const score=s=>Number(!s.includes('flash'))*4+Number(/preview|exp/.test(s))*2+Number(s==='gemini-omni-1.1-flash')*16;
    return score(a)-score(b)||b.localeCompare(a,undefined,{numeric:true});
  });
}
export async function testConnection(key,model,signal,report=()=>{}){
  model=normalizeModel(model);let candidates=[];
  if(model){if(!/^[a-zA-Z0-9.-]+$/.test(model))throw Error('INVALID_MODEL_ID');candidates=[model];}
  else{
    let token='',models=[],pages=0;const seen=new Set();
    do{
      const data=await request('models?pageSize=1000'+(token?'&pageToken='+encodeURIComponent(token):''),key,null,signal,report,{stage:'List available models'});
      if(!Array.isArray(data.models))throw Error('INVALID_MODEL_LIST');models.push(...data.models);token=data.nextPageToken||'';
      if(token&&(seen.has(token)||++pages>=10))throw Error('MODEL_LIST_PAGINATION');seen.add(token);
    }while(token);
    candidates=rankModels(models).slice(0,4);if(!candidates.length)throw Error('NO_MODEL_FOUND');
  }
  const c=document.createElement('canvas');c.width=16;c.height=16;const ctx=c.getContext('2d');ctx.fillStyle='green';ctx.fillRect(0,0,16,16);
  let last;
  for(const candidate of candidates){
    if(signal?.aborted)throw Error('CANCELLED');
    try{
      const result=await request(`models/${candidate}:generateContent`,key,{contents:[{parts:[{text:'Inspect this generated test image. Return JSON only: {"color":"green"} with its main color.'},{inlineData:{mimeType:'image/png',data:c.toDataURL('image/png').split(',')[1]}}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:{type:'object',required:['color'],properties:{color:{type:'string'}}},temperature:0}},signal,report,{stage:'Test image and JSON response',model:candidate});
      const text=responseText(result);let parsed;try{parsed=JSON.parse(text);}catch{}
      if(!parsed||typeof parsed.color!=='string'){
        const d={stage:'Validate test output',model:candidate,state:'failed',provider_message:'The model did not return the required color JSON.',finish_reason:result.candidates?.[0]?.finishReason||null,block_reason:result.promptFeedback?.blockReason||null};report(d);throw new ApiError('INVALID_TEST_RESPONSE',d);
      }
      report({stage:'Connection ready',state:'succeeded',model:candidate});return candidate;
    }catch(e){last=e;
      const interactionsOnly=e.message==='API_HTTP_400'&&/only supports? (?:the )?interactions api|interactions api only/i.test(e.diagnostic?.provider_message||'');
      if(interactionsOnly){
        report({stage:'API compatibility',state:'failed',model:candidate,provider_message:'This model requires Interactions API; Thrnd currently uses generateContent.'});
        last=new ApiError('INTERACTIONS_ONLY',e.diagnostic);
        if(model)throw last;
        continue;
      }
      const unsupported400=e.message==='API_HTTP_400'&&/not supported|unsupported|not available|not found/i.test(e.diagnostic?.provider_message||'');
      if(model||!(e.message==='API_HTTP_404'||e.message==='INVALID_TEST_RESPONSE'||unsupported400))throw e;
    }
  }
  throw last||Error('NO_MODEL_FOUND');
}
export function explain(code){return ({INCOMPLETE_DECISIONS:'Some decisions remain incomplete after three attempts. Valid decisions were kept. Retry analysis to try again.',DEMO_CUSTOM_RULES:'Custom rules need actual AI analysis. Choose a local video; the fixture demo cannot evaluate them.',INTERACTIONS_ONLY:'This model requires a different Google API. Clear Model ID and Test connection to try another listed model.',AI_SETUP_REQUIRED:'Enter your key and check consent, then click Test connection.',CONNECTION_REQUIRED:'Click Test connection to verify your key and model.',MISSING_SUBTITLES:'Language filters need subtitles. Add subtitles or turn that filter off.',REQUEST_TIMEOUT:'Google did not finish within 90 seconds. Check API diagnostics, then retry.',EXTRACTION_TIMEOUT:'Frame extraction took over 60 seconds. Try a compatible MP4 or retry.',API_HTTP_400:'Google rejected the request. API diagnostics shows its explanation.',API_HTTP_401:'Google rejected authentication. Check API diagnostics and your key.',API_HTTP_403:'Google denied access. Check its permission message in API diagnostics.',API_HTTP_404:'Google returned not found. API diagnostics identifies the failing endpoint and model.',API_HTTP_429:'Google quota or rate limit reached. Check API diagnostics; retry later.',INVALID_RESPONSE:'Incomplete segment decisions. Retry analysis.',MISSING_EVIDENCE:'Some content could not be classified. Playback is held.',EMPTY_RESPONSE:'Google returned no usable answer. See API diagnostics for refusal or finish reason.',NO_MODEL_FOUND:'The returned model list has no suitable generateContent model. See API diagnostics.',INVALID_MODEL_ID:'Enter only a model ID or models/ID, not a URL.',INVALID_TEST_RESPONSE:'The model did not return valid image-test JSON. See API diagnostics.',INVALID_MODEL_LIST:'Google returned an unexpected model-list format.',MODEL_LIST_PAGINATION:'Model listing exceeded the pagination limit.',NETWORK_ERROR:'No readable Google response. Check your network and API diagnostics.',CANCELLED:'Request cancelled after a session or settings change.',INVALID_JSON:'The endpoint returned non-JSON content. See API diagnostics.',ANALYSIS_FAILED:'Analysis failed. Check API diagnostics and retry.'})[code]||`${code}. See API diagnostics.`;}
