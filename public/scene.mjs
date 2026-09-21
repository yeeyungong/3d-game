import {buildStation} from '/station.mjs';
import * as THREE from '/vendor/three.module.js';
import {centers,spawnPoint,zoneAt,movePosition,findPath,WORLD_LIMIT,nearestTarget} from '/src/world.mjs';

const palette=[0xef5968,0x42cbbb,0xa786ed,0xffac52,0x4e9eeb,0xa8d965,0xed88c2,0x9ad5ee];
export function createWorld(container,{getState,getActor,onRoomChange,onWalk,canMove,onInput=()=>{}}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D研究站：点击地面行走，WASD移动，拖动旋转镜头');
  container.prepend(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x172731);scene.fog=new THREE.Fog(0x172731,26,62);
  const camera=new THREE.PerspectiveCamera(48,1,.1,120);
  const hemi=new THREE.HemisphereLight(0xa9c4ec,0x152133,.65);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xd2def4,1.05);sun.position.set(-12,28,15);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:80});sun.shadow.bias=-.0005;scene.add(sun);
  const rim=new THREE.DirectionalLight(0x7cbacc,.35);rim.position.set(15,10,-20);scene.add(rim);
  const material=(color,metalness=.15,roughness=.75)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const steel=material(0x314957),dark=material(0x182b36),edge=material(0x54727d),glass=new THREE.MeshStandardMaterial({color:0x7acbd1,emissive:0x2b8b91,emissiveIntensity:.55,roughness:.25,metalness:.35});
  function box(w,h,d,x,y,z,mat=steel,parent=scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function cylinder(r1,r2,h,x,y,z,mat,parent=scene){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,10),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function label(text,color='#e8eadf',width=4){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#152731cc';ctx.beginPath();ctx.roundRect(6,8,500,112,15);ctx.fill();ctx.font='600 40px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,64);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:true}));sprite.scale.set(width,width/4,1);return sprite;
  }
  const hologram=buildStation(scene,{box,cylinder,material,label});
  // Humans have separate head, torso, arms, hands, legs and boots, articulated for walking.
  function human(index,name){
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);
    const suit=material(palette[index]),pants=material(0x263c4b),skin=material([0xd9ad89,0xbd8b67,0xe0bb99,0xc99a7e][index%4]),hair=material([0x342d2a,0x332920,0x51463c][index%3]);
    box(.64,.73,.38,0,1.2,0,suit,body);box(.46,.5,.06,0,1.22,.22,dark,body);box(.11,.1,.07,.13,1.36,.26,glass,body);
    box(.58,.19,.4,0,.79,0,pants,body);cylinder(.11,.12,.16,0,1.63,0,skin,body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),skin);head.scale.set(.87,1.1,.9);head.position.set(0,1.87,0);head.castShadow=true;body.add(head);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.233,12,8,0,Math.PI*2,0,Math.PI*.56),hair);cap.position.set(0,1.9,0);cap.scale.set(.92,1.1,.95);body.add(cap);
    for(const x of [-.07,.07])box(.036,.026,.025,x,1.88,.196,dark,body);
    box(.04,.07,.055,0,1.83,.208,skin,body);
    const limbs=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.43,1.47,0);body.add(arm);
      box(.19,.4,.22,0,-.17,0,suit,arm);box(.15,.29,.17,0,-.49,.015,skin,arm);box(.17,.17,.16,0,-.69,.015,skin,arm);limbs.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.18,.76,0);body.add(leg);
      box(.23,.57,.25,0,-.27,0,pants,leg);box(.25,.16,.4,0,-.64,.055,dark,leg);limbs.push(leg);
    }
    const badge=label(`${String(index+1).padStart(2,'0')}  ${name}`,'#e8eadf',1.7);badge.position.set(0,2.45,0);root.add(badge);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.52,.59,40),new THREE.MeshBasicMaterial({color:0xe8b765,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.11;root.add(ring);
    scene.add(root);return {root,body,limbs,ring,badge,name,position:spawnPoint('hub',index),room:'hub',angle:Math.PI,walk:0};
  }
  const people=getState().players.map((p,i)=>human(i,p.name));
  const keys=new Set(),taps=new Map();let touch={x:0,z:0},yaw=0,distance=8.5,pitch=.48,drag=null,destination=null,route=[],actorBefore='',positionText='';
  const targetRing=new THREE.Mesh(new THREE.RingGeometry(.25,.35,24),new THREE.MeshBasicMaterial({color:0xe8b765,side:THREE.DoubleSide}));targetRing.rotation.x=-Math.PI/2;targetRing.position.y=.15;targetRing.visible=false;scene.add(targetRing);
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  function clearInput(){keys.clear();taps.clear();touch={x:0,z:0};destination=null;route=[];targetRing.visible=false;}
  function navigateTo(point){
    route=findPath(people[Number(getActor().slice(1))-1].position,point);destination=route.shift()||null;
    targetRing.position.set(point.x,.15,point.z);targetRing.visible=!!destination;
  }
  renderer.domElement.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);if(!e.repeat)taps.set(e.code,performance.now()+120);destination=null;route=[];targetRing.visible=false;}});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);
  renderer.domElement.addEventListener('blur',()=>{keys.clear();taps.clear();});
  renderer.domElement.addEventListener('pointerdown',e=>{renderer.domElement.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};renderer.domElement.setPointerCapture(e.pointerId);});
  renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6)drag.moved=true;if(drag.moved){yaw-=dx*.006;pitch=THREE.MathUtils.clamp(pitch+dy*.004,.18,1.15);}drag.x=e.clientX;drag.y=e.clientY;});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(drag&&!drag.moved&&canMove()){
      const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
      if(ray.ray.intersectPlane(plane,hit)&&Math.abs(hit.x)<=WORLD_LIMIT&&Math.abs(hit.z)<=WORLD_LIMIT)navigateTo({x:hit.x,z:hit.z});
    }drag=null;
  });
  renderer.domElement.addEventListener('pointercancel',()=>{drag=null;});
  renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.008,4,19);},{passive:false});
  for(const button of container.querySelectorAll('[data-walk]')){
    button.addEventListener('pointerdown',e=>{e.preventDefault();const dir=button.dataset.walk;touch={x:dir==='left'?-1:dir==='right'?1:0,z:dir==='up'?-1:dir==='down'?1:0};destination=null;button.setPointerCapture(e.pointerId);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{touch={x:0,z:0};});
  }
  const resize=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(container);
  const follow=new THREE.Vector3();
  const combatTarget=()=>nearestTarget(getState().players.map((p,i)=>({...p,position:people[i].position})),getActor());
  function update(dt,now){
    const state=getState(),actor=getActor(),selected=people[Number(actor.slice(1))-1];
    if(actorBefore!==actor){clearInput();actorBefore=actor;follow.set(selected.position.x,1.25,selected.position.z);}
    for(let i=0;i<people.length;i++){
      const h=people[i],p=state.players[i];
      if(h.name!==p.name){const replacement=label(`${String(i+1).padStart(2,'0')}  ${p.name}`,'#e8eadf',1.7);replacement.position.copy(h.badge.position);h.root.remove(h.badge);h.badge.material.map.dispose();h.badge.material.dispose();h.badge=replacement;h.root.add(replacement);h.name=p.name;}
      if(state.network&&p.position){const dx=p.position.x-h.position.x,dz=p.position.z-h.position.z;h.remoteWalking=Math.hypot(dx,dz)>.025;if(h.remoteWalking)h.angle=Math.atan2(dx,dz);const a=1-Math.exp(-dt*20);h.position={x:h.position.x+dx*a,z:h.position.z+dz*a};h.room=p.room;}
      else if(h.room!==p.room){h.position=spawnPoint(p.room,i);h.room=p.room;}
      h.ring.visible=p.id===actor&&p.alive;
      if(!p.alive){h.body.rotation.z=Math.PI/2;h.body.position.y=.15;}else{h.body.rotation.z=0;h.body.position.y=0;}
    }
    let walking=false;
    if(canMove()){
      const held=code=>keys.has(code)||(taps.get(code)||0)>now;
      const ix=Number(held('KeyD')||held('ArrowRight'))-Number(held('KeyA')||held('ArrowLeft'))+touch.x;
      const iz=Number(held('KeyS')||held('ArrowDown'))-Number(held('KeyW')||held('ArrowUp'))+touch.z;
      let input={x:ix*Math.cos(yaw)+iz*Math.sin(yaw),z:-ix*Math.sin(yaw)+iz*Math.cos(yaw)};
      if(destination){input={x:destination.x-selected.position.x,z:destination.z-selected.position.z};if(Math.hypot(input.x,input.z)<.12){destination=route.shift()||null;targetRing.visible=!!destination;input={x:0,z:0};}}
      if(state.network)onInput(input,keys.has('ShiftLeft')||keys.has('ShiftRight'));
      else if(Math.hypot(input.x,input.z)>.01){
        const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
        const next=movePosition(selected.position,input,destination?Math.min(dt,Math.hypot(input.x,input.z)/(sprint?6.5:3.5)):dt,sprint);
        walking=Math.hypot(next.x-selected.position.x,next.z-selected.position.z)>.001;
        if(walking){selected.position=next;selected.angle=Math.atan2(input.x,input.z);onWalk();const room=zoneAt(next);if(room!==selected.room){selected.room=room;onRoomChange(room);}}
      }
    }else {clearInput();if(state.network)onInput({x:0,z:0},false);}
    const targetId=combatTarget();
    for(let i=0;i<people.length;i++){
      people[i].ring.visible=state.players[i].alive&&(people[i]===selected||state.players[i].id===targetId);
      people[i].ring.material.color.setHex(people[i]===selected?0xe8b765:0xef5968);
      const h=people[i],isWalking=state.network?h.remoteWalking:h===selected&&walking;h.walk+=dt*(isWalking?10:0);
      h.root.position.set(h.position.x,0,h.position.z);h.root.rotation.y=h.angle;
      const swing=isWalking?Math.sin(h.walk)*.65:0;
      h.limbs[0].rotation.x=swing;h.limbs[1].rotation.x=-swing;h.limbs[2].rotation.x=-swing;h.limbs[3].rotation.x=swing;
      if(state.players[i].alive)h.body.position.y=isWalking?Math.abs(Math.sin(h.walk))*.035:Math.sin(now*.0015+i)*.013;
    }
    follow.lerp(new THREE.Vector3(selected.position.x,1.25,selected.position.z),1-Math.exp(-dt*7));
    camera.position.set(follow.x+Math.sin(yaw)*distance*Math.cos(pitch),follow.y+distance*Math.sin(pitch),follow.z+Math.cos(yaw)*distance*Math.cos(pitch));camera.lookAt(follow);
    hologram.rotation.y=now*.0006;hologram.position.y=2.3+Math.sin(now*.001)*.15;
    renderer.render(scene,camera);
    const text=`${selected.position.x.toFixed(1)}, ${selected.position.z.toFixed(1)}`;
    if(text!==positionText){container.querySelector('.world-position').textContent=`位置 ${text}`;positionText=text;}
  }
  return {update,combatTarget,navigate(room){if(!canMove())return;yaw=centers[room].z>0?Math.PI:0;navigateTo(centers[room]);renderer.domElement.focus({preventScroll:true});},reset(){people.forEach((h,i)=>{h.position=spawnPoint('hub',i);h.room='hub';});actorBefore='';clearInput();},focus(){renderer.domElement.focus();}};
}
