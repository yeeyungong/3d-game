import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
test('serves only public assets and explicitly allowed modules',async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const path of ['/package.json','/src/../package.json','/docs/superpowers/plans/2026-09-21-rules-prototype.md','/%ZZ']){
      const res=await fetch(base+path);assert.ok([400,404].includes(res.status));
    }
    for(const path of ['/minigames.mjs','/src/puzzles.mjs','/communication.mjs','/voice.mjs']){const asset=await fetch(base+path);assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);}
    const res=await fetch(base+'/src/rules.mjs');assert.equal(res.status,200);
    assert.match(res.headers.get('content-type'),/javascript/);
  }finally{await new Promise(r=>server.close(r));}
});
