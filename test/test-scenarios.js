/* 关卡冒烟：各可玩场景能 newGame / beginRound，config 覆盖生效 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var { loadGameLogic, loadRegistries } = require(path.join(ROOT, 'src/logic/load-logic'));

var baseDir = ROOT;
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

  if (id === 'test') {
    assert(s.distance === 1, 'test distance 1 (2-cell track)');
    assert(s.altitude === 1000, 'test altitude 1000');
    assert(s.traffic.length === 1 && s.traffic[0] === 0, 'test 1 plane at airport');
    assert(s.reroll === 1, 'test 1000ft beginRound 收入重掷');
    assert(s.rerollOnTrack.indexOf(1000) === -1, 'test 1000ft 轨上重掷已收走');
    assert(Logic.approachTrackCellCount(Logic.getScenarioConfig(s)) === 2, 'test 2 approach cells');
    assert(Logic.altitudeTrackSteps(Logic.getScenarioConfig(s)).join(',') === '1000,0', 'test altitude steps');
  }
  if (id === 'yul') {
    assert(s.traffic.indexOf(3) !== -1, 'yul traffic at 3');
    assert(s.traffic.filter(function (d) { return d === 0; }).length === 2, 'yul traffic ×2 at airport');
    assert(s.traffic.filter(function (d) { return d === 1; }).length === 3, 'yul traffic ×3 at dist 1');
    assert(s.traffic.filter(function (d) { return d === 7; }).length === 0, 'yul no traffic at dist 7');
    assert(s.traffic.filter(function (d) { return d === 6; }).length === 0, 'yul no traffic at dist 6');
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
