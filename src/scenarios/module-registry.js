/* ============================================================
 * 玩法模块注册表 —— 参考 Sky Team 基础盒 + Turbulence 扩展
 *
 * 模块 Hook 约定（按需实现）：
 *   initState(state, cfg)           → 模块运行时 state
 *   onBeginRound(state)             → 每轮开始
 *   onRollDice(state, role)         → 掷骰后
 *   onRerollAll(state)              → 重掷后
 *   onPlaceDie(state, role, idx, slot) → 放置后（湍流：重掷剩余骰）
 *   slotAllowed(state, role, slot, def) → 槽位额外限制（警报：禁用槽位）
 *   beforeResolveRound(state)       → 结算前（风：调整引擎窗口）
 *   afterResolveRound(state)        → 结算后（燃油：扣减）
 *   checkWin(state)                 → 额外终局条件 → string[] 失败原因
 *   getWidgets(state)               → UI 扩展 [{ id, render(ctx), priority }]
 *   getDiceLimit(state, role)       → 低能见度：同时可用骰子数
 * ============================================================ */
'use strict';

var ModuleRegistry = {
  _all: {},

  register: function (mod) {
    if (!mod.id) throw new Error('module.id required');
    this._all[mod.id] = mod;
  },

  get: function (id) {
    return this._all[id] || null;
  },

  getActive: function (state) {
    return (state.activeModules || [])
      .map(function (id) { return ModuleRegistry.get(id); })
      .filter(Boolean);
  },

  listAll: function () {
    return Object.keys(this._all).map(function (k) { return ModuleRegistry._all[k]; });
  },

  /** 合并所有激活模块的中央仪表 Widget（未来 P3 使用） */
  collectWidgets: function (state, ctx) {
    var widgets = [];
    this.getActive(state).forEach(function (mod) {
      if (typeof mod.getWidgets === 'function') {
        var list = mod.getWidgets(state, ctx) || [];
        widgets = widgets.concat(list);
      }
    });
    return widgets.sort(function (a, b) { return (a.priority || 50) - (b.priority || 50); });
  }
};

/* ---------- 基础盒：空中交通（已实现，逻辑在 game-logic） ---------- */
ModuleRegistry.register({
  id: 'traffic',
  name: '空中交通',
  description: '进近路径上的飞机，无线电 1/2 清除。',
  logicOwner: 'core',
  logicFile: 'src/logic/game-logic.js（hasTraffic / resolveRound 无线电段）'
});

/* ---------- Turbulence 扩展占位 ---------- */

ModuleRegistry.register({
  id: 'turbulence',
  name: '湍流',
  description: '标记轮次：每放置一颗骰子后，重掷该玩家剩余骰子。',
  initState: function () {
    return { turbulenceRounds: [] };
  },
  onPlaceDie: function (state, role) {
    var ms = state.moduleState.turbulence;
    if (!ms || ms.turbulenceRounds.indexOf(state.round) === -1) return;
    state.dice[role].forEach(function (d) {
      if (!d.used && d.v !== 0) d.v = 1 + Math.floor(Math.random() * 6);
    });
  }
});

ModuleRegistry.register({
  id: 'visibility',
  name: '低能见度',
  description: '每轮仅 2 颗骰子可用，放置后补掷下一颗。',
  initState: function () {
    return { activeDiceLimit: 2 };
  },
  getDiceLimit: function (state) {
    var ms = state.moduleState.visibility;
    return ms ? ms.activeDiceLimit : null;
  }
});

ModuleRegistry.register({
  id: 'alarms',
  name: '警报面板',
  description: '高度轨警报 token 禁用对应槽位，需骰子复位。',
  initState: function () {
    return { blockedSlots: {} };
  },
  slotAllowed: function (state, role, slotName) {
    var ms = state.moduleState.alarms;
    if (!ms) return { ok: true };
    var key = role + '.' + slotName;
    if (ms.blockedSlots[key]) {
      return { ok: false, why: '该槽位被警报锁定' };
    }
    return { ok: true };
  }
});

ModuleRegistry.register({
  id: 'wind',
  name: '风',
  description: '风向/风速影响引擎推进与终局速度判定。',
  initState: function () {
    return { speed: 0, direction: 'neutral' };
  },
  beforeResolveRound: function () {
    /* 未来：调整 effective engine sum */
  }
});

ModuleRegistry.register({
  id: 'kerosene',
  name: '燃油',
  description: '燃油表每轮 -6 或按放置骰值扣减，≤0 坠毁。',
  initState: function (state, cfg) {
    return { fuel: (cfg.KEROSENE_START || 42) };
  },
  afterResolveRound: function (state) {
    var ms = state.moduleState.kerosene;
    if (!ms) return;
    ms.fuel -= 6;
    if (ms.fuel <= 0) {
      state.phase = 'lose';
      state.loseReason = '燃油耗尽！';
    }
  },
  checkWin: function (state) {
    var ms = state.moduleState.kerosene;
    if (ms && ms.fuel <= 0) return ['燃油耗尽'];
    return [];
  }
});

ModuleRegistry.register({
  id: 'interns',
  name: '实习生',
  description: '实习生轨道，放置骰子获得额外能力。',
  initState: function () {
    return { track: 0 };
  }
});

ModuleRegistry.register({
  id: 'penguins',
  name: '企鹅障碍',
  description: '冰跑道上的企鹅，行为同空中交通但主题不同。',
  initState: function () {
    return {};
  }
});

ModuleRegistry.register({
  id: 'ice-brakes',
  name: '冰刹车',
  description: '刹车槽位需特定点数顺序激活。',
  initState: function () {
    return {};
  }
});

if (typeof window !== 'undefined') window.ModuleRegistry = ModuleRegistry;
