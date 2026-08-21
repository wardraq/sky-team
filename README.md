# 天合小队 Sky Team

双人合作 Web 桌游，机制来自 **[Sky Team（天作之合）](https://boardgamegeek.com/boardgame/373106/sky-team)**（Luc Rémond，2024 Spiel des Jahres）。两名玩家分别扮演机长与副驾，在 7 轮内将客机安全降落——掷骰后禁止交流点数，只能靠策略讨论与放置顺序协作。

**仅支持联机**：所有规则由服务端仲裁，客户端只负责渲染与发送操作。

---

## 快速开始

**环境**：Node.js 18+（无 npm 依赖、无构建步骤）

```bash
# 启动服务（默认端口 8080）
node server.js

# 静默模式（不打印启动横幅）
QUIET=1 node server.js

# 自定义端口
PORT=3000 node server.js
```

**后台运行**（关闭终端后仍继续服务，日志写入 `server.log`）：

```bash
# 推荐：静默 + 后台 + 日志重定向
nohup QUIET=1 node server.js > server.log 2>&1 &

# 自定义端口
nohup QUIET=1 PORT=3000 node server.js > server.log 2>&1 &
```

查看是否在跑：`lsof -i :8080` 或 `tail -f server.log`

**停止服务**：

```bash
# 前台运行时，在启动服务的终端按 Ctrl+C
```

若服务在后台运行，可按端口查找并结束进程：

```bash
# 默认端口 8080
lsof -ti :8080 | xargs kill

# 或按进程名
pkill -f "node server.js"
```

浏览器访问：

| 入口 | URL |
|------|-----|
| 联机大厅 | http://localhost:8080/ |
| 机长 | http://localhost:8080/?room=sky&role=pilot&scenario=yul |
| 副驾 | http://localhost:8080/?room=sky&role=copilot&scenario=yul |
| 观战（只读） | http://localhost:8080/?room=sky&role=passenger |
| 模块实验室 | http://localhost:8080/test/module-lab.html |

**本地双人测试**：同一浏览器开两个标签页，分别打开机长与副驾链接，`room` 参数保持一致即可。

> 请勿用 `file://` 直接打开 `index.html`，需通过 `server.js` 提供静态文件与 WebSocket。

---

## 怎么玩

1. 在大厅输入房间号、**选择关卡**，再选角色进入。
2. 机长与副驾都连接后（须同一关卡），服务端自动开局。
3. 每轮流程：**策略讨论 → 秘密掷骰 → 轮流放置 → 揭示结算**。
4. 掷骰完成后至放置结束前，对方看不到你的骰子点数（服务端过滤）。
5. 第 7 轮结束时满足全部降落条件即胜利，否则坠机。

详细规则见游戏内 **📖 规则** 弹窗，或阅读 [`docs/DESIGN.md`](docs/DESIGN.md)。

### 与 Sky Team 对齐的槽位规则（摘要）

| 槽位 | 归属 | 点数限制 |
|------|------|----------|
| 姿态 / 引擎 | 双方各 1（强制） | 无 |
| 无线电 | 机长 1 + 副驾 2 | 任意（值 = 清除第 N 格飞机） |
| 起落架 ×3 | 机长 | 1/2、3/4、5/6，任意顺序 |
| 襟翼 ×4 | 副驾 | 1/2 → 2/3 → 4/5 → 5/6，须按顺序 |
| 刹车 ×3 | 机长 | 2 → 4 → 6，须按顺序 |
| 集中精力 ☕ | 共用 ×3 | 任意，获得咖啡标记 |

终局速度：**引擎和 < 刹车值**。咖啡在**放置时**修正；重掷从高度轨 🔄 格收入。

---

## 项目结构

```
sky-squad/
├── index.html              # 游戏主页面（联机大厅 + 驾驶舱 UI）
├── server.js               # HTTP 静态服务 + WebSocket 房间 + 规则仲裁
├── docs/                   # 文档
│   ├── DESIGN.md           # 项目设计、架构与踩坑记录
│   ├── SkyTeam.zh.md       # 原版规则（中文）
│   └── SkyTeam.en.md       # 原版规则（英文）
├── test/                   # 测试与开发工具
│   ├── test.js             # 逻辑层蒙特卡洛冒烟
│   ├── test-modules.js     # 玩法模块单元测试
│   ├── test-scenarios.js   # 可玩关卡冒烟
│   ├── test-online.js      # 联机 E2E 测试
│   ├── module-lab.html     # 模块/规则实验室（浏览器）
│   ├── approach-lab.html   # → 重定向至 modules/traffic.html
│   └── modules/            # 各模块 UI 预览页
│       ├── index.html      # 模块索引
│       ├── traffic.html    # 空中交通（航道 Widget）
│       └── …               # 其余模块占位预览
└── src/
    ├── logic/
    │   ├── game-logic.js   # 纯规则层（无 DOM，Node/浏览器共用）
    │   └── load-logic.js   # Node 端加载逻辑与 Registry
    ├── scenarios/
    │   ├── scenario-registry.js   # 关卡配置
    │   └── module-registry.js     # 可选玩法模块 Hook
    ├── core/
    │   ├── game-controller.js     # 客户端 action → WebSocket
    │   ├── game-session.js        # WebSocket 连接与消息
    │   └── view-context.js        # 权限（canSee / canOperate）
    ├── widgets/                   # UI 组件（面板、仪表、进近轨等）
    ├── lab/                       # 模块实验室
    └── app.js                     # 浏览器入口
```

### 架构要点

- **零构建**：多 `<script>` 标签加载，改完刷新即生效。
- **单点规则**：`game-logic.js` 为唯一规则源；`server.js` 通过 `load-logic.js` 加载同一套逻辑 + Registry。
- **客户端薄**：不本地改状态，所有 `place` / `roll` / `settle` 等操作经 WebSocket 由服务端执行后再广播。
- **保密模型**：`roll` 阶段隐藏对方骰子；`place` 阶段起双方放置明牌（模拟实体桌游翻骰到公共区）。

---

## 测试

```bash
node test/test.js              # 默认模拟 500 局，可传 node test/test.js 100
node test/test-modules.js      # 模块与槽位规则测试（50+ 项）
node test/test-scenarios.js    # 可玩关卡冒烟（yul / lhr / hnd）
node test/test-online.js       # 需先启动 server.js

# 浏览器开发工具
#   http://localhost:8080/test/module-lab.html       模块实验室
#   http://localhost:8080/test/modules/index.html    模块 UI 预览索引
#   http://localhost:8080/test/modules/traffic.html  航道（空中交通）
```

---

## 开发与扩展

### 调整数值

编辑 `src/logic/game-logic.js` 顶部 `CONFIG`（轮数、起始高度/距离、刹车基数等）。

### 新增关卡

在 `src/scenarios/scenario-registry.js` 注册场景，指定 `config` 覆盖与 `modules` 列表。去掉 `disabled: true` 即可在大厅选关；联机 URL 加 `&scenario=<id>`。

**阶段 1 可玩关卡**：`yul`（蒙特利尔教学）、`lhr`（希思罗繁忙交通）、`hnd`（羽田转弯进近 + 姿态格）。旧链接 `scenario=training` 自动映射到 `yul`。

### 新增玩法模块

在 `src/scenarios/module-registry.js` 注册模块，实现 `initState`、`onPlaceDie`、`slotAllowed` 等 Hook。可在 **模块实验室** 单独调试。

### 更多文档

- [`docs/DESIGN.md`](docs/DESIGN.md) — 机制说明、结算顺序、与原版差异、历史决策
- 页面右下角 **dbg-badge** — 联机调试信息（角色、轮次、阶段）

---

## 许可与声明

本项目为 **自用 Sky Team Web 联机版**，仅供学习与交流。Sky Team 桌游版权归原出版方所有。
