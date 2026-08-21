/* 基础玩法模块冒烟测试（Node，零构建） */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadGameLogic } = require('./src/logic/load-logic');

const baseDir = __dirname;
const Logic = loadGameLogic(baseDir);

function loadScript(relativePath) {
  const full = path.join(baseDir, relativePath);
  const code = fs.readFileSync(full, 'utf8') +
    '\nif(typeof ModuleRegistry!=="undefined"){global.ModuleRegistry=ModuleRegistry;}' +
    '\nif(typeof ScenarioRegistry!=="undefined"){global.ScenarioRegistry=ScenarioRegistry;}';
  new Function(code)();
}

loadScript('src/scenarios/scenario-registry.js');
loadScript('src/scenarios/module-registry.js');
const ModuleRegistry = global.ModuleRegistry;
const ScenarioRegistry = global.ScenarioRegistry;

let passed = 0;
let failed = 0;

function assert(cond, name, detail) {
  if (cond) {
    passed++;
    console.log('  ✓', name);
  } else {
    failed++;
    console.log('  ✗', name, detail ? '→ ' + detail : '');
  }
}

function labState(moduleId) {
  const scenario = Logic.resolveScenario('training');
  const cfg = Logic.mergeConfig(scenario.config);
  const s = Logic.newGame('training');
  s.activeModules = [moduleId];
  s.moduleState = {};
  const mod = ModuleRegistry.get(moduleId);
  if (mod && mod.initState) s.moduleState[moduleId] = mod.initState(s, cfg);
  ['pilot', 'copilot'].forEach((r) => {
    Object.keys(Logic.SLOTS[r]).forEach((slot) => {
      if (s.placements[r][slot] === undefined) s.placements[r][slot] = null;
    });
  });
  return s;
}

function fillReveal(s) {
  s.phase = 'reveal';
  s.placements.pilot.axis = { v: 3, mod: 0 };
  s.placements.copilot.axis = { v: 3, mod: 0 };
  s.placements.pilot.engine = { v: 2, mod: 0 };
  s.placements.copilot.engine = { v: 2, mod: 0 };
}

console.log('=== 基础模块测试 ===\n');

/* ---------- traffic（核心层逻辑） ---------- */
console.log('[traffic] 空中交通（logicOwner: core）');
{
  const s = Logic.newGame('training');
  assert(s.traffic.indexOf(3) !== -1, 'training 场景初始有距离 3 的飞机');
  assert(Logic.hasTraffic(s, 3), 'hasTraffic(3)');

  const s2 = Logic.newGame('training');
  s2.phase = 'reveal';
  s2.distance = 4;
  s2.traffic = [2, 3];
  fillReveal(s2);
  s2.placements.pilot.radio = { v: 2, mod: 0 };
  Logic.applyPlacementEffect(s2, 'pilot', 'radio');
  assert(!Logic.hasTraffic(s2, 3), '无线电 2 清除前方第一格（距 3）飞机');
  assert(Logic.hasTraffic(s2, 2), '更远的飞机（距 2）仍在');

  const s2b = Logic.newGame('training');
  s2b.distance = 4;
  s2b.traffic = [4, 2];
  s2b.placements.pilot.radio = { v: 1, mod: 0 };
  Logic.applyPlacementEffect(s2b, 'pilot', 'radio');
  assert(!Logic.hasTraffic(s2b, 4), '无线电 1 清除当前位置（距 4）飞机');
  assert(Logic.hasTraffic(s2b, 2), '更远的飞机仍在');

  const s3 = Logic.newGame('training');
  s3.phase = 'reveal';
  s3.distance = 4;
  s3.traffic = [3];
  fillReveal(s3);
  s3.placements.pilot.engine = { v: 6, mod: 0 };
  s3.placements.copilot.engine = { v: 6, mod: 0 };
  s3.gearAct = 4;
  s3.flapsAct = 4;
  s3.blueMark = 6;
  Logic.resolveRound(s3);
  assert(s3.phase === 'lose' && s3.loseReason.indexOf('碰撞') !== -1, '推进路径撞机坠毁');

  const mod = ModuleRegistry.get('traffic');
  assert(mod.logicOwner === 'core', 'Registry 标记 logicOwner=core');
  assert(typeof mod.initState !== 'function', 'traffic 无 initState Hook');
}

