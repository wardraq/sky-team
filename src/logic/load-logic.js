/* Node 端加载逻辑层与场景/模块注册表 */
'use strict';
const fs = require('fs');
const path = require('path');

function loadGameLogic(baseDir) {
  baseDir = baseDir || path.join(__dirname, '..', '..');
  const logicPath = path.join(baseDir, 'src/logic/game-logic.js');
  if (fs.existsSync(logicPath)) {
    return new Function(fs.readFileSync(logicPath, 'utf8') + '\nreturn GameLogic;')();
  }
  const htmlPath = path.join(baseDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script id="game-logic">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('未找到 game-logic');
  return new Function(m[1] + '\nreturn GameLogic;')();
}

function loadRegistries(baseDir) {
  baseDir = baseDir || path.join(__dirname, '..', '..');
  function runScript(relativePath) {
    const code = fs.readFileSync(path.join(baseDir, relativePath), 'utf8') +
      '\nif(typeof ScenarioRegistry!=="undefined")global.ScenarioRegistry=ScenarioRegistry;' +
      '\nif(typeof ModuleRegistry!=="undefined")global.ModuleRegistry=ModuleRegistry;' +
      '\nif(typeof AirportTracks!=="undefined")global.AirportTracks=AirportTracks;' +
      '\nif(typeof mergeTrack!=="undefined")global.mergeTrack=mergeTrack;';
    new Function(code)();
  }
  runScript('src/scenarios/airport-tracks.js');
  runScript('src/scenarios/scenario-registry.js');
  runScript('src/scenarios/module-registry.js');
  return {
    ScenarioRegistry: global.ScenarioRegistry,
    ModuleRegistry: global.ModuleRegistry
  };
}

function loadGameEnvironment(baseDir) {
  const GameLogic = loadGameLogic(baseDir);
  const reg = loadRegistries(baseDir);
  return { GameLogic, ScenarioRegistry: reg.ScenarioRegistry, ModuleRegistry: reg.ModuleRegistry };
}

module.exports = { loadGameLogic, loadRegistries, loadGameEnvironment };
