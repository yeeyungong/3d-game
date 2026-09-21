import test from 'node:test';
import assert from 'node:assert/strict';
import {movePosition,zoneAt,spawnPoint,findPath,WORLD_LIMIT,WORLD_SCALE} from '../src/world.mjs';
test('walking changes position, diagonal normalized, sprint is faster',()=>{
  const p={x:0,z:0};
  const straight=movePosition(p,{x:1,z:0},1,false);
  assert.ok(straight.x>0);assert.equal(straight.z,0);
  const diagonal=movePosition(p,{x:1,z:1},1,false);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-straight.x)<1e-8);
  assert.ok(movePosition(p,{x:1,z:0},1,true).x>straight.x);
});
test('world bounds and zone centers are consistent',()=>{
  assert.equal(zoneAt(spawnPoint('power')),'power');
  assert.equal(zoneAt(spawnPoint('lab')),'lab');
  assert.equal(zoneAt(spawnPoint('comms')),'comms');
  assert.equal(zoneAt(spawnPoint('storage')),'storage');
  assert.equal(zoneAt(spawnPoint('hub')),'hub');
  assert.ok(movePosition({x:WORLD_LIMIT,z:WORLD_LIMIT},{x:1,z:1},1,true).x<=WORLD_LIMIT);
});
test('walking cannot pass through central console',()=>{
  const p=movePosition({x:0,z:0},{x:0,z:-1},1,false);
  assert.ok(p.z>-1.2*WORLD_SCALE);
});
test('automatic route goes around console and reaches destination',()=>{
  let p={x:0,z:-10};const route=findPath(p,{x:0,z:0});
  assert.ok(route.length>0);
  for(const target of route){
    for(let n=0;n<300&&Math.hypot(target.x-p.x,target.z-p.z)>.12;n++){
      const delta={x:target.x-p.x,z:target.z-p.z};
      p=movePosition(p,delta,Math.min(1/60,Math.hypot(delta.x,delta.z)/3.5));
    }
    assert.ok(Math.hypot(target.x-p.x,target.z-p.z)<.15);
  }
  assert.ok(Math.hypot(p.x,p.z)<.15);
});

test('expanded station allows distant travel and routes around room partitions',()=>{
  assert.ok(movePosition({x:30,z:0},{x:1,z:0},1).x>30);
  assert.equal(zoneAt({x:11,z:11}),'hub');
  // East partition of the power room: cannot walk directly through it.
  const stop=movePosition({x:-11,z:-17},{x:-1,z:0},1);
  assert.ok(stop.x>-13.2);
  for(const target of [{x:-24,z:-24},{x:24,z:-24},{x:-24,z:24},{x:24,z:24}]){
    let p={x:0,z:0};const route=findPath(p,target);assert.ok(route.length>0);
    for(const point of route){
      for(let n=0;n<300&&Math.hypot(point.x-p.x,point.z-p.z)>.12;n++){
        const delta={x:point.x-p.x,z:point.z-p.z};
        p=movePosition(p,delta,Math.min(1/60,Math.hypot(delta.x,delta.z)/3.5));
      }
      assert.ok(Math.hypot(point.x-p.x,point.z-p.z)<.15,`unreachable waypoint ${JSON.stringify(point)}`);
    }
  }
});

test('all player spawn positions can leave each expanded room',()=>{
  for(const room of ['hub','power','lab','storage','comms'])for(let i=0;i<8;i++){
    let p=spawnPoint(room,i);const route=findPath(p,{x:0,z:0});assert.ok(route.length>0);
    for(const point of route){
      for(let n=0;n<300&&Math.hypot(point.x-p.x,point.z-p.z)>.12;n++){
        const delta={x:point.x-p.x,z:point.z-p.z};
        p=movePosition(p,delta,Math.min(1/60,Math.hypot(delta.x,delta.z)/3.5));
      }
      assert.ok(Math.hypot(point.x-p.x,point.z-p.z)<.15,`${room} player ${i} stuck`);
    }
  }
});

test('keyboard target chooses nearby visible player without exposing identities',async()=>{
 const {nearestTarget}=await import('../src/world.mjs');
 const players=[{id:'p1',alive:true,room:'hub',position:{x:0,z:0}},{id:'p2',alive:true,room:'hub',position:{x:2,z:0}},{id:'p3',alive:true,room:'hub',position:{x:3,z:0}}];
 assert.equal(nearestTarget(players,'p1'),'p2');
 players[1].alive=false;assert.equal(nearestTarget(players,'p1'),'p3');
 players[2].position.x=5;assert.equal(nearestTarget(players,'p1'),null);
 players[1].alive=true;players[1].position={x:-14.4,z:-17};players[0].position={x:-12,z:-17};assert.equal(nearestTarget(players,'p1'),null);
});
