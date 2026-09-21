# 无怪物规则试玩原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. If the user selects delegated execution, use superpowers:subagent-driven-development instead.

**Goal:** 制作一个可操作的本地浏览器规则原型，验证 8 人身份转换、任务能量、会议淘汰及胜负完整循环。

**Architecture:** 纯规则模块拥有唯一状态，页面通过 action 调用规则模块，不能直接改变玩家身份。单独的测试控制台允许设计者模拟其他玩家行为，始终显著标注“本地规则原型 · 模拟玩家”；不声称存在真实联网。

**Tech Stack:** JavaScript ES Modules、HTML、CSS、Node 内置测试与静态 HTTP 服务，无第三方运行依赖。

**Spec:** docs/superpowers/specs/2026-09-21-no-monsters-game-design.md

## Global Constraints

- 开局 7 好人与 1 原始内鬼。
- 原始内鬼整局最多成功转换 2 人，第一次开局可用，第二次通过秘密任务解锁。
- 只有原始内鬼能转换；公共界面不显示内鬼人数。
- 不设置怪物、Boss、PvE、英雄职业。
- 能量由全队共享，上限 100。
- 只有获得超过全部存活玩家一半票数的玩家才会被淘汰。
- 存活内鬼为零：好人获胜。否则，存活好人不超过 2：内鬼获胜。

## Scope and delivery

完整游戏包含多个系统，本计划只交付可独立运行与测试的规则原型。原型呈现研究站分区示意、私人身份面板、任务交互、转换引导、会议和结算。探索通过点击相邻房间模拟，战斗通过明确的攻击操作模拟。七名其他玩家由设计者在模拟面板控制，不添加伪装为真人的自动发言。

后续单独计划制作真正的第三人称 3D 移动、空间碰撞、越肩摄像机、道具、秘密任务环境痕迹、服务器权威联机、文字聊天与断线恢复。本阶段不能作为 3D 联机游戏完成的证明，也不验证依赖真实玩家沟通的平衡结论。

此分期是制作建议，等待用户审阅；不改变正式设计里的最终游戏目标。

## Review Focus

1. 连点或重复提交同一任务不能重复奖励：任务 2 测试冷却和唯一操作状态。
2. 会议开始与转换结束处于同一时刻不能产生两次生效：任务 3 测试会议中取消引导。
3. 被投出的原始内鬼仍有队友时不得结束：任务 4 测试继续对局与机会失效。
4. 活人数量变化后不能使用旧投票分母：任务 4 以会议存活快照计算票数。
5. 重开不能残留旧计时器、身份或会议票数：任务 5 采用单一时钟与完整替换状态，任务 6 手动复验。

## File structure

- package.json：start、test 命令，声明 ES Modules。
- server.mjs：只提供项目公开静态目录与规则模块，监听本机，拒绝路径越界。
- src/rules.mjs：初始状态、action 转移、时钟、判胜。
- src/views.mjs：把权威状态转换成单个玩家可见的数据。
- tests/rules.test.mjs：规则边界与完整流程测试。
- tests/views.test.mjs：私人信息投影测试。
- public/index.html：启动、探索、会议、结果与模拟控制台容器。
- public/style.css：研究站控制台视觉与窄屏布局。
- public/app.mjs：输入、时钟、渲染与无障碍焦点处理。
- README.md：运行方式、原型限制与手动验收步骤。

## Shared interfaces

```js
// src/rules.mjs
export function createGame({ originalId = 'p1' } = {}) {}
export function reduce(state, action) {} // 返回新状态；无效操作返回原状态
export function outcome(players) {} // 'good' | 'traitor' | null
// src/views.mjs
export function playerView(state, viewerId) {}
```

状态结构固定：

```js
const state = {
  now: 0, phase: 'explore', winner: null, energy: 0,
  players: [], // { id, name, role:'good'|'original'|'converted', alive, hp, room }
  corruption: { used: 0, steps: 0, readyAt: 15000, channel: null },
  taskReadyAt: {},
  taskChannel: null,
  meeting: null, // { aliveIds, stage:'discuss'|'vote', endsAt, votes }
  protectionUntil: 15000,
  log: [] // 仅设计者模拟面板可查看完整事件
};
```

