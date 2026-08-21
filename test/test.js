/* 天合小队 Sky Team 逻辑层冒烟测试 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { loadGameLogic } = require(path.join(ROOT, 'src/logic/load-logic'));
const isNum = (s) => /^\d+$/.test(s || '');
const N = isNum(process.argv[2]) ? parseInt(process.argv[2], 10)
       : isNum(process.argv[3]) ? parseInt(process.argv[3], 10) : 500;
const baseDir = ROOT;
const Logic = loadGameLogic(baseDir);
let wins = 0, loses = 0, errors = 0, stuck = 0;
const loseReasons = {};
let lastAxis = { pilot: 3, copilot: 3 }; // 模拟讨论阶段约定：都瞄准中值 3

function byVal(free, target) {
  return [...free].sort((a, b) => Math.abs(a.d.v - target) - Math.abs(b.d.v - target))[0];
}

function nextRadioSlot(p, role) {
  if (!p.radio) return 'radio';
  if (role === 'copilot' && !p.radio2) return 'radio2';
  return null;
}

function pickDieForSlot(free, role, slot, Logic) {
  var def = Logic.SLOTS[role][slot];
  if (!def || !def.limit) return free[Math.floor(Math.random() * free.length)];
  var ok = free.filter(function (x) { return def.limit.indexOf(x.d.v) !== -1; });
  return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
}

function findEquipMove(s, role, p, free) {
  if (role === 'pilot') {
    if (s.brakesAct < Logic.CONFIG.BRAKE_COUNT) {
      var bs = 'brake' + (s.brakesAct + 1);
      if (!p[bs]) {
        var bd = pickDieForSlot(free, role, bs, Logic);
        if (bd) return { target: bs, diePick: bd };
      }
    }
    var gears = [];
    for (var g = 1; g <= Logic.CONFIG.GEAR_COUNT; g++) {
      var gs = 'gear' + g;
      if (s.gearOn && !s.gearOn[gs] && !p[gs]) gears.push(gs);
    }
    for (var i = 0; i < gears.length; i++) {
      var gd = pickDieForSlot(free, role, gears[i], Logic);
      if (gd) return { target: gears[i], diePick: gd };
    }
  } else {
    if (s.flapsAct < Logic.CONFIG.FLAP_COUNT) {
      var fs = 'flap' + (s.flapsAct + 1);
      if (!p[fs]) {
        var fd = pickDieForSlot(free, role, fs, Logic);
        if (fd) return { target: fs, diePick: fd };
      }
    }
  }
  return null;
}

function placeHeuristic(s) {
  const role = s.currentPlayer;
  const free = s.dice[role].map((d, i) => ({ d, i })).filter(x => !x.d.used);
  if (!free.length) return;
  const p = s.placements[role];
  let target = null, diePick = null;

  if (!p.axis) {
    target = 'axis';
    // 目标：抵消当前轴（axis>0 放低值拉回，axis<0 放高值，水平放中值 3）
    const aim = s.axis > 0 ? 2 : s.axis < 0 ? 4 : 3;
    diePick = byVal(free, aim);
  } else if (!p.engine) {
    target = 'engine';
    diePick = (s.round === Logic.CONFIG.ROUNDS)
      ? [...free].sort((a, b) => a.d.v - b.d.v)[0]
      : byVal(free, 3);
  } else {
    const nearPlane = Logic.hasTraffic(s, s.distance - 1) || Logic.hasTraffic(s, s.distance - 2);
    const radioSlot = nearPlane ? nextRadioSlot(p, role) : null;
    if (radioSlot) {
      target = radioSlot;
      diePick = free.find(x => x.d.v === 1) || free.find(x => x.d.v === 2) || free[0];
    } else {
      const equip = findEquipMove(s, role, p, free);
      if (equip) { target = equip.target; diePick = equip.diePick; }
      else if (!p.coffee) { target = 'coffee'; diePick = free[Math.floor(Math.random() * free.length)]; }
      else {
        var moves = [];
        Object.keys(Logic.SLOTS[role]).forEach(function (k) {
          if (p[k] !== null) return;
          free.forEach(function (x) {
            if (Logic.slotAllowed(s, role, k, x.d.v).ok) moves.push({ target: k, diePick: x });
          });
        });
        if (!moves.length) return;
        var pick = moves[Math.floor(Math.random() * moves.length)];
        target = pick.target;
        diePick = pick.diePick;
      }
    }
  }
  if (!target || !diePick) return;
  var opts = {};
  var def = Logic.SLOTS[role][target];
  if (def.limit && def.limit.indexOf(diePick.d.v) === -1 && s.coffee > 0) {
    for (var plus = 0; plus <= s.coffee; plus++) {
      for (var minus = 0; plus + minus <= s.coffee; minus++) {
        var nv = diePick.d.v + plus - minus;
        if (nv >= 1 && nv <= 6 && def.limit.indexOf(nv) !== -1) {
          opts = { coffeePlus: plus, coffeeMinus: minus };
          plus = s.coffee + 1; break;
        }
      }
    }
  }
  const res = Logic.placeDie(s, role, diePick.i, target, opts);
  if (res.ok && target === 'axis') lastAxis[role] = diePick.d.v;
}

function autoPlay(s) {
  switch (s.phase) {
    case 'discuss': s.phase = 'roll'; break;
    case 'roll':
      Logic.rollDice(s, 'pilot');
      Logic.rollDice(s, 'copilot');
      if (s.reroll > 0 && Math.random() < 0.3) {
        Logic.rerollAll(s);
        Logic.rollDice(s, 'pilot');
        Logic.rollDice(s, 'copilot');
      }
      s.phase = 'place';
      s.currentPlayer = s.startPlayer;
      break;
    case 'place': placeHeuristic(s); break;
    case 'reveal': Logic.resolveRound(s); break;
    case 'roundEnd': Logic.nextRound(s); break;
  }
}

for (let i = 0; i < N; i++) {
  try {
    const s = Logic.newGame();
    Logic.beginRound(s);
    lastAxis = { pilot: 3, copilot: 3 };
    let guard = 0;
    while (s.phase !== 'win' && s.phase !== 'lose') {
      autoPlay(s);
      if (++guard > 500) { stuck++; break; }
    }
    if (s.phase === 'win') wins++;
    else if (s.phase === 'lose') {
      loses++;
      const short = s.loseReason.split('（')[0];
      loseReasons[short] = (loseReasons[short] || 0) + 1;
    }
  } catch (e) {
    errors++;
    console.error('✗ 异常：', e.message);
  }
}

console.log(`=== 模拟 ${N} 局 ===`);
console.log(`胜：${wins}（${(wins / N * 100).toFixed(1)}%） 负：${loses}（${(loses / N * 100).toFixed(1)}%） 卡死：${stuck} 异常：${errors}`);
console.log('\n输因分布（按大类）：');
Object.entries(loseReasons).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${v.toString().padStart(4)}  ${(v / N * 100).toFixed(1)}%  ${k}`);
});
console.log('\n✓ 逻辑层冒烟测试完成');

/* ---------- 专项：失败路径验证 ---------- */
console.log('\n=== 失败路径专项验证 ===');
function failTest(name, setup, expectInReason) {
  const s = Logic.newGame();
  Logic.beginRound(s);
  setup(s);
  s.phase = 'reveal';   // resolveRound 仅在 reveal 阶段执行
  Logic.resolveRound(s);
  const ok = s.phase === 'lose' && (!expectInReason || s.loseReason.indexOf(expectInReason) !== -1);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + ' → ' + (s.phase === 'lose' ? s.loseReason : 'phase=' + s.phase));
  if (!ok) process.exitCode = 1;
}
failTest('碰撞（当前位置有飞机+须前进）', s => {
  s.distance = 5; s.traffic = [5];
  s.placements.pilot.axis = {v: 3, mod: 0}; s.placements.copilot.axis = {v: 3, mod: 0};
  s.placements.pilot.engine = {v: 6, mod: 0}; s.placements.copilot.engine = {v: 6, mod: 0};
}, '碰撞');
failTest('姿态 ±3 尾旋', s => {
  s.placements.pilot.axis = {v: 6, mod: 0}; s.placements.copilot.axis = {v: 1, mod: 0};
  s.placements.pilot.engine = {v: 3, mod: 0}; s.placements.copilot.engine = {v: 3, mod: 0};
}, '姿态失衡');
failTest('等待模式推进', s => {
  s.distance = 0; s.waiting = true;
  s.placements.pilot.axis = {v: 3, mod: 0}; s.placements.copilot.axis = {v: 3, mod: 0};
  s.placements.pilot.engine = {v: 4, mod: 0}; s.placements.copilot.engine = {v: 4, mod: 0};
}, '等待模式');
failTest('冲出跑道', s => {
  s.distance = 1; s.traffic = [];
  s.placements.pilot.axis = {v: 3, mod: 0}; s.placements.copilot.axis = {v: 3, mod: 0};
  s.placements.pilot.engine = {v: 6, mod: 0}; s.placements.copilot.engine = {v: 6, mod: 0};
}, '冲出跑道');

/* 即时生效：第二颗引擎放上即推进/撞机 */
(function () {
  var s = Logic.newGame();
  Logic.beginRound(s);
  s.phase = 'place';
  s.distance = 5;
  s.traffic = [5];
  s.placements.pilot.axis = { v: 3, mod: 0 };
  s.placements.copilot.axis = { v: 3, mod: 0 };
  s.placements.pilot.engine = { v: 6, mod: 0 };
  s.placements.copilot.engine = { v: 6, mod: 0 };
  s.roundResolved = { axis: false, engine: false };
  Logic.tryResolveAxisImmediate(s);
  Logic.tryResolveEngineImmediate(s);
  var ok = s.phase === 'lose' && s.loseReason.indexOf('碰撞') !== -1 && s.roundResolved.engine;
  console.log((ok ? '  ✓ ' : '  ✗ ') + '第二颗引擎立即碰撞 → ' + (ok ? s.loseReason : 'phase=' + s.phase));
  if (!ok) process.exitCode = 1;
})();

console.log('✓ 失败路径专项验证完成');
