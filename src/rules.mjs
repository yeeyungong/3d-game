import {validPuzzle} from './puzzles.mjs';
export const rooms={hub:{name:'中央大厅',adj:['power','lab','storage','comms']},power:{name:'供电区',adj:['hub','lab','storage']},lab:{name:'实验室',adj:['hub','power','comms']},storage:{name:'仓储区',adj:['hub','power','comms']},comms:{name:'通讯区',adj:['hub','lab','storage']}};
export const tasks={
 'power-calibration':{name:'校准供电设备',room:'power',duration:12000,reward:15,cooldown:60000},
 'lab-calibration':{name:'校准样本仪器',room:'lab',duration:12000,reward:15,cooldown:60000},
 'storage-cache':{name:'搜索能量箱',room:'storage',duration:3000,reward:5,cooldown:90000},
 'comms-cache':{name:'回收备用能量',room:'comms',duration:3000,reward:5,cooldown:90000}
};
export const secrets=[{name:'植入污染装置',room:'power',duration:8000},{name:'盗取侵蚀样本',room:'lab',duration:6000},{name:'上传污染程序',room:'comms',duration:10000}];
export function createGame({originalId='p1'}={}) {
  const names=['林舟','许岚','陈默','苏禾','沈遥','陆川','白露','江屿'];
  return {now:0,phase:'explore',winner:null,energy:0,
    players:names.map((name,i)=>({id:`p${i+1}`,name,role:`p${i+1}`===originalId?'original':'good',alive:true,hp:100,room:'hub'})),
    corruption:{used:0,steps:0,readyAt:15000,channel:null},
    channels:{},taskReadyAt:{},attackReadyAt:{},meeting:null,meetingChannel:null,
    protectionUntil:15000,log:[]};
}
export function outcome(players) {
  const live=players.filter(p=>p.alive);
  if (!live.some(p=>p.role!=='good')) return 'good';
  return live.filter(p=>p.role==='good').length<=2?'traitor':null;
}
function log(s,text,audience='public'){s.log.push({at:s.now,text,audience});}
function cancel(s,id){
  delete s.channels[id];
  if(s.corruption.channel && [s.corruption.channel.actorId,s.corruption.channel.targetId].includes(id)){
    s.corruption.channel=null;s.corruption.readyAt=s.now+10000;
  }
  if(s.meetingChannel?.actorId===id)s.meetingChannel=null;
}
function busy(s,id){return Boolean(s.channels[id]||s.corruption.channel?.actorId===id||s.meetingChannel?.actorId===id);}
function finishMeeting(s){
  const m=s.meeting,counts={};
  for(const id of m.aliveIds){const target=m.votes[id];if(target)counts[target]=(counts[target]||0)+1;}
  const eliminated=Object.keys(counts).find(id=>counts[id]>m.aliveIds.length/2);
  if(eliminated){
    const p=s.players.find(p=>p.id===eliminated);p.alive=false;p.hp=0;
    log(s,`${p.name} 被投票淘汰 · ${p.role==='good'?'好人':'内鬼'}`);
  }else log(s,'无人获得过半票数 · 继续探索');
  log(s,`投票记录：${m.aliveIds.map(id=>`${s.players.find(p=>p.id===id).name} → ${m.votes[id]?s.players.find(p=>p.id===m.votes[id]).name:Object.hasOwn(m.votes,id)?'跳过':'弃权'}`).join('；')}`);
  const paused=s.now-m.startedAt;
  for(const key of Object.keys(s.taskReadyAt))s.taskReadyAt[key]+=paused;
  for(const key of Object.keys(s.attackReadyAt))s.attackReadyAt[key]+=paused;
  s.corruption.readyAt+=paused;
  s.meeting=null;s.phase='explore';s.protectionUntil=s.now+5000;
}
function advance(s,to){
  while(s.now<to&&!s.winner){
    const deadlines=s.phase==='meeting'?[s.meeting.endsAt]:[
      ...Object.values(s.channels).map(c=>c.endsAt),s.meetingChannel?.endsAt,s.corruption.channel?.endsAt
    ].filter(Number.isFinite);
    s.now=Math.min(to,...deadlines);
    // Meetings win a simultaneous deadline; cancel all other channels first.
    if(s.meetingChannel?.endsAt<=s.now){
      const started=s.now;
      if(s.corruption.channel)s.corruption.readyAt=s.now+10000;
      s.energy=0;s.phase='meeting';s.channels={};s.corruption.channel=null;s.meetingChannel=null;
      s.meeting={aliveIds:s.players.filter(p=>p.alive).map(p=>p.id),stage:'discuss',startedAt:started,endsAt:started+60000,votes:{}};
      log(s,'会议已开始 · 消耗 100 能量');
    }
    if(s.phase==='meeting'){
      if(s.meeting.endsAt<=s.now){
        if(s.meeting.stage==='discuss'){s.meeting.stage='vote';s.meeting.endsAt+=20000;log(s,'投票开始 · 请作出选择');}
        else finishMeeting(s);
      }
    }else{
      for(const [id,c] of Object.entries(s.channels)){
        if(c.interactive&&!c.solved||c.endsAt>s.now)continue;
        if(c.kind==='secret'){
          s.corruption.steps++;
          log(s,`秘密任务完成：${secrets[c.step].name}`,id);
        }else{
          const t=tasks[c.taskId];s.energy=Math.min(100,s.energy+t.reward);
          s.taskReadyAt[c.taskId]=s.now+t.cooldown;
          log(s,`${s.players.find(p=>p.id===id).name} 完成${t.name} · +${t.reward} 能量`);
        }
        delete s.channels[id];
      }
      const c=s.corruption.channel;
      if(c&&c.endsAt<=s.now){
        const target=s.players.find(p=>p.id===c.targetId);
        target.role='converted';s.corruption.used++;
        s.corruption.readyAt=s.now+45000;s.corruption.channel=null;
        log(s,`${target.name} 已被转换`,c.actorId);
        log(s,'你已被侵蚀。协助内鬼，让存活好人减少至两人。',target.id);
      }
    }
    s.winner=outcome(s.players);
    if(s.winner)s.phase='ended';
  }
}
export function reduce(state,action) {
  if(state.winner)return state;
  const actor=state.players.find(p=>p.id===action.actorId);
  const s=structuredClone(state);
  if(action.type==='TICK'){
    if(!Number.isFinite(action.now)||action.now<=state.now)return state;
    advance(s,action.now);
  }else{
    if(action.type==='VOTE'){
      if(!actor?.alive||s.phase!=='meeting'||s.meeting.stage!=='vote'||!s.meeting.aliveIds.includes(actor.id)||!(action.targetId===null||s.meeting.aliveIds.includes(action.targetId)))return state;
      s.meeting.votes[actor.id]=action.targetId;return s;
    }
    if(!actor?.alive||s.phase!=='explore')return state;
    if(action.type==='CANCEL_INTERACTION'){
      cancel(s,actor.id);
    }else if(action.type==='MOVE'){
      if(!rooms[actor.room].adj.includes(action.room))return state;
      s.players.find(p=>p.id===actor.id).room=action.room;
      cancel(s,actor.id);
    }else if(action.type==='START_TASK'){
      const t=tasks[action.taskId];
      if(!t||t.room!==actor.room||busy(s,actor.id)||(s.taskReadyAt[action.taskId]||0)>s.now||Object.values(s.channels).some(c=>c.taskId===action.taskId))return state;
      s.channels[actor.id]={kind:'task',taskId:action.taskId,startsAt:s.now,endsAt:action.interactive?null:s.now+t.duration,interactive:!!action.interactive};
    }else if(action.type==='SOLVE_PUZZLE'){
      const c=s.channels[actor.id];
      if(!c?.interactive||c.solved||!validPuzzle(c.kind==='secret'?secrets[c.step].room:tasks[c.taskId].room,action.answer))return state;
      c.solved=true;c.endsAt=s.now+300;
    }else if(action.type==='START_SECRET'){
      const t=secrets[s.corruption.steps];
      if(actor.role!=='original'||!t||t.room!==actor.room||busy(s,actor.id)||s.now<s.protectionUntil)return state;
      s.channels[actor.id]={kind:'secret',step:s.corruption.steps,startsAt:s.now,endsAt:action.interactive?null:s.now+t.duration,interactive:!!action.interactive};
    }else if(action.type==='START_CORRUPT'){
      const target=s.players.find(p=>p.id===action.targetId);
      if(actor.role!=='original'||busy(s,actor.id)||!target?.alive||target.role!=='good'||target.room!==actor.room||s.now<s.protectionUntil||s.now<s.corruption.readyAt||s.corruption.used>=1+Number(s.corruption.steps===3))return state;
      s.corruption.channel={actorId:actor.id,targetId:target.id,startsAt:s.now,endsAt:s.now+5000};
    }else if(action.type==='START_MEETING'){
      if(actor.room!=='hub'||s.energy<100||s.meetingChannel||busy(s,actor.id))return state;
      s.meetingChannel={actorId:actor.id,startsAt:s.now,endsAt:s.now+3000};
    }else if(action.type==='ATTACK'){
      const target=s.players.find(p=>p.id===action.targetId);
      if(!['original','converted'].includes(actor.role)||!target?.alive||target.id===actor.id||target.room!==actor.room||s.now<s.protectionUntil||busy(s,actor.id)||(s.attackReadyAt[actor.id]||0)>s.now)return state;
      target.hp=Math.max(0,target.hp-25);s.attackReadyAt[actor.id]=s.now+800;
      cancel(s,target.id);
      log(s,`你受到攻击 · 剩余 ${target.hp} 生命`,target.id);
      if(target.hp===0){target.alive=false;log(s,`${target.name} 已死亡 · 身份未知`);}
    }else return state;
  }
  s.winner=outcome(s.players);
  if(s.winner)s.phase='ended';
  return s;
}
