import test from 'node:test';
import assert from 'node:assert/strict';
import {puzzleAnswers,validPuzzle} from '../src/puzzles.mjs';
import {createGame,reduce} from '../src/rules.mjs';
test('all puzzle types reject incomplete and wrong input',()=>{
 for(const [room,answer] of Object.entries(puzzleAnswers)){
  assert.equal(validPuzzle(room,answer),true);assert.equal(validPuzzle(room,answer.slice(1)),false);assert.equal(validPuzzle(room,answer.map(()=>-1)),false);
 }
 assert.equal(validPuzzle('unknown',[]),false);assert.equal(validPuzzle('power',null),false);
});
test('each interactive task awards once after solving, and secret puzzle unlocks next step',()=>{
 for(const [taskId,room,reward] of [['power-calibration','power',15],['lab-calibration','lab',15],['storage-cache','storage',5],['comms-cache','comms',5]]){
  let s=createGame();s=reduce(s,{type:'MOVE',actorId:'p2',room});s=reduce(s,{type:'START_TASK',actorId:'p2',taskId,interactive:true});
  s=reduce(s,{type:'TICK',now:99999});assert.equal(s.energy,0);
  s=reduce(s,{type:'SOLVE_PUZZLE',actorId:'p2',answer:puzzleAnswers[room]});s=reduce(s,{type:'TICK',now:100500});assert.equal(s.energy,reward);
 }
 let s=reduce(createGame(),{type:'TICK',now:15000});s=reduce(s,{type:'MOVE',actorId:'p1',room:'power'});s=reduce(s,{type:'START_SECRET',actorId:'p1',interactive:true});s=reduce(s,{type:'TICK',now:50000});assert.equal(s.corruption.steps,0);s=reduce(s,{type:'SOLVE_PUZZLE',actorId:'p1',answer:puzzleAnswers.power});s=reduce(s,{type:'TICK',now:51000});assert.equal(s.corruption.steps,1);assert.equal(s.energy,0);
});
