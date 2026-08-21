/* ============================================================
 * 天合小队 Sky Team —— 纯逻辑层（不依赖 DOM，可被 node 测试）
 * 机制参考：Sky Team (Luc Rémond, 2023, Spiel des Jahres 2024)
 * ============================================================ */
'use strict';

var CONFIG = {
  ROUNDS: 7,
  DICE_PER_PLAYER: 4,
  ALTITUDE_START: 7,
  DISTANCE_START: 6,
  AXIS_LIMIT: 3,
  TRAFFIC_START: [3],
  BLUE_START: 5,
  BLUE_MAX: 8,
  ORANGE_START: 8,
  ORANGE_MAX: 12,
  BRAKE_BASE: 2,
  BRAKE_STEP: 2,
  COFFEE_MAX: 3,
  COFFEE_SLOT_COUNT: 3,
  REROLL_START: 0,
  ALTITUDE_REROLL_SPACES: [7, 4],
  APPROACH_AXIS: {},
  GEAR_COUNT: 3,
  FLAP_COUNT: 4,
  BRAKE_COUNT: 3
};

var ROLES = { pilot: '机长', copilot: '副驾' };
var ROLE_COLOR = { pilot: 'blue', copilot: 'orange' };

/** 双方共用的放骰槽（集中精力 ☕） */
var SHARED_SLOTS = {
  coffee1: { name: '集中精力 ☕', coffee: true },
  coffee2: { name: '集中精力 ☕', coffee: true },
  coffee3: { name: '集中精力 ☕', coffee: true }
};

function isSharedSlot(slotName) {
  return Object.prototype.hasOwnProperty.call(SHARED_SLOTS, slotName);
}

function getSlotDef(role, slotName) {
  if (isSharedSlot(slotName)) return SHARED_SLOTS[slotName];
  return SLOTS[role] && SLOTS[role][slotName];
}

function getPlacement(s, role, slotName) {
  if (isSharedSlot(slotName)) return s.placements.shared[slotName];
  return s.placements[role][slotName];
}

function setPlacement(s, role, slotName, val) {
  if (isSharedSlot(slotName)) s.placements.shared[slotName] = val;
  else s.placements[role][slotName] = val;
}

var SLOTS = {
  pilot: {
    axis:    { name: '姿态',  mandatory: true },
    engine:  { name: '引擎',  mandatory: true },
    radio:   { name: '无线电' },
    gear1:   { name: '起落架 1/2', gear: true, limit: [1, 2] },
    gear2:   { name: '起落架 3/4', gear: true, limit: [3, 4] },
    gear3:   { name: '起落架 5/6', gear: true, limit: [5, 6] },
    brake1:  { name: '刹车 2', order: 'brake', limit: [2] },
    brake2:  { name: '刹车 4', order: 'brake', limit: [4] },
    brake3:  { name: '刹车 6', order: 'brake', limit: [6] }
  },
  copilot: {
    axis:    { name: '姿态',  mandatory: true },
    engine:  { name: '引擎',  mandatory: true },
    radio:   { name: '无线电·左' },
    radio2:  { name: '无线电·右' },
    flap1:   { name: '襟翼 1/2', order: 'flap', limit: [1, 2] },
    flap2:   { name: '襟翼 2/3', order: 'flap', limit: [2, 3] },
    flap3:   { name: '襟翼 4/5', order: 'flap', limit: [4, 5] },
    flap4:   { name: '襟翼 5/6', order: 'flap', limit: [5, 6] }
  }
};

function radioSlots(role) {
  return role === 'copilot' ? ['radio', 'radio2'] : ['radio'];
}

