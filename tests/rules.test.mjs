import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, reduce, outcome } from '../src/rules.mjs';

test('initial identities and victory precedence', () => {
  const s=createGame();
  assert.equal(s.players.length,8);
  assert.equal(s.players.filter(p=>p.role==='good').length,7);
  assert.equal(outcome(s.players),null);
  assert.equal(outcome(s.players.map(p=>({...p,alive:p.role==='good'}))),'good');
  assert.equal(outcome(s.players.map((p,i)=>({...p,alive:i<3}))),'traitor');
  assert.equal(outcome(s.players.map(p=>({...p,alive:false}))),'good');
});
test('alternate original and immutable invalid actions',()=>{
  const s=createGame({originalId:'p4'});
  assert.equal(s.players[3].role,'original');
  assert.equal(reduce(s,{type:'unknown'}),s);
});

const act=(s,type,extra={})=>reduce(s,{type,...extra});
const ready=()=>act(createGame(),'TICK',{now:15000});
test('task completes once with cooldown and immutable input',()=>{
  const initial=createGame();
  let s=act(initial,'MOVE',{actorId:'p2',room:'power'});
  s=act(s,'START_TASK',{actorId:'p2',taskId:'power-calibration'});
  s=act(s,'TICK',{now:12000});
  assert.equal(s.energy,15);
  assert.equal(initial.players[1].room,'hub');
  s=act(s,'START_TASK',{actorId:'p2',taskId:'power-calibration'});
  s=act(s,'TICK',{now:24000});
  assert.equal(s.energy,15);
});
test('movement cancels task, rooms require adjacency, time cannot reverse',()=>{
  let s=act(createGame(),'MOVE',{actorId:'p2',room:'power'});
  assert.equal(act(s,'MOVE',{actorId:'p2',room:'comms'}),s);
  s=act(s,'START_TASK',{actorId:'p2',taskId:'power-calibration'});
  s=act(s,'MOVE',{actorId:'p2',room:'lab'});
  s=act(s,'TICK',{now:12000});
  assert.equal(s.energy,0);
  assert.equal(act(s,'TICK',{now:100}),s);
});
test('task caps energy and multiple actors cannot claim one terminal',()=>{
  let s={...createGame(),energy:95};
  for(const actorId of ['p2','p3'])s=act(s,'MOVE',{actorId,room:'power'});
  s=act(s,'START_TASK',{actorId:'p2',taskId:'power-calibration'});
  s=act(s,'START_TASK',{actorId:'p3',taskId:'power-calibration'});
  assert.equal(Object.keys(s.channels).length,1);
  s=act(s,'TICK',{now:12000});
  assert.equal(s.energy,100);
});
test('original converts; converted cannot infect and second charge is locked',()=>{
  let s=ready();
  s=act(s,'START_CORRUPT',{actorId:'p1',targetId:'p2'});
  s=act(s,'TICK',{now:20000});
  assert.equal(s.players[1].role,'converted');
  assert.equal(s.corruption.used,1);
  assert.equal(s.corruption.channel,null);
  assert.equal(act(s,'START_CORRUPT',{actorId:'p2',targetId:'p3'}),s);
  s=act(s,'TICK',{now:65000});
  assert.equal(act(s,'START_CORRUPT',{actorId:'p1',targetId:'p3'}),s);
});
test('moving target cancels corruption without spending charge',()=>{
  let s=act(ready(),'START_CORRUPT',{actorId:'p1',targetId:'p2'});
  s=act(s,'MOVE',{actorId:'p2',room:'power'});
  assert.equal(s.corruption.channel,null);
  assert.equal(s.corruption.readyAt,25000);
  s=act(s,'TICK',{now:30000});
  assert.equal(s.players[1].role,'good');
  assert.equal(s.corruption.used,0);
});
test('secret chain unlocks second charge, cap never replenishes',()=>{
  let s=ready();
  for(const [room,duration] of [['power',8000],['lab',6000],['comms',10000]]){
    s=act(s,'MOVE',{actorId:'p1',room});
    s=act(s,'START_SECRET',{actorId:'p1'});
    s=act(s,'TICK',{now:s.now+duration});
  }
  assert.equal(s.corruption.steps,3);
  s=act(s,'MOVE',{actorId:'p1',room:'hub'});
  for(const targetId of ['p2','p3']){
    s=act(s,'TICK',{now:Math.max(s.now+1,s.corruption.readyAt)});
    s=act(s,'START_CORRUPT',{actorId:'p1',targetId});
    s=act(s,'TICK',{now:s.now+5000});
  }
  assert.equal(s.corruption.used,2);
  s.players[1].alive=false;
  s=act(s,'TICK',{now:s.now+45000});
  assert.equal(act(s,'START_CORRUPT',{actorId:'p1',targetId:'p4'}),s);
});

