(()=>{
 if(globalThis.__thrnd8)return;globalThis.__thrnd8=true;
 let armed=false,v=null,phase='off',epoch=0,anchor=0,muted=false,cover=null,label=null,source='',wantPlay=false,lastStatus='',busy=false;
 const decisions=new Map();
 const rpc=async m=>{const r=await chrome.runtime.sendMessage({target:'worker',...m});if(!r?.ok)throw Error(r?.error||'Thrnd connection lost');return r.value;};
 function identity(){return location.hostname.endsWith('youtube.com')?(new URL(location.href).searchParams.get('v')||location.pathname)+'|'+v?.currentSrc:v?.currentSrc;}
 function status(s){if(s===lastStatus)return;lastStatus=s;rpc({op:'status',status:s}).catch(()=>{});if(label)label.textContent='Thrnd · '+s;}
 function shield(message){if(!cover){cover=document.createElement('div');cover.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;background:#101b19!important;color:#eef5ef!important;display:grid!important;place-content:center!important;text-align:center!important;font:18px system-ui!important;padding:40px!important;';const shadow=cover.attachShadow({mode:'closed'});label=document.createElement('p');const stop=document.createElement('button');stop.textContent='Stop filtering · leave video paused';stop.style.cssText='padding:12px;background:#c7f69f;border:0;border-radius:8px;cursor:pointer';stop.onclick=()=>rpc({op:'stopSelf'}).then(()=>stopSession()).catch(e=>{label.textContent=e.message;});shadow.append(label,stop);document.documentElement.append(cover);}label.textContent='Thrnd · '+message;}
 function hide(){cover?.remove();cover=null;label=null;}
 function guard(token){if(token!==epoch||!armed||!v?.isConnected||identity()!==source)throw Error('CANCELLED');if(document.querySelector('.html5-video-player.ad-showing'))throw Error('An advertisement interrupted analysis. Retry after it finishes.');}
 async function seek(t,token){guard(token);v.pause();v.muted=true;const video=v;video.currentTime=Math.min(t,Math.max(0,video.duration-.04));const began=performance.now();await new Promise((resolve,reject)=>{const poll=()=>{try{guard(token);if(!video.seeking&&video.readyState>=2&&Math.abs(video.currentTime-t)<.15)return resolve();if(performance.now()-began>12000)throw Error('Video seeking timed out. This source cannot currently be analyzed.');setTimeout(poll,40);}catch(e){reject(e);}};poll();});guard(token);}
 function captions(a,b){for(const track of Array.from(v.textTracks||[])){const cues=Array.from(track.cues||[]);if(['subtitles','captions'].includes(track.kind)&&cues.length&&Math.max(...cues.map(c=>c.endTime))>=v.duration-5)return cues.filter(c=>c.startTime<b&&c.endTime>a).map(c=>c.text).join(' ');}return null;}
 async function analyzeWindow(){
  if(busy||!armed||!v||phase==='error'||document.hidden)return;
  busy=true;const token=++epoch;phase='scan';anchor=v.currentTime;if(!cover)muted=v.muted;wantPlay=true;shield('Preparing upcoming video…');v.pause();v.muted=true;
  try{
   if(document.pictureInPictureElement)await document.exitPictureInPicture();if(document.fullscreenElement)await document.exitFullscreen();guard(token);
   if(v.mediaKeys)throw Error('Protected video is unsupported. Filtering is not active.');
   if(!Number.isFinite(v.duration)||v.duration<=0||!v.seekable.length)throw Error('A finite, seekable video is required. Live streams are unsupported.');
   const canvas=document.createElement('canvas');canvas.width=384;canvas.height=Math.max(1,Math.round(384*(v.videoHeight||9)/(v.videoWidth||16)));const ctx=canvas.getContext('2d');
   const first=Math.floor(anchor/2)*2,end=Math.min(v.duration,first+30);
   for(let start=first;start<end;){
    const batch=[];
    while(batch.length<3&&start<end){
     if(decisions.has(start)){start+=2;continue;}
     const item={start_time:start,end_time:Math.min(start+2,v.duration),captions:captions(start,start+2),frames:[]};
     for(const offset of [.25,.75,1.25,1.75]){const t=Math.min(start+offset,v.duration-.04);await seek(t,token);ctx.drawImage(v,0,0,canvas.width,canvas.height);let data;try{data=canvas.toDataURL('image/jpeg',.65).split(',')[1];}catch{throw Error('This website blocks frame extraction. Filtering is not active.');}item.frames.push({time:t,data});}
     batch.push(item);start+=2;
    }
    if(batch.length){status('Analyzing · '+Math.min(30,start-first)+' / 30 source seconds');const rows=await rpc({op:'analyze',batch});guard(token);for(const r of rows)decisions.set(r.start_time,r);}
   }
   phase='restore';let safe=anchor;while(safe<v.duration&&decisions.get(Math.floor(safe/2)*2)?.decision==='skip')safe=decisions.get(Math.floor(safe/2)*2).end_time;await seek(Math.min(safe,v.duration-.04),token);guard(token);anchor=v.currentTime;phase='ready';busy=false;if(safe>=v.duration-.04){v.muted=muted;hide();status('Active · end of video');return;}if(!decisions.has(Math.floor(safe/2)*2)){analyzeWindow();return;}v.muted=muted;hide();status('Active · classified section');if(wantPlay)await v.play();
  }catch(e){if(token!==epoch)return;phase='restore';try{if(identity()===source)await seek(anchor,token);}catch{}if(token!==epoch)return;phase='error';v?.pause();shield(e.message);status('Error · '+e.message);}
  finally{if(token===epoch)busy=false;}
 }
 async function skip(end){if(busy)return;busy=true;phase='skip';const token=++epoch;const wasPlaying=!v.paused;const oldMute=v.muted;shield('Skipping matched content…');try{await seek(Math.min(end,v.duration-.04),token);guard(token);phase='ready';v.muted=oldMute;hide();status('Active · skipped matched content');busy=false;if(end>=v.duration-.05){v.pause();status('Active · end of video');return;}tick();if(phase==='ready'&&wasPlaying)await v.play();}catch(e){if(token===epoch){phase='error';status('Error · '+e.message);shield(e.message);}}finally{if(token===epoch)busy=false;}}
 function tick(){
  if(!armed||!v)return;
  if(identity()!==source){epoch++;busy=false;decisions.clear();phase='armed';source=identity();v.pause();v.muted=muted;hide();status('Armed · new video');return;}
  if(document.hidden){if(phase==='ready'&&!v.paused){v.pause();status('Armed · paused in background');}return;}
  if(phase!=='ready'||busy||v.paused)return;
  const t=v.currentTime,key=Math.floor(t/2)*2,r=decisions.get(key);
  if(!r){analyzeWindow();return;}
  if(r.decision==='skip'){let end=r.end_time;while(decisions.get(end)?.decision==='skip')end=decisions.get(end).end_time;skip(end);return;}
  const next=decisions.get(key+2),guardSeconds=Math.min(.5,.15*Math.max(1,v.playbackRate));
  if(t>=key+2-guardSeconds&&key+2<v.duration){if(!next)analyzeWindow();else if(next.decision==='skip'){let end=next.end_time;while(decisions.get(end)?.decision==='skip')end=decisions.get(end).end_time;skip(end);}}
  for(const k of decisions.keys())if(k<t-60)decisions.delete(k);
 }
 function bind(video){if(v===video)return;epoch++;busy=false;decisions.clear();v=video;source=identity();phase='armed';
  v.addEventListener('play',()=>{if(!armed||v!==video)return;if(['scan','restore','skip','error'].includes(phase)){v.pause();return;}if(phase==='armed')analyzeWindow();else tick();},true);
  v.addEventListener('seeking',()=>{if(armed&&v===video&&phase==='ready'&&!busy){shield('Checking seek position…');v.pause();phase='armed';setTimeout(()=>analyzeWindow(),100);}},true);
  if(!v.paused)analyzeWindow();
 }
 async function stopSession(){const wasCovered=!!cover;armed=false;const token=++epoch;busy=false;phase='off';if(v){v.pause();if(wasCovered&&Number.isFinite(anchor)&&identity()===source){try{v.currentTime=anchor;const began=performance.now();await new Promise(resolve=>{const poll=()=>{if(!v.seeking||performance.now()-began>12000||token!==epoch)return resolve();setTimeout(poll,40);};poll();});}catch{}}if(token!==epoch)return;if(wasCovered)v.muted=muted;}hide();}
 function start(){const retry=!!cover;epoch++;busy=false;decisions.clear();armed=true;phase='armed';status('Armed · play to analyze');const video=document.querySelector('video');if(video){if(!retry)muted=video.muted;if(v===video){if(!v.paused||retry)analyzeWindow();}else bind(video);}}
 chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.op==='start'){start();reply({ok:true});}if(m.op==='stop'){stopSession();reply({ok:true});}});
 setInterval(()=>{if(!armed)return;const videos=Array.from(document.querySelectorAll('video'));const video=videos.find(x=>x===v&&x.isConnected)||videos.sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0];if(video&&video!==v)bind(video);tick();},40);
 rpc({op:'state'}).then(s=>{if(s.armed)start();}).catch(()=>{});
})();