所有时间为从本局开始计算的毫秒。`reduce` 不读取真实系统时间。`TICK` 使用单调递增的绝对时间，向后时间无效。每个 action 执行后只调用一次判胜，终局拒绝后续 action。

动作定义：`TICK {now}`、`MOVE {actorId,room}`、`START_TASK {actorId,taskId}`、`START_SECRET {actorId}`、`START_CORRUPT {actorId,targetId}`、`ATTACK {actorId,targetId}`、`START_MEETING {actorId}`、`VOTE {actorId,targetId}`；跳过票 `targetId:null`。

房间标识：hub、power、lab、storage、comms。邻接关系为中央连四区，外环 power-lab-comms-storage-power。原型中同房间代表满足距离和视线，页面必须说明这一简化。

## Task 1: 建立可测试的初始状态与胜负核心

**Files:** Create package.json, src/rules.mjs, tests/rules.test.mjs.

**Interfaces:** Produces createGame、outcome、reduce 基础实现；玩家 ID 固定 p1–p8。

- [ ] 写入基础测试：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, reduce, outcome } from '../src/rules.mjs';
test('initial roles and victory', () => {
  const s = createGame();
  assert.equal(s.players.filter(p => p.role === 'good').length, 7);
  assert.equal(outcome(s.players), null);
  assert.equal(outcome(s.players.map(p => ({...p, alive:p.role==='good'}))), 'good');
  assert.equal(outcome(s.players.map((p,i) => ({...p, alive:i<3}))), 'traitor');
});
```

- [ ] 运行 `node --test tests/rules.test.mjs`，确认因缺少规则导出而失败。
- [ ] 实现状态初始化和判胜，保留所有输入对象不变：

```js
export function outcome(players) {
  const live = players.filter(p => p.alive);
  if (!live.some(p => p.role !== 'good')) return 'good';
  return live.filter(p => p.role === 'good').length <= 2 ? 'traitor' : null;
}
```

- [ ] 创建 package.json：`{"type":"module","scripts":{"test":"node --test","start":"node server.mjs"}}`。
- [ ] 重跑测试，要求全部通过。只有目录已初始化 Git 时才提交本任务；不要为了记录计划擅自创建仓库。

## Task 2: 任务与资源循环

**Files:** Modify src/rules.mjs, tests/rules.test.mjs.

**Interfaces:** Implements MOVE、TICK、START_TASK；任务 `power-calibration` 在 power 房间，完成需 12000ms，奖励 15，完成后 60000ms 冷却。

- [ ] 增加奖励唯一性测试：

```js
test('task completes once and cannot restart during cooldown', () => {
  let s = createGame();
  s = reduce(s, {type:'MOVE',actorId:'p2',room:'power'});
  s = reduce(s, {type:'START_TASK',actorId:'p2',taskId:'power-calibration'});
  s = reduce(s, {type:'TICK',now:12000});
  assert.equal(s.energy,15);
  s = reduce(s, {type:'START_TASK',actorId:'p2',taskId:'power-calibration'});
  s = reduce(s, {type:'TICK',now:24000});
  assert.equal(s.energy,15);
});
```

- [ ] 运行测试并确认新增用例失败。
- [ ] 用任务配置表实现交互、完成与冷却：

```js
const tasks = {
  'power-calibration': {room:'power',duration:12000,reward:15,cooldown:60000},
  'lab-calibration': {room:'lab',duration:12000,reward:15,cooldown:60000},
  'storage-cache': {room:'storage',duration:3000,reward:5,cooldown:90000},
  'comms-cache': {room:'comms',duration:3000,reward:5,cooldown:90000}
};
// 完成时 energy = Math.min(100, energy + task.reward)
// 移动、受伤、死亡或会议开始取消 taskChannel，不奖励。
```

- [ ] 增加能量上限断言 `assert.equal(reduce({...createGame(),energy:100},{type:'TICK',now:1}).energy,100)`，运行全部测试。原型仅实现上述单人任务；运输与双人交互留在后续空间玩法计划，不使用假的完成动画冒充实现。

## Task 3: 转换与秘密任务

**Files:** Modify src/rules.mjs, tests/rules.test.mjs.

**Interfaces:** Implements START_SECRET、START_CORRUPT；仅原始内鬼按 power、lab、comms 顺序完成 8000、6000、10000ms 引导。公开面板不显示秘密进度。

- [ ] 增加第一次转换及被转换者不能感染测试：

```js
test('original converts but converted player cannot', () => {
  let s = reduce(createGame(),{type:'TICK',now:15000});
  s = reduce(s,{type:'START_CORRUPT',actorId:'p1',targetId:'p2'});
  s = reduce(s,{type:'TICK',now:20000});
  assert.equal(s.players.find(p=>p.id==='p2').role,'converted');
  assert.equal(s.corruption.used,1);
  s = reduce(s,{type:'START_CORRUPT',actorId:'p2',targetId:'p3'});
  assert.equal(s.corruption.channel,null);
});
```

- [ ] 运行测试，确认新增用例失败。
- [ ] 采用明确上限计算执行条件：

```js
const availableTotal = 1 + Number(state.corruption.steps === 3);
const available = state.corruption.used < availableTotal;
// 验证 original、alive、同房间、目标 good、now>=readyAt、无保护及 explore。
// 引导完成 used += 1，readyAt = now + 45000。
// 移动或受伤中断后 readyAt = now + 10000。
```

- [ ] 使用 fixtures 构造合法的满能量引导状态，断言会议开始后 `corruption.channel === null`；推进 5000ms 后目标仍是 good。测试第二机会未解锁不能使用、用满两次不能再使用、原始内鬼死亡后不能使用。每种条件都检查 `used` 和目标 role，运行全部测试。

## Task 4: 攻击、会议与终局

**Files:** Modify src/rules.mjs, tests/rules.test.mjs.

**Interfaces:** Implements ATTACK、START_MEETING、VOTE；原型会议终端需在 hub，引导 3000ms；讨论 60000ms，投票 20000ms，返回保护 5000ms。状态增加 `attackReadyAt:{}` 和 `meetingChannel:null`。

- [ ] 增加过半与原始内鬼出局不提前获胜测试：

```js
test('a surviving converted player keeps the game running', () => {
  const s = createGame();
  s.players[0].alive = false;
  s.players[1].role = 'converted';
  assert.equal(outcome(s.players),null);
});
test('strict majority threshold', () => {
  assert.equal(Math.floor(6/2)+1,4);
  assert.equal(Math.floor(5/2)+1,3);
});
```

- [ ] 以真实 meeting 状态再构造六名存活玩家的两次结算：p2 分别收到 3 票与 4 票，推进投票终点后分别断言 alive 为 true、false；不能只依赖上面的公式测试。
- [ ] 实现同房间攻击 25 伤害、800ms 冷却、保护与会议期间拒绝伤害。死亡后中断所有关联引导并检查胜负。
- [ ] 会议开始保存 aliveIds 并取消其他引导。阶段转换逻辑使用绝对截止时间；超大一次 TICK 也按原定截止时间处理，不额外延长阶段。

```js
const requiredVotes = Math.floor(state.meeting.aliveIds.length/2)+1;
// votes 每位 ID 一个槽，修改覆盖；非法目标拒绝；结算只遍历 aliveIds。
// 达到 requiredVotes 才淘汰；无论是否淘汰，energy 已在会议开始扣除。
```

- [ ] 补上重复投票覆盖、死亡者投票无效、终局后 action 不变、最后内鬼死亡好人获胜的测试并运行全套。

## Task 5: 可操作界面与信息分离

**Files:** Create public/index.html, public/style.css, public/app.mjs, src/views.mjs, tests/views.test.mjs, server.mjs.

**Interfaces:** playerView(state,viewerId) 输出 `{phase,winner,energy,aliveCount,self,players,corruption,meeting}`；players 只含公开姓名、存活状态及原型所需房间，不含其他玩家 role。内鬼可见同阵营标记。只有原始内鬼收到 corruption。

- [ ] 写私人信息投影测试，先运行确认失败：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/rules.mjs';
import {playerView} from '../src/views.mjs';
test('good view hides other roles and secret progress',()=>{
  const v=playerView(createGame(),'p2');
  assert.equal(v.corruption,null);
  assert.ok(v.players.every(p=>!Object.hasOwn(p,'role')));
  assert.equal(v.aliveCount,8);
});
```

