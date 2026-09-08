export function segmentSchema(keys,count){return {type:'object',required:['segments'],properties:{segments:{type:'array',minItems:count,maxItems:count,items:{type:'object',required:['start_time','scores'],properties:{start_time:{type:'number'},scores:{type:'object',required:keys,properties:Object.fromEntries(keys.map(k=>[k,{type:['number','null'],minimum:0,maximum:1}]))}}}}}};}
export function collectRows(text,batch){
 const clean=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 let body;try{body=JSON.parse(clean);}catch{throw Error('INVALID_RESPONSE');}
 if(!Array.isArray(body.segments))throw Error('INVALID_RESPONSE');
 const allowed=new Set(batch.map(e=>e.start_time)),rows=new Map(),duplicates=new Set();
 for(const s of body.segments){if(!s||!allowed.has(s.start_time))continue;if(rows.has(s.start_time))duplicates.add(s.start_time);else rows.set(s.start_time,s);}
 for(const t of duplicates)rows.delete(t);
 return rows;
}
