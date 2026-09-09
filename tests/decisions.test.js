import test from 'node:test';
import assert from 'node:assert/strict';
import {collectRows,segmentSchema} from '../extension/decisions.js';
const batch=[{start_time:0},{start_time:2},{start_time:4}];
test('partial reply preserves valid rows instead of discarding entire batch',()=>{const rows=collectRows(JSON.stringify({segments:[{start_time:0,scores:{violence:0}},{start_time:4,scores:{violence:1}}]}),batch);assert.equal(rows.size,2);assert(!rows.has(2));assert.equal(rows.get(4).scores.violence,1);});
test('duplicates are rejected only for ambiguous timestamp; unexpected times ignored',()=>{const rows=collectRows(JSON.stringify({segments:[{start_time:0},{start_time:0},{start_time:2},{start_time:999}]}),batch);assert.equal(rows.size,1);assert(rows.has(2));});
test('schema requires all selected and custom scores, allowing explicit uncertainty',()=>{const schema=segmentSchema(['violence','custom_spiders'],3);assert.equal(schema.properties.segments.minItems,3);assert.deepEqual(schema.properties.segments.items.properties.scores.required,['violence','custom_spiders']);assert.deepEqual(schema.properties.segments.items.properties.scores.properties.custom_spiders.type,['number','null']);});
