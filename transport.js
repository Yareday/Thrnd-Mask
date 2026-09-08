// Deliberately avoid the large nested responseJsonSchema from v6.
// Every row and score is still validated locally before authorizing playback.
export function analysisBody(parts){return {contents:[{parts}],generationConfig:{responseMimeType:'application/json',temperature:0}};}
export function smallerBatch(size){return Math.max(1,Math.floor(size/3));}
export function requestSummary(parts,batch){return {stage:'Analysis request shape',state:'prepared',target_segments:batch.length,image_count:parts.filter(p=>p.inlineData).length,format:'JSON mode; local score validation',approximate_body_bytes:JSON.stringify(analysisBody(parts)).length};}
