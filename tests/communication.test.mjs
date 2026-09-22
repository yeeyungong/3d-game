import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {voiceIceServers,createCommunication} from '../multiplayer/communication.mjs';

test('TURN credentials expire, match coturn REST authentication and do not expose the shared secret',()=>{
 const env={STUN_URLS:'stun:stun.example:3478,https://invalid.example',TURN_URLS:'turn:relay.example:3478?transport=udp,turns:relay.example:5349',TURN_SHARED_SECRET:'test-only-shared-secret'};
 const servers=voiceIceServers(env,'room-p1');assert.equal(servers.length,2);assert.deepEqual(servers[0].urls,['stun:stun.example:3478']);
 const turn=servers[1];assert.equal(turn.credential,createHmac('sha1',env.TURN_SHARED_SECRET).update(turn.username).digest('base64'));
 const expiry=Number(turn.username.split(':')[0]);assert.ok(expiry>Date.now()/1000+43000&&expiry<=Date.now()/1000+43201);
 assert.ok(!JSON.stringify(servers).includes(env.TURN_SHARED_SECRET));assert.deepEqual(voiceIceServers({STUN_URLS:'',TURN_URLS:env.TURN_URLS}),[]);
});

test('a backpressured channel update is retried instead of permanently caching an unsent roster',()=>{
 let blocked=true,attempts=0;const communication=createCommunication(()=>{attempts++;return !blocked;});
 const member={id:'p1',name:'Host',ws:{}},room={members:new Map([['p1',member]]),state:null};
 communication.sync(room);blocked=false;communication.sync(room);communication.sync(room);assert.equal(attempts,2);
});
