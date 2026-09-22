import {createHmac,randomBytes} from 'node:crypto';

export function channelFor(room,member){
 if(!room.state||room.state.winner)return 'all';
 return room.state.players.find(p=>p.id===member.id)?.alive?'living':'ghost';
}

export function voiceIceServers(env=process.env,identity='room'){
 const urls=(value,pattern)=>String(value||'').split(',').map(s=>s.trim()).filter(s=>pattern.test(s));
 const stun=urls(env.STUN_URLS??'stun:stun.l.google.com:19302',/^stuns?:[^\s]+$/);
 const turn=urls(env.TURN_URLS,/^turns?:[^\s]+$/);
 const servers=stun.length?[{urls:stun}]:[];
 if(turn.length&&env.TURN_SHARED_SECRET){
  const username=`${Math.floor(Date.now()/1000)+43200}:${identity}`;
  servers.push({urls:turn,username,credential:createHmac('sha1',env.TURN_SHARED_SECRET).update(username).digest('base64')});
 }
 return servers;
}

export function createCommunication(send){
 function sync(room){
  // Rotate signal sessions at a channel boundary so delayed SDP cannot cross it.
  for(const member of room.members.values()){
   const channel=channelFor(room,member);
   if(member.communicationChannel&&member.communicationChannel!==channel&&member.voiceSession)member.voiceSession=randomBytes(12).toString('hex');
   member.communicationChannel=channel;
  }
  for(const member of room.members.values()){
   if(!member.ws)continue;
   const channel=channelFor(room,member);
   const peers=[...room.members.values()].filter(p=>p.ws&&channelFor(room,p)===channel).map(p=>({id:p.id,name:p.name,voiceSession:p.voiceSession||null,muted:!!p.muted}));
   const signature=JSON.stringify({channel,peers});
   if(member.communicationSignature===signature)continue;
   const delivered=send(member.ws,{type:'communication',channel,peers,iceServers:member.voiceSession?member.iceServers:[],relayConfigured:!!process.env.TURN_URLS&&!!process.env.TURN_SHARED_SECRET});
   if(delivered!==false)member.communicationSignature=signature;
  }
 }
 function handle(room,member,a){
  if(!['chat','voice-join','voice-leave','voice-mute','voice-signal'].includes(a.type))return false;
  const error=message=>send(member.ws,{type:'communication-error',action:a.type,requestId:typeof a.requestId==='string'?a.requestId.slice(0,64):null,message});
  const now=Date.now();
  if(a.type==='chat'){
   if(typeof a.text!=='string'||!a.text.trim()||a.text.length>300){error('消息不能为空，最多 300 字符。');return true;}
   if(now-(member.chatAt||0)<700){error('消息发送太频繁，请稍后重试。');return true;}
   member.chatAt=now;const channel=channelFor(room,member);
   const message={type:'chat',id:randomBytes(8).toString('hex'),actorId:member.id,name:member.name,text:a.text.trim(),channel,at:now,requestId:typeof a.requestId==='string'?a.requestId.slice(0,64):null};
   for(const p of room.members.values())if(p.ws&&channelFor(room,p)===channel)send(p.ws,message);
   return true;
  }
  if(a.type==='voice-join'){
   if(!member.voiceSession){member.voiceSession=randomBytes(12).toString('hex');member.muted=false;member.iceServers=voiceIceServers(process.env,`${room.code}-${member.id}`);}
   member.communicationSignature=null;sync(room);return true;
  }
  if(a.type==='voice-leave'){member.voiceSession=null;member.iceServers=[];sync(room);return true;}
  if(a.type==='voice-mute'){if(member.voiceSession&&typeof a.muted==='boolean'){member.muted=a.muted;sync(room);}return true;}
  const target=room.members.get(a.targetId);
  if(!member.voiceSession||a.session!==member.voiceSession||!target?.ws||target===member||!target.voiceSession||a.targetSession!==target.voiceSession||channelFor(room,target)!==channelFor(room,member)){
   error('语音对象已离线或不在当前频道，请重新加入语音。');return true;
  }
  if(now-(member.signalAt||0)>1000){member.signalAt=now;member.signalCount=0;}
  if(++member.signalCount>120){error('语音信令太频繁，请稍后重试。');return true;}
  let payload;
  if(a.description&&['offer','answer'].includes(a.description.type)&&typeof a.description.sdp==='string'&&a.description.sdp.length<=24000){
   payload={description:{type:a.description.type,sdp:a.description.sdp}};
  }else if(a.candidate&&typeof a.candidate.candidate==='string'&&a.candidate.candidate.length<=2048&&
   (a.candidate.sdpMid===null||typeof a.candidate.sdpMid==='string'&&a.candidate.sdpMid.length<=64)&&
   (a.candidate.sdpMLineIndex===null||Number.isInteger(a.candidate.sdpMLineIndex)&&a.candidate.sdpMLineIndex>=0&&a.candidate.sdpMLineIndex<16)){
   payload={candidate:{candidate:a.candidate.candidate,sdpMid:a.candidate.sdpMid,sdpMLineIndex:a.candidate.sdpMLineIndex}};
  }else{error('无效的语音信令。');return true;}
  send(target.ws,{type:'voice-signal',from:member.id,session:member.voiceSession,targetSession:target.voiceSession,...payload});return true;
 }
 return {sync,handle};
}
