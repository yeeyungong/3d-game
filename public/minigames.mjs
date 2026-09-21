import {puzzleAnswers,validPuzzle} from '/src/puzzles.mjs';

export function createMinigames(dialog,{submit,cancel}){
 let room=null,answer=[],selected=null,locked=false;
 const symbols=['●','▲','■','◆'],colors=['#ff6578','#ffd45b','#66a8ff','#e37be6'];
 const titles={power:['修复线路','连接相同颜色与符号的接头。点击两端，或拖动接线。'],lab:['校准样本','按样本标签上的编号，从 1 到 4 依次扫描。'],storage:['检查能源箱','按上方货单切换对应箱体的开关，再确认装载。'],comms:['调整通讯信号','将三个频段调到目标刻度，再锁定信号。']};
 const body=dialog.querySelector('.puzzle-body'),hint=dialog.querySelector('.puzzle-hint');
 function check(){
  if(locked)return;
  if(validPuzzle(room,answer)){locked=true;hint.textContent='✓ 校准完成，正在同步…';dialog.classList.add('solved');submit([...answer]);}
  else hint.textContent='尚未匹配，请检查亮起的接头或目标数值。';
 }
 function connect(right){if(selected===null||locked)return;const left=selected;if(puzzleAnswers.power[left]!==right){hint.textContent='接头不匹配：请连接相同符号。';return;}answer[left]=right;selected=null;drawWires();if(answer.every(v=>v!==null))check();}
 function drawWires(){
  body.querySelectorAll('[data-left]').forEach(b=>{const i=+b.dataset.left;b.classList.toggle('chosen',selected===i);b.classList.toggle('connected',answer[i]!==null);b.setAttribute('aria-pressed',String(selected===i));});
  body.querySelectorAll('[data-right]').forEach(b=>b.classList.toggle('connected',answer.includes(+b.dataset.right)));
  body.querySelector('svg').innerHTML=answer.map((right,left)=>right===null?'':`<line x1="8" y1="${left*25+12.5}" x2="92" y2="${right*25+12.5}" stroke="${colors[left]}" stroke-width="5" vector-effect="non-scaling-stroke"/>`).join('');
  hint.textContent=`已连接 ${answer.filter(v=>v!==null).length} / 4 条线路`;
 }
 dialog.querySelector('.puzzle-close').addEventListener('click',()=>cancel());
 dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
 body.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-left]');if(!b||locked)return;selected=+b.dataset.left;drawWires();});
 body.addEventListener('pointerup',e=>{if(room!=='power'||locked)return;const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-right]');if(b)connect(+b.dataset.right);});
 body.addEventListener('click',e=>{
  if(locked)return;
  const left=e.target.closest('[data-left]'),right=e.target.closest('[data-right]'),sample=e.target.closest('[data-sample]'),cell=e.target.closest('[data-cell]');
  if(left){selected=+left.dataset.left;drawWires();}if(right)connect(+right.dataset.right);
  if(sample){const id=+sample.dataset.sample;if(id!==puzzleAnswers.lab[answer.length]){hint.textContent='顺序错误，扫描已重置；请从 1 号重新开始。';answer=[];body.querySelectorAll('[data-sample]').forEach(b=>b.classList.remove('connected'));return;}answer.push(id);sample.classList.add('connected');hint.textContent=`已扫描 ${answer.length} / 4 个样本`;if(answer.length===4)check();}
  if(cell){const id=+cell.dataset.cell;answer[id]=1-answer[id];cell.classList.toggle('connected',!!answer[id]);cell.setAttribute('aria-pressed',String(!!answer[id]));}
  if(e.target.closest('[data-confirm]'))check();
 });
 body.addEventListener('input',e=>{if(locked||!e.target.matches('[data-band]'))return;answer[+e.target.dataset.band]=+e.target.value;body.querySelector(`[data-readout="${e.target.dataset.band}"]`).textContent=e.target.value;});
 return {
  open(nextRoom,title){room=nextRoom;locked=false;selected=null;answer=room==='power'?[null,null,null,null]:room==='storage'?[0,0,0,0,0,0]:room==='comms'?[0,0,0]:[];dialog.classList.remove('solved');dialog.querySelector('.puzzle-title').textContent=titles[room][0];dialog.querySelector('.puzzle-subtitle').textContent=title;dialog.querySelector('.puzzle-instructions').textContent=titles[room][1];hint.textContent='等待操作';
   if(room==='power')body.innerHTML=`<div class="wiring-board"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg><div class="wire-side">${symbols.map((symbol,i)=>`<button data-left="${i}" style="--wire:${colors[i]}" aria-label="左侧 ${symbol}" aria-pressed="false">${symbol}</button>`).join('')}</div><div class="wire-side">${[1,3,0,2].map((id,i)=>`<button data-right="${i}" style="--wire:${colors[id]}" aria-label="右侧 ${symbols[id]}">${symbols[id]}</button>`).join('')}</div></div>`;
   if(room==='lab')body.innerHTML=`<div class="sample-board">${[1,2,3,4].map((id,i)=>`<button data-sample="${id}" style="--sample:${colors[i]}" aria-label="扫描 ${puzzleAnswers.lab.indexOf(id)+1} 号样本"><i></i><b>${String(puzzleAnswers.lab.indexOf(id)+1).padStart(2,'0')}</b></button>`).join('')}</div><div class="scanner-rail">SAMPLE ANALYSIS / 样本扫描仪</div>`;
   if(room==='storage')body.innerHTML=`<div class="cargo-manifest">装载货单 <b>01 · 03 · 05</b></div><div class="cargo-grid">${answer.map((_,i)=>`<button data-cell="${i}" aria-pressed="false">▣<span>箱体 ${String(i+1).padStart(2,'0')}</span></button>`).join('')}</div><button class="puzzle-confirm" data-confirm>确认装载 →</button>`;
   if(room==='comms')body.innerHTML=`<div class="signal-display">╱╲╱╲╱╲╱╲<span>SIGNAL CALIBRATION</span></div>${answer.map((_,i)=>`<label class="signal-band">频段 ${'ABC'[i]} <b>目标 ${puzzleAnswers.comms[i]}</b><input type="range" min="0" max="100" step="5" value="0" data-band="${i}" aria-label="频段 ${'ABC'[i]}"><output data-readout="${i}">0</output></label>`).join('')}<button class="puzzle-confirm" data-confirm>锁定信号 →</button>`;
   if(!dialog.open)dialog.showModal();body.querySelector('button,input')?.focus();
  },close(){if(dialog.open)dialog.close();room=null;},get active(){return dialog.open;}
 };
}
