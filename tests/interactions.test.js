import test from 'node:test';
import assert from 'node:assert/strict';
import {testConnection,rankModels,explain} from '../extension/api.js';
const model=name=>({name:'models/'+name,supportedGenerationMethods:['generateContent']});
function setup(){globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}}),toDataURL:()=> 'data:image/png;base64,YQ=='})};}
test('exact user error triggers auto fallback to a compatible model',async()=>{
 setup();const attempts=[];
 globalThis.fetch=async(url,opts)=>{
  if(!opts.body)return {ok:true,status:200,json:async()=>({models:[model('gemini-9-flash'),model('gemini-8-flash')]})};
  attempts.push(url);return url.includes('gemini-9')?{ok:false,status:400,json:async()=>({error:{status:'INVALID_ARGUMENT',message:'This model only supports Interactions API.'}})}:{ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'{"color":"green"}'}]}}]})};
 };
 assert.equal(await testConnection('fake',''),'gemini-8-flash');assert.equal(attempts.length,2);
});
test('manual Interactions-only model gets a specific actionable error',async()=>{
 setup();globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({error:{message:'This model only supports Interactions API.'}})});
 await assert.rejects(testConnection('fake','gemini-omni-1.1-flash'),/INTERACTIONS_ONLY/);assert(explain('INTERACTIONS_ONLY').includes('Clear Model ID'));
});
test('confirmed incompatible model is deprioritized',()=>{assert.equal(rankModels([model('gemini-omni-1.1-flash'),model('gemini-3-flash')])[0],'gemini-3-flash');});