/* ---------- turbulence ---------- */
console.log('\n[turbulence] 湍流');
{
  const mod = ModuleRegistry.get('turbulence');
  const s = labState('turbulence');
  assert(s.moduleState.turbulence.turbulenceRounds !== undefined, 'initState 返回 turbulenceRounds');

  s.phase = 'place';
  s.round = 3;
  s.moduleState.turbulence.turbulenceRounds = [3];
  s.dice.pilot = [{ v: 4, used: true }, { v: 2, used: false }, { v: 6, used: false }, { v: 1, used: false }];
  const before = s.dice.pilot.filter((d) => !d.used).map((d) => d.v);
  mod.onPlaceDie(s, 'pilot', 0, 'axis');
  const after = s.dice.pilot.filter((d) => !d.used).map((d) => d.v);
  assert(after.length === before.length, '湍流轮只重掷未用骰，数量不变');
  assert(after.every((v) => v >= 1 && v <= 6), '重掷后点数在 1-6');

  s.round = 2;
  const snap = s.dice.pilot.map((d) => d.v);
  mod.onPlaceDie(s, 'pilot', 0, 'engine');
  assert(JSON.stringify(s.dice.pilot.map((d) => d.v)) === JSON.stringify(snap), '非湍流轮不重掷');
}

/* ---------- visibility ---------- */
console.log('\n[visibility] 低能见度');
{
  const mod = ModuleRegistry.get('visibility');
  const s = labState('visibility');
  assert(mod.getDiceLimit(s) === 2, 'getDiceLimit 返回 2');
  assert(s.moduleState.visibility.activeDiceLimit === 2, 'initState activeDiceLimit=2');
}

/* ---------- alarms ---------- */
console.log('\n[alarms] 警报面板');
{
  const mod = ModuleRegistry.get('alarms');
  const s = labState('alarms');
  s.moduleState.alarms.blockedSlots['pilot.engine'] = true;
  const ok = mod.slotAllowed(s, 'pilot', 'engine', Logic.SLOTS.pilot.engine);
  assert(!ok.ok && ok.why.indexOf('警报') !== -1, '锁定槽位 slotAllowed 拒绝');
  const ok2 = mod.slotAllowed(s, 'pilot', 'axis', Logic.SLOTS.pilot.axis);
  assert(ok2.ok, '未锁定槽位可通过');

  s.phase = 'place';
  s.currentPlayer = 'pilot';
  s.dice.pilot[0].v = 3;
  const viaCore = Logic.slotAllowed(s, 'pilot', 'engine');
  assert(!viaCore.ok, 'Core.slotAllowed 聚合模块拒绝引擎槽');
}

/* ---------- kerosene ---------- */
console.log('\n[kerosene] 燃油');
{
  const mod = ModuleRegistry.get('kerosene');
  const s = labState('kerosene');
  assert(s.moduleState.kerosene.fuel === 42, 'initState 默认 fuel=42');

  s.phase = 'reveal';
  fillReveal(s);
  Logic.resolveRound(s);
  assert(s.moduleState.kerosene.fuel === 36, 'afterResolveRound 每轮 -6');

  s.moduleState.kerosene.fuel = 3;
  mod.afterResolveRound(s);
  assert(s.phase === 'lose' && s.loseReason.indexOf('燃油') !== -1, 'fuel≤0 坠机');
  assert(mod.checkWin(s).indexOf('燃油耗尽') !== -1, 'checkWin 返回燃油耗尽');
}

/* ---------- wind / interns / penguins / ice-brakes（占位 initState） ---------- */
console.log('\n[占位模块] initState 不抛错');
['wind', 'interns', 'penguins', 'ice-brakes'].forEach((id) => {
  try {
    const s = labState(id);
    assert(s.moduleState[id] !== undefined, id + ' initState 有返回值');
  } catch (e) {
    failed++;
    console.log('  ✗', id, '→', e.message);
  }
});

