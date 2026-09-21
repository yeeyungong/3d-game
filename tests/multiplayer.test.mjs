import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createServer} from '../server.mjs';
import {attachMultiplayer} from '../multiplayer/server.mjs';
function client(url){return new Promise((resolve,reject)=>{const ws=new WebSocket(url),messages=[];ws.on('message',s=>messages.push(JSON.parse(s)));ws.on('error',reject);ws.on('open',()=>resolve({ws,messages,send:m=>ws.send(JSON.stringify(m)),async wait(type,predicate=()=>true){const end=Date.now()+4000;while(Date.now()<end){const i=messages.findIndex(m=>m.type===type&&predicate(m));if(i>=0)return messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,15));}throw Error(`Timeout waiting for ${type}`);}}));});}
test('eight real connections: invite, permissions, private views, motion and reconnect',async()=>{
 const server=createServer(),game=attachMultiplayer(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`ws://127.0.0.1:${server.address().port}/multiplayer`,clients=[];
 try{
  const host=await client(url);clients.push(host);host.send({type:'create',name:'船长'});const joined=await host.wait('joined');const code=joined.code;
  host.send({type:'start'});assert.match((await host.wait('error')).message,/8/);
  for(let i=1;i<8;i++){const c=await client(url);clients.push(c);c.send({type:'join',code,name:`船员${i}`});await c.wait('joined');}
  clients[1].send({type:'start'});assert.match((await clients[1].wait('error')).message,/房主/);
  const extra=await client(url);clients.push(extra);extra.send({type:'join',code,name:'多余'});assert.match((await extra.wait('error')).message,/已满/);
  for(const c of clients.slice(0,8))c.send({type:'ready',ready:true});
  await host.wait('lobby',m=>m.players.length===8&&m.players.every(p=>p.ready));host.send({type:'start'});
  const states=await Promise.all(clients.slice(0,8).map(c=>c.wait('state')));
  assert.equal(states.filter(s=>s.view.self.role==='original').length,1);
  for(const s of states){assert.equal(s.view.players.length,8);assert.ok(s.view.players.every(p=>!('role' in p)&&!('hp' in p)));if(s.view.self.role==='good')assert.equal(s.view.corruption,null);}
  const r=game.rooms.get(code);const before={...r.positions.p1};host.send({type:'action',action:{type:'TICK',now:99999999}});host.send({type:'action',action:{type:'MOVE',room:'lab'}});host.send({type:'input',x:1,z:0,sprint:false});
  await host.wait('state',m=>m.view.positions.p1.x>before.x+.05);assert.equal(r.state.players[0].room,'hub');assert.ok(r.state.now<10000);
  const hp=r.state.players[7].hp;host.send({type:'action',action:{type:'ATTACK',targetId:'p8',actorId:'p8'}});await host.wait('error');assert.equal(r.state.players[7].hp,hp);
  r.state.players[0].room='power';r.positions.p1={x:-23.8,z:-23.8};
  host.send({type:'action',action:{type:'START_TASK',taskId:'power-calibration',interactive:false}});
  await host.wait('state',m=>m.view.channel?.kind==='task');assert.equal(r.state.channels.p1.interactive,true);
  host.send({type:'action',action:{type:'SOLVE_PUZZLE',answer:[2,0,3,1]}});
  await host.wait('state',m=>m.view.energy===15);await clients[1].wait('state',m=>m.view.energy===15);
  host.ws.close();await new Promise(r=>setTimeout(r,30));const resumed=await client(url);clients.push(resumed);resumed.send({type:'resume',code,token:joined.token});assert.equal((await resumed.wait('joined')).actorId,'p1');assert.equal((await resumed.wait('state')).view.self.name,'船长');
 }finally{for(const c of clients)c.ws.terminate();game.close();await new Promise(r=>server.close(r));}
});
