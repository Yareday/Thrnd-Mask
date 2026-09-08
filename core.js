import {FILTERS} from './categories.js';
export const CONTRACT = Object.freeze({startupBuffer:30, lowWater:6, horizon:180, segment:2, batchSegments:15, extractionTimeoutMs:60000, requestTimeoutMs:90000, threshold:0.80, sampleOffsets:[.25,.75,1.25,1.75], falseSkipsPer30Minutes:1});
export const CATEGORIES = FILTERS.map(f=>f.id);
export function horizon(time, duration, now) {
  const start = Math.floor(time/2)*2;
  return Array.from({length:90}, (_,i) => ({category:'unknown', start_time:start+i*2, end_time:start+i*2+2,
    confidence:null, decision:'keep', reason_code:start+i*2>=duration?'OUTSIDE_SOURCE':'PENDING', status:'unknown', entered_at_ms:now, scores:null}));
}
export function decide(event, scores, toggles, now, source='ai',threshold=CONTRACT.threshold) {
  const active=Object.keys(toggles).filter(c=>toggles[c]&&(CATEGORIES.includes(c)||/^custom_[a-z0-9_]{1,40}$/.test(c)));
  if (!scores || active.some(c=>scores[c]!==null && (typeof scores[c]!=='number'||!Number.isFinite(scores[c])||scores[c]<0||scores[c]>1)))
    return {...event,reason_code:'INVALID_RESPONSE',status:'unknown'};
  const matches=active.filter(c=>scores[c]!==null && scores[c]>=threshold).sort((a,b)=>scores[b]-scores[a]);
  const missing=active.some(c=>scores[c]===null);
  const category=matches[0]|| (missing?'unknown':'none');
  return {...event,category,confidence:matches.length?scores[category]:null,decision:matches.length?'skip':'keep',
    reason_code:matches.length?'CATEGORY_MATCH':missing?'MISSING_EVIDENCE':'BELOW_SKIP_THRESHOLD',
    status:matches.length||!missing?'classified':'unknown', scores, source, threshold, latency_ms:now-event.entered_at_ms};
}
export function bufferAhead(records,time,duration){
  let end=Math.floor(time/2)*2;
  while(end<duration && records.get(end)?.status==='classified')end+=2;
  return Math.max(0,Math.min(end,duration)-time);
}
export function fixture(t) {
  return {...Object.fromEntries(CATEGORIES.map(c=>[c,0])),violence:t>=10&&t<14?1:0,physical_assault:t>=10&&t<12?1:0,knockdowns:t>=12&&t<14?1:0,sexual_content:t>=20&&t<24?1:0,strong_language:t>=30&&t<34?1:0};
}
export function parseVtt(text) {
  const stamp=s=>s.split(':').reduce((n,x)=>n*60+Number(x.replace(',','.')),0);
  return text.replace(/\r/g,'').split(/\n\s*\n/).flatMap(block=>{
    const lines=block.split('\n'), i=lines.findIndex(x=>x.includes('-->'));
    if(i<0)return [];
    const [a,b]=lines[i].split('-->').map(x=>x.trim().split(/\s/)[0]);
    const start=stamp(a),end=stamp(b);
    return Number.isFinite(start)&&Number.isFinite(end)&&end>start?[{start,end,text:lines.slice(i+1).join(' ').replace(/<[^>]*>/g,'')}]:[];
  });
}
