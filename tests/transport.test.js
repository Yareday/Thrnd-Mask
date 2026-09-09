import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisBody,smallerBatch,requestSummary} from '../extension/transport.js';
import {request} from '../extension/api.js';
test('analysis uses JSON mode without complex schema or changed frame evidence',()=>{const parts=[{text:'rules'},{inlineData:{mimeType:'image/jpeg',data:'private-image'}}];const b=analysisBody(parts);assert.deepEqual(b.generationConfig,{responseMimeType:'application/json',temperature:0});assert.equal(b.contents[0].parts,parts);assert(!JSON.stringify(requestSummary(parts,[{}])).includes('private-image'));});
test('400 compatibility reduction is bounded at one segment',()=>{assert.equal(smallerBatch(15),5);assert.equal(smallerBatch(5),1);assert.equal(smallerBatch(1),1);});
test('invalid argument diagnostics preserve field names and redact the key',async()=>{
 const entries=[],key='secret-test-value';globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({error:{status:'INVALID_ARGUMENT',message:'Request contains an invalid argument.',details:[{fieldViolations:[{field:'generation_config.response_json_schema'},{field:key}]}]}})});
 await assert.rejects(request('models/test:generateContent',key,{},undefined,d=>entries.push(d)),/API_HTTP_400/);
 assert(entries.at(-1).invalid_fields.includes('response_json_schema'));assert(!JSON.stringify(entries).includes(key));
});
