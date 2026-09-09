import test from 'node:test';
import assert from 'node:assert/strict';
import {FILTERS,buildPrompt,thresholdFor} from '../extension/categories.js';
import {decide,horizon,CONTRACT} from '../extension/core.js';
test('27 distinct categories include punch and knockdown definitions',()=>{
 assert.equal(FILTERS.length,27);assert.equal(new Set(FILTERS.map(f=>f.id)).size,27);
 const p=buildPrompt({physical_assault:true,knockdowns:true});assert(p.includes('Punches to the face'));assert(p.includes('blood is not required'));assert(p.includes('immediate knockdown/aftermath'));assert(!p.includes('Explicit strong profanity'));
});
test('knockdown score is actionable independently of broad violence score',()=>{
 const e=horizon(60,200,0)[0],scores={violence:.3,knockdowns:.86};
 const r=decide(e,scores,{violence:true,knockdowns:true},1000,'ai',thresholdFor('balanced'));
 assert.equal(r.category,'knockdowns');assert.equal(r.decision,'skip');assert.equal(r.start_time,60);assert.equal(r.end_time,62);
 assert.equal(decide(e,scores,{violence:true,knockdowns:true},1000,'ai',thresholdFor('strict')).decision,'keep');
});
test('more filtering threshold changes uncertain decision transparently',()=>{
 const e=horizon(0,200,0)[0];assert.equal(decide(e,{physical_assault:.7},{physical_assault:true},10,'ai',thresholdFor('protective')).decision,'skip');assert.equal(decide(e,{physical_assault:.7},{physical_assault:true},10,'ai',thresholdFor('balanced')).decision,'keep');
});
test('missing enabled category fails closed; disabled categories need no scores',()=>{
 const e=horizon(0,200,0)[0];assert.equal(decide(e,{violence:0},{violence:true,knockdowns:true},10).status,'unknown');assert.equal(decide(e,{violence:0},{violence:true,knockdowns:false},10).status,'classified');
});
test('sampling covers four distinct positions inside each segment',()=>{assert.deepEqual(CONTRACT.sampleOffsets,[.25,.75,1.25,1.75]);assert(CONTRACT.sampleOffsets.every(t=>t>0&&t<2));});
