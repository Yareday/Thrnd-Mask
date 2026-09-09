import test from 'node:test';
import assert from 'node:assert/strict';
import {request,testConnection,redact,rankModels} from '../extension/api.js';
const image=()=>{globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}}),toDataURL:()=> 'data:image/png;base64,YQ=='})};};
const model=name=>({name:'models/'+name,supportedGenerationMethods:['generateContent']});
const good=()=>({ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'{"color":"green"}'}]}}]})});
test('auto mode retries a listed model after 404; logs exact stage and redacts secrets',async()=>{
 image();const entries=[],calls=[],key='AIzaEXAMPLE_PRIVATE_VALUE';
 globalThis.fetch=async(url,opts)=>{calls.push(url);
  if(!opts.body)return {ok:true,status:200,json:async()=>({models:[model('gemini-9-flash'),model('gemini-8-flash')]})};
  if(url.includes('gemini-9'))return {ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND',message:`Model gone. key=${key}`}})};
  return good();
 };
 assert.equal(await testConnection(key,'',undefined,d=>entries.push(d)),'gemini-8-flash');assert.equal(calls.length,3);
 const fail=entries.find(d=>d.state==='failed');assert.equal(fail.stage,'Test image and JSON response');assert.equal(fail.model,'gemini-9-flash');assert.equal(fail.http_status,404);assert.equal(fail.provider_status,'NOT_FOUND');assert(fail.provider_message.includes('[REDACTED]'));assert(!JSON.stringify(entries).includes(key));
});
test('listing 404 is identified as listing and never mislabeled a selected model',async()=>{
 image();const entries=[];globalThis.fetch=async()=>({ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND',message:'List endpoint unavailable'}})});
 await assert.rejects(testConnection('fake','',undefined,d=>entries.push(d)),/API_HTTP_404/);
 const d=entries.at(-1);assert.equal(d.stage,'List available models');assert.equal(d.model,null);assert.equal(d.provider_message,'List endpoint unavailable');assert(!d.endpoint.includes('?'));
});
test('quota and authentication errors stop fallback',async()=>{
 image();for(const code of [401,403,429]){let calls=0;
 globalThis.fetch=async(url,opts)=>{calls++;return !opts.body?{ok:true,status:200,json:async()=>({models:[model('gemini-9-flash'),model('gemini-8-flash')]})}:{ok:false,status:code,json:async()=>({error:{message:'Unavailable'}})};};
 await assert.rejects(testConnection('fake',''),new RegExp('API_HTTP_'+code));assert.equal(calls,2);}
});
test('manual models/ prefix normalized without silently changing model',async()=>{
 image();let calls=0;globalThis.fetch=async url=>{calls++;assert(url.includes('/models/gemini-manual:generateContent'));return good();};assert.equal(await testConnection('fake','models/gemini-manual'),'gemini-manual');assert.equal(calls,1);
});
test('auto fallback is bounded at four tests',async()=>{
 image();let calls=0;globalThis.fetch=async(url,opts)=>{calls++;return !opts.body?{ok:true,status:200,json:async()=>({models:Array.from({length:8},(_,i)=>model('gemini-'+i+'-flash'))})}:{ok:false,status:404,json:async()=>({error:{message:'Not found'}})};};await assert.rejects(testConnection('fake',''),/API_HTTP_404/);assert.equal(calls,5);
});
test('non JSON HTTP errors and network errors produce usable diagnostics',async()=>{
 const entries=[];globalThis.fetch=async()=>({ok:false,status:502,json:async()=>{throw Error('HTML page');}});
 await assert.rejects(request('models','fake',null,undefined,d=>entries.push(d)),/API_HTTP_502/);assert.equal(entries.at(-1).http_status,502);
 globalThis.fetch=async()=>{throw Error('secret details must not escape');};await assert.rejects(request('models','fake',null,undefined,d=>entries.push(d)),/NETWORK_ERROR/);assert(!JSON.stringify(entries).includes('secret details'));
});
test('ranking favors stable flash; redaction covers encoded key and key-shaped strings',()=>{
 assert.equal(rankModels([model('gemini-10-pro'),model('gemini-9-flash-preview'),model('gemini-8-flash')])[0],'gemini-8-flash');
 assert.equal(redact('key=a%2Bb and a+b','a+b'),'key=[REDACTED] and [REDACTED]');assert(!redact('AIzaEXAMPLE_SECRET').includes('EXAMPLE'));
});
