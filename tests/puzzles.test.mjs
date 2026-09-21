import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePuzzle,validPuzzle} from '../src/puzzles.mjs';
import {createGame,reduce} from '../src/rules.mjs';
import {playerView} from '../src/views.mjs';
const act=(s,type,extra={})=>reduce(s,{type,actorId:'p2',...extra});
function open(s){s=act(s,'TICK',{now:Math.max(s.now+1,s.taskReadyAt['hub-maintenance']||0)});return act(s,'START_TASK',{taskId:'hub-maintenance',interactive:true});}
function solve(s){const p=s.channels.p2.puzzle;return act(act(s,'SOLVE_PUZZLE',{puzzleId:p.id,answer:p.answer}),'TICK',{now:s.now+400});}
test('five areas offer three non-repeating variants, randomized answers and bounded difficulty',()=>{
 for(const room of ['power','lab','storage','comms','hub']){
  const kinds=new Set(),answers=new Set();let last=null;
  for(let seed=1;seed<=60;seed++){const p=generatePuzzle(room,1,seed,last,String(seed));assert.notEqual(p.kind,last);assert.equal(validPuzzle(p,p.answer),true);assert.equal(validPuzzle(p,[]),false);assert.equal(validPuzzle(p,p.answer.map(()=>-1)),false);kinds.add(p.kind);answers.add(JSON.stringify(p.answer));last=p.kind;}
  assert.equal(kinds.size,3);assert.ok(answers.size>5);
 }
 const easy=generatePuzzle('power',1,8,null,'a'),hard=generatePuzzle('power',3,8,null,'b');assert.ok(hard.answer.length>easy.answer.length);
});
test('player progresses every three completions, caps at three, resets per game and never pays twice',()=>{
 let s=createGame({puzzleSeed:7});
 for(let i=1;i<=10;i++){s=open(s);const p=s.channels.p2.puzzle;assert.equal(p.level,Math.min(3,1+Math.floor((i-1)/3)));const old=s;s=solve(s);assert.equal(s.taskProgress.p2.completed,i);assert.equal(act(s,'SOLVE_PUZZLE',{puzzleId:p.id,answer:p.answer}),s);assert.equal(old.channels.p2.solved,undefined);}
 assert.equal(s.taskProgress.p2.level,3);assert.equal(s.taskProgress.p1,undefined);assert.deepEqual(createGame().taskProgress,{});
 assert.equal(playerView(s,'p1').taskProgress.completed,0);
});
test('wrong submissions lower only this player after three failures and stale puzzles cannot claim rewards',()=>{
 let s=createGame();for(let i=0;i<3;i++)s=solve(open(s));s=open(s);const old=s.channels.p2.puzzle;
 for(let i=0;i<3;i++)s=act(s,'SOLVE_PUZZLE',{puzzleId:old.id,answer:[-1]});
 assert.equal(s.channels.p2.puzzle.level,1);assert.notEqual(s.channels.p2.puzzle.id,old.id);assert.equal(s.taskProgress.p2.completed,3);
 assert.equal(act(s,'SOLVE_PUZZLE',{puzzleId:old.id,answer:old.answer}),s);
 const energy=s.energy;s=act(s,'CANCEL_INTERACTION');assert.equal(act(s,'SOLVE_PUZZLE',{puzzleId:old.id,answer:old.answer}),s);assert.equal(s.energy,energy);
});
test('private views expose only the current player puzzle and progress',()=>{
 let s=open(createGame());const owner=playerView(s,'p2'),other=playerView(s,'p3');assert.ok(owner.channel.puzzle);assert.equal(other.channel,null);assert.equal(other.taskProgress.completed,0);
});

test('all terminals and secret tasks award once with their generated puzzle',()=>{
 for(const [taskId,room,reward] of [['power-calibration','power',15],['lab-calibration','lab',15],['storage-cache','storage',5],['comms-cache','comms',5],['hub-maintenance','hub',10]]){
  let s=createGame();if(room!=='hub')s=act(s,'MOVE',{room});s=act(s,'START_TASK',{taskId,interactive:true});s=solve(s);assert.equal(s.energy,reward);assert.equal(s.taskProgress.p2.completed,1);
 }
 let s=reduce(createGame(),{type:'TICK',now:15000});s=reduce(s,{type:'MOVE',actorId:'p1',room:'power'});s=reduce(s,{type:'START_SECRET',actorId:'p1',interactive:true});const p=s.channels.p1.puzzle;
 s=reduce(s,{type:'SOLVE_PUZZLE',actorId:'p1',puzzleId:p.id,answer:p.answer});s=reduce(s,{type:'TICK',now:15400});assert.equal(s.corruption.steps,1);assert.equal(s.energy,0);assert.equal(s.taskProgress.p1.completed,1);
});
