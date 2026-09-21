import {randomBytes,randomInt} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {createGame,reduce,tasks} from '../src/rules.mjs';
import {playerView} from '../src/views.mjs';
import {spawnPoint,movePosition,zoneAt,nearestTarget} from '../src/world.mjs';

export function attachMultiplayer(server,{origins=[],maxRooms=100}={}){
 const wss=new WebSocketServer({server,path:'/multiplayer',maxPayload:4096,verifyClient:({origin})=>!origin||origins.includes(origin)});
 const rooms=new Map(),connections=new Set();
 const send=(ws,msg)=>{if(ws.readyState===1&&ws.bufferedAmount<262144)ws.send(JSON.stringify(msg));};
 const fail=(ws,message)=>send(ws,{type:'error',message});
 function lobby(r){return {type:'lobby',code:r.code,hostId:r.hostId,players:[...r.members.values()].map(m=>({id:m.id,name:m.name,ready:m.ready,connected:!!m.ws})),started:!!r.state};}
 function broadcast(r){for(const m of r.members.values())if(m.ws)send(m.ws,lobby(r));}
 function snapshot(r,m){
  const v=playerView(r.state,m.id);v.log=v.log.slice(-30);v.positions=r.positions;v.allowed=[];
  const add=(type,extra={})=>{if(reduce(r.state,{type,actorId:m.id,...extra})!==r.state)v.allowed.push(`${type}-${extra.taskId||extra.targetId||''}`);};
  for(const id of Object.keys(tasks))add('START_TASK',{taskId:id});add('START_SECRET');add('START_MEETING');
  const target=nearestTarget(r.state.players.map(p=>({...p,position:r.positions[p.id]})),m.id);
  if(target){add('ATTACK',{targetId:target});if(v.corruption)add('START_CORRUPT',{targetId:target});}
  return {type:'state',actorId:m.id,view:v};
 }
 function detach(ws){const r=rooms.get(ws.room),m=r?.members.get(ws.actorId);if(!m||m.ws!==ws)return;m.ws=null;m.input={x:0,z:0};m.disconnectedAt=Date.now();broadcast(r);}
 wss.on('connection',ws=>{
  if(connections.size>=800){ws.close(1013);return;}ws.connectedAt=Date.now();
  connections.add(ws);ws.alive=true;ws.on('pong',()=>ws.alive=true);
  ws.on('message',data=>{try{
   const now=Date.now();if(now-(ws.rateAt||0)>1000){ws.rateAt=now;ws.count=0;}if(++ws.count>65)return fail(ws,'操作太频繁，请稍后再试。');
   const a=JSON.parse(data);if(!a||typeof a.type!=='string')return;
   if(['create','join','resume'].includes(a.type)){
    if(ws.room)return fail(ws,'已经加入房间。');
    let r;
    if(a.type==='create'){
     if(rooms.size>=maxRooms)return fail(ws,'房间已满，请稍后重试。');
     let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
     r={code,members:new Map(),hostId:'p1',state:null,positions:{},last:now,createdAt:now};rooms.set(code,r);
    }else r=rooms.get(String(a.code||'').trim().toUpperCase());
    if(!r)return fail(ws,'房间不存在或已结束，请重新创建房间。');
    let m;
    if(a.type==='resume'){
     m=[...r.members.values()].find(m=>m.token===a.token);if(!m)return fail(ws,'重新连接失败，请重新加入房间。');
     if(m.ws){m.ws.close(4001,'Session replaced');}m.ws=ws;
    }else{
     if(r.state)return fail(ws,'游戏已经开始，只允许原玩家重新连接。');
     if(r.members.size>=8)return fail(ws,'房间已满（8 人）。');
     const name=String(a.name||'').trim();if(!/^[\p{L}\p{N}_ -]{1,12}$/u.test(name)){if(!r.members.size)rooms.delete(r.code);return fail(ws,'昵称需为 1–12 个中文、字母、数字或空格。');}
     const id=Array.from({length:8},(_,i)=>`p${i+1}`).find(id=>!r.members.has(id));
     m={id,name,token:randomBytes(24).toString('hex'),ready:false,ws,input:{x:0,z:0},lastInput:now};r.members.set(id,m);
    }
    ws.room=r.code;ws.actorId=m.id;send(ws,{type:'joined',code:r.code,actorId:m.id,token:m.token});broadcast(r);if(r.state)send(ws,snapshot(r,m));return;
   }
   const r=rooms.get(ws.room),m=r?.members.get(ws.actorId);if(!r||m?.ws!==ws)return fail(ws,'请先加入房间。');
   if(a.type==='leave'){r.members.delete(m.id);ws.room=null;ws.actorId=null;if(r.state){r.state=reduce(r.state,{type:'CANCEL_INTERACTION',actorId:m.id});const p=r.state.players.find(p=>p.id===m.id);p.alive=false;p.hp=0;r.state=reduce(r.state,{type:'TICK',now:r.state.now+1});}if(r.hostId===m.id)r.hostId=r.members.keys().next().value;broadcast(r);return;}
   if(a.type==='ready'&&!r.state){m.ready=!!a.ready;broadcast(r);return;}
   if(a.type==='start'){
    if(m.id!==r.hostId||r.state)return fail(ws,'只有房主可以开始。');
    if(r.members.size<4||[...r.members.values()].some(m=>!m.ready||!m.ws))return fail(ws,'需要 4–8 名玩家全部在线并准备。');
    const ids=[...r.members.keys()];
    r.state=createGame({originalId:ids[randomInt(ids.length)]});r.state.players=r.state.players.filter(p=>r.members.has(p.id));
    r.state.players.forEach((p,i)=>{p.name=r.members.get(p.id).name;r.positions[p.id]=spawnPoint('hub',i);});r.last=now;broadcast(r);return;
   }
   if(!r.state)return;
   if(a.type==='input'){
    if(!Number.isFinite(a.x)||!Number.isFinite(a.z)||Math.abs(a.x)>1.01||Math.abs(a.z)>1.01)return;
    m.input={x:a.x,z:a.z};m.sprint=!!a.sprint;m.lastInput=now;return;
   }
   if(a.type==='action'){
    const action=a.action;if(!action||!['ATTACK','START_CORRUPT','START_TASK','START_SECRET','SOLVE_PUZZLE','START_MEETING','VOTE','CANCEL_INTERACTION'].includes(action.type))return;
    if(['ATTACK','START_CORRUPT'].includes(action.type)){
     const target=nearestTarget(r.state.players.map(p=>({...p,position:r.positions[p.id]})),m.id);if(!target||target!==action.targetId)return fail(ws,'目标太远或被遮挡。');
    }
    // Actor, time, position and task mode are never accepted from the browser.
    const safe={type:action.type,actorId:m.id,targetId:action.targetId,taskId:action.taskId,answer:action.answer,interactive:true};
    const next=reduce(r.state,safe);if(next===r.state)return fail(ws,'当前条件不满足。');r.state=next;if(['START_TASK','START_SECRET','START_MEETING','START_CORRUPT'].includes(safe.type))m.input={x:0,z:0};send(ws,snapshot(r,m));
    if(safe.type==='ATTACK')for(const viewer of r.members.values()){
     const a=r.positions[m.id],b=r.positions[viewer.id];
     if(viewer.ws&&Math.hypot(a.x-b.x,a.z-b.z)<10)send(viewer.ws,{type:'combat',actorId:m.id,targetId:safe.targetId});
    }
   }
  }catch{fail(ws,'无法处理该操作。');}});
  ws.on('close',()=>{connections.delete(ws);detach(ws);});ws.on('error',()=>{});
 });
 let tickCount=0;
 const interval=setInterval(()=>{
  const now=Date.now();tickCount++;for(const [code,r] of rooms){
   for(const [id,m] of r.members)if(!m.ws&&now-m.disconnectedAt>120000){r.members.delete(id);if(!r.state&&r.hostId===id)r.hostId=r.members.keys().next().value;if(r.state){r.state=reduce(r.state,{type:'CANCEL_INTERACTION',actorId:id});const p=r.state.players.find(p=>p.id===id);p.alive=false;p.hp=0;}broadcast(r);}
   if(!r.members.size||now-r.createdAt>6*3600000){for(const m of r.members.values())m.ws?.close(4000,'Room expired');rooms.delete(code);continue;}
   if(!r.state)continue;
   const dt=Math.min(.1,(now-r.last)/1000);r.last=now;
   if(r.state.phase==='explore')for(const m of r.members.values()){
    const p=r.state.players.find(p=>p.id===m.id);if(!p.alive||!m.ws||now-m.lastInput>300)continue;
    const before=r.positions[m.id],after=movePosition(before,m.input,dt,m.sprint);
    if(Math.hypot(after.x-before.x,after.z-before.z)>.0001){r.state=reduce(r.state,{type:'CANCEL_INTERACTION',actorId:m.id});r.positions[m.id]=after;const zone=zoneAt(after);if(zone!==p.room)r.state=reduce(r.state,{type:'MOVE',actorId:m.id,room:zone});}
   }
   r.state=reduce(r.state,{type:'TICK',now:r.state.now+dt*1000});
   if(tickCount%2===0)for(const m of r.members.values())if(m.ws)send(m.ws,snapshot(r,m));
  }
 },50);interval.unref();
 const heartbeat=setInterval(()=>{for(const ws of connections){if(!ws.alive||!ws.room&&Date.now()-ws.connectedAt>15000){ws.terminate();continue;}ws.alive=false;ws.ping();}},30000);heartbeat.unref();
 return {rooms,close(){clearInterval(interval);clearInterval(heartbeat);for(const ws of connections)ws.terminate();wss.close();}};
}
