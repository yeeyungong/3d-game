# 多人邀请版部署

这份项目分为两个服务：Vercel 部署网页，Render（或你自己的 Node 主机）部署联机服务器。**只部署 Vercel 还不能联机。** 无需数据库账号或把私密密钥放进网页。

## 1. 上传代码

把项目上传到自己的 Git 仓库，包含 package-lock.json、public、src、multiplayer、scripts、server.mjs、vercel.json 和 render.yaml。不要上传 node_modules、dist、.npm-cache 或 .env 文件。

## 2. 部署联机服务器（Render）

导入同一仓库创建 Web Service，或用仓库内的 render.yaml 创建 Blueprint。

- Runtime：Node，版本 22 或更高
- Build Command：`npm ci`
- Start Command：`npm start`
- 环境变量 `HOST`：`0.0.0.0`
- 环境变量 `ALLOWED_ORIGINS`：你的 Vercel 正式网址，例如 `https://shadow-protocol.vercel.app`。多个网址用英文逗号分隔，不要末尾斜杠。
- PORT 使用 Render 自动设置的值，不需要手动设置。
- 保持单个实例。房间暂存在实例内存里，不能横向扩容到多个实例。

记录服务地址，例如 `https://shadow-server.onrender.com`。

## 3. 部署网页（Vercel）

导入同一仓库，Framework Preset 选择 Other：

- Build Command：`npm run build`
- Output Directory：`dist`
- 环境变量 `PUBLIC_GAME_SERVER_URL`：`wss://shadow-server.onrender.com/multiplayer`（替换成第 2 步的实际地址）。

vercel.json 已包含构建设置。环境变量修改后需要重新部署。Vercel 正式域名生成后，回到 Render 把实际域名填进 ALLOWED_ORIGINS 并重启服务。Preview 部署域名若也要联机，需单独加入允许名单。

## 4. 邀请朋友

打开 Vercel 网址 → 输入昵称 → 创建房间 → 复制邀请链接 → 发给朋友。朋友打开链接后输入昵称，点“加入房间”。也可手动输入六位房间码。

4–8 人全部准备后，房主开始游戏。J 转换、K 攻击；任务需完成面板小游戏。每个人只能控制自己的角色。会议请配合你们自己的语音聊天工具，目前未内置语音或文字聊天。

刷新页面会用当前标签页保存的会话重新连接，保留角色。断线超过 2 分钟后移出房间/淘汰；主动离开对局也会淘汰。完整邀请链接只含房间码，不含重连凭证。

## 本地验证

`npm ci` 然后 `npm start`，打开 http://127.0.0.1:4173/ 。本地自动连接相同地址的 WebSocket 服务。

`npm test` 包括真实 WebSocket 的 8 客户端联机测试。`npm run build` 验证 Vercel 静态产物。联机大厅仍提供“先玩单人练习”。

## 当前版本的边界

- 这是可部署的朋友房间版本，还未在你的 Vercel/Render 账号上发布；本地测试不能代替公网网络测试。
- 房间存在内存中，服务器重启、重新部署或休眠会清空房间，玩家需重新创建。Render 免费实例可能冷启动，首次连接需要等待后重试。官方说明：https://render.com/docs/free
- 移动由服务器校验并同步，浏览器做插值；跨地区高延迟仍可能影响手感。
- 无账号、排位、永久战绩或房间持久化；不要用于竞技比赛或大规模公开运营。小游戏答案验证防止误操作，但不等同于完整反作弊。
- Vercel 不运行 WebSocket 服务器：https://vercel.com/docs/limits 。Render 支持 WebSocket：https://render.com/docs/websocket 。