function meetingFixture(count=8){
  const s=ready();s.energy=100;
  for(let i=count;i<8;i++)s.players[i].alive=false;
  return s;
}
function openVote(s){
  s=act(s,'START_MEETING',{actorId:'p2'});
  s=act(s,'TICK',{now:s.now+63000});
  return s;
}
test('meeting cancels corruption and costs energy even when skipped',()=>{
  let s=meetingFixture();
  s=act(s,'START_CORRUPT',{actorId:'p1',targetId:'p3'});
  s=act(s,'START_MEETING',{actorId:'p2'});
  s=act(s,'TICK',{now:s.now+6000});
  assert.equal(s.phase,'meeting');
  assert.equal(s.energy,0);
  assert.equal(s.players[2].role,'good');
  assert.equal(s.corruption.channel,null);
  s=act(s,'TICK',{now:s.now+80000});
  assert.equal(s.phase,'explore');
  assert.equal(s.energy,0);
});
test('six alive needs four votes; duplicate votes overwrite and dead cannot vote',()=>{
  for(const votes of [3,4]){
    let s=openVote(meetingFixture(6));
    assert.equal(s.meeting.stage,'vote');
    assert.equal(act(s,'VOTE',{actorId:'p8',targetId:'p2'}),s);
    for(let i=1;i<=votes;i++)s=act(s,'VOTE',{actorId:`p${i}`,targetId:'p2'});
    s=act(s,'VOTE',{actorId:'p1',targetId:'p2'});
    s=act(s,'TICK',{now:s.meeting.endsAt});
    assert.equal(s.players[1].alive,votes===3);
  }
});
test('voting original out keeps converted alive and removes conversion authority',()=>{
  let s=meetingFixture();s.players[1].role='converted';
  s=openVote(s);
  for(let i=2;i<=6;i++)s=act(s,'VOTE',{actorId:`p${i}`,targetId:'p1'});
  s=act(s,'TICK',{now:s.meeting.endsAt});
  assert.equal(s.players[0].alive,false);
  assert.equal(s.winner,null);
  assert.equal(act(s,'START_CORRUPT',{actorId:'p1',targetId:'p3'}),s);
});
test('good players cannot attack or convert; converted players cannot convert',()=>{
  const s=ready();
  assert.equal(act(s,'ATTACK',{actorId:'p2',targetId:'p1'}),s);
  assert.equal(act(s,'START_CORRUPT',{actorId:'p2',targetId:'p3'}),s);
  s.players[1].role='converted';
  assert.equal(act(s,'START_CORRUPT',{actorId:'p2',targetId:'p3'}),s);
  assert.notEqual(act(s,'ATTACK',{actorId:'p2',targetId:'p3'}),s);
});