- [ ] 实现独立玩家视图。原型完整状态仍在本地，README 必须说明投影测试不能替代服务器数据隔离。
- [ ] 实现主界面：顶部显示标题、原型标识、能量与存活人数；中央研究站五房间示意；左侧当前玩家身份与目标；右侧所在房间可用动作；底部最近可见事件。另设可展开“模拟控制台”，切换被控制玩家，设置其他玩家投票，不在普通面板展示全部身份。
- [ ] 采用深蓝灰背景、暖白文字、琥珀能量提示、紫色侵蚀状态。用图形与姓名同时标识玩家。初始视图有“开始试玩”按钮及三步说明，无怪物相关图案或文字。
- [ ] 输入与时钟统一经过 dispatcher，重开只替换 state：

```js
let state=createGame();
let elapsed=0;
function dispatch(action){state=reduce(state,action);render();}
// 一个 requestAnimationFrame 循环累计 elapsed，调用 TICK；
// 重开重置 elapsed、state、选中玩家、旧面板状态，不创建第二个循环。
```

- [ ] 为交互按钮设置真实 disabled 原因；会议面板管理键盘焦点，结果出现后焦点移至重开按钮；动态消息用 aria-live。
- [ ] 静态服务监听 127.0.0.1:4173，仅路由 public 目录与 `/src/` 的规则、视图模块；解码路径后验证解析结果位于允许目录，未知路径返回 404，禁止目录列表。
- [ ] 运行 `npm test`，随后 `npm start` 并验证首页可访问、所有动作可用、没有控制台异常。

