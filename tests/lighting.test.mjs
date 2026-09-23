import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,reduce} from '../src/rules.mjs';
import {playerView} from '../src/views.mjs';
import {findPath,movePosition,nearPowerSwitch,spawnPoint} from '../src/world.mjs';

const action={type:'TOGGLE_POWER_LIGHTS',actorId:'p1',position:{x:-18.7,z:-18.7}};
function ready(){const s=createGame();s.players[0].room='power';return s;}
test('nearby players toggle shared lighting and a new game restores it',()=>{
 const s=ready(),off=reduce(s,action);
 assert.equal(off.powerLightsOn,false);
 assert.equal(playerView(off,'p2').powerLightsOn,false);
 assert.equal(reduce(off,action).powerLightsOn,true);
 assert.equal(createGame().powerLightsOn,true);
});
test('remote, invalid, busy, dead and meeting interactions cannot change lights',()=>{
 for(const position of [undefined,{x:0,z:0},{x:NaN,z:-18.7},{x:Infinity,z:0}]){
  const s=ready();assert.equal(reduce(s,{...action,position}),s);
 }
 for(const change of [s=>s.players[0].alive=false,s=>s.phase='meeting',s=>s.players[0].room='hub',s=>s.channels.p1={kind:'task'}]){
  const s=ready();change(s);assert.equal(reduce(s,action),s);
 }
});
test('a player can walk from the entrance to the switch around equipment',()=>{
 let p=spawnPoint('power',0);const route=findPath(p,{x:-18.7,z:-17});
 assert.ok(route.length);
 for(const point of route){
  for(let i=0;i<300&&Math.hypot(point.x-p.x,point.z-p.z)>.05;i++){
   const delta={x:point.x-p.x,z:point.z-p.z};
   p=movePosition(p,delta,Math.min(1/60,Math.hypot(delta.x,delta.z)/3.5));
  }
  assert.ok(Math.hypot(point.x-p.x,point.z-p.z)<.1);
 }
 assert.ok(nearPowerSwitch(p));
});