test('one hit kills and a 20-second cooldown prevents the next kill',()=>{
  let s=createGame();
  s.players[1].role='converted';
  assert.equal(act(s,'ATTACK',{actorId:'p2',targetId:'p1'}),s);
  s=act(s,'TICK',{now:15000});
  s=act(s,'ATTACK',{actorId:'p2',targetId:'p1'});
  assert.equal(s.players[0].hp,0);
  assert.equal(s.players[0].alive,false);
  assert.equal(s.winner,null);
  assert.equal(act(s,'ATTACK',{actorId:'p2',targetId:'p3'}),s);
  s=act(s,'TICK',{now:34999});
  assert.equal(act(s,'ATTACK',{actorId:'p2',targetId:'p3'}),s);
  s=act(s,'TICK',{now:35000});
  s=act(s,'ATTACK',{actorId:'p2',targetId:'p3'});
  assert.equal(s.players[2].alive,false);
});
test('third good converted triggers immediate traitor victory',()=>{
  let s=ready();for(let i=4;i<8;i++)s.players[i].alive=false;
  s=act(s,'START_CORRUPT',{actorId:'p1',targetId:'p2'});
  s=act(s,'TICK',{now:s.now+5000});
  assert.equal(s.winner,'traitor');
});
test('meeting interruption applies retry cooldown and pauses it through meeting',()=>{
  let s=meetingFixture();
  s=act(s,'START_CORRUPT',{actorId:'p1',targetId:'p3'});
  s=act(s,'START_MEETING',{actorId:'p2'});
  s=act(s,'TICK',{now:98000});
  assert.equal(s.phase,'explore');
  assert.equal(s.corruption.readyAt,108000);
  s=act(s,'TICK',{now:103000});
  assert.equal(act(s,'START_CORRUPT',{actorId:'p1',targetId:'p3'}),s);
  s=act(s,'TICK',{now:108000});
  assert.notEqual(act(s,'START_CORRUPT',{actorId:'p1',targetId:'p3'}),s);
});
test('full game: tasks fund meetings, both traitors ejected, good wins',()=>{
  let s=ready();
  s=act(s,'START_CORRUPT',{actorId:'p1',targetId:'p2'});
  s=act(s,'TICK',{now:20000});
  s=act(s,'MOVE',{actorId:'p3',room:'power'});
  for(let i=0;i<7;i++){
    s=act(s,'TICK',{now:Math.max(s.now+1,s.taskReadyAt['power-calibration']||0)});
    s=act(s,'START_TASK',{actorId:'p3',taskId:'power-calibration'});
    s=act(s,'TICK',{now:s.now+12000});
  }
  assert.equal(s.energy,100);
  s=act(s,'MOVE',{actorId:'p3',room:'hub'});
  s=act(s,'START_MEETING',{actorId:'p3'});
  s=act(s,'TICK',{now:s.now+63000});
  for(let i=3;i<=7;i++)s=act(s,'VOTE',{actorId:`p${i}`,targetId:'p1'});
  s=act(s,'TICK',{now:s.meeting.endsAt});
  assert.equal(s.energy,0);assert.equal(s.winner,null);assert.equal(s.players[0].alive,false);
  s=act(s,'TICK',{now:s.now+5000});
  s=act(s,'MOVE',{actorId:'p3',room:'power'});
  for(let i=0;i<7;i++){
    s=act(s,'TICK',{now:Math.max(s.now+1,s.taskReadyAt['power-calibration']||0)});
    s=act(s,'START_TASK',{actorId:'p3',taskId:'power-calibration'});
    s=act(s,'TICK',{now:s.now+12000});
  }
  s=act(s,'MOVE',{actorId:'p3',room:'hub'});
  s=act(s,'START_MEETING',{actorId:'p3'});
  s=act(s,'TICK',{now:s.now+63000});
  for(let i=3;i<=7;i++)s=act(s,'VOTE',{actorId:`p${i}`,targetId:'p2'});
  s=act(s,'TICK',{now:s.meeting.endsAt});
  assert.equal(s.winner,'good');assert.equal(s.phase,'ended');
});
test('damage cancels task and conversion; different rooms cannot be attacked',()=>{
  let s=ready();
  s=act(s,'MOVE',{actorId:'p2',room:'power'});
  s=act(s,'START_TASK',{actorId:'p2',taskId:'power-calibration'});
  assert.equal(act(s,'ATTACK',{actorId:'p1',targetId:'p2'}),s);
  s=act(s,'MOVE',{actorId:'p1',room:'power'});
  s=act(s,'ATTACK',{actorId:'p1',targetId:'p2'});
  assert.equal(s.channels.p2,undefined);
  s=act(s,'MOVE',{actorId:'p4',room:'power'});
  s=act(s,'START_CORRUPT',{actorId:'p1',targetId:'p4'});
  assert.ok(s.corruption.channel);
  s.players[2].role='converted';
  s=act(s,'MOVE',{actorId:'p3',room:'power'});
  s=act(s,'ATTACK',{actorId:'p3',targetId:'p1'});
  assert.equal(s.corruption.channel,null);assert.equal(s.corruption.used,0);
});
test('walking within a room cancels active channel without spending charge',()=>{
  let s=act(ready(),'START_CORRUPT',{actorId:'p1',targetId:'p2'});
  s=act(s,'CANCEL_INTERACTION',{actorId:'p1'});
  assert.equal(s.corruption.channel,null);
  assert.equal(s.corruption.used,0);
  assert.equal(s.corruption.readyAt,25000);
});

test('interactive task requires correct puzzle, interruption never grants energy',()=>{
 let s=act(ready(),'MOVE',{actorId:'p2',room:'power'});
 s=act(s,'START_TASK',{actorId:'p2',taskId:'power-calibration',interactive:true});
 s=act(s,'TICK',{now:100000});assert.equal(s.energy,0);assert.ok(s.channels.p2);
 const puzzle=s.channels.p2.puzzle;
 const wrong=act(s,'SOLVE_PUZZLE',{actorId:'p2',puzzleId:puzzle.id,answer:[-1]});assert.equal(wrong.energy,0);assert.equal(wrong.channels.p2.solved,undefined);
 const cancelled=act(s,'CANCEL_INTERACTION',{actorId:'p2'});
 assert.equal(act(cancelled,'SOLVE_PUZZLE',{actorId:'p2',puzzleId:puzzle.id,answer:puzzle.answer}),cancelled);
 s=act(s,'SOLVE_PUZZLE',{actorId:'p2',puzzleId:puzzle.id,answer:puzzle.answer});
 s=act(s,'TICK',{now:101000});assert.equal(s.energy,15);assert.equal(s.channels.p2,undefined);
 s=act(s,'TICK',{now:102000});assert.equal(s.energy,15);
});
