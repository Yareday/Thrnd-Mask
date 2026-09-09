import test from 'node:test';
import assert from 'node:assert/strict';
import {request,testConnection} from '../extension/api.js';
test('request allows a 60s answer, expires after 90s, and propagates cancellation',async()=>{
 let now=0;Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
 globalThis.fetch=async()=>{now+=60000;return {ok:true,json:async()=>({ok:true})};};assert.deepEqual(await request('test','fake',{}),{ok:true});
 globalThis.fetch=async()=>{now+=90001;return {ok:true,json:async()=>({})};};await assert.rejects(request('test','fake',{}),/REQUEST_TIMEOUT/);
 const ctl=new AbortController();ctl.abort();await assert.rejects(request('test','fake',{},ctl.signal),/CANCELLED/);
});
test('auto model selection uses listed models and tests image input',async()=>{
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}}),toDataURL:()=> 'data:image/png;base64,YQ=='})};
 let calls=0;globalThis.fetch=async(url,opts)=>{calls++;if(!opts.body)return {ok:true,json:async()=>({models:[{name:'models/gemini-test-flash',supportedGenerationMethods:['generateContent']}]})};assert(url.includes('gemini-test-flash'));assert(JSON.parse(opts.body).contents[0].parts[1].inlineData);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"color":"green"}'}]}}]})};};
 assert.equal(await testConnection('fake',''),'gemini-test-flash');assert.equal(calls,2);
});
