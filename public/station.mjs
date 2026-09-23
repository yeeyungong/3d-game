import * as THREE from '/vendor/three.module.js';
import {designCenters as centers,zoneAt,WORLD_SCALE,partitions} from '/src/world.mjs';

// All large equipment keeps the footprints used by world.mjs collision and navigation.
export function buildStation(world,{box:makeBox,cylinder:makeCylinder,material,label}){
  const scene=new THREE.Group();scene.scale.set(WORLD_SCALE,1,WORLD_SCALE);world.add(scene);
  const box=(...args)=>makeBox(...args,scene),cylinder=(...args)=>makeCylinder(...args,scene);
  const ink=material(0x101a29),steel=material(0x384758),white=material(0xa9bec9);
  const glow=color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.3,roughness:.45});
  const workLights=[],workMaterials=[],fans=[];
  let switchLever,switchIndicator;
  const themes={hub:[0x54c7b3,0x465969,'中央大厅 / MEETING'],power:[0xffc45c,0x514e3e,'供电区 / ELECTRICAL'],lab:[0x72d9ef,0x3e5668,'实验室 / LABORATORY'],storage:[0xf19b60,0x554a42,'仓储区 / STORAGE'],comms:[0xb399f3,0x48435e,'通讯区 / COMMUNICATIONS']};
  function outlined(mesh){const lines=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),new THREE.LineBasicMaterial({color:0x0b1321}));mesh.add(lines);return mesh;}
  const block=(w,h,d,x,y,z,mat)=>outlined(box(w,h,d,x,y,z,mat));
  function light(color,x,z,power=75){const l=new THREE.PointLight(color,power*WORLD_SCALE*WORLD_SCALE,11*WORLD_SCALE,2);l.position.set(x,3.8,z);scene.add(l);return l;}
  function floorText(text,x,z,color='#bbcbd3',width=4){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='900 92px sans-serif';ctx.textAlign='center';ctx.fillText(text,512,164);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;if(z>8)m.rotation.z=Math.PI;m.position.set(x,.085,z);scene.add(m);}
  for(const wall of partitions){block(wall.w*2,wall.h,wall.d*2,wall.x,wall.h/2,wall.z,steel);box(wall.w*2+.02,.1,wall.d*2+.02,wall.x,wall.h-.15,wall.z,material(0x8095a4));}
  box(48,.6,48,0,-.35,0,ink);
  for(let x=-22;x<=22;x+=4)for(let z=-22;z<=22;z+=4){const room=zoneAt({x:x*WORLD_SCALE,z:z*WORLD_SCALE});const outer=Math.abs(x)>18||Math.abs(z)>18;const color=new THREE.Color(themes[room][1]).multiplyScalar(outer?.47:1);box(3.92,.06,3.92,x,.015,z,material(color));}
  for(const [room,p] of Object.entries(centers)){
    const [accent,,name]=themes[room],lit=glow(accent),paint=material(accent);
    const sign=label(name,`#${accent.toString(16).padStart(6,'0')}`,5.4);sign.position.set(p.x,3.3,p.z+(p.z>0?5:-5));scene.add(sign);
    const roomLight=light(room==='power'?0xffedcc:accent,p.x,p.z,room==='power'?65:room==='hub'?150:110);
    if(room==='power')workLights.push(roomLight);
    if(room!=='power')floorText(room==='hub'?'MEETING':room.toUpperCase(),p.x,p.z+1,`#${accent.toString(16).padStart(6,'0')}`,room==='hub'?5:4);
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
      const concrete=material(0x7d8583),housing=material(0x66736e),copper=material(0xb65b22,.55),ceramic=material(0xc7c4ac),green=glow(0x6de9ac),lamp=glow(0xffefd3);
      workMaterials.push(lamp);
      // A flush concrete equipment pad and clear central maintenance aisle.
      box(10.8,.025,8.7,-14.5,.058,-15,concrete);
      for(let x=-19;x<=-10;x+=.55)box(.3,.025,.24,x,.085,-14.9,Math.round(x/.55)%2?ink:paint);
      for(let i=0;i<3;i++){
        const x=-18+i*2;
        block(1.6,.22,1.6,x,.19,-17,ink);
        block(1.3,1.7,1.25,x,1.12,-17,housing);
        for(const side of [-1,1])for(let j=0;j<6;j++)box(.13,1.3,.08,x+side*.72,1.12,-17.48+j*.19,steel);
        block(1.55,.18,1.5,x,2.04,-17,ink);
        for(const dx of [-.4,.4]){
          cylinder(.1,.1,.55,x+dx,2.39,-17,ceramic);
          for(let k=0;k<3;k++)cylinder(.18,.18,.07,x+dx,2.22+k*.15,-17,ceramic);
          cylinder(.075,.075,.16,x+dx,2.75,-17,copper);
        }
        block(.55,.4,.08,x,1.15,-16.34,ink);box(.31,.065,.03,x,1.2,-16.285,green);
        box(.3,.18,.035,x,.67,-16.29,paint);
        box(.19,.17,1.6,x,.22,-18.45,copper);
        const tag=label(`TR / 0${i+1}`,'#d9e0d5',1.1);tag.position.set(x,3.05,-17);scene.add(tag);
      }
      // Raised orange cable trunk runs behind the transformer bank.
      block(9,.22,.24,-15,.22,-19.25,copper);
      box(.22,1.1,.22,-10.6,.72,-19.25,copper);
      block(2.5,.22,4,-11,.19,-17,ink);
      block(2.25,2.1,3.7,-11,1.3,-17,housing);
      block(2.5,.18,4,-11,2.4,-17,ink);
      for(const z of [-18.05,-16.65]){
        cylinder(.61,.61,.09,-11,2.54,z,steel);cylinder(.5,.5,.08,-11,2.6,z,ink);
        const fan=new THREE.Group();fan.position.set(-11,2.68,z);scene.add(fan);
        for(let j=0;j<4;j++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.68,.035,.17),housing);blade.position.x=.25;const arm=new THREE.Group();arm.rotation.y=j*Math.PI/2;arm.add(blade);fan.add(arm);}
        fans.push(fan);cylinder(.14,.14,.12,-11,2.7,z,steel);
      }
      for(let i=0;i<3;i++){
        block(.63,1.7,.07,-11.72+i*.72,1.3,-15.12,steel);
        box(.38,.09,.04,-11.72+i*.72,1.9,-15.06,green);
        for(let j=0;j<5;j++)box(.4,.035,.035,-11.72+i*.72,.7+j*.13,-15.05,ink);
      }
      // Work lights switch off; green equipment status and amber guidance remain.
      for(const [x,z] of [[-19,-15.3],[-9.4,-15.3]]){
        box(.13,2.9,.13,x,1.45,z,ink);block(.25,.65,.22,x,2.65,z,steel);box(.27,.48,.05,x,2.65,z+.13,lamp);
        const l=light(0xffefd3,x,z,30);l.position.y=2.7;workLights.push(l);
      }
      block(.9,1.5,.7,-11,.83,-11,steel);block(.78,.95,.08,-11,1.03,-10.61,ink);
      switchIndicator=box(.46,.1,.04,-11,1.36,-10.55,green.clone());
      switchLever=new THREE.Group();switchLever.position.set(-11,1.02,-10.5);scene.add(switchLever);
      const handle=new THREE.Mesh(new THREE.BoxGeometry(.38,.14,.14),ceramic);handle.position.set(0,.17,.1);switchLever.add(handle);
      const switchLabel=label('照明开关 · E','#a2ffd1',2);switchLabel.position.set(-11,2.15,-11);scene.add(switchLabel);
      floorText('SERVICE AISLE',-15,-13,'#dce0cb',4);
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
  // Room-local surface response keeps the unlit bay dark without changing other rooms.
  const surfaces=[];
  for(const mesh of scene.children){
    if(!mesh.isMesh||zoneAt({x:mesh.position.x*WORLD_SCALE,z:mesh.position.z*WORLD_SCALE})!=='power'||!mesh.material.isMeshStandardMaterial||mesh.material.emissiveIntensity>1)continue;
    mesh.material=mesh.material.clone();surfaces.push({material:mesh.material,color:mesh.material.color.clone()});
  }
  const intensities=workLights.map(l=>l.intensity);let previous;
  return {update(on,now){
    hologram.rotation.y=now*.0006;hologram.position.y=2.3+Math.sin(now*.001)*.15;
    for(const fan of fans)fan.rotation.y=now*.0015;
    if(on===previous)return;previous=on;
    workLights.forEach((l,i)=>l.intensity=on?intensities[i]:intensities[i]*.025);
    workMaterials.forEach(m=>{m.emissiveIntensity=on?1.3:0;m.color.setHex(on?0xffefd3:0x343c3d);});
    surfaces.forEach(({material,color})=>material.color.copy(color).multiplyScalar(on?1:.22));
    switchLever.rotation.x=on?-.5:.5;
    switchIndicator.material.color.setHex(on?0x6de9ac:0xffb64e);switchIndicator.material.emissive.copy(switchIndicator.material.color);
  }};
}
