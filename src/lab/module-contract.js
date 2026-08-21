/* ============================================================
 * 模块职责契约 —— 谁维护哪段逻辑（Lab 与开发文档共用）
 * ============================================================ */
'use strict';

var ModuleContract = {
  LAYERS: [
    {
      id: 'scenario',
      name: '关卡层',
      file: 'src/scenarios/scenario-registry.js',
      color: '#7cc4ff',
      owns: [
        '场景 CONFIG 覆盖（高度/距离/交通起始等）',
        '本关启用哪些玩法模块（modules[]）',
        'setup(state, cfg) 额外初始化'
      ]
    },
    {
      id: 'core',
      name: '核心规则层',
      file: 'src/logic/game-logic.js',
      color: '#3ddc84',
      owns: [
        '全局 CONFIG / SLOTS 定义',
        '掷骰、放置、轮流、咖啡修正',
        'slotAllowed 基础校验 + 调用模块扩展',
        'resolveRound 每轮结算（姿态/引擎/进近/高度）',
        '第 7 轮降落终局检查（核心条件）',
        'traffic 空中交通核心逻辑（无线电清除/撞机）'
      ]
    },
    {
      id: 'module',
      name: '玩法模块层',
      file: 'src/scenarios/module-registry.js',
      color: '#ff9440',
      owns: [
        'initState — 模块运行时状态',
        'onBeginRound / onRollDice / onPlaceDie 等阶段 Hook',
        'slotAllowed — 额外放置限制（如警报锁槽）',
        'beforeResolveRound / afterResolveRound — 结算前后介入',
        'checkWin — 额外降落失败条件',
        'getWidgets — 中央仪表 UI 扩展'
      ]
    },
    {
      id: 'widget',
      name: '界面 Widget 层',
      file: 'src/widgets/',
      color: '#d8b45a',
      owns: [
        'render(ctx) 纯展示',
        'UI 侧预校验（先选骰子等提示）',
        'emit(action) 交给 GameController，不直接改 state'
      ]
    },
    {
      id: 'controller',
      name: '应用控制层',
      file: 'src/core/game-controller.js',
      color: '#b8c8da',
      owns: [
        '玩家 action 统一分发',
        '本地模式 → GameLogic',
        '联机模式 → WebSocket → server'
      ]
    },
    {
      id: 'server',
      name: '联机仲裁层',
      file: 'server.js',
      color: '#ff5a5a',
      owns: [
        '房间与连接管理',
        '服务端调用同一份 GameLogic 仲裁',
        '按角色 sanitize 隐藏对方骰子'
      ]
    }
  ],

  LIFECYCLE: [
    { step: 'config', label: '配置加载', owner: 'scenario+core', desc: 'ScenarioRegistry.get → mergeConfig → newGame' },
    { step: 'init', label: '模块初始化', owner: 'module', desc: 'ModuleRegistry.initState(state, cfg)' },
    { step: 'discuss', label: '策略讨论', owner: 'core', desc: 'phase=discuss，无自动逻辑' },
    { step: 'roll', label: '掷骰操作', owner: 'core', desc: 'rollDice → onRollDice(module)' },
    { step: 'place', label: '放置操作', owner: 'core+module', desc: 'slotAllowed(module) → placeDie → onPlaceDie(module)' },
    { step: 'reveal', label: '轮末确认', owner: 'core', desc: 'resolveRound' },
    { step: 'resolve', label: '每轮结算', owner: 'core+module', desc: 'beforeResolve(module) → 核心结算 → afterResolve(module)' },
    { step: 'landing', label: '降落结算', owner: 'core+module', desc: '终局检查 + checkWin(module)' }
  ],

  HOOKS: [
    { hook: 'initState', phase: 'config', owner: 'module', args: '(state, cfg) → object' },
    { hook: 'onBeginRound', phase: 'discuss', owner: 'module', args: '(state)' },
    { hook: 'onRollDice', phase: 'roll', owner: 'module', args: '(state, role)' },
    { hook: 'onRerollAll', phase: 'roll', owner: 'module', args: '(state)' },
    { hook: 'slotAllowed', phase: 'place', owner: 'module', args: '(state, role, slot, def) → {ok,why}' },
    { hook: 'onPlaceDie', phase: 'place', owner: 'module', args: '(state, role, dieIdx, slot)' },
    { hook: 'getDiceLimit', phase: 'place', owner: 'module', args: '(state, role) → number|null' },
    { hook: 'beforeResolveRound', phase: 'resolve', owner: 'module', args: '(state)' },
    { hook: 'afterResolveRound', phase: 'resolve', owner: 'module', args: '(state)' },
    { hook: 'checkWin', phase: 'landing', owner: 'module', args: '(state) → string[]' },
    { hook: 'getWidgets', phase: 'widget', owner: 'module', args: '(state, ctx) → [{id,render,priority}]' }
  ],

  CORE_ACTIONS: [
    { id: 'newGame', label: '新建对局', owner: 'core', phase: 'config' },
    { id: 'beginRound', label: '开始本轮', owner: 'core', phase: 'discuss', hooks: ['onBeginRound'] },
    { id: 'rollDice', label: '掷骰', owner: 'core', phase: 'roll', hooks: ['onRollDice'] },
    { id: 'rerollAll', label: '重掷全部', owner: 'core', phase: 'roll', hooks: ['onRerollAll'] },
    { id: 'placeDie', label: '放置骰子', owner: 'core', phase: 'place', hooks: ['slotAllowed', 'onPlaceDie'] },
    { id: 'useCoffee', label: '咖啡修正（放置时）', owner: 'core', phase: 'place', hooks: [] },
    { id: 'resolveRound', label: '结算本轮', owner: 'core', phase: 'resolve', hooks: ['beforeResolveRound', 'afterResolveRound'] },
    { id: 'nextRound', label: '下一轮', owner: 'core', phase: 'resolve' },
    { id: 'checkLanding', label: '降落检查', owner: 'core+module', phase: 'landing', hooks: ['checkWin'] }
  ]
};

if (typeof window !== 'undefined') window.ModuleContract = ModuleContract;
