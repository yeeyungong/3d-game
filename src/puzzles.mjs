const variants={
 power:[['wires','修复线路','wires'],['switches','顺序启动开关','sequence'],['voltage','平衡电压','sliders']],
 lab:[['samples','配对样本','wires'],['reagents','记忆药剂顺序','memory'],['anomaly','找出异常样本','toggle']],
 storage:[['cargo','分类货物','toggle'],['boxes','记忆箱子位置','memory'],['route','排列运输路线','sequence']],
 comms:[['frequency','调整通讯频率','sliders'],['signal','复现信号序列','memory'],['cipher','拼接通讯密码','sequence']],
 hub:[['navigation','校准导航','sliders'],['circuit','修复大厅电路','wires'],['access','核对通行记录','toggle']]
};
export function generatePuzzle(room,level,seed,lastKind,id){
 let value=seed>>>0;const random=()=>{value+=0x6D2B79F5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const choices=variants[room].filter(v=>v[0]!==lastKind),[kind,title,mode]=choices[Math.floor(random()*choices.length)];
 level=Math.max(1,Math.min(3,level));const n=level+3;let answer,labels;
 if(mode==='wires')answer=shuffle(Array.from({length:n},(_,i)=>i));
 if(mode==='sequence')answer=shuffle(Array.from({length:n},(_,i)=>i+1));
 if(mode==='memory')answer=Array.from({length:n},()=>1+Math.floor(random()*(level+3)));
 if(mode==='sliders'){const step=[10,5,1][level-1];answer=Array.from({length:level+1},()=>step*(1+Math.floor(random()*(100/step-1))));}
 if(mode==='toggle'){
  labels=Array.from({length:level*2+4},()=>Math.floor(random()*3));labels[0]=0;labels[1]=1;labels=shuffle(labels);answer=labels.map(v=>Number(v===0));
 }
 return {id,room,kind,title,mode,level,answer,labels,step:[10,5,1][level-1],options:n,previewMs:[4500,3500,2500][level-1]};
}
export function validPuzzle(puzzle,answer){return !!puzzle&&Array.isArray(answer)&&answer.length===puzzle.answer.length&&puzzle.answer.every((v,i)=>v===answer[i]);}
