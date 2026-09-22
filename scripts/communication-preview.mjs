// Local-only manual QA server. Not part of the production routes or static build.
// Uses silent synthetic audio; never requests the real microphone.
import {readFile} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {attachMultiplayer} from '../multiplayer/server.mjs';
import {createGame} from '../src/rules.mjs';
import {spawnPoint} from '../src/world.mjs';
const server=createServer(),normal=server.listeners('request')[0];server.removeListener('request',normal);
const game=attachMultiplayer(server,{origins:['http://127.0.0.1:4174']});
server.on('request',async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html.replace('src="/app.mjs"','src="/qa-audio.mjs"'));return;
 }
 if(path==='/qa-audio.mjs'){
  res.writeHead(200,{'Content-Type':'text/javascript'});res.end(`
   const connections=[];const NativePeer=window.RTCPeerConnection;
   window.RTCPeerConnection=class extends NativePeer{constructor(options){super(options);connections.push(this);}};
   navigator.mediaDevices.getUserMedia=async()=>{const ctx=new AudioContext();await ctx.resume();const source=ctx.createOscillator(),gain=ctx.createGain(),out=ctx.createMediaStreamDestination();gain.gain.value=0;source.connect(gain);gain.connect(out);source.start();for(const track of out.stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{stop();source.stop();ctx.close();};}return out.stream;};
   await import('/app.mjs');
   const qa=document.createElement('div');qa.id='qa-controls';qa.style='position:fixed;left:4px;top:4px;z-index:99999;background:#fff;color:#111;font-size:12px;padding:6px';
   qa.innerHTML='<b>QA · 合成静音音频</b> <button data-phase="explore">测试探索</button><button data-phase="meeting">测试会议</button><button data-phase="ended">测试结算</button><output id="qa-rtc">RTC 等待</output>';
   function place(){const modal=[...document.querySelectorAll('dialog[open]')].at(-1);if(qa.parentNode!==(modal||document.body))(modal||document.body).append(qa);}new MutationObserver(place).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});place();
   qa.onclick=e=>{if(e.target.dataset.phase)fetch('/qa-phase',{method:'POST',body:e.target.dataset.phase});};
   setInterval(async()=>{let bytes=0;for(const pc of connections)if(pc.connectionState==='connected')for(const stat of (await pc.getStats()).values())if(stat.type==='inbound-rtp'&&stat.kind==='audio')bytes+=stat.bytesReceived||0;document.getElementById('qa-rtc').textContent='RTC 接收字节 '+bytes;},1000);
  `);return;
 }
 if(path==='/qa-phase'&&req.method==='POST'){
  let phase='';for await(const data of req)phase+=data;
  if(!['explore','meeting','ended'].includes(phase)){res.writeHead(400);res.end();return;}
  for(const room of game.rooms.values()){
   room.state=createGame({originalId:'p8'});for(const [i,p] of room.state.players.entries()){p.name=room.members.get(p.id)?.name||p.name;room.positions[p.id]=spawnPoint('hub',i);}
   room.state.phase=phase;
   if(phase==='meeting')room.state.meeting={stage:'discuss',endsAt:60000,aliveIds:room.state.players.map(p=>p.id),votes:{}};
   if(phase==='ended')room.state.winner='good';
  }
  res.end('ok');return;
 }
 normal(req,res);
});
server.listen(4174,'127.0.0.1',()=>console.log('Synthetic audio QA: http://127.0.0.1:4174'));
process.on('SIGINT',()=>{game.close();server.close();});
