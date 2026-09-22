import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoice} from '../public/voice.mjs';

function fixture(getUserMedia){
 const sent=[],states=[],pcs=[];
 class PC{
  constructor(){pcs.push(this);this.connectionState='new';this.signalingState='stable';this.remoteDescription=null;this.candidates=[];}
  addTrack(){} close(){this.connectionState='closed';} async setLocalDescription(){this.localDescription={type:this.remoteDescription?'answer':'offer',sdp:'v=0'};}
  async setRemoteDescription(d){this.remoteDescription=d;} async addIceCandidate(c){this.candidates.push(c);}
 }
 const audios=[];
 const voice=createVoice({send:m=>{sent.push(m);return true;},onChange:s=>states.push(s),platform:{getUserMedia,createPeer:()=>new PC(),createAudio:()=>{const a={play:async()=>{},pause(){},remove(){}};audios.push(a);return a;}}});
 voice.update({selfId:'p1',channel:'all',peers:[],iceServers:[]});
 return {voice,sent,states,pcs,audios};
}
const stream=()=>{const track={enabled:true,stopped:false,stop(){this.stopped=true;}};return {track,getTracks:()=>[track],getAudioTracks:()=>[track]};};

test('microphone permission completing after exit cannot reactivate voice',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));const joining=f.voice.join();f.voice.leave();const s=stream();resolve(s);await joining;
 assert.equal(s.track.stopped,true);assert.ok(!f.sent.some(m=>m.type==='voice-join'));assert.equal(f.states.at(-1).active,false);
});
test('permission rejection remains retryable; mute and exit stop capture',async()=>{
 let attempts=0;const s=stream();const f=fixture(async()=>{if(!attempts++)throw Object.assign(Error(),{name:'NotAllowedError'});return s;});
 await f.voice.join();assert.match(f.states.at(-1).message,/权限/);await f.voice.join();assert.equal(f.states.at(-1).active,true);
 f.voice.mute();assert.equal(s.track.enabled,false);assert.equal(f.sent.at(-1).muted,true);f.voice.leave();assert.equal(s.track.stopped,true);assert.equal(f.states.at(-1).active,false);
});
test('voice accepts queued ICE, rejects stale sessions and closes peers on channel change',async()=>{
 const f=fixture(async()=>stream());await f.voice.join();
 f.voice.update({selfId:'p1',channel:'all',iceServers:[],peers:[{id:'p1',voiceSession:'self'},{id:'p2',name:'Crew',voiceSession:'peer'}]});
 await f.voice.signal({from:'p2',session:'old',targetSession:'self',description:{type:'offer',sdp:'old'}});assert.equal(f.pcs[0].remoteDescription,null);
 await f.voice.signal({from:'p2',session:'peer',targetSession:'self',candidate:{candidate:'early'}});assert.equal(f.pcs[0].candidates.length,0);
 await f.voice.signal({from:'p2',session:'peer',targetSession:'self',description:{type:'answer',sdp:'new'}});assert.equal(f.pcs[0].candidates.length,1);
 f.voice.update({selfId:'p1',channel:'ghost',peers:[{id:'p1',voiceSession:'self'}],iceServers:[]});assert.equal(f.pcs[0].connectionState,'closed');
 f.voice.leave();
});

test('only lower id offers and a channel session rotation reconnects without reopening the microphone',async()=>{
 const s=stream(),f=fixture(async()=>s);await f.voice.join();
 const roster={selfId:'p1',channel:'all',iceServers:[],peers:[{id:'p1',voiceSession:'a'},{id:'p2',voiceSession:'b'}]};
 f.voice.update(roster);await f.pcs[0].onnegotiationneeded();assert.equal(f.sent.at(-1).description.type,'offer');
 f.voice.update({...roster,channel:'living',peers:[{id:'p1',voiceSession:'c'},{id:'p2',voiceSession:'d'}]});
 assert.equal(f.pcs[0].connectionState,'closed');assert.equal(s.track.stopped,false);assert.equal(f.pcs.length,2);
 await f.voice.signal({from:'p2',session:'b',targetSession:'a',description:{type:'answer',sdp:'stale'}});assert.equal(f.pcs[1].remoteDescription,null);f.voice.leave();
});

test('higher id answers offers and removes remote audio when a member leaves',async()=>{
 const f=fixture(async()=>stream());await f.voice.join();
 f.voice.update({selfId:'p2',channel:'all',iceServers:[],peers:[{id:'p2',voiceSession:'self'},{id:'p1',voiceSession:'peer'}]});
 await f.pcs[0].onnegotiationneeded();assert.equal(f.sent.filter(m=>m.type==='voice-signal').length,0);
 await f.voice.signal({from:'p1',session:'peer',targetSession:'self',description:{type:'offer',sdp:'v=0'}});assert.equal(f.sent.at(-1).description.type,'answer');
 f.pcs[0].ontrack({streams:[{}]});f.voice.update({selfId:'p2',channel:'all',peers:[{id:'p2',voiceSession:'self'}]});
 assert.equal(f.pcs[0].connectionState,'closed');assert.equal(f.audios[0].srcObject,null);f.voice.leave();
});
