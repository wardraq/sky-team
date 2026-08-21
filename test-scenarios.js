/* 关卡冒烟：各可玩场景能 newGame / beginRound，config 覆盖生效 */
'use strict';

var path = require('path');
var fs = require('fs');
var { loadGameLogic, loadRegistries } = require('./src/logic/load-logic');

var baseDir = __dirname;
var Logic = loadGameLogic(baseDir);
var reg = loadRegistries(baseDir);
var ScenarioRegistry = reg.ScenarioRegistry;

var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; return; }
  failed++;
  console.error('FAIL:', msg);
}

function smokeScenario(id) {
  var meta = ScenarioRegistry.meta(id);
  assert(!!meta, id + ' meta exists');

  var s = Logic.newGame(id);
  assert(s.scenarioId === id, id + ' scenarioId on state');
  assert(Array.isArray(s.traffic), id + ' traffic array');
  Logic.beginRound(s);
  assert(s.phase === 'discuss', id + ' begins in discuss');

  if (id === 'yul') {
    assert(s.traffic.indexOf(3) !== -1, 'yul traffic at 3');
    assert(s.distance === 6, 'yul distance 6');
  }
  if (id === 'lhr') {
    assert(s.traffic.indexOf(1) !== -1 && s.traffic.indexOf(2) !== -1, 'lhr multi traffic');
  }
  if (id === 'hnd') {
    var rules = Logic.getApproachAxisRules(s);
    assert(rules && rules[5], 'hnd approach axis at 5');
    assert(s.traffic.indexOf(2) !== -1, 'hnd traffic');
  }
}

console.log('[scenarios] playable:', ScenarioRegistry.list().map(function (s) { return s.id; }).join(', '));
ScenarioRegistry.list().forEach(function (sc) { smokeScenario(sc.id); });

assert(ScenarioRegistry.get('training').id === 'yul', 'training alias -> yul');
assert(ScenarioRegistry.isPlayable('training'), 'training alias playable');
var legacy = Logic.newGame('training');
assert(legacy.scenarioId === 'yul', 'newGame(training) -> yul');

console.log('test-scenarios: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
