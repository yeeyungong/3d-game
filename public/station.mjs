import * as THREE from '/vendor/three.module.js';
import {designCenters as centers,zoneAt,WORLD_SCALE,partitions} from '/src/world.mjs';

// All large equipment keeps the footprints used by world.mjs collision and navigation.
export function buildStation(world,{box:makeBox,cylinder:makeCylinder,material,label}){
  const scene=new THREE.Group();scene.scale.set(WORLD_SCALE,1,WORLD_SCALE);world.add(scene);
  const box=(...args)=>makeBox(...args,scene),cylinder=(...args)=>makeCylinder(...args,scene);
  const ink=material(0x101a29),steel=material(0x384758),white=material(0xa9bec9);
  const glow=color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.3,roughness:.45});
  const themes={hub:[0x54c7b3,0x465969,'中央大厅 / MEETING'],power:[0xffc45c,0x514e3e,'供电区 / ELECTRICAL'],lab:[0x72d9ef,0x3e5668,'实验室 / LABORATORY'],storage:[0xf19b60,0x554a42,'仓储区 / STORAGE'],comms:[0xb399f3,0x48435e,'通讯区 / COMMUNICATIONS']};
  function outlined(mesh){const lines=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),new THREE.LineBasicMaterial({color:0x0b1321}));mesh.add(lines);return mesh;}
  const block=(w,h,d,x,y,z,mat)=>outlined(box(w,h,d,x,y,z,mat));
  function light(color,x,z,power=75){const l=new THREE.PointLight(color,power*WORLD_SCALE*WORLD_SCALE,11*WORLD_SCALE,2);l.position.set(x,3.8,z);scene.add(l);}
  function floorText(text,x,z,color='#bbcbd3',width=4){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='900 92px sans-serif';ctx.textAlign='center';ctx.fillText(text,512,164);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;if(z>8)m.rotation.z=Math.PI;m.position.set(x,.085,z);scene.add(m);}
  for(const wall of partitions){block(wall.w*2,wall.h,wall.d*2,wall.x,wall.h/2,wall.z,steel);box(wall.w*2+.02,.1,wall.d*2+.02,wall.x,wall.h-.15,wall.z,material(0x8095a4));}
  box(48,.6,48,0,-.35,0,ink);
  for(let x=-22;x<=22;x+=4)for(let z=-22;z<=22;z+=4){const room=zoneAt({x:x*WORLD_SCALE,z:z*WORLD_SCALE});const outer=Math.abs(x)>18||Math.abs(z)>18;const color=new THREE.Color(themes[room][1]).multiplyScalar(outer?.47:1);box(3.92,.06,3.92,x,.015,z,material(color));}
  for(const [room,p] of Object.entries(centers)){
    const [accent,,name]=themes[room],lit=glow(accent),paint=material(accent);
    const sign=label(name,`#${accent.toString(16).padStart(6,'0')}`,5.4);sign.position.set(p.x,3.3,p.z+(p.z>0?5:-5));scene.add(sign);
    light(accent,p.x,p.z,room==='hub'?150:110);
    floorText(room==='hub'?'MEETING':room.toUpperCase(),p.x,p.z+1,`#${accent.toString(16).padStart(6,'0')}`,room==='hub'?5:4);
    if(room==='hub')continue;
    const sx=Math.sign(p.x),sz=Math.sign(p.z);
    // Cutaway hull: broad cartoon panels, dark seams and colored safety rails.
    for(let i=-5;i<=5;i+=2.5){
      block(2.4,3.2,.32,p.x+i,1.6,p.z+sz*8,steel);
      block(.32,3.2,2.4,p.x+sx*8,1.6,p.z+i,steel);
      box(2.1,.12,.36,p.x+i,2.5,p.z+sz*7.98,paint);
      box(.36,.12,2.1,p.x+sx*7.98,2.5,p.z+i,paint);
    }
    // Illuminated doorway markings and dark outer service aisles stay walkable.
    for(let i=-2;i<=2;i++)box(.5,.035,.45,p.x+i*.65,.08,p.z-sz*5, i%2?ink:paint);
    box(5,.04,.09,p.x,.08,p.z-sz*5.4,lit);
    for(let i=-4;i<=4;i+=2){box(.07,.04,.7,p.x-sx*5.6,.09,p.z+i,lit);}
    const warning=label('维护通道 · 弱光','#7d8b9a',3);warning.position.set(p.x+sx*5,1.9,p.z+sz*6.7);scene.add(warning);
    // Low floor grilles read as service access, without suggesting usable vents.
    box(1.7,.06,1.1,p.x+sx*5,.07,p.z+sz*5,ink);
    for(let i=0;i<6;i++)box(1.5,.025,.06,p.x+sx*5,.115,p.z+sz*5-.4+i*.16,steel);
    if(room==='power'){
      for(let i=0;i<3;i++){const x=-18+i*2;outlined(cylinder(.72,.8,2.5,x,1.25,-17,steel));cylinder(.74,.74,.3,x,1.6,-17,lit);cylinder(.82,.82,.2,x,2.5,-17,ink);block(.65,.5,.15,x,1,-16.2,ink);box(.4,.16,.035,x,1.08,-16.11,lit);for(let j=0;j<3;j++)box(.1,.06,2,x+(j-1)*.22,.08,-19,paint);}
      floorText('HIGH VOLTAGE',-15,-15,'#ffc45c',5);
    }
    if(room==='lab')for(let i=0;i<2;i++){
      const z=-17+i*4;block(3,1,1.3,16,.5,z,white);block(3.1,.13,1.4,16,1.06,z,ink);
      for(let j=0;j<3;j++){cylinder(.18,.22,.55,15.1+j*.7,1.4,z,glow(j===1?0x9be3a0:0x7ccfe5));cylinder(.22,.22,.07,15.1+j*.7,1.7,z,ink);}
      box(2.7,.08,.04,16,.8,z+.67,lit);
    }
    if(room==='storage')for(let i=0;i<5;i++){
      const x=-17+i%3*1.6,z=16+Math.floor(i/3)*1.6,h=i%2?2.5:1.5;
      block(1.4,h,1.4,x,h/2,z,material(i%2?0xc28b54:0x537d7b));
      for(const dx of [-.48,.48])box(.13,h+.04,1.44,x+dx,h/2,z,ink);
      box(.65,.3,.035,x,h*.65,z-.72,white);
      if(i===0)floorText('CARGO',-14,12,'#f1ae77',4);
    }
    if(room==='comms')for(let i=0;i<3;i++){
      const x=11+i*2;block(1.4,3.1,.8,x,1.55,18,ink);
      for(let j=0;j<5;j++){block(1.2,.4,.05,x,.4+j*.52,17.57,steel);box(.62,.06,.03,x-.14,.42+j*.52,17.53,lit);box(.09,.09,.03,x+.42,.42+j*.52,17.53,glow(0x84dcab));}
    }
  }
  // Recognizable emergency table, thick silhouette and a red physical button.
  outlined(cylinder(1.5,1.8,.35,0,.2,-3,ink));cylinder(.9,1.1,1,0,.8,-3,steel);
  outlined(cylinder(1.65,1.65,.22,0,1.32,-3,material(0x527ac8)));
  block(1,.12,.8,0,1.49,-3,white);cylinder(.28,.32,.2,0,1.63,-3,glow(0xee5961));
  floorText('EMERGENCY',0,-.6,'#f3d5a3',3.6);
  const hologram=new THREE.Mesh(new THREE.IcosahedronGeometry(.5,0),new THREE.MeshBasicMaterial({color:0x69e2cf,wireframe:true}));hologram.position.set(0,2.3,-3);scene.add(hologram);
  for(let z=-20;z<=20;z+=4)for(const x of [-6,6])box(.1,.05,1.4,x,.1,z,glow(0x4d9b9e));
  for(let x=-20;x<=20;x+=4)for(const z of [-6,6])box(1.4,.05,.1,x,.1,z,glow(0x4d9b9e));
  return hologram;
}
