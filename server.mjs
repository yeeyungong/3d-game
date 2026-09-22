import {attachMultiplayer} from './multiplayer/server.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const routes={'/':'public/index.html','/index.html':'public/index.html','/style.css':'public/style.css','/app.mjs':'public/app.mjs','/src/rules.mjs':'src/rules.mjs','/src/views.mjs':'src/views.mjs'};
Object.assign(routes,{'/communication.mjs':'public/communication.mjs','/voice.mjs':'public/voice.mjs','/communication.css':'public/communication.css'});
Object.assign(routes,{'/online.mjs':'public/online.mjs','/config.json':'public/config.json','/minigames.mjs':'public/minigames.mjs','/src/puzzles.mjs':'src/puzzles.mjs','/station.mjs':'public/station.mjs','/theme.css':'public/theme.css','/scene.mjs':'public/scene.mjs','/src/world.mjs':'src/world.mjs','/vendor/three.module.js':'node_modules/three/build/three.module.js','/vendor/three.core.js':'node_modules/three/build/three.core.js'});
export function createServer(){return http.createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=Object.hasOwn(routes,path)?routes[path]:null;
    if(!file||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(new URL(file,import.meta.url));
    res.writeHead(200,{'Content-Type':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch(error){res.writeHead(error instanceof URIError?400:404);res.end('Not found');}
});}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createServer();
  attachMultiplayer(server,{origins:(process.env.ALLOWED_ORIGINS||'http://127.0.0.1:4173,http://localhost:4173').split(',').map(s=>s.trim())});
  server.on('error',error=>{console.error(`Cannot start preview: ${error.message}`);process.exitCode=1;});
  server.listen(Number(process.env.PORT)||4173,process.env.HOST||'127.0.0.1',()=>console.log('Shadow Protocol: http://127.0.0.1:4173'));
}
