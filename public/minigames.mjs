import {validPuzzle} from '/src/puzzles.mjs';
export function createMinigames(dialog,{submit,cancel}){
 let puzzle=null,answer=[],selected=null,locked=false,preview=false,timer=null;
 const symbols=['●','▲','■','◆','★','⬟'],colors=['#ff6578','#ffd45b','#66a8ff','#e37be6','#68e0bd','#ffae61'];
 const body=dialog.querySelector('.puzzle-body'),hint=dialog.querySelector('.puzzle-hint');
 const levelNames=['入门','进阶','挑战'];
 function check(){
  if(locked||preview||!puzzle)return;
  const ok=validPuzzle(puzzle,answer);submit([...answer],puzzle.id);
  if(ok){locked=true;hint.textContent='✓ 完成，正在同步…';dialog.classList.add('solved');}
  else {hint.textContent='答案未匹配，请重试。连续失败 3 次会调整难度。';if(['sequence','memory'].includes(puzzle.mode)){answer=[];drawProgress();}}
 }
 function drawProgress(){const el=body.querySelector('.puzzle-progress');if(el)el.textContent=`已输入 ${answer.length} / ${puzzle.answer.length} 步`;}
 function drawWires(){
  body.querySelectorAll('[data-left]').forEach(b=>{const i=+b.dataset.left;b.classList.toggle('chosen',selected===i);b.classList.toggle('connected',answer[i]!==null);b.setAttribute('aria-pressed',String(selected===i));});
  body.querySelectorAll('[data-right]').forEach(b=>b.classList.toggle('connected',answer.includes(+b.dataset.right)));
  const n=answer.length;body.querySelector('svg').innerHTML=answer.map((r,l)=>r===null?'':`<line x1="8" y1="${(l+.5)*100/n}" x2="92" y2="${(r+.5)*100/n}" stroke="${colors[l]}" stroke-width="5" vector-effect="non-scaling-stroke"/>`).join('');
  hint.textContent=`已连接 ${answer.filter(v=>v!==null).length} / ${n} · 连错可重新选择端点`;
 }
 function connect(right){if(selected===null||locked)return;const left=selected;answer=answer.map(v=>v===right?null:v);answer[left]=right;selected=null;drawWires();}
 function showMemory(){
  clearTimeout(timer);preview=true;answer=[];drawProgress();const clue=body.querySelector('.puzzle-clue');clue.textContent=puzzle.answer.join(' → ');hint.textContent='记住顺序，提示消失后输入。';
  body.querySelectorAll('[data-token]').forEach(b=>b.disabled=true);
  timer=setTimeout(()=>{preview=false;clue.textContent='? → ? → ?';body.querySelectorAll('[data-token]').forEach(b=>b.disabled=false);hint.textContent='按记忆依次点击，可重复点击同一项。';},puzzle.previewMs);
 }
 dialog.querySelector('.puzzle-close').addEventListener('click',()=>cancel());
 dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
 body.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-left]');if(!b||locked)return;selected=+b.dataset.left;drawWires();});
 body.addEventListener('pointerup',e=>{if(puzzle?.mode!=='wires'||locked)return;const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-right]');if(b)connect(+b.dataset.right);});
 body.addEventListener('click',e=>{
  if(locked||!puzzle)return;
  const left=e.target.closest('[data-left]'),right=e.target.closest('[data-right]'),token=e.target.closest('[data-token]'),cell=e.target.closest('[data-cell]');
  if(left){selected=+left.dataset.left;drawWires();}if(right)connect(+right.dataset.right);
  if(token&&!preview){const id=+token.dataset.token;if(puzzle.mode==='sequence'&&answer.includes(id))return;answer.push(id);drawProgress();if(answer.length===puzzle.answer.length)check();}
  if(cell){const id=+cell.dataset.cell;answer[id]=1-answer[id];cell.classList.toggle('connected',!!answer[id]);cell.setAttribute('aria-pressed',String(!!answer[id]));}
  if(e.target.closest('[data-confirm]'))check();
  if(e.target.closest('[data-reset]')){answer=[];drawProgress();hint.textContent='输入已清空。';}
  if(e.target.closest('[data-replay]'))showMemory();
 });
 body.addEventListener('input',e=>{if(locked||!e.target.matches('[data-band]'))return;answer[+e.target.dataset.band]=+e.target.value;body.querySelector(`[data-readout="${e.target.dataset.band}"]`).textContent=e.target.value;});
 return {
  open(next,title){
   clearTimeout(timer);puzzle=next;locked=false;preview=false;selected=null;
   answer=['wires','toggle','sliders'].includes(puzzle.mode)?puzzle.answer.map(()=>puzzle.mode==='wires'?null:0):[];
   dialog.classList.remove('solved');dialog.querySelector('.puzzle-title').textContent=puzzle.title;dialog.querySelector('.puzzle-subtitle').textContent=`${title} · ${levelNames[puzzle.level-1]} ${puzzle.level}/3`;
   const instructions={wires:'连接相同颜色与符号的两端，完成后确认。',sequence:'按照目标顺序依次点击，点满后自动检查。',memory:'记住短暂显示的顺序，提示消失后复现。',toggle:'根据筛选条件选择所有符合要求的项目，再确认。',sliders:'将各项数值调整到目标刻度，再确认。'};
   dialog.querySelector('.puzzle-instructions').textContent=instructions[puzzle.mode];hint.textContent='每完成 3 个任务升一档 · 连续失败 3 次降一档';
   if(puzzle.mode==='wires'){
    const right=puzzle.answer.map((_,r)=>puzzle.answer.indexOf(r));
    body.innerHTML=`<div class="wiring-board"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg><div class="wire-side">${puzzle.answer.map((_,i)=>`<button data-left="${i}" style="--wire:${colors[i]}" aria-label="左侧 ${symbols[i]}">${symbols[i]}</button>`).join('')}</div><div class="wire-side">${right.map((id,i)=>`<button data-right="${i}" style="--wire:${colors[id]}" aria-label="右侧 ${symbols[id]}">${symbols[id]}</button>`).join('')}</div></div><button class="puzzle-confirm" data-confirm>确认接线 →</button>`;
   }
   if(['sequence','memory'].includes(puzzle.mode)){
    body.innerHTML=`<div class="cargo-manifest puzzle-clue">${puzzle.answer.join(' → ')}</div><div class="cargo-grid">${Array.from({length:puzzle.options},(_,i)=>`<button data-token="${i+1}">${String(i+1).padStart(2,'0')}</button>`).join('')}</div><p class="puzzle-progress"></p><button data-reset>清空输入</button>${puzzle.mode==='memory'?'<button data-replay>重新查看顺序</button>':''}`;drawProgress();if(puzzle.mode==='memory')showMemory();
   }
   if(puzzle.mode==='toggle'){
    const labels=puzzle.room==='lab'?['异常','正常','正常']:puzzle.room==='hub'?['已授权','过期','未登记']:['能源','零件','补给'];
    body.innerHTML=`<div class="cargo-manifest">筛选条件：<b>${labels[0]}</b> · 选择所有符合项</div><div class="cargo-grid">${answer.map((_,i)=>`<button data-cell="${i}" aria-pressed="false">${String(i+1).padStart(2,'0')}<span>${labels[puzzle.labels[i]]}</span></button>`).join('')}</div><button class="puzzle-confirm" data-confirm>确认检查 →</button>`;
   }
   if(puzzle.mode==='sliders')body.innerHTML=`<div class="signal-display">╱╲╱╲╱╲<span>${puzzle.title}</span></div>${answer.map((_,i)=>`<label class="signal-band">通道 ${i+1}<b>目标 ${puzzle.answer[i]}</b><input type="range" min="0" max="100" step="${puzzle.step}" value="0" data-band="${i}" aria-label="通道 ${i+1}"><output data-readout="${i}">0</output></label>`).join('')}<button class="puzzle-confirm" data-confirm>确认校准 →</button>`;
   if(!dialog.open)dialog.showModal();body.querySelector('button,input')?.focus();
  },close(){clearTimeout(timer);if(dialog.open)dialog.close();puzzle=null;},get active(){return dialog.open;}
 };
}
