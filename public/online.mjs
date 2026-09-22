export function createOnline({onState,onStatus,onLocal,onCombat=()=>{},onJoined=()=>{},onCommunication=()=>{},onChat=()=>{},onVoiceSignal=()=>{},onCommunicationError=()=>{},onDisconnect=()=>{}}){
 const dialog=document.querySelector('#network-dialog'),status=document.querySelector('#network-status');let ws=null,session=null,connecting=false,manual=false,retry=null,lastInput=0,config=null,ready=false;
 const el=id=>document.getElementById(id),say=text=>{status.textContent=text;onStatus(text);};
 let admitted=false;
 const send=msg=>{if(ws?.readyState!==1)return false;ws.send(JSON.stringify(msg));return true;};
 function lobby(data){
  el('room-entry').hidden=true;el('room-lobby').hidden=false;el('room-code-display').textContent=data.code;
  const list=el('room-members');list.replaceChildren();
  for(const p of data.players){const li=document.createElement('li');li.textContent=`${p.name}${p.id===data.hostId?' · 房主':''} — ${p.connected?(p.ready?'已准备':'未准备'):'断线，等待重连'}`;list.append(li);}
  ready=!!data.players.find(p=>p.id===session?.actorId)?.ready;el('room-ready').textContent=ready?'取消准备':'准备';el('room-start').hidden=data.hostId!==session?.actorId;el('room-start').disabled=data.players.length<4||data.players.some(p=>!p.ready||!p.connected);
  el('room-start').textContent=`开始游戏 · ${data.players.length} 人`;
  say(data.started?'已连接 · 对局进行中':`${data.players.length} / 8 人 · ${data.players.length<4?'至少 4 人才能开始':'等待全部准备'}`);
 }
 async function connect(action){
  if(connecting)return;connecting=true;manual=false;say('正在连接房间服务器…');
  try{
   config??=await fetch('/config.json').then(r=>r.json());
   const local=['127.0.0.1','localhost'].includes(location.hostname);
   const url=config.serverUrl||(local?`ws://${location.host}/multiplayer`:'');
   if(!url)throw Error('尚未配置联机服务器。请设置 Vercel 的 PUBLIC_GAME_SERVER_URL 后重新部署。');
   if(ws){ws.onclose=null;ws.close();}
   admitted=false;ws=new WebSocket(url);const active=ws;const timeout=setTimeout(()=>{if(active.readyState!==1){active.close();say('连接超时，请检查服务器地址。');}},10000);
   ws.onopen=()=>{clearTimeout(timeout);connecting=false;send(action);};
   ws.onmessage=e=>{if(ws!==active)return;const data=JSON.parse(e.data);
    if(data.type==='joined'){session={code:data.code,token:data.token,actorId:data.actorId};admitted=true;onJoined(data.actorId);sessionStorage.setItem('shadow-room',JSON.stringify(session));el('room-leave').hidden=false;el('local-mode').hidden=true;}
    if(data.type==='communication')onCommunication(data);
    if(data.type==='chat')onChat(data);
    if(data.type==='voice-signal')onVoiceSignal(data);
    if(data.type==='communication-error')onCommunicationError(data);
    if(data.type==='lobby')lobby(data);
    if(data.type==='combat')onCombat(data);
    if(data.type==='state'){onState(data);if(dialog.open)dialog.close();say(`房间 ${session.code} · 已连接`);}
    if(data.type==='error'){say(data.message);if(action.type==='resume'){session=null;sessionStorage.removeItem('shadow-room');manual=true;ws.close();el('room-entry').hidden=false;el('room-lobby').hidden=true;el('local-mode').hidden=false;el('room-leave').hidden=false;if(!dialog.open)dialog.showModal();}else if(!dialog.open&&!session)dialog.showModal();}
   };
   ws.onclose=e=>{if(ws!==active)return;clearTimeout(timeout);connecting=false;admitted=false;onDisconnect();if(manual)return;if(e.code===4001){manual=true;session=null;sessionStorage.removeItem('shadow-room');say('此房间会话已在另一个页面打开，请刷新后重新加入。');return;}say('连接断开，正在尝试重连…');if(session){clearTimeout(retry);retry=setTimeout(()=>connect({type:'resume',...session}),1500);}else say('连接失败，请检查房间服务器是否启动。');};
   ws.onerror=()=>say('无法连接服务器，请检查部署地址与允许的网页域名。');
  }catch(e){connecting=false;say(e.message);}
 }
 function leave(){manual=true;clearTimeout(retry);onDisconnect();send({type:'leave'});ws?.close();session=null;sessionStorage.removeItem('shadow-room');location.href=location.pathname;}
 el('room-create').onclick=()=>connect({type:'create',name:el('room-name').value});
 el('room-join').onclick=()=>connect({type:'join',name:el('room-name').value,code:el('room-code').value});
 el('room-ready').onclick=()=>send({type:'ready',ready:!ready});el('room-start').onclick=()=>send({type:'start'});el('room-leave').onclick=leave;
 el('room-copy').onclick=async()=>{const url=new URL(location.href);url.search='';url.searchParams.set('room',session.code);try{await navigator.clipboard.writeText(url.href);say('邀请链接已复制，发给朋友即可。');}catch{el('invite-link').hidden=false;el('invite-link').value=url.href;el('invite-link').select();say('请复制下方邀请链接。');}};
 el('local-mode').onclick=()=>{manual=true;clearTimeout(retry);onDisconnect();ws?.close();dialog.close();onLocal();};
 dialog.addEventListener('cancel',e=>e.preventDefault());
 const code=new URLSearchParams(location.search).get('room');if(code)el('room-code').value=code;
 dialog.showModal();
 try{const saved=JSON.parse(sessionStorage.getItem('shadow-room'));if(saved&&(!code||saved.code===code.toUpperCase())){session=saved;connect({type:'resume',...saved});}}catch{}
 return {get connected(){return admitted&&ws?.readyState===1;},sendCommunication:message=>admitted&&send(message),sendAction:action=>send({type:'action',action}),input(input,sprint){if(performance.now()-lastInput<50)return;lastInput=performance.now();const len=Math.max(1,Math.hypot(input.x,input.z));send({type:'input',x:input.x/len,z:input.z/len,sprint});},leave};
}
