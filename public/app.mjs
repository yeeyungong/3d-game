import {createOnline} from '/online.mjs';
import {createMinigames} from '/minigames.mjs';
import {createGame,reduce,rooms,tasks,secrets} from '/src/rules.mjs';
import {playerView} from '/src/views.mjs';
import {createWorld} from '/scene.mjs';

const $=id=>document.getElementById(id);
const crewColors=['#ef5968','#42cbbb','#a786ed','#ffac52','#4e9eeb','#a8d965','#ed88c2','#9ad5ee'];
const crewColor=id=>crewColors[Number(id.slice(1))-1];
function crewPortrait(id){return `<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M19 109V89Q20 70 41 69H59Q81 70 81 89V109" fill="${crewColor(id)}" stroke="#151c34" stroke-width="5"/><path d="M39 65V77Q50 87 61 77V65" fill="#dfac87" stroke="#151c34" stroke-width="4"/><ellipse cx="50" cy="44" rx="25" ry="30" fill="#f2caa3" stroke="#151c34" stroke-width="5"/><path d="M25 40Q16 8 48 10Q82 6 76 38L64 30L51 35L40 28Z" fill="#333048" stroke="#151c34" stroke-width="4"/><path d="M36 46V51M63 46V51" stroke="#151c34" stroke-width="5" stroke-linecap="round"/><path d="M43 61Q50 65 57 61" fill="none" stroke="#9a554c" stroke-width="3" stroke-linecap="round"/><path d="M30 86H69V108H30Z" fill="#263b59"/><rect x="57" y="89" width="8" height="6" rx="2" fill="#b6f3f4"/></svg>`;}
const roleNames={good:'好人',original:'原始内鬼',converted:'被转换内鬼'};
let state=createGame(),actorId='p1',started=false,paused=false,speed=1,last=performance.now(),lastRender=0,lastAnnouncement='',world=null;
let puzzleSession=null,online=null,remoteView=null;
let audioContext=null,soundEnabled=true,killTimer=null;
function unlockAudio(){
  if(!soundEnabled)return;
  try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}
}
document.addEventListener('pointerdown',unlockAudio);
document.addEventListener('keydown',unlockAudio);
$('sound-toggle').onclick=()=>{soundEnabled=!soundEnabled;$('sound-toggle').textContent=`音效：${soundEnabled?'开':'关'}`;$('sound-toggle').setAttribute('aria-label',soundEnabled?'关闭音效':'开启音效');if(soundEnabled)unlockAudio();};
function killSound(volume){
  if(!soundEnabled||audioContext?.state!=='running')return;
  const ctx=audioContext,t=ctx.currentTime,bus=ctx.createGain();bus.gain.value=volume;bus.connect(ctx.destination);
  const tone=ctx.createOscillator(),gain=ctx.createGain();tone.type='triangle';tone.frequency.setValueAtTime(180,t);tone.frequency.exponentialRampToValueAtTime(38,t+.3);gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.65,t+.015);gain.gain.exponentialRampToValueAtTime(.001,t+.4);tone.connect(gain);gain.connect(bus);tone.start(t);tone.stop(t+.42);
  const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.25),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
  const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter();noise.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(2200,t);filter.frequency.exponentialRampToValueAtTime(180,t+.25);noise.connect(filter);filter.connect(bus);noise.start(t);noise.onended=()=>{noise.disconnect();filter.disconnect();};tone.onended=()=>{tone.disconnect();gain.disconnect();bus.disconnect();};
}
function showKill(killerId,targetId){
  world?.playAttack(killerId,targetId);
  const involved=actorId===killerId||actorId===targetId;killSound(involved?.45:.12);
  if(!involved)return;
  const dialog=$('kill-cinematic');clearTimeout(killTimer);
  dialog.querySelector('.kill-cast').innerHTML=`<div class="kill-attacker">${crewPortrait(killerId)}</div><div class="kill-impact">✦</div><div class="kill-victim">${crewPortrait(targetId)}</div>`;
  dialog.querySelector('.kill-title').textContent=actorId===targetId?'你被淘汰了':'目标已淘汰';
  if(!dialog.open)dialog.showModal();
  killTimer=setTimeout(()=>dialog.close(),1400);
}
$('kill-cinematic').addEventListener('cancel',event=>event.preventDefault());
const minigames=createMinigames($('task-dialog'),{submit:(answer,puzzleId)=>dispatch({type:'SOLVE_PUZZLE',answer,puzzleId}),cancel:()=>{if(puzzleSession){if(remoteView)online.sendAction({type:'CANCEL_INTERACTION'});else state=reduce(state,{type:'CANCEL_INTERACTION',actorId:puzzleSession.actorId});}puzzleSession=null;minigames.close();render();world?.focus();}});
const seconds=n=>Math.max(0,Math.ceil(n/1000));
const time=n=>`${String(Math.floor(n/60000)).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderedMarkup=new Map();
function html(id,value){
  const el=$(id);if(renderedMarkup.get(id)===value)return;
  const focused=el.contains(document.activeElement)?document.activeElement?.dataset.key:null;
  el.innerHTML=value;
  renderedMarkup.set(id,value);
  if(focused)el.querySelector(`[data-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
}
function available(type,extra={}){if(remoteView)return online.connected&&remoteView.allowed.includes(`${type}-${extra.taskId||extra.targetId||''}`);return started&&reduce(state,{type,actorId,...extra})!==state;}
function button(label,type,extra={},className='',reason=''){
  const enabled=available(type,extra), data=esc(JSON.stringify({type,...extra}));
  return `<button data-action="${data}" data-key="${type}-${extra.targetId||extra.taskId||extra.room||''}" class="${className}" ${enabled?'':`disabled title="${esc(reason||'当前不可操作')}"`}>${label}</button>`;
}
function dispatch(action){
  if(remoteView){online.sendAction(action);return;}
  const previous=state;
  if(['START_TASK','START_SECRET'].includes(action.type))action={...action,interactive:true};
  state=reduce(state,{actorId,...action});
  if(previous===state&&action.type!=='TICK')$('announcement').textContent='当前条件不满足，请查看操作提示。';
  if(previous!==state&&['START_TASK','START_SECRET'].includes(action.type)){
    const c=state.channels[actorId],definition=c.kind==='secret'?secrets[c.step]:tasks[c.taskId];
    puzzleSession={actorId,puzzleId:c.puzzle.id};minigames.open(c.puzzle,definition.name);
  }
  if(action.type==='SOLVE_PUZZLE'&&state.channels[actorId]?.puzzle.id!==puzzleSession?.puzzleId){const c=state.channels[actorId];if(c){puzzleSession={actorId,puzzleId:c.puzzle.id};minigames.open(c.puzzle,c.kind==='secret'?secrets[c.step].name:tasks[c.taskId].name);}}
  render();
  if(previous!==state&&action.type==='ATTACK')showKill(actorId,action.targetId);
}
function reset(){
  if(remoteView){online.leave();return;}
  puzzleSession=null;minigames.close();
  state=createGame();actorId='p1';started=true;paused=false;speed=1;last=performance.now();lastAnnouncement='';
  $('speed').value='1';$('meeting-dialog').close();$('result-dialog').close();render();
  world?.reset();
  $('help').focus();
}
function actorOptions(){return state.players.map(p=>`<option value="${p.id}" ${p.id===actorId?'selected':''}>${p.id.slice(1).padStart(2,'0')} · ${p.name}${p.alive?'':'（已淘汰）'}</option>`).join('');}
function render(){
  if(puzzleSession){const channel=state.channels[puzzleSession.actorId];if(actorId!==puzzleSession.actorId||!channel||state.phase!=='explore'){minigames.close();puzzleSession=null;world?.focus();}}
  const v=remoteView||playerView(state,actorId),self=v.self,c=v.corruption;
  $('clock').textContent=time(v.now);$('energy-value').textContent=v.energy;$('energy-fill').style.width=`${v.energy}%`;
  $('alive').textContent=String(v.aliveCount).padStart(2,'0');
  $('phase-label').textContent=!started?'等待进入研究站':v.winner?'行动结束':paused?'计时暂停 · 可移动':v.phase==='meeting'?'会议进行中':'探索进行中';
  $('energy-note').textContent=v.energy===100?'能量充足 · 前往中央大厅启动投票':'做任务与探索，为下一次投票充能';
  $('map-status').textContent=v.winner?'行动结束':!started?'系统待机':v.phase==='meeting'?'会议中':paused?'计时暂停':'探索中';
  $('identity').style.setProperty('--player-color',crewColor(self.id));
  html('identity',`<div class="portrait">${crewPortrait(self.id)}<span>${self.id.slice(1).padStart(2,'0')}</span></div><h2 class="player-name">${self.name}</h2><span class="role-tag ${self.role!=='good'?'traitor':''}">${roleNames[self.role]}${self.alive?'':' / 已淘汰'}</span><p class="role-goal">${self.role==='good'?'完成任务，收集线索。<br>消灭所有存活内鬼。':'隐瞒身份，改变局势。<br>让存活好人减少至两人。'}</p><div class="health-label"><span>生命状态</span><span>${self.hp} / 100</span></div><div class="health-track"><i style="width:${self.hp}%"></i></div>`);
  html('corruption',c?`<section class="corruption-box"><h3>◈ 侵蚀协议</h3><p>整局已使用 ${c.used} / 2 次<br>当前可用 ${Math.max(0,1+Number(c.steps===3)-c.used)} 次${c.readyAt>v.now?` · 冷却 ${seconds(c.readyAt-v.now)}s`:''}</p>${secrets.map((t,i)=>`<div class="secret-step ${i<c.steps?'complete':i===c.steps?'active':''}"><span>${i<c.steps?'✓':`0${i+1}`}</span>${t.name}</div>`).join('')}<p>${c.steps===3?'第二次转换已解锁':'完成三项秘密任务，解锁第二次转换。'}</p></section>`:'');
  $('location-title').textContent=rooms[self.room].name;
  const targetId=world?.combatTarget(),target=v.players.find(p=>p.id===targetId);
  html('pilot-status',`<b>${self.name}</b> · ${roleNames[self.role]} · HP ${self.hp}<span>${rooms[self.room].name}</span>${c?`<small>转换 ${c.used} / 2 · 秘密任务 ${c.steps} / 3</small>`:''}`);
  html('combat-hud',self.role==='good'?'<span>完成任务 · 收集能量 · 投票找出内鬼</span>':`<span>${target?'目标：'+target.name:'靠近玩家以选取目标'}</span><div>${self.role==='original'?`<button data-combat="J" ${c&&target&&available('START_CORRUPT',{targetId})?'':'disabled'}><kbd>J</kbd> 转换</button>`:''}<button data-combat="K" ${target&&available('ATTACK',{targetId})?'':'disabled'}><kbd>K</kbd> ${v.attackReadyAt>v.now?`冷却 ${seconds(v.attackReadyAt-v.now)}s`:'击杀'}</button></div>`);
  let actions='';
  if(v.channel&&!v.channel.interactive){
    const names={secret:'秘密任务进行中',task:'正在收集能量',corrupt:'正在转换目标',meeting:'正在启动会议'};
    const progress=Math.min(100,(v.now-v.channel.startsAt)/(v.channel.endsAt-v.channel.startsAt)*100);
    actions+=`<div class="channel-box">${names[v.channel.kind]} · ${seconds(v.channel.endsAt-v.now)}s<div class="progress"><i style="width:${progress}%"></i></div><p>移动或受到伤害将中断操作。</p></div>`;
  }
  if(!self.alive)actions+='<p class="empty">你已被淘汰，等待本局结束。</p>';
  else if(v.phase==='explore'){
    if(v.protectionUntil>v.now)actions+=`<div class="protection">◈ 安全保护 · ${seconds(v.protectionUntil-v.now)} 秒<br>期间不能攻击或转换。</div>`;
    if(self.room==='hub')actions+=`<div class="operation"><p>消耗 100 能量，召集所有存活玩家讨论并投票。</p>${button('启动会议 <span>→</span>','START_MEETING',{},'primary','需要100能量，且不能同时进行其他操作')}<p class="hint">${v.energy<100?`还需要 ${100-v.energy} 点能量`:'终端就绪 · 引导 3 秒'}</p></div>`;
    for(const [id,t] of Object.entries(tasks).filter(([,t])=>t.room===self.room)){
      const remaining=seconds((v.taskReadyAt[id]||0)-v.now);
      actions+=`<div class="operation"><p>${t.name} · 随机任务</p><p class="task-level">${['入门','进阶','挑战'][(v.taskProgress?.level||1)-1]} · 本局已完成 ${v.taskProgress?.completed||0} 项</p>${button(`${t.name} <span>+${t.reward} ϟ</span>`,'START_TASK',{taskId:id},'primary','终端冷却、被占用或正在操作')}<p class="hint">${remaining?`终端恢复中 · ${remaining}s`:v.energy===100?'能量已满，溢出奖励不会保留':'完成后能量自动加入公共池'}</p></div>`;
    }
    if(c&&secrets[c.steps]?.room===self.room)actions+=`<div class="operation"><p class="violet">秘密任务 / 仅你可见</p>${button(secrets[c.steps].name,'START_SECRET',{},'violet','保护期间或当前已有操作')}<p class="hint">完成面板操作以推进秘密任务</p></div>`;

  }
  html('actions',actions);
  const events=[...v.log].reverse().slice(0,14);
  html('events',events.length?events.map(e=>`<div class="event"><time>${time(e.at)}</time><span>${esc(e.text)}</span></div>`).join(''):'<p class="empty">研究站等待唤醒。每个选择，都会留下记录。</p>');
  const newest=events[0]?.text;
  if(newest&&newest!==lastAnnouncement){$('announcement').textContent=newest;lastAnnouncement=newest;}
  html('actor',actorOptions());$('pause').textContent=paused?'继续计时':'暂停计时';
  renderMeeting(v);renderResult(v);
}
function renderMeeting(v){
  const dialog=$('meeting-dialog');
  if(!v.meeting||v.winner){if(dialog.open)dialog.close();return;}
  const m=v.meeting,canVote=m.stage==='vote'&&v.self.alive;
  const targets=v.players.filter(p=>m.aliveIds.includes(p.id));
  html('meeting-content',`<div class="meeting-heading"><p class="eyebrow">紧急会议 / EMERGENCY</p><span class="countdown">${seconds(m.endsAt-v.now)}<small>s</small></span></div><h2>${m.stage==='discuss'?'现在，谁值得信任？':'作出你的选择。'}</h2><p class="meeting-copy">${m.stage==='discuss'?'讨论阶段 · 请与朋友使用语音聊天讨论。':`需要至少 ${Math.floor(m.aliveIds.length/2)+1} 票才能淘汰一人。结束前可修改选择。`}<br>当前控制：${v.self.name}${v.self.alive?'':'（已淘汰）'} · ${paused?'计时暂停':`${speed}× 时间`}</p><div class="meeting-grid">${targets.map(p=>`<button ${canVote?'':'disabled'} data-action="${esc(JSON.stringify({type:'VOTE',targetId:p.id}))}" data-key="vote-${p.id}" class="${m.ownVote===p.id?'chosen':''}"><span class="crew-avatar" style="--player-color:${crewColor(p.id)}">${crewPortrait(p.id)}</span>${p.name}${m.ownVote===p.id?' ✓':''}</button>`).join('')}<button ${canVote?'':'disabled'} data-key="vote-skip" data-action="${esc(JSON.stringify({type:'VOTE',targetId:null}))}" class="${m.hasVoted&&m.ownVote===null?'chosen':''}">跳过投票${m.hasVoted&&m.ownVote===null?' ✓':''}</button></div><p class="meeting-copy">${m.hasVoted?'你的选择已记录，其他玩家看不到。':'尚未投票。未选择将计为弃权。'}</p><div class="meeting-controls"><label for="meeting-actor">模拟玩家</label><select id="meeting-actor" data-key="meeting-actor">${actorOptions()}</select><button data-command="step">推进 15 秒</button><button data-command="pause">${paused?'继续计时':'暂停计时'}</button></div>`);
  if(!dialog.open)dialog.showModal();
}
function renderResult(v){
  const dialog=$('result-dialog');if(!v.winner){if(dialog.open)dialog.close();return;}
  html('result-content',`<p class="eyebrow">行动结束 / GAME OVER</p><h2>${v.winner==='good'?'好人获胜。':'研究站已被侵蚀。'}</h2><p class="meeting-copy">${v.winner==='good'?'所有存活内鬼已被消灭。':'存活好人已减少至两人或更少。'}<br>本局用时 ${time(v.now)} · 成功转换 ${remoteView?v.reveal.filter(p=>p.role==='converted').length:state.corruption.used} 人</p><div class="result-roster">${v.reveal.map(p=>`<div><span>${p.name}${p.alive?'':' †'}</span><span class="${p.role==='good'?'':'violet'}">${roleNames[p.role]}</span></div>`).join('')}</div><details><summary>查看身份与行动时间线</summary><div class="result-timeline">${v.timeline.map(e=>`<div class="event"><time>${time(e.at)}</time><span>${esc(e.text)}</span></div>`).join('')}</div></details><p class="meeting-copy">3D 本地原型 · 战斗距离仍按区域简化。</p><button id="result-restart" data-command="restart" class="primary large">再玩一局 <span>↻</span></button>`);
  if(!dialog.open){dialog.showModal();$('result-restart').focus();}
}
function combatAction(key){
  if(!started||state.phase!=='explore'||document.querySelector('dialog[open]'))return;
  const self=state.players.find(p=>p.id===actorId);
  if(!self?.alive||self.role==='good'||key==='J'&&self.role!=='original')return;
  const targetId=world?.combatTarget();
  if(!targetId){$('announcement').textContent='靠近目标，保持视线畅通后再操作。';return;}
  dispatch({type:key==='J'?'START_CORRUPT':'ATTACK',targetId});world?.focus();
}
document.addEventListener('keydown',event=>{
  if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  if(event.code==='KeyJ'||event.code==='KeyK'){event.preventDefault();combatAction(event.code==='KeyJ'?'J':'K');}
});
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]');
  const combat=event.target.closest('[data-combat]');if(combat&&!combat.disabled)combatAction(combat.dataset.combat);
  if(action&&!action.disabled)dispatch(JSON.parse(action.dataset.action));
  const cmd=event.target.closest('[data-command]')?.dataset.command;
  if(cmd==='step'&&started)dispatch({type:'TICK',now:state.now+15000});
  if(cmd==='pause'){paused=!paused;render();}
  if(cmd==='restart')reset();
});
document.addEventListener('change',event=>{
  if(['actor','meeting-actor'].includes(event.target.id)){actorId=event.target.value;lastAnnouncement='';render();}
});
$('speed').addEventListener('change',e=>{speed=Number(e.target.value);});
$('pause').addEventListener('click',()=>{paused=!paused;render();});
$('step').addEventListener('click',()=>{if(started)dispatch({type:'TICK',now:state.now+15000});});
$('restart').addEventListener('click',reset);
$('help').addEventListener('click',()=>{paused=true;$('welcome').showModal();$('start').innerHTML='返回研究站 <span>→</span>';render();});
function closeWelcome(){if(!started)started=true;paused=false;last=performance.now();$('welcome').close();render();world?.focus();}
$('start').addEventListener('click',closeWelcome);$('close-help').addEventListener('click',closeWelcome);
$('welcome').addEventListener('cancel',e=>{e.preventDefault();closeWelcome();});
for(const id of ['meeting-dialog','result-dialog'])$(id).addEventListener('cancel',e=>e.preventDefault());
function frame(now){
  const delta=Math.min(250,now-last);last=now;
  if(!remoteView&&started&&!paused&&!state.winner&&!document.hidden&&!$('welcome').open){state=reduce(state,{type:'TICK',now:state.now+delta*speed});}
  world?.update(delta/1000,now);
  if(now-lastRender>150){render();lastRender=now;}
  requestAnimationFrame(frame);
}
try{
  world=createWorld($('world'),{getState:()=>state,getActor:()=>actorId,onInput:(input,sprint)=>online?.input(input,sprint),
    canMove:()=>started&&(!remoteView||online?.connected)&&state.phase==='explore'&&state.players.find(p=>p.id===actorId).alive&&!document.querySelector('dialog[open]')&&!document.hidden,
    onRoomChange:room=>{if(remoteView)return;state=reduce(state,{type:'MOVE',actorId,room});render();},
    onWalk:()=>{if(remoteView)return;if(state.channels[actorId]||state.corruption.channel?.actorId===actorId||state.corruption.channel?.targetId===actorId||state.meetingChannel?.actorId===actorId)state=reduce(state,{type:'CANCEL_INTERACTION',actorId});}
  });
}catch(error){$('world-error').hidden=false;$('world-error').textContent='3D 场景无法启动，请使用支持 WebGL 的浏览器。';console.error(error);}
$('leave-online').onclick=()=>online?.leave();
render();
online=createOnline({
 onCombat:message=>showKill(message.actorId,message.targetId),
 onLocal:()=>{if(remoteView){remoteView=null;document.body.classList.remove('online-game');reset();}$('connection-status').textContent='单人练习';$('welcome').showModal();},
 onStatus:text=>{$('connection-status').textContent=text;},
 onState:message=>{
  remoteView=message.view;actorId=message.actorId;started=true;paused=false;document.body.classList.add('online-game');
  const v=remoteView;
  state={network:true,now:v.now,phase:v.phase,winner:v.winner,players:v.players.map(p=>({...p,role:p.id===actorId?v.self.role:'unknown',hp:p.id===actorId?v.self.hp:100,position:v.positions[p.id]})),channels:{},corruption:v.corruption||{used:0,channel:null},meetingChannel:null};
  if(v.channel&&['task','secret'].includes(v.channel.kind))state.channels[actorId]=v.channel;
  if(v.channel?.interactive&&v.channel.puzzle.id!==puzzleSession?.puzzleId){const c=v.channel,def=c.kind==='secret'?secrets[c.step]:tasks[c.taskId];puzzleSession={actorId,puzzleId:c.puzzle.id};minigames.open(c.puzzle,def.name);}
  render();
 }
});requestAnimationFrame(frame);