function emptyGearOn() {
  var o = {};
  for (var g = 1; g <= CONFIG.GEAR_COUNT; g++) o['gear' + g] = false;
  return o;
}
function emptyFlapsOn() {
  var o = {};
  for (var f = 1; f <= CONFIG.FLAP_COUNT; f++) o['flap' + f] = false;
  return o;
}
function emptyBrakesOn() {
  var o = {};
  for (var b = 1; b <= CONFIG.BRAKE_COUNT; b++) o['brake' + b] = false;
  return o;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function d6() { return 1 + Math.floor(Math.random() * 6); }

/** 关卡配置合并：场景 config 覆盖 CONFIG 默认值 */
function mergeConfig(overrides) {
  var cfg = {};
  Object.keys(CONFIG).forEach(function (k) { cfg[k] = CONFIG[k]; });
  if (overrides) Object.keys(overrides).forEach(function (k) { cfg[k] = overrides[k]; });
  return cfg;
}

/** 解析场景；浏览器端读 ScenarioRegistry，Node 测试回退内置默认 */
function resolveScenario(scenarioId) {
  if (typeof ScenarioRegistry !== 'undefined') {
    return ScenarioRegistry.get(scenarioId || ScenarioRegistry.defaultId);
  }
  return {
    id: 'builtin',
    name: '内置默认',
    config: {},
    modules: ['traffic'],
    setup: null
  };
}

function newGame(scenarioId) {
  var scenario = resolveScenario(scenarioId);
  var cfg = mergeConfig(scenario.config);
  var s = {
    phase: 'discuss',
    round: 1,
    startPlayer: 'pilot',
    currentPlayer: null,
    dice: {
      pilot:   [{ v: 0, used: false }, { v: 0, used: false }, { v: 0, used: false }, { v: 0, used: false }],
      copilot: [{ v: 0, used: false }, { v: 0, used: false }, { v: 0, used: false }, { v: 0, used: false }]
    },
    rolled: { pilot: false, copilot: false },
    placements: emptyPlacements(),
    axis: 0,
    altitude: cfg.ALTITUDE_START,
    distance: cfg.DISTANCE_START,
    waiting: false,
    traffic: (cfg.TRAFFIC_START || CONFIG.TRAFFIC_START).slice(),
    gearAct: 0, flapsAct: 0, brakesAct: 0,
    gearOn: emptyGearOn(),
    flapsOn: emptyFlapsOn(),
    brakesOn: emptyBrakesOn(),
    blueMark: cfg.BLUE_START,
    orangeMark: cfg.ORANGE_START,
    landingRound: false,
    coffee: 0,
    reroll: cfg.REROLL_START,
    rerollOnTrack: (cfg.ALTITUDE_REROLL_SPACES || CONFIG.ALTITUDE_REROLL_SPACES).slice(),
    coffeeUsed: {},
    roundResolved: { axis: false, engine: false },
    log: [],
    loseReason: '',
    finalStats: null,
    scenarioId: scenario.id,
    activeModules: (scenario.modules || []).slice(),
    moduleState: {}
  };
  if (scenario.setup) scenario.setup(s, cfg);
  if (typeof ModuleRegistry !== 'undefined') {
    s.activeModules.forEach(function (mid) {
      var mod = ModuleRegistry.get(mid);
      if (mod && mod.initState) s.moduleState[mid] = mod.initState(s, cfg);
    });
  }
  return s;
}

function emptyPlacements() {
  var p = { pilot: {}, copilot: {}, shared: {} };
  ['pilot', 'copilot'].forEach(function (r) {
    Object.keys(SLOTS[r]).forEach(function (s) { p[r][s] = null; });
  });
  Object.keys(SHARED_SLOTS).forEach(function (s) { p.shared[s] = null; });
  return p;
}
function effVal(s) { return s ? clamp(s.v + (s.mod || 0), 1, 6) : null; }
function hasTraffic(s, d) { return s.traffic.indexOf(d) !== -1; }
function clearTraffic(s, d) { s.traffic = s.traffic.filter(function (x) { return x !== d; }); }
function brakeValue(s) { return CONFIG.BRAKE_BASE + CONFIG.BRAKE_STEP * s.brakesAct; }
function getOrangeMark(s) { return s.orangeMark; }

function isLandingRound(s) { return !!s.landingRound; }
function isWaitingMode(s) { return s.distance === 0 && !s.landingRound; }

/** 无线电：骰点 N = 从当前位置起第 N 格（1=当前位置，2=前方第一格） */
function radioTarget(s, val) { return s.distance - (val - 1); }
function radioDieForDistance(s, targetDist) { return s.distance - targetDist + 1; }

function getApproachAxisRules(s) {
  var scenario = resolveScenario(s.scenarioId);
  var cfg = mergeConfig(scenario.config);
  return cfg.APPROACH_AXIS || CONFIG.APPROACH_AXIS || {};
}

/** 进近转弯：前进 k 格时，经过的每一格姿态须在允许范围内（官方 Approach Track Effects） */
function checkApproachAxis(s, fromDist, steps) {
  var rules = getApproachAxisRules(s);
  for (var step = 1; step <= steps; step++) {
    var d = fromDist - step;
    var allowed = rules[d];
    if (allowed && allowed.length && allowed.indexOf(s.axis) === -1) {
      return { ok: false, distance: d, allowed: allowed, axis: s.axis };
    }
  }
  return { ok: true };
}

function collectAltitudeReroll(s) {
  if (!s.rerollOnTrack || !s.rerollOnTrack.length) return;
  var i = s.rerollOnTrack.indexOf(s.altitude);
  if (i === -1) return;
  s.rerollOnTrack.splice(i, 1);
  s.reroll++;
  logPush(s, '🔄 高度 ' + s.altitude + ' 获得重掷标记（供应 ×' + s.reroll + '）');
}

/** 双方姿态骰都放满 → 立即比较并倾斜（官方：As soon as the second die is placed） */
function tryResolveAxisImmediate(s) {
  if (s.roundResolved && s.roundResolved.axis) return false;
  var pa = effVal(s.placements.pilot.axis);
  var ca = effVal(s.placements.copilot.axis);
  if (pa === null || ca === null) return false;
  if (!s.roundResolved) s.roundResolved = { axis: false, engine: false };
  s.roundResolved.axis = true;

  var diff = Math.abs(pa - ca);
  if (diff > 0) {
    s.axis += (pa > ca) ? diff : -diff;
    logPush(s, '⚡ 姿态 ' + pa + ' vs ' + ca + ' → 盘 ' + (s.axis > 0 ? '+' : '') + s.axis);
    if (Math.abs(s.axis) >= CONFIG.AXIS_LIMIT) {
      s.phase = 'lose';
      s.loseReason = '姿态失衡（' + s.axis + '），飞机进入尾旋坠毁！';
      logPush(s, '💥 ' + s.loseReason, 'lose');
      return true;
    }
  } else {
    logPush(s, '⚡ 姿态 ' + pa + ' = ' + ca + '，保持水平');
  }
  return false;
}

/** 双方引擎骰都放满 → 立即比较速度并推进（官方：As soon as the second die is placed） */
function tryResolveEngineImmediate(s) {
  if (s.roundResolved && s.roundResolved.engine) return false;
  var pe = effVal(s.placements.pilot.engine);
  var ce = effVal(s.placements.copilot.engine);
  if (pe === null || ce === null) return false;
  if (!s.roundResolved) s.roundResolved = { axis: false, engine: false };
  s.roundResolved.engine = true;

  var es = pe + ce;
  if (isLandingRound(s)) {
    if (es >= brakeValue(s)) {
      s.phase = 'lose';
      s.loseReason = '着陆速度过快！引擎和 ' + es + ' ≥ 刹车值 ' + brakeValue(s);
      logPush(s, '💥 ' + s.loseReason, 'lose');
      return true;
    }
    logPush(s, '⚡ 着陆轮速度检查：' + es + ' < ' + brakeValue(s) + ' ✓');
  } else if (isWaitingMode(s)) {
    if (es >= s.blueMark) {
      s.phase = 'lose';
      s.loseReason = '等待模式下引擎推进（' + es + ' ≥ ' + s.blueMark + '），冲出跑道坠毁！';
      logPush(s, '💥 ' + s.loseReason, 'lose');
      return true;
    }
    logPush(s, '⚡ 等待模式：速度 ' + es + ' 低于蓝标记 ' + s.blueMark + '，悬停安全');
  } else {
    var orange = getOrangeMark(s);
    var k = es < s.blueMark ? 0 : (es <= orange ? 1 : 2);
    if (k > 0) {
      if (hasTraffic(s, s.distance)) {
        s.phase = 'lose';
        s.loseReason = '碰撞！当前位置（距离 ' + s.distance + '）有飞机，必须前进（引擎和 ' + es + '）';
        logPush(s, '💥 ' + s.loseReason, 'lose');
        return true;
      }
      var fromDist = s.distance;
      var axisChk = checkApproachAxis(s, fromDist, k);
      if (!axisChk.ok) {
        s.phase = 'lose';
        s.loseReason = '进近转弯失败！距离 ' + axisChk.distance + ' 要求姿态 [' + axisChk.allowed.join(',') + ']，当前 ' + axisChk.axis;
        logPush(s, '💥 ' + s.loseReason, 'lose');
        return true;
      }
      s.distance -= k;
      if (s.distance < 0) {
        s.phase = 'lose';
        s.loseReason = '冲出跑道！飞过了机场';
        logPush(s, '💥 ' + s.loseReason, 'lose');
        return true;
      }
      if (s.distance === 0) {
        s.waiting = true;
        logPush(s, '🛬 抵达机场，进入等待模式！');
      }
      logPush(s, '⚡ 引擎 ' + es + ' → 前进 ' + k + ' 格，距机场 ' + s.distance);
    } else {
      logPush(s, '⚡ 引擎 ' + es + ' < 蓝标记 ' + s.blueMark + '，悬停');
    }
  }
  return false;
}

function resolveMandatoryImmediate(s) {
  tryResolveAxisImmediate(s);
  if (s.phase === 'lose') return;
  tryResolveEngineImmediate(s);
}

/** 放置后立即生效（对齐实体 Sky Team 官方规则）：
 *  无线电→清障 | 起落架/襟翼/刹车→拨杆 | 咖啡→+1
 *  姿态/引擎→双方槽位满第二颗时立即结算（见上） */
function applyPlacementEffect(s, role, slotName) {
  var p = getPlacement(s, role, slotName);
  if (!p || p._effectApplied) return;
  var def = getSlotDef(role, slotName);
  if (!def) return;
  var val = effVal(p);
  var applied = false;

  if (radioSlots(role).indexOf(slotName) !== -1 && val !== null) {
    var target = radioTarget(s, val);
    if (hasTraffic(s, target)) {
      clearTraffic(s, target);
      logPush(s, ROLES[role] + ' ' + def.name + '（骰点 ' + val + '）：清除距离 ' + target + ' 的飞机 ✂');
    } else {
      var hint = '';
      var ahead = s.traffic.filter(function (d) { return d < s.distance; }).sort(function (a, b) { return b - a; });
      if (ahead.length > 0) {
        var nearest = ahead[0];
        var need = radioDieForDistance(s, nearest);
        if (need >= 1 && need <= 6 && need !== val) {
          hint = '（最近前方飞机在距 ' + nearest + '，需骰点 ' + need + '，不是 ' + val + '）';
        }
      }
      logPush(s, ROLES[role] + ' ' + def.name + '（骰点 ' + val + '）：距离 ' + target + ' 无飞机' + hint);
    }
    applied = true;
  } else if (def.coffee) {
    if (s.coffee < CONFIG.COFFEE_MAX) {
      s.coffee++;
      logPush(s, ROLES[role] + ' 集中精力 → ☕ +1（' + s.coffee + '/' + CONFIG.COFFEE_MAX + '）');
    } else {
      logPush(s, ROLES[role] + ' 集中精力：☕ 已满，无额外获得');
    }
    applied = true;
  } else if (def.gear) {
    if (!s.gearOn[slotName]) {
      s.gearOn[slotName] = true;
      s.gearAct++;
      s.blueMark = clamp(CONFIG.BLUE_START + s.gearAct, CONFIG.BLUE_START, CONFIG.BLUE_MAX);
      logPush(s, '起落架「' + def.name + '」激活 → 蓝标记 ' + s.blueMark);
    } else {
      logPush(s, '起落架「' + def.name + '」已激活，放置无效果');
    }
    applied = true;
  } else if (def.order === 'flap' && !s.flapsOn[slotName]) {
    s.flapsOn[slotName] = true;
    s.flapsAct++;
    s.orangeMark = clamp(s.orangeMark + 1, CONFIG.ORANGE_START, CONFIG.ORANGE_MAX);
    logPush(s, '襟翼「' + def.name + '」激活 ' + s.flapsAct + '/' + CONFIG.FLAP_COUNT + ' → 橙标记 ' + s.orangeMark);
    applied = true;
  } else if (def.order === 'brake' && !s.brakesOn[slotName]) {
    s.brakesOn[slotName] = true;
    s.brakesAct++;
    logPush(s, '刹车「' + def.name + '」激活 → 刹车值 ' + brakeValue(s));
    applied = true;
  }

  if (applied) p._effectApplied = true;
}

function applyAllPlacementEffects(s) {
  ['pilot', 'copilot'].forEach(function (r) {
    Object.keys(s.placements[r]).forEach(function (slotName) {
      if (s.placements[r][slotName]) applyPlacementEffect(s, r, slotName);
    });
  });
  Object.keys(s.placements.shared).forEach(function (slotName) {
    if (s.placements.shared[slotName]) applyPlacementEffect(s, 'pilot', slotName);
  });
}

function logPush(s, msg, cls) {
  s.log.unshift({ rd: s.round, msg: msg, cls: cls || '' });
  if (s.log.length > 60) s.log.pop();
}

function callModuleHook(hookName, s) {
  if (typeof ModuleRegistry === 'undefined') return;
  var args = Array.prototype.slice.call(arguments, 2);
  s.activeModules.forEach(function (mid) {
    var mod = ModuleRegistry.get(mid);
    if (mod && typeof mod[hookName] === 'function') {
      mod[hookName].apply(mod, [s].concat(args));
    }
  });
}

function beginRound(s) {
  s.placements = emptyPlacements();
  s.rolled = { pilot: false, copilot: false };
  s.dice = {
    pilot:   [{ v: 0, used: false }, { v: 0, used: false }, { v: 0, used: false }, { v: 0, used: false }],
    copilot: [{ v: 0, used: false }, { v: 0, used: false }, { v: 0, used: false }, { v: 0, used: false }]
  };
  s.startPlayer = (s.round % 2 === 1) ? 'pilot' : 'copilot';
  s.currentPlayer = null;
  s.phase = 'discuss';
  s.landingRound = (s.distance === 0 && s.altitude <= 1);
  s.waiting = (s.distance === 0 && !s.landingRound);
  s.roundResolved = { axis: false, engine: false };
  logPush(s, '—— 第 ' + s.round + ' 轮开始 ——');
  collectAltitudeReroll(s);
  callModuleHook('onBeginRound', s);
}

function rollDice(s, role) {
  if (s.phase !== 'roll') return false;
  s.dice[role].forEach(function (d) { d.v = d6(); d.used = false; });
  s.rolled[role] = true;
  callModuleHook('onRollDice', s, role);
  return true;
}
function rerollAll(s) {
  if (s.reroll <= 0) return false;
  if (s.phase !== 'roll' && s.phase !== 'place') return false;
  s.reroll--;
  if (s.phase === 'roll') {
    s.rolled = { pilot: false, copilot: false };
    logPush(s, '使用重掷标记，双方全部骰子重掷！');
  } else {
    ['pilot', 'copilot'].forEach(function (r) {
      s.dice[r].forEach(function (d) {
        if (!d.used) d.v = d6();
      });
    });
    logPush(s, '使用重掷标记，双方未用骰子重掷！');
  }
  callModuleHook('onRerollAll', s);
  return true;
}

function slotAllowed(s, role, slotName, dieValue) {
  var def = getSlotDef(role, slotName);
  if (!def) return { ok: false, why: '不存在的槽位' };
  if (getPlacement(s, role, slotName) != null) return { ok: false, why: '该槽位已占用' };
  if (def.gear && s.gearOn[slotName]) {
    /* 已激活的起落架槽仍可放置，但无额外效果（官方规则） */
  }
  if (def.order === 'flap') {
    var fn = +slotName.replace('flap', '');
    if (s.flapsAct + 1 !== fn) {
      return { ok: false, why: '襟翼须按顺序激活（下一个：襟翼 ' + (s.flapsAct + 1) + '）' };
    }
    if (s.flapsOn[slotName]) return { ok: false, why: '该襟翼已激活' };
  }
  if (def.order === 'brake') {
    var bn = +slotName.replace('brake', '');
    if (s.brakesAct + 1 !== bn) {
      var needVal = [2, 4, 6][bn - 1];
      return { ok: false, why: '刹车须按顺序激活（下一个：点数 ' + needVal + '）' };
    }
    if (s.brakesOn[slotName]) return { ok: false, why: '该刹车已激活' };
  }
  if (dieValue !== undefined && def.limit && def.limit.indexOf(dieValue) === -1) {
    return { ok: false, why: '该槽位只接受点数 ' + def.limit.join('/') };
  }
  if (typeof ModuleRegistry !== 'undefined') {
    for (var i = 0; i < s.activeModules.length; i++) {
      var mod = ModuleRegistry.get(s.activeModules[i]);
      if (mod && mod.slotAllowed) {
        var chk = mod.slotAllowed(s, role, slotName, def);
        if (chk && !chk.ok) return chk;
      }
    }
  }
  return { ok: true };
}
function dieValueAllowed(def, v) {
  if (!def.limit) return true;
  return def.limit.indexOf(v) !== -1;
}

function placeDie(s, role, dieIdx, slotName, opts) {
  opts = opts || {};
  if (s.phase !== 'place') return { ok: false, why: '当前不是放置阶段' };
  if (s.currentPlayer !== role) return { ok: false, why: '还没轮到' + ROLES[role] };
  var die = s.dice[role][dieIdx];
  if (!die || die.used) return { ok: false, why: '骰子不可用' };
  if (die.v === 0) return { ok: false, why: '尚未掷骰' };

  var cPlus = Math.max(0, opts.coffeePlus | 0);
  var cMinus = Math.max(0, opts.coffeeMinus | 0);
  var coffeeSpent = cPlus + cMinus;
  if (coffeeSpent > s.coffee) return { ok: false, why: '咖啡不足（需要 ' + coffeeSpent + '，剩余 ' + s.coffee + '）' };
  var finalV = die.v + cPlus - cMinus;
  if (finalV < 1 || finalV > 6) return { ok: false, why: '咖啡修正后点数须在 1~6（当前 ' + finalV + '）' };

  var chk = slotAllowed(s, role, slotName, finalV);
  if (!chk.ok) return { ok: false, why: chk.why };
  var def = getSlotDef(role, slotName);

  die.used = true;
  setPlacement(s, role, slotName, { v: die.v, mod: finalV - die.v });
  if (coffeeSpent > 0) {
    s.coffee -= coffeeSpent;
    logPush(s, '☕ 放置前修正骰子 ' + die.v + ' → ' + finalV + '（+' + cPlus + '/−' + cMinus + '，剩 ' + s.coffee + '）');
  }
  logPush(s, ROLES[role] + ' 在「' + def.name + '」放置骰子' + (finalV !== die.v ? '（' + finalV + '）' : ''));
  applyPlacementEffect(s, role, slotName);
  resolveMandatoryImmediate(s);
  callModuleHook('onPlaceDie', s, role, dieIdx, slotName);
  if (s.phase === 'lose') return { ok: true };
  nextPlace(s);
  return { ok: true };
}

function nextPlace(s) {
  var placed = 0;
  ['pilot', 'copilot'].forEach(function (r) {
    Object.keys(s.placements[r]).forEach(function (k) {
      if (s.placements[r][k]) placed++;
    });
  });
  Object.keys(s.placements.shared).forEach(function (k) {
    if (s.placements.shared[k]) placed++;
  });
  if (placed >= CONFIG.DICE_PER_PLAYER * 2) {
    s.phase = 'reveal';
    s.currentPlayer = null;
    logPush(s, '双方放置完毕，揭示！');
    return;
  }
  s.currentPlayer = (s.currentPlayer === 'pilot') ? 'copilot' : 'pilot';
  var mine = 0;
  Object.keys(s.placements[s.currentPlayer]).forEach(function (k) {
    if (s.placements[s.currentPlayer][k]) mine++;
  });
  if (mine >= CONFIG.DICE_PER_PLAYER) {
    s.currentPlayer = (s.currentPlayer === 'pilot') ? 'copilot' : 'pilot';
  }
}

function useCoffee(s, role, slotName, delta) {
  return false;
}

function resolveRound(s) {
  if (s.phase !== 'reveal') return false;
  callModuleHook('beforeResolveRound', s);
  applyAllPlacementEffects(s);
  resolveMandatoryImmediate(s);
  if (s.phase === 'lose') return true;

  var pa = effVal(s.placements.pilot.axis), ca = effVal(s.placements.copilot.axis);
  var pe = effVal(s.placements.pilot.engine), ce = effVal(s.placements.copilot.engine);
  if (pa === null || ca === null || pe === null || ce === null) {
    s.phase = 'lose';
    s.loseReason = '强制槽位未填满（每轮须各放 1 颗在姿态与引擎）';
    logPush(s, '💥 ' + s.loseReason, 'lose');
    return true;
  }

  s.altitude--;
  logPush(s, '高度下降 → ' + s.altitude);
  callModuleHook('afterResolveRound', s);

  if (s.altitude === 0 && s.distance !== 0) {
    s.phase = 'lose';
    s.loseReason = '高度归零仍未到达机场，迫降坠毁！';
    logPush(s, '💥 ' + s.loseReason, 'lose');
    return true;
  }

  var isGameEnd = (s.altitude === 0 && s.distance === 0) || s.round === CONFIG.ROUNDS;
  if (isGameEnd) {
    var fails = [];
    if (s.distance !== 0) fails.push('未到达机场（距 ' + s.distance + '）');
    if (s.axis !== 0) fails.push('姿态未水平（' + s.axis + '）');
    if (s.gearAct < CONFIG.GEAR_COUNT) fails.push('起落架未全部激活（' + s.gearAct + '/' + CONFIG.GEAR_COUNT + '）');
    if (s.flapsAct < CONFIG.FLAP_COUNT) fails.push('襟翼未全部激活（' + s.flapsAct + '/' + CONFIG.FLAP_COUNT + '）');
    if (s.traffic.length > 0) fails.push('路径仍有 ' + s.traffic.length + ' 架飞机');
    if (typeof ModuleRegistry !== 'undefined') {
      s.activeModules.forEach(function (mid) {
        var mod = ModuleRegistry.get(mid);
        if (mod && mod.checkWin) {
          var extra = mod.checkWin(s);
          if (extra && extra.length) fails = fails.concat(extra);
        }
      });
    }
    if (fails.length === 0) {
      s.phase = 'win';
      s.finalStats = { rounds: s.round, axis: s.axis, gear: s.gearAct, flaps: s.flapsAct, coffee: s.coffee, reroll: s.reroll };
      logPush(s, '🏆 降落成功！欢迎抵达。', 'win');
    } else {
      s.phase = 'lose'; s.loseReason = '降落条件未满足：' + fails.join('；');
      logPush(s, '💥 ' + s.loseReason, 'lose');
    }
  } else {
    s.phase = 'roundEnd';
    logPush(s, '—— 第 ' + s.round + ' 轮结束 ——');
  }
  return true;
}

function nextRound(s) {
  if (s.phase !== 'roundEnd') return false;
  s.round++;
  beginRound(s);
  return true;
}

var GameLogic = {
  CONFIG: CONFIG, ROLES: ROLES, SLOTS: SLOTS, SHARED_SLOTS: SHARED_SLOTS,
  isSharedSlot: isSharedSlot, getSlotDef: getSlotDef, getPlacement: getPlacement,
  mergeConfig: mergeConfig, resolveScenario: resolveScenario,
  newGame: newGame, beginRound: beginRound,
  rollDice: rollDice, rerollAll: rerollAll,
  placeDie: placeDie, useCoffee: useCoffee,
  resolveRound: resolveRound, nextRound: nextRound,
  applyPlacementEffect: applyPlacementEffect, applyAllPlacementEffects: applyAllPlacementEffects,
  tryResolveAxisImmediate: tryResolveAxisImmediate, tryResolveEngineImmediate: tryResolveEngineImmediate,
  effVal: effVal, brakeValue: brakeValue, orangeMark: getOrangeMark, getOrangeMark: getOrangeMark,
  radioTarget: radioTarget, radioDieForDistance: radioDieForDistance, isLandingRound: isLandingRound, isWaitingMode: isWaitingMode,
  checkApproachAxis: checkApproachAxis, collectAltitudeReroll: collectAltitudeReroll,
  getApproachAxisRules: getApproachAxisRules,
  hasTraffic: hasTraffic, slotAllowed: slotAllowed, radioSlots: radioSlots
};
if (typeof window !== 'undefined') window.GameLogic = GameLogic;
if (typeof module !== 'undefined' && module.exports) module.exports = GameLogic;