/* ---------- 槽位点数与顺序（Sky Team 官方规则） ---------- */
console.log('\n[core] 高度轨重掷 + 进近转弯');
{
  const s = Logic.newGame('training');
  Logic.beginRound(s);
  assert(s.reroll === 1, '第 1 轮初（高度 7）收入 1 枚重掷');
  assert(s.rerollOnTrack.indexOf(7) === -1, '高度 7 轨上标记已收走');

  ScenarioRegistry.register({
    id: '_axis_test',
    name: 'test',
    config: { APPROACH_AXIS: { 4: [0] } },
    modules: []
  });
  const sAxis = Logic.newGame('_axis_test');
  sAxis.axis = 2;
  assert(!Logic.checkApproachAxis(sAxis, 5, 1).ok, '姿态 2 不满足距 4 要求 [0]');
  sAxis.axis = 0;
  assert(Logic.checkApproachAxis(sAxis, 5, 1).ok, '姿态 0 满足距 4 要求');

  const sEng = Logic.newGame('_axis_test');
  sEng.phase = 'place';
  sEng.distance = 5;
  sEng.axis = 2;
  sEng.traffic = [];
  sEng.placements.pilot.axis = { v: 3, mod: 0 };
  sEng.placements.copilot.axis = { v: 3, mod: 0 };
  sEng.placements.pilot.engine = { v: 6, mod: 0 };
  sEng.placements.copilot.engine = { v: 3, mod: 0 };
  sEng.roundResolved = { axis: true, engine: false };
  Logic.tryResolveEngineImmediate(sEng);
  assert(sEng.phase === 'lose' && sEng.loseReason.indexOf('进近转弯') !== -1, '进近转弯失败即时判负');
}

console.log('\n[slot-rules] 起落架 / 襟翼 / 刹车点数与顺序');
{
  function prepPlace(role) {
    const s = Logic.newGame('training');
    s.phase = 'place';
    s.currentPlayer = role;
    s.dice[role].forEach((d, i) => { d.v = i + 1; d.used = false; });
    return s;
  }

  let s = prepPlace('pilot');
  assert(!Logic.slotAllowed(s, 'pilot', 'gear3', 5).ok, 'gear3 拒绝点数 5');
  assert(Logic.slotAllowed(s, 'pilot', 'gear3', 3).ok, 'gear3 接受点数 3');
  assert(!Logic.slotAllowed(s, 'pilot', 'gear1', 3).ok, 'gear1 只接受 1/2');

  s = prepPlace('pilot');
  assert(!Logic.slotAllowed(s, 'pilot', 'brake2', 4).ok, '未激活 brake1 时不可放 brake2');
  assert(Logic.slotAllowed(s, 'pilot', 'brake1', 2).ok, 'brake1 接受点数 2');
  s.brakesAct = 1;
  s.brakesOn.brake1 = true;
  assert(Logic.slotAllowed(s, 'pilot', 'brake2', 4).ok, 'brake1 后 brake2 接受点数 4');

  s = prepPlace('copilot');
  assert(!Logic.slotAllowed(s, 'copilot', 'flap2', 2).ok, '未激活 flap1 时不可放 flap2');
  assert(Logic.slotAllowed(s, 'copilot', 'flap1', 1).ok, 'flap1 接受点数 1');
  s.flapsAct = 1;
  s.flapsOn.flap1 = true;
  assert(Logic.slotAllowed(s, 'copilot', 'flap2', 2).ok, 'flap2 接受点数 2');
  s.flapsAct = 3;
  s.flapsOn.flap1 = true;
  s.flapsOn.flap2 = true;
  s.flapsOn.flap3 = true;
  assert(Logic.slotAllowed(s, 'copilot', 'flap4', 6).ok, 'flap4 接受点数 6');
  assert(!Logic.slotAllowed(s, 'copilot', 'flap4', 4).ok, 'flap4 拒绝点数 4');

  s = prepPlace('pilot');
  assert(Logic.slotAllowed(s, 'pilot', 'radio', 5).ok, '机长无线电任意点数');
  s = prepPlace('copilot');
  assert(Logic.slotAllowed(s, 'copilot', 'radio2', 3).ok, '副驾第二无线电槽任意点数');
}

/* ---------- 场景 + 模块组合 ---------- */
console.log('\n[scenario] yul 默认启用 traffic');
{
  const s = Logic.newGame('yul');
  assert(s.activeModules.indexOf('traffic') !== -1, 'activeModules 含 traffic');
  assert(s.scenarioId === 'yul', 'scenarioId=yul');
  const legacy = Logic.newGame('training');
  assert(legacy.scenarioId === 'yul', 'training 别名 -> yul');
}

console.log('\n=== 结果 ===');
console.log('通过:', passed, '失败:', failed);
if (failed > 0) process.exit(1);
console.log('✓ 基础模块测试全部通过');
