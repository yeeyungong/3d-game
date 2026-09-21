import {mkdir,cp,writeFile} from 'node:fs/promises';
const url=process.env.PUBLIC_GAME_SERVER_URL||'';
if(url&&!/^wss:\/\//.test(url))throw Error('PUBLIC_GAME_SERVER_URL must be a wss:// URL ending in /multiplayer');
await mkdir('dist/vendor',{recursive:true});
await cp('public','dist',{recursive:true});await cp('src','dist/src',{recursive:true});
for(const name of ['three.module.js','three.core.js'])await cp(`node_modules/three/build/${name}`,`dist/vendor/${name}`);
await writeFile('dist/config.json',JSON.stringify({serverUrl:url}));
console.log(url?'Built multiplayer web client.':'Built client: configure PUBLIC_GAME_SERVER_URL on Vercel to enable online rooms.');
