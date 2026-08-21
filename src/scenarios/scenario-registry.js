/* ============================================================
 * 关卡注册表 —— 参考 Sky Team Flight Log 机场场景
 *
 * 场景结构：
 *   id, name, description, difficulty(1-5), airport,
 *   config: 覆盖 CONFIG 的键值,
 *   modules: 启用的 ModuleRegistry id 列表,
 *   setup(state, cfg): 可选，进一步初始化 state,
 *   disabled: true 时不在选关界面展示
 * ============================================================ */
'use strict';

var ScenarioRegistry = {
  defaultId: 'yul',

  _all: {},

  register: function (scenario) {
    if (!scenario.id) throw new Error('scenario.id required');
    this._all[scenario.id] = scenario;
  },

  get: function (id) {
    if (id === 'training') id = 'yul';
    var s = this._all[id];
    if (s) return s;
    return this._all[this.defaultId] || this._all['yul'] || this._all['training'];
  },

  /** 返回可选关卡列表（不含 disabled） */
  list: function () {
    return Object.keys(this._all)
      .map(function (k) { return ScenarioRegistry._all[k]; })
      .filter(function (s) { return !s.disabled; })
      .sort(function (a, b) { return (a.difficulty || 0) - (b.difficulty || 0); });
  },

  /** 联机/大厅用摘要（不含 setup 函数） */
  meta: function (id) {
    var s = this.get(id);
    if (!s) return null;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      difficulty: s.difficulty,
      airport: s.airport,
      modules: (s.modules || []).slice()
    };
  },

  isPlayable: function (id) {
    var s = this.get(id);
    return !!(s && !s.disabled);
  }
};

/* ---------- 阶段 1：纯 config 可玩关卡 ---------- */

ScenarioRegistry.register({
  id: 'yul',
  name: '蒙特利尔 YUL',
  description: '官方教学进近。黎明、雪原，路径距 3 有 1 架飞机。',
  difficulty: 1,
  airport: 'YUL',
  config: {
    DISTANCE_START: 6,
    TRAFFIC_START: [3]
  },
  modules: ['traffic']
});

/** @deprecated 别名，指向 yul */
ScenarioRegistry.register({
  id: 'training',
  name: '蒙特利尔 YUL（training）',
  description: '同 yul，兼容旧链接。',
  difficulty: 1,
  airport: 'YUL',
  config: {
    DISTANCE_START: 6,
    TRAFFIC_START: [3]
  },
  modules: ['traffic'],
  disabled: true
});

ScenarioRegistry.register({
  id: 'lhr',
  name: '希思罗 LHR',
  description: '伦敦进近末端繁忙，多架空中交通。',
  difficulty: 2,
  airport: 'LHR',
  config: {
    DISTANCE_START: 6,
    TRAFFIC_START: [1, 2, 4]
  },
  modules: ['traffic']
});

ScenarioRegistry.register({
  id: 'hnd',
  name: '羽田 HND',
  description: '东京湾左转进近，部分距离格有姿态要求。',
  difficulty: 3,
  airport: 'HND',
  config: {
    DISTANCE_START: 6,
    TRAFFIC_START: [2, 4],
    APPROACH_AXIS: {
      5: [-1, 0],
      4: [-1, 0],
      3: [0],
      2: [0]
    }
  },
  modules: ['traffic']
});

ScenarioRegistry.defaultId = 'yul';

/* ---------- 占位：待模块接好后启用 ---------- */

ScenarioRegistry.register({
  id: 'paris-cdg',
  name: '巴黎戴高乐',
  description: '经典入门机场，交通适中。',
  difficulty: 2,
  airport: 'CDG',
  config: { TRAFFIC_START: [2, 4] },
  modules: ['traffic'],
  disabled: true
});

ScenarioRegistry.register({
  id: 'beijing-storm',
  name: '北京 · 风暴进近',
  description: '湍流轮次 + 低能见度（双骰限制）。',
  difficulty: 4,
  airport: 'PEK',
  config: { TRAFFIC_START: [2, 4], ROUNDS: 7 },
  modules: ['traffic', 'turbulence', 'visibility'],
  disabled: true
});

ScenarioRegistry.register({
  id: 'warsaw-emergency',
  name: '华沙 · 紧急迫降',
  description: '起落架故障 + 警报面板。',
  difficulty: 5,
  airport: 'WAW',
  config: { TRAFFIC_START: [1, 3], GEAR_COUNT: 0 },
  modules: ['traffic', 'alarms'],
  setup: function (state) { state.gearDisabled = true; },
  disabled: true
});

ScenarioRegistry.register({
  id: 'azores-fuel',
  name: '亚速尔 · 燃油耗尽',
  description: '燃油表每轮下降，需管理引擎消耗。',
  difficulty: 4,
  airport: 'TER',
  config: { TRAFFIC_START: [4], ALTITUDE_START: 6 },
  modules: ['traffic', 'kerosene', 'wind'],
  disabled: true
});

ScenarioRegistry.register({
  id: 'mcmurdo-ice',
  name: '麦克默多 · 冰跑道',
  description: '终进近须保持水平 + 冰面刹车（待实现）。',
  difficulty: 3,
  airport: 'NZIR',
  config: {
    TRAFFIC_START: [2],
    DISTANCE_START: 7,
    APPROACH_AXIS: { 3: [0], 2: [0], 1: [0] }
  },
  modules: ['traffic', 'ice-brakes'],
  disabled: true
});

if (typeof window !== 'undefined') window.ScenarioRegistry = ScenarioRegistry;
