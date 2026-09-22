import {createVoice} from './voice.mjs';

export function createCommunication({send}){
 const panel=document.createElement('details');panel.id='communication-panel';
 panel.innerHTML=`<summary>通讯 · 文字 / 语音 <span class="comms-badge"></span></summary><div class="comms-body"><p class="comms-channel">加入多人房间后可聊天</p><div class="comms-messages" role="log" aria-label="聊天消息" aria-live="polite"></div><form class="comms-form"><label class="sr-only" for="chat-input">聊天消息</label><input id="chat-input" maxlength="300" placeholder="输入消息 / Type a message" autocomplete="off" disabled><button type="submit" disabled>发送</button></form><p class="comms-feedback" role="status"></p><div class="comms-voice-controls"><button type="button" class="voice-join" disabled>加入语音</button><button type="button" class="voice-mute" hidden>静音</button><button type="button" class="voice-leave" hidden>退出语音</button><button type="button" class="voice-play" hidden>播放语音</button></div><p class="voice-status" role="status">麦克风默认关闭</p><ul class="voice-members" aria-label="语音参与者"></ul><p class="comms-relay"></p></div>`;
 document.body.append(panel);
 const $=selector=>panel.querySelector(selector),input=$('input'),submit=$('[type=submit]'),log=$('.comms-messages'),feedback=$('.comms-feedback');
 let connected=false,selfId=null,channel=null,pending=null,pendingTimer=null,composing=false,unread=0,roster=[],voiceState={peers:[]};
 const voice=createVoice({send,onChange:state=>{voiceState=state;renderVoice();}});
 function renderVoice(){
  $('.voice-join').hidden=voiceState.active||voiceState.pending;$('.voice-join').disabled=!connected;
  $('.voice-leave').hidden=!(voiceState.active||voiceState.pending);$('.voice-leave').textContent=voiceState.pending?'取消申请':'退出语音';
  $('.voice-mute').hidden=!voiceState.active;$('.voice-mute').textContent=voiceState.muted?'取消静音':'静音';$('.voice-mute').setAttribute('aria-pressed',String(!!voiceState.muted));
  $('.voice-status').textContent=voiceState.message||'麦克风默认关闭';$('.voice-play').hidden=!voiceState.peers.some(p=>p.blocked);
  const list=$('.voice-members');list.replaceChildren();
  for(const p of roster.filter(p=>p.voiceSession)){
   const li=document.createElement('li'),peer=voiceState.peers.find(v=>v.id===p.id);
   const state=p.id===selfId?'你':!voiceState.active?'已加入':({connected:'已连接',failed:'连接失败',disconnected:'连接中断'})[peer?.state]||'连接中';
   li.textContent=`${p.name} · ${p.muted?'已静音 · ':''}${state}`;list.append(li);
  }
 }
 function place(){
  const open=[...document.querySelectorAll('dialog[open]')];const top=open.at(-1);
  panel.hidden=top?.id==='kill-cinematic';
  const parent=top&&top.id!=='kill-cinematic'?top:document.body;
  if(panel.parentElement!==parent)parent.append(panel);
 }
 new MutationObserver(place).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});place();
 panel.addEventListener('toggle',()=>{if(panel.open){unread=0;$('.comms-badge').textContent='';log.scrollTop=log.scrollHeight;}});
 input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||composing||e.keyCode===229))e.preventDefault();});
 function finishPending(error){clearTimeout(pendingTimer);if(!error&&input.value===pending?.text)input.value='';pending=null;submit.disabled=!connected;feedback.textContent=error||'';}
 $('form').addEventListener('submit',e=>{
  e.preventDefault();if(composing||!connected||pending||!input.value.trim())return;
  const requestId=crypto.randomUUID();pending={requestId,text:input.value};submit.disabled=true;
  if(send({type:'chat',text:input.value,requestId})===false){finishPending('连接已断开，消息未发送。');return;}
  feedback.textContent='发送中…';pendingTimer=setTimeout(()=>finishPending('未收到发送确认，请检查连接后重试。'),8000);
 });
 $('.voice-join').onclick=()=>voice.join();$('.voice-mute').onclick=()=>voice.mute();$('.voice-leave').onclick=()=>voice.leave();$('.voice-play').onclick=()=>voice.retryPlayback();
 window.addEventListener('pagehide',()=>voice.leave());
 function disconnect(){connected=false;selfId=null;channel=null;roster=[];voice.leave(false);finishPending('连接后可继续聊天。');input.disabled=true;log.replaceChildren();unread=0;$('.comms-badge').textContent='';$('.comms-channel').textContent='加入多人房间后可聊天';$('.comms-relay').textContent='';}
 return {
  joined(id){disconnect();selfId=id;connected=true;input.disabled=false;submit.disabled=false;feedback.textContent='';panel.open=true;renderVoice();},
  disconnect,
  update(data){
   if(!connected)return;
   if(channel!==data.channel){channel=data.channel;log.replaceChildren();unread=0;$('.comms-badge').textContent='';if(pending)finishPending('频道已切换，请重新发送。');input.value='';}
   roster=data.peers;
   $('.comms-channel').textContent=({all:'房间频道 · 全员交流',living:'存活频道 · 仅存活玩家',ghost:'观战频道 · 仅淘汰玩家'})[channel];
   $('.comms-relay').textContent=data.relayConfigured?'语音中继已配置':'跨网络语音若连接失败，需要房主配置 TURN 中继。';
   voice.update({...data,selfId});renderVoice();
  },
  chat(data){
   if(!connected||data.channel!==channel)return;
   if(data.actorId===selfId&&data.requestId===pending?.requestId)finishPending();
   const line=document.createElement('p'),name=document.createElement('strong'),body=document.createElement('span');
   name.textContent=`${data.name}${data.actorId===selfId?'（你）':''} `;body.textContent=data.text;line.append(name,body);log.append(line);
   while(log.children.length>80)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;
   if(!panel.open){unread++;$('.comms-badge').textContent=String(unread);}
  },
  signal:data=>voice.signal(data),
  error(data){if(data.action==='chat'&&data.requestId===pending?.requestId)finishPending(data.message);else{feedback.textContent=data.message;if(data.action==='voice-join')voice.leave(false);}}
 };
}
