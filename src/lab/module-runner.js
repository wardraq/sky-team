/* ============================================================
 * 模块实验室运行器 —— 单模块隔离测试，逐步驱动 Hook / 核心动作
 * ============================================================ */
'use strict';

var ModuleRunner = {
  log: [],

  clearLog: function () {
    this.log = [];
  },

  pushLog: function (level, msg, detail) {
    this.log.unshift({
      t: new Date().toISOString().slice(11, 23),
      level: level || 'info',
      msg: msg,
      detail: detail || null
    });
    if (this.log.length > 80) this.log.pop();
  },

  clone: function (obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /** 只激活被测模块的 lab 状态 */
  newLabState: function (moduleId, scenarioId) {
    var Logic = window.GameLogic;
    scenarioId = scenarioId || (typeof ScenarioRegistry !== 'undefined' ? ScenarioRegistry.defaultId : null);
    var scenario = Logic.resolveScenario(scenarioId);
    var cfg = Logic.mergeConfig(scenario.config);
    var s = Logic.newGame(scenarioId);
    s.activeModules = [moduleId];
    s.moduleState = {};
    this.ensurePlacements(s);
    var mod = ModuleRegistry.get(moduleId);
    if (mod && mod.initState) {
      s.moduleState[moduleId] = mod.initState(s, cfg);
    }
    this.pushLog('ok', '新建 Lab 状态 · 仅模块: ' + moduleId);
    return s;
  },

  ensurePlacements: function (state) {
    var Logic = window.GameLogic;
    ['pilot', 'copilot'].forEach(function (r) {
      if (!state.placements[r]) state.placements[r] = {};
      Object.keys(Logic.SLOTS[r]).forEach(function (slot) {
        if (state.placements[r][slot] === undefined) state.placements[r][slot] = null;
      });
    });
  },

  getModuleHooks: function (moduleId) {
    var mod = ModuleRegistry.get(moduleId);
    if (!mod) return [];
    return ModuleContract.HOOKS.filter(function (h) {
      return typeof mod[h.hook] === 'function';
    });
  },

  runHook: function (state, moduleId, hookName, args) {
    var mod = ModuleRegistry.get(moduleId);
    if (!mod) return { ok: false, why: '模块不存在' };
    if (typeof mod[hookName] !== 'function') {
      return { ok: false, why: '模块未实现 Hook: ' + hookName };
    }
    var msBefore = this.clone(state.moduleState[moduleId] || null);
    var phaseBefore = state.phase;
    try {
      mod[hookName].apply(mod, [state].concat(args || []));
      this.pushLog('ok', 'Hook ' + hookName + '(' + (args || []).join(', ') + ')', {
        moduleStateBefore: msBefore,
        moduleStateAfter: this.clone(state.moduleState[moduleId] || null),
        phase: phaseBefore + ' → ' + state.phase
      });
      return { ok: true };
    } catch (e) {
      this.pushLog('err', 'Hook ' + hookName + ' 异常: ' + e.message, e.stack);
      return { ok: false, why: e.message };
    }
  },

  runCore: function (state, actionId, args) {
    var Logic = window.GameLogic;
    args = args || {};
    var res;
    try {
      switch (actionId) {
        case 'newGame':
          res = { ok: true, state: this.newLabState(args.moduleId, args.scenarioId) };
          break;
        case 'beginRound':
          Logic.beginRound(state);
          res = { ok: true };
          break;
        case 'rollDice':
          res = { ok: Logic.rollDice(state, args.role || 'pilot') };
          break;
        case 'rerollAll':
          res = { ok: Logic.rerollAll(state) };
          break;
        case 'placeDie':
          res = Logic.placeDie(state, args.role || 'pilot', args.dieIdx || 0, args.slot || 'axis');
          break;
        case 'useCoffee':
          res = { ok: Logic.useCoffee(state, args.role || 'pilot', args.slot || 'axis', args.delta || 1) };
          break;
        case 'resolveRound':
          res = { ok: Logic.resolveRound(state) };
          break;
        case 'nextRound':
          res = { ok: Logic.nextRound(state) };
          break;
        case 'checkLanding':
          res = this.checkLanding(state, args.moduleId);
          break;
        default:
          res = { ok: false, why: '未知动作: ' + actionId };
      }
      if (res.ok !== false) {
        this.pushLog('ok', 'Core.' + actionId, args);
      } else {
        this.pushLog('warn', 'Core.' + actionId + ' 失败', res.why || res);
      }
      return res;
    } catch (e) {
      this.pushLog('err', 'Core.' + actionId + ' 异常: ' + e.message, e.stack);
      return { ok: false, why: e.message };
    }
  },

  checkLanding: function (state, moduleId) {
    var Logic = window.GameLogic;
    var fails = [];
    if (state.distance !== 0) fails.push('未到达机场（距 ' + state.distance + '）');
    if (state.axis !== 0) fails.push('姿态未水平（' + state.axis + '）');
    if (state.gearAct < Logic.CONFIG.GEAR_COUNT) fails.push('起落架未全部激活');
    if (state.flapsAct < Logic.CONFIG.FLAP_COUNT) fails.push('襟翼未全部激活');
    if (state.traffic.length > 0) fails.push('路径仍有飞机');
    var mod = ModuleRegistry.get(moduleId);
    if (mod && mod.checkWin) {
      var extra = mod.checkWin(state) || [];
      fails = fails.concat(extra);
    }
    this.pushLog(fails.length ? 'warn' : 'ok', '降落检查: ' + (fails.length ? fails.join('；') : '通过'));
    return { ok: fails.length === 0, fails: fails };
  },

  PRESETS: {
    'turbulence': {
      label: '湍流 · 放置阶段',
      moduleId: 'turbulence',
      apply: function (s) {
        s.phase = 'place';
        s.round = 3;
        s.currentPlayer = 'pilot';
        s.moduleState.turbulence = { turbulenceRounds: [3] };
        s.dice.pilot = [{ v: 4, used: false }, { v: 2, used: false }, { v: 6, used: false }, { v: 1, used: false }];
        s.dice.copilot = [{ v: 3, used: false }, { v: 3, used: false }, { v: 3, used: false }, { v: 3, used: false }];
      }
    },
    'kerosene-low': {
      label: '燃油 · 即将耗尽',
      moduleId: 'kerosene',
      apply: function (s, cfg) {
        s.phase = 'reveal';
        s.round = 6;
        s.moduleState.kerosene = { fuel: 5 };
      }
    },
    'alarms-blocked': {
      label: '警报 · 槽位锁定',
      moduleId: 'alarms',
      apply: function (s) {
        s.phase = 'place';
        s.currentPlayer = 'pilot';
        s.moduleState.alarms = { blockedSlots: { 'pilot.engine': true } };
        s.dice.pilot = [{ v: 3, used: false }, { v: 3, used: false }, { v: 3, used: false }, { v: 3, used: false }];
      }
    },
    'visibility-roll': {
      label: '低能见度 · 掷骰阶段',
      moduleId: 'visibility',
      apply: function (s) {
        s.phase = 'roll';
        s.moduleState.visibility = { activeDiceLimit: 2 };
      }
    },
    'traffic-approach': {
      label: '交通 · 进近有飞机',
      moduleId: 'traffic',
      apply: function (s) {
        s.phase = 'reveal';
        s.distance = 4;
        s.traffic = [2, 3];
        s.placements.pilot.axis = { v: 3, mod: 0 };
        s.placements.copilot.axis = { v: 3, mod: 0 };
        s.placements.pilot.engine = { v: 2, mod: 0 };
        s.placements.copilot.engine = { v: 2, mod: 0 };
      }
    },
    'landing-final': {
      label: '终局 · 第 7 轮揭示',
      moduleId: 'traffic',
      apply: function (s) {
        var L = window.GameLogic;
        s.phase = 'reveal';
        s.round = L.CONFIG.ROUNDS;
        s.distance = 0;
        s.axis = 0;
        s.altitude = 0;
        s.gearAct = 4;
        s.flapsAct = 4;
        s.brakesAct = 3;
        s.traffic = [];
        s.placements.pilot.axis = { v: 3, mod: 0 };
        s.placements.copilot.axis = { v: 3, mod: 0 };
        s.placements.pilot.engine = { v: 2, mod: 0 };
        s.placements.copilot.engine = { v: 2, mod: 0 };
      }
    }
  },

  applyPreset: function (presetKey, moduleId) {
    var preset = this.PRESETS[presetKey];
    if (!preset) return null;
    var state = this.newLabState(preset.moduleId || moduleId);
    preset.apply(state);
    this.ensurePlacements(state);
    this.pushLog('ok', '加载预设: ' + preset.label);
    return state;
  },

  renderWidgetPreview: function (state, moduleId) {
    var mod = ModuleRegistry.get(moduleId);
    if (!mod || !mod.getWidgets) return '<div class="lab-muted">该模块无 getWidgets</div>';
    var widgets = mod.getWidgets(state, { state: state, logic: window.GameLogic, ui: { mode: 'local' } });
    if (!widgets || !widgets.length) return '<div class="lab-muted">getWidgets 返回空</div>';
    return widgets.map(function (w) {
      return '<div class="lab-widget-preview">' + (w.render ? w.render({ state: state, logic: window.GameLogic }) : '') + '</div>';
    }).join('');
  }
};

if (typeof window !== 'undefined') window.ModuleRunner = ModuleRunner;
