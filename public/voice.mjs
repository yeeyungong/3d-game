// Small-room audio mesh. Only the lower player id offers, preventing offer glare.
export function createVoice({send,onChange=()=>{},platform={}}){
 const getMedia=platform.getUserMedia||(()=>{
  if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Object.assign(Error(),{name:'InsecureContext'});
  return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
 });
 const createPeer=platform.createPeer||(config=>new RTCPeerConnection(config));
 const createAudio=platform.createAudio||(()=>{const audio=document.createElement('audio');audio.autoplay=true;audio.hidden=true;document.body.append(audio);return audio;});
 let generation=0,stream=null,pending=false,muted=false,message='麦克风已关闭',roster={peers:[]},selfSession=null,ackTimer=null;
 const peers=new Map();
 function notify(){onChange({active:!!stream,pending,muted,message,peers:[...peers.values()].map(p=>({id:p.id,name:p.name,state:p.pc.connectionState,blocked:p.blocked}))});}
 function closePeer(id){const p=peers.get(id);if(!p)return;peers.delete(id);p.pc.onicecandidate=null;p.pc.ontrack=null;p.pc.onnegotiationneeded=null;p.pc.onconnectionstatechange=null;p.pc.close();p.audio.pause();p.audio.srcObject=null;p.audio.remove();}
 function leave(announce=true){generation++;clearTimeout(ackTimer);ackTimer=null;pending=false;for(const id of [...peers.keys()])closePeer(id);const hadStream=!!stream;stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});stream=null;selfSession=null;muted=false;message='麦克风已关闭';if(announce&&hadStream)send({type:'voice-leave'});notify();}
 async function join(){
  if(pending||stream)return;
  const epoch=++generation;pending=true;message='等待麦克风权限…';notify();
  try{
   const captured=await getMedia();
   if(epoch!==generation){captured.getTracks().forEach(t=>t.stop());return;}
   stream=captured;pending=false;muted=false;message='正在加入语音…';
   for(const t of stream.getTracks())t.onended=()=>{leave();message='麦克风已断开，请检查设备后重新加入。';notify();};
   if(send({type:'voice-join'})===false){leave(false);message='房间已断线，请连接后重试。';notify();return;}
   ackTimer=setTimeout(()=>{if(!selfSession){leave();message='加入语音超时，请重试。';notify();}},10000);ackTimer.unref?.();notify();
  }catch(error){
   if(epoch!==generation)return;
   pending=false;
   message=({NotAllowedError:'未获得麦克风权限，请在浏览器地址栏允许后重试。',NotFoundError:'没有找到麦克风，请连接设备后重试。',NotReadableError:'麦克风被占用，请关闭其他录音程序后重试。',InsecureContext:'语音需要 HTTPS 或 localhost，并使用支持麦克风的浏览器。'})[error.name]||'无法开启麦克风，请检查设备和浏览器后重试。';notify();
  }
 }
 function mute(){if(!stream)return;muted=!muted;for(const t of stream.getAudioTracks())t.enabled=!muted;send({type:'voice-mute',muted});message=muted?'麦克风已静音，仍可收听':'麦克风已开启';notify();}
 function makePeer(member){
  const pc=createPeer({iceServers:roster.iceServers||[]}),audio=createAudio();
  const p={id:member.id,name:member.name,session:member.voiceSession,pc,audio,queue:[],chain:Promise.resolve(),blocked:false};
  peers.set(p.id,p);
  const live=()=>peers.get(p.id)===p&&!!stream;
  const signal=payload=>{if(live())send({type:'voice-signal',targetId:p.id,session:selfSession,targetSession:p.session,...payload});};
  p.live=live;p.send=signal;
  pc.onicecandidate=e=>{if(e.candidate)signal({candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate});};
  pc.ontrack=e=>{if(!live())return;audio.srcObject=e.streams[0];Promise.resolve(audio.play()).catch(()=>{if(live()){p.blocked=true;message='浏览器暂停了语音播放，请点击“播放语音”。';notify();}});};
  pc.onconnectionstatechange=()=>{if(!live())return;if(pc.connectionState==='failed')message='语音连接失败，请退出后重新加入；跨网络可能需要 TURN 中继。';notify();};
  pc.onnegotiationneeded=async()=>{
   if(roster.selfId>=p.id||!live())return;
   try{await pc.setLocalDescription();signal({description:pc.localDescription});}catch{if(live()){message='语音协商失败，请退出后重新加入。';notify();}}
  };
  for(const track of stream.getTracks())pc.addTrack(track,stream);
  return p;
 }
 function update(next){
  const changed=roster.channel!==next.channel||roster.selfId!==next.selfId;roster=next;
  if(changed)for(const id of [...peers.keys()])closePeer(id);
  if(!stream)return;
  const own=next.peers.find(p=>p.id===next.selfId)?.voiceSession;
  if(!own){if(selfSession)leave(false);return;}
  if(selfSession&&selfSession!==own)for(const id of [...peers.keys()])closePeer(id);
  selfSession=own;clearTimeout(ackTimer);ackTimer=null;
  const allowed=new Map(next.peers.filter(p=>p.id!==next.selfId&&p.voiceSession).map(p=>[p.id,p]));
  for(const [id,p] of peers)if(!allowed.has(id)||allowed.get(id).voiceSession!==p.session)closePeer(id);
  try{for(const member of allowed.values())if(!peers.has(member.id))makePeer(member);}
  catch{leave();message='浏览器无法建立语音连接，请换用支持 WebRTC 的浏览器。';notify();return;}
  message=muted?'麦克风已静音，仍可收听':allowed.size?'麦克风已开启':'已加入语音，等待朋友加入';notify();
 }
 async function signal(data){
  const p=peers.get(data.from);
  if(!p||!stream||data.session!==p.session||data.targetSession!==selfSession)return;
  p.chain=p.chain.then(async()=>{
   if(!p.live())return;
   if(data.description){
    // The higher id answers; unexpected offers from it are stale or invalid.
    if(data.description.type==='offer'&&roster.selfId<p.id)return;
    await p.pc.setRemoteDescription(data.description);if(!p.live())return;
    for(const candidate of p.queue.splice(0)){await p.pc.addIceCandidate(candidate);if(!p.live())return;}
    if(data.description.type==='offer'){await p.pc.setLocalDescription();p.send({description:p.pc.localDescription});}
   }else if(data.candidate){
    if(p.pc.remoteDescription)await p.pc.addIceCandidate(data.candidate);
    else if(p.queue.length<64)p.queue.push(data.candidate);
   }
  }).catch(()=>{if(p.live()){message='语音连接出错，请退出后重新加入。';notify();}});
  return p.chain;
 }
 async function retryPlayback(){for(const p of peers.values()){try{await p.audio.play();p.blocked=false;}catch{p.blocked=true;}}notify();}
 return {join,leave,mute,update,signal,retryPlayback};
}
