import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/rules.mjs';
import {playerView} from '../src/views.mjs';
test('good view hides roles, secret channels and other votes',()=>{
  const s=createGame();
  s.channels.p1={kind:'secret',step:0,startsAt:0,endsAt:8000};
  s.log.push({at:0,text:'secret!',audience:'p1'});
  s.meeting={aliveIds:s.players.map(p=>p.id),stage:'vote',endsAt:20000,votes:{p1:'p2',p2:null}};
  const v=playerView(s,'p2');
  assert.equal(v.corruption,null);
  assert.ok(v.players.every(p=>!Object.hasOwn(p,'role')));
  assert.equal(v.aliveCount,8);
  assert.equal(v.log.length,0);
  assert.equal(v.meeting.ownVote,null);
  assert.equal(v.meeting.votes,undefined);
  assert.equal(v.channel,null);
});
test('traitors recognize teammates and terminal result exposes timeline',()=>{
  const s=createGame();s.players[1].role='converted';
  const v=playerView(s,'p1');
  assert.equal(v.players[1].ally,true);
  assert.equal(v.corruption.used,0);
  s.winner='good';s.phase='ended';
  assert.equal(playerView(s,'p2').reveal[0].role,'original');
});