## Task 6: 完整对局验收与交付

**Files:** Modify README.md, tests/rules.test.mjs; fixes stay in owning modules.

- [ ] 写一个完整流程测试：开始→等待保护结束→转换第一人→好人任务累积100→开会→原始内鬼被投出→局势继续→最后被转换者死亡→好人获胜。用每步的阵营、能量、阶段断言验证，不跳过中间状态。
- [ ] 再测试三名好人时成功转换一名会立刻结束为内鬼胜利；结束后不能重新投票或继续任务。
- [ ] 运行 `npm test`，所有测试通过后再做浏览器验收。
- [ ] 在桌面与窄屏各检查一次：开始、移动、任务奖励、转换中断、会议投票、结算、连续重开三次。确认窄屏可滚动且按钮不被遮挡。
- [ ] README 写明两条运行命令、模拟控制台用途、设计文档位置，以及尚未提供真实3D/联网/语音/空间距离判定。提交交付说明时报告实际测试结果，不推断多人平衡已成立。

## Self-review result

本计划覆盖设计文档中的身份、资源、会议、胜负和部分任务，形成一个可运行的独立规则验证工具。完整规格的3D空间、装备及破坏表现、多人聊天与服务器隔离明确属于下一阶段，没有将这些功能包装为当前已完成。后续制作计划应根据原型观察与用户选择的引擎独立细化。

## Execution choice

建议由当前助手在本任务内顺序实现，模块少且共用同一状态接口，沟通成本较低。若用户选择并行代理实现，则按规则模块、玩家视图和界面边界分配任务并进行接口复核。必须先让用户审阅本计划并选择执行方式，再开始实现。


## 执行结果与用户追加要求

已完成规则引擎、玩家视图、任务能量、秘密任务、两次转换、会议投票、战斗结算、模拟控制与浏览器验收。用户试玩时进一步要求真正的可移动3D人物，因此原平面视图已替换为本地Three.js场景，包含人形与行走动画、键盘/触屏移动、跟随旋转镜头、基础碰撞及自动绕行。详见 progress.md 的实际测试记录。联网、精确距离判定与完整场景互动仍不属于当前交付。
