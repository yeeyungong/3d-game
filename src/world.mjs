export const WORLD_SCALE=1.7;
export const POWER_SWITCH={x:-11*WORLD_SCALE,z:-11*WORLD_SCALE};
export function nearPowerSwitch(position){return !!position&&Number.isFinite(position.x)&&Number.isFinite(position.z)&&Math.hypot(position.x-POWER_SWITCH.x,position.z-POWER_SWITCH.z)<=2.6;}
export const WORLD_LIMIT=21.4*WORLD_SCALE;
export const designCenters={hub:{x:0,z:0},power:{x:-14,z:-14},lab:{x:14,z:-14},storage:{x:-14,z:14},comms:{x:14,z:14}};
export const centers=Object.fromEntries(Object.entries(designCenters).map(([id,p])=>[id,{x:p.x*WORLD_SCALE,z:p.z*WORLD_SCALE}]));
export const partitions=Object.values(designCenters).filter(p=>p.x).flatMap(p=>{const sx=Math.sign(p.x),sz=Math.sign(p.z);return [-4,4].flatMap(offset=>[{x:sx*8,z:p.z+offset,w:.16,d:2,h:3.5},{x:p.x+offset,z:sz*8,w:2,d:.16,h:3.5}]);});
export function spawnPoint(room,index=0){const c=centers[room]||centers.hub;return {x:c.x+(index%4-1.5)*2.8,z:c.z+(room==='hub'?1:-Math.sign(c.z))*(Math.floor(index/4)*2.5+(room==='hub'?3:4))};}
export function zoneAt({x,z}){if(Math.abs(x)<8*WORLD_SCALE||Math.abs(z)<8*WORLD_SCALE)return 'hub';return z<0?(x<0?'power':'lab'):(x<0?'storage':'comms');}
const obstacles=[...partitions,{x:0,z:-3,w:1.8,d:1.8},
  {x:-11,z:-17,w:1.25,d:2},{x:-11,z:-11,w:.45,d:.35},
  ...[0,1,2].map(i=>({x:-18+i*2,z:-17,w:.8,d:.8})),
  ...[0,1].map(i=>({x:16,z:-17+i*4,w:1.5,d:.65})),
  ...[0,1,2,3,4].map(i=>({x:-17+i%3*1.6,z:16+Math.floor(i/3)*1.6,w:.7,d:.7})),
  ...[0,1,2].map(i=>({x:11+i*2,z:18,w:.7,d:.4}))].map(o=>({...o,x:o.x*WORLD_SCALE,z:o.z*WORLD_SCALE,w:o.w*WORLD_SCALE,d:o.d*WORLD_SCALE}));
const blocked=(x,z)=>obstacles.some(o=>Math.abs(x-o.x)<o.w+.3&&Math.abs(z-o.z)<o.d+.3);
export function findPath(from,to){
  const start={x:Math.round(from.x),z:Math.round(from.z)},goal={x:Math.round(to.x),z:Math.round(to.z)};
  const key=p=>`${p.x},${p.z}`;
  if(blocked(goal.x,goal.z)||Math.abs(goal.x)>Math.floor(WORLD_LIMIT)||Math.abs(goal.z)>Math.floor(WORLD_LIMIT))return [];
  const queue=[start],parents=new Map([[key(start),null]]);let found=false;
  for(let head=0;head<queue.length;head++){
    const p=queue[head];if(key(p)===key(goal)){found=true;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next={x:p.x+dx,z:p.z+dz};
      if(Math.abs(next.x)>Math.floor(WORLD_LIMIT)||Math.abs(next.z)>Math.floor(WORLD_LIMIT)||blocked(next.x,next.z)||parents.has(key(next)))continue;
      parents.set(key(next),p);queue.push(next);
    }
  }
  if(!found)return [];
  const path=[];let p=goal;
  while(p){path.unshift(p);p=parents.get(key(p));}
  if(!blocked(to.x,to.z))path.push({...to});
  return path;
}
export function movePosition(p,input,dt,sprint=false){
  const length=Math.hypot(input.x,input.z);if(!length)return {...p};
  const step=(sprint?6.5:3.5)*Math.max(0,Math.min(dt,1));
  const result={...p},count=Math.ceil(step/.1)||1;
  for(let i=0;i<count;i++){
    const x=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,result.x+input.x/length*step/count));
    if(!blocked(x,result.z))result.x=x;
    const z=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,result.z+input.z/length*step/count));
    if(!blocked(result.x,z))result.z=z;
  }
  return result;
}

export function nearestTarget(players,actorId){
 const actor=players.find(p=>p.id===actorId);if(!actor?.alive)return null;
 let nearest=null,best=3.5;
 for(const p of players){
  if(!p.alive||p.id===actorId||p.room!==actor.room)continue;
  const dx=p.position.x-actor.position.x,dz=p.position.z-actor.position.z,d=Math.hypot(dx,dz);
  if(d>=best)continue;
  let clear=true;const steps=Math.ceil(d/.15);
  for(let i=1;i<steps;i++)if(blocked(actor.position.x+dx*i/steps,actor.position.z+dz*i/steps)){clear=false;break;}
  if(clear){best=d;nearest=p.id;}
 }
 return nearest;
}
