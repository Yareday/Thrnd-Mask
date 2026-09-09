import test from 'node:test';
import assert from 'node:assert/strict';
import {expandGroups,validatePlan,GROUPS} from '../extension/rules.js';
import {buildPrompt} from '../extension/categories.js';
import {decide,horizon} from '../extension/core.js';
const rule={id:'custom_spiders',title:'Spiders',condition:'A visible live spider; exclude drawings and toys.',evidence:'visual',enabled:true};
test('Violence switch activates the entire violent group and related harm',()=>{
 const t=expandGroups({violence:true,sexual:false,language:false});for(const id of GROUPS.violence)assert.equal(t[id],true);assert.equal(t.physical_assault,true);assert.equal(t.knockdowns,true);assert.equal(t.nudity,false);assert.equal(t.strong_language,false);
});
test('sexual and language switches expand their complete groups',()=>{const t=expandGroups({violence:false,sexual:true,language:true});for(const id of [...GROUPS.sexual,...GROUPS.language])assert(t[id]);assert.equal(t.physical_assault,false);});
test('a new category compiles into the actual video prompt and skip decision',()=>{
 const plan=validatePlan({action:'apply',message:'Filter spiders.',groups:{violence:false,sexual:false,language:false},rules:[rule]});
 const prompt=buildPrompt({custom_spiders:true},plan.rules);assert(prompt.includes(rule.condition));assert(prompt.includes('custom_spiders'));
 const e=horizon(60,200,0)[0],r=decide(e,{custom_spiders:.9},{custom_spiders:true},20000);
 assert.equal(r.decision,'skip');assert.equal(r.category,'custom_spiders');
 assert.equal(decide(e,{}, {custom_spiders:true},20000).status,'unknown');
});
test('invalid plans cannot apply executable or unbounded configurations',()=>{
 const plan={action:'apply',message:'OK',groups:{violence:true,sexual:false,language:false},rules:[rule]};
 for(const bad of [{...plan,rules:[{...rule,id:'__proto__'}]},{...plan,rules:[rule,rule]},{...plan,rules:[{...rule,evidence:'audio'}]},{...plan,rules:Array(9).fill(rule)},{...plan,groups:{violence:'false'}}])assert.throws(()=>validatePlan(bad),/INVALID_CHAT_PLAN/);
});
test('clarification cannot change configuration and disabled custom rules cannot skip',()=>{
 assert.deepEqual(validatePlan({action:'clarify',message:'Should I replace the broad filter?',rules:[rule]}),{action:'clarify',message:'Should I replace the broad filter?'});
 assert(!buildPrompt({},[{...rule,enabled:false}]).includes('custom_spiders'));
 assert.equal(decide(horizon(0,200,0)[0],{custom_spiders:1},{custom_spiders:false},2).decision,'keep');
});
