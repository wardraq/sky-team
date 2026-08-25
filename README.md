# 天合小队 Sky Team

双人合作 Web 桌游，机制来自 **[Sky Team（天作之合）](https://boardgamegeek.com/boardgame/373106/sky-team)**（Luc Rémond，2024 Spiel des Jahres）。两名玩家分别扮演机长与副驾，协作完成进近与着陆——掷骰后禁止交流点数，只能靠策略讨论与放置顺序配合。

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
nohup QUIET=1 node server.js > server.log 2>&1 &
```

查看是否在跑：`lsof -i :8080` 或 `tail -f server.log`

**停止服务**：前台 `Ctrl+C`；后台则 `lsof -ti :8080 | xargs kill`

浏览器访问（本机）：

| 入口 | URL |
|------|-----|
| 联机大厅 | http://localhost:8080/ |
| 游戏指导 | http://localhost:8080/guide.html |
| 机长 | http://localhost:8080/?room=sky&role=pilot&scenario=yul |
| 副驾 | http://localhost:8080/?room=sky&role=copilot&scenario=yul |
| 测试机场（短轨） | `…&scenario=test` |
| 观战（只读） | http://localhost:8080/?room=sky&role=passenger |
| 模块实验室 | http://localhost:8080/test/module-lab.html |
| 着陆轮测试 | http://localhost:8080/test/landing-round-lab.html |

**局域网联机**：在同一 Wi‑Fi 下，把 `localhost` 换成主机局域网 IP（如 `192.168.1.10`），`room` 与 `scenario` 两边保持一致。

**本地双人测试**：开两个标签页，分别打开机长与副驾链接即可。

> 请勿用 `file://` 直接打开 `index.html`，需通过 `server.js` 提供静态文件与 WebSocket。

---

## 怎么玩

1. 在大厅输入房间号、**选择关卡**，再选角色进入。
2. 机长与副驾都连接后（须同一关卡），服务端自动开局。
3. 每轮流程：**策略讨论 → 秘密掷骰 → 轮流放置 → 揭示结算**。
4. 掷骰完成后至放置结束前，对方看不到你的骰子点数（服务端过滤）。
5. 普通轮结算后高度下降；当 **距机场 0 且高度 0** 时进入 **着陆轮**，须再完成一轮放置并满足胜利 A–D。

详细规则见游戏内 **📖 规则** 弹窗，或 [`docs/SkyTeam.zh.md`](docs/SkyTeam.zh.md)、[`docs/DESIGN.md`](docs/DESIGN.md)。

### 与 Sky Team 对齐的槽位规则（摘要）

| 槽位 | 归属 | 点数限制 |
|------|------|----------|
| 姿态 / 引擎 | 双方各 1（强制） | 无；第二颗放上即即时结算 |
| 无线电 | 机长 1 + 副驾 2 | 任意；清除 **当前位置起第 N 格上的 1 架飞机** |
| 起落架 ×3 | 机长 | 1/2、3/4、5/6，任意顺序 |
| 襟翼 ×4 | 副驾 | 1/2 → 2/3 → 4/5 → 5/6，须按顺序 |
| 刹车 ×3 | 机长 | 2 → 4 → 6，须按顺序 |
| 集中精力 ☕ | 共用 ×3 | 任意，获得咖啡 token（上限 3） |

**普通轮引擎**：引擎和与 **蓝标记** 比较，决定前进格数或悬停。  
**着陆轮引擎**：第二颗引擎放上时与 **刹车值**（`2 + 2×已激活刹车数`）比较，须 **引擎和 < 刹车值**。

**重掷**：轮初经过高度轨 🔄 格收入标记；使用时双方 **各选任意颗** 自己骰子重掷（须分别确认）。  
**咖啡**：放置前在己方骰子上 ±1 修正（消耗 token）。

### 着陆轮胜利条件（A–D，须全部满足）

| | 条件 |
|---|------|
| **A** | 在机场（`distance = 0`） |
| **B** | 姿态水平（`axis = 0`） |
| **C** | 起落架 3 + 襟翼 4 全部激活 |
| **D** | 进近轨无飞机，且着陆轮引擎和 **<** 刹车值 |

**等待航线**：已到机场但高度未到 0 → 须再玩完整轮，进近轨不再前进，须悬停（引擎和 < 蓝标记）。  
**未及时到达**：高度已到 0 但未到机场 → 坠毁判负。

### 仪表与轨道 UI

- **航道 / 高度轨**：滑动视窗，当前格固定左侧，轨道随进度左移。
- **高度格边框**：按高度 **先手交替** 着色（起始高度机长蓝 → 下一格副驾橙 …，含 0ft）。
- **航道**：前方交通用 ✈️ 浮层；机场 🏢 为背景，飞机可重叠显示。

---

## 可玩关卡

大厅或 URL 参数 `scenario=<id>` 选关；`training` 自动映射为 `yul`。

| ID | 说明 |
|----|------|
| `test` | 测试机场：航道 2 格、高度 1000/0、机场 1 架飞机、1000ft 可重掷 |
| `yul` | 蒙特利尔教学：6000→0ft，7 格进近，YUL 交通布局 |
| `lhr` | 希思罗：末端繁忙交通 |
| `hnd` | 羽田：部分距离格有姿态要求（`APPROACH_AXIS`） |

航道格数、初始交通、高度步长、重掷格等均在 [`src/scenarios/airport-tracks.js`](src/scenarios/airport-tracks.js) 配置，[`scenario-registry.js`](src/scenarios/scenario-registry.js) 引用并注册为可选关卡。

---

## 项目结构

```
sky-team/
├── index.html              # 游戏主页面（联机大厅 + 驾驶舱 UI）
├── server.js               # HTTP 静态服务 + WebSocket 房间 + 规则仲裁
├── docs/                   # 规则与设计文档
├── test/
│   ├── test.js             # 逻辑层蒙特卡洛冒烟
│   ├── test-modules.js     # 玩法模块与规则单元测试
│   ├── test-scenarios.js   # 可玩关卡冒烟
│   ├── test-online.js      # 联机 E2E 测试
│   ├── module-lab.html     # 模块/规则实验室
│   ├── landing-round-lab.html   # 着陆轮 UI + 预设场景
│   └── modules/            # 各模块 UI 预览页
└── src/
    ├── logic/
    │   ├── game-logic.js   # 纯规则层（无 DOM，Node/浏览器共用）
    │   └── load-logic.js   # Node 端加载逻辑与 Registry
    ├── scenarios/
    │   ├── airport-tracks.js      # 各机场航道/高度轨配置
    │   ├── scenario-registry.js   # 关卡注册（引用 airport-tracks）
    │   └── module-registry.js     # 可选玩法模块 Hook
    ├── core/               # 联机会话、控制器、视图权限
    ├── widgets/            # 面板、航道、高度、刹车板、姿态等
    ├── lab/                # 模块实验室运行时
    └── app.js              # 浏览器入口
```

### 架构要点

- **零构建**：多 `<script>` 标签加载，改完刷新即生效。
- **单点规则**：`game-logic.js` 为唯一规则源；`server.js` 通过 `load-logic.js` 加载同一套逻辑。
- **场景配置**：`getScenarioConfig(state)` 合并关卡覆盖项，Widget 与 `resolveRound` 降高度均按场景配置执行。
- **客户端薄**：不本地改状态，所有操作经 WebSocket 由服务端执行后再广播。
- **保密模型**：`roll` 阶段隐藏对方骰子；`place` 起双方放置明牌。

---

## 测试

```bash
node test/test.js              # 默认模拟 500 局
node test/test-modules.js      # 模块与规则测试（90+ 项）
node test/test-scenarios.js    # 可玩关卡冒烟（test / yul / lhr / hnd）
node test/test-online.js       # 需先启动 server.js
```

浏览器开发工具：

| 页面 | 用途 |
|------|------|
| `/test/module-lab.html` | 单模块 Hook 逐步驱动 |
| `/test/landing-round-lab.html` | 着陆轮预设 + A–D 检查 + 仪表预览 |
| `/test/modules/index.html` | 模块 UI 预览索引 |

---

## 开发与扩展

### 调整默认数值

编辑 `src/logic/game-logic.js` 顶部 `CONFIG`（全局默认）。关卡可在 `airport-tracks.js` 覆盖 `DISTANCE_START`、`ALTITUDE_*`、`TRAFFIC_START`、`ALTITUDE_REROLL_SPACES`、`ROUNDS` 等。

### 新增机场 / 关卡

1. 在 `src/scenarios/airport-tracks.js` 增加轨配置：

```javascript
myAirport: {
  DISTANCE_START: 3,
  TRAFFIC_START: [2, 0],
  ALTITUDE_START: 3000,
  ALTITUDE_STEP: 1000,
  ALTITUDE_MIN: 0,
  ALTITUDE_REROLL_SPACES: [3000],
  ROUNDS: 4
}
```

2. 在 `scenario-registry.js` 注册：

```javascript
ScenarioRegistry.register({
  id: 'my-airport',
  name: '我的机场',
  description: '…',
  difficulty: 2,
  airport: 'XXX',
  config: mergeTrack('myAirport', { APPROACH_AXIS: { 2: [0] } }),  // 可选
  modules: ['traffic']
});
```

去掉 `disabled: true` 即可在大厅选关。

### 新增玩法模块

在 `src/scenarios/module-registry.js` 注册，实现 `initState`、`onPlaceDie`、`slotAllowed` 等 Hook。可在 **模块实验室** 单独调试。

### 更多文档

- [`docs/SkyTeam.zh.md`](docs/SkyTeam.zh.md) — 对照官方 PDF 整理的中文规则
- [`docs/DESIGN.md`](docs/DESIGN.md) — 架构、结算顺序、与原版差异
- 页面右下角 **dbg-badge** — 联机调试信息

---

## 许可与声明

本项目为 **自用 Sky Team Web 联机版**，仅供学习与交流。Sky Team 桌游版权归原出版方所有。
