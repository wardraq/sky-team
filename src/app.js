/* ============================================================
 * 应用入口 —— 仅联机：大厅 + WebSocket 客户端
 * ============================================================ */
'use strict';

function showError(msg, stack) {
  try {
    var el = document.getElementById('app') || document.body;
    var box = document.createElement('div');
    box.className = 'err-box';
    box.innerHTML = '<b>⚠ 页面初始化错误</b><br>' + msg +
      (stack ? '<br><pre style="margin-top:8px;white-space:pre-wrap;font-size:11px;opacity:.85">' + stack + '</pre>' : '');
    el.appendChild(box);
  } catch (e) { /* ignore */ }
}
window.addEventListener('error', function (e) {
  showError(e.message || String(e.error || e), e.error && e.error.stack);
});
window.addEventListener('unhandledrejection', function (e) {
  showError('Promise: ' + (e.reason && e.reason.message || e.reason), e.reason && e.reason.stack);
});

var L = window.GameLogic;
if (!L) {
  showError('逻辑层未加载。请运行 node server.js 后访问 http://localhost:8080/');
  throw new Error('GameLogic missing');
}

function ensureDebug() {
  var d = document.getElementById('dbg-badge');
  if (d) return d;
  d = document.createElement('div');
  d.id = 'dbg-badge';
  d.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:500;background:rgba(0,0,0,.78);color:#7fdca0;font:11px/1.4 var(--mono);padding:6px 10px;border-radius:6px;border:1px solid #2e5;max-width:46vw;white-space:pre-wrap;pointer-events:none;';
  document.body.appendChild(d);
  return d;
}
function setDebug(msg) { try { ensureDebug().textContent = msg; } catch (e) {} }

var ui = {
  viewer: null,
  screen: 'lobby',
  room: 'sky',
  scenarioId: 'yul',
  scenario: null,
  peers: { pilot: false, copilot: false, passengers: 0 },
  ws: null,
  wsConnected: false
};

var controller;
var viewCtx = createViewContext(ui, function () { return controller ? controller.getState() : null; });

function toast(msg) {
  var el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

var wsHandlers = { toast: toast, onMessage: null };
var session = createGameSession(ui, wsHandlers);

function flash(msg) {
  var b = document.querySelector('.banner .phase');
  if (b) {
    b.innerHTML = '<span style="color:var(--red)">⚠ ' + msg + '</span>';
    setTimeout(function () { if (controller.getState()) renderAll(); }, 1300);
  }
}

var controller = createGameController({
  logic: L,
  ui: ui,
  viewCtx: viewCtx,
  session: session,
  flash: flash,
  toast: toast
});

wsHandlers.onMessage = function (m) {
  session.handleWSMessage(m, controller);
  renderAll();
};

controller.onStateChange(renderAll);

function showLobby(show) {
  document.getElementById('lobby-screen').style.display = show ? 'flex' : 'none';
  document.getElementById('topbar').style.display = show ? 'none' : '';
  document.querySelector('main').style.display = show ? 'none' : '';
}

function renderAll() {
  if (ui.screen === 'lobby') {
    showLobby(true);
    setDebug('lobby · 选择房间与角色');
    return;
  }
  showLobby(false);
  var state = controller.getState();
  var ctx = controller.getContext();
  try {
    renderTopbar(state);
    if (!state) {
      renderWaiting();
      setDebug('waiting · role=' + ui.viewer + ' · room=' + ui.room);
      return;
    }
    PlayerPanel.render('pilot', ctx);
    PlayerPanel.render('copilot', ctx);
    CenterDashboard.mount(ctx);
    setDebug('online · role=' + ui.viewer + ' · room=' + ui.room +
      ' · r' + state.round + '/' + roundsMax(state) + ' · ' + state.phase +
      ' · alt' + state.altitude + ' · dist' + state.distance);
  } catch (e) {
    setDebug('RENDER ERR: ' + e.message);
    var c = document.getElementById('center');
    if (c) c.innerHTML = '<div class="card" style="border-color:#7a2f2f"><h3 style="color:var(--red)">渲染错误</h3><pre style="color:#ffb4b4;white-space:pre-wrap;font-size:12px">' + (e.stack || e.message) + '</pre></div>';
  }
}

function scenarioStars(n) {
  var s = '';
  for (var i = 0; i < (n || 1); i++) s += '★';
  return s;
}

function populateScenarioSelect() {
  var sel = document.getElementById('scenario-select');
  var hint = document.getElementById('scenario-hint');
  if (!sel || typeof ScenarioRegistry === 'undefined') return;
  sel.innerHTML = '';
  ScenarioRegistry.list().forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = scenarioStars(s.difficulty) + ' ' + s.name + ' (' + (s.airport || s.id.toUpperCase()) + ')';
    sel.appendChild(opt);
  });
  function syncHint() {
    var meta = ScenarioRegistry.meta(sel.value);
    if (hint && meta) hint.textContent = meta.description || '';
  }
  sel.addEventListener('change', syncHint);
  var params = new URLSearchParams(location.search);
  var fromUrl = params.get('scenario');
  if (fromUrl && ScenarioRegistry.isPlayable(fromUrl)) sel.value = ScenarioRegistry.get(fromUrl).id;
  syncHint();
}

function renderWaiting() {
  document.getElementById('panel-pilot').innerHTML = '';
  document.getElementById('panel-copilot').innerHTML = '';
  var el = document.getElementById('center');
  var base = location.href.split('?')[0];
  var scen = ui.scenarioId || 'yul';
  var scenQ = '&scenario=' + encodeURIComponent(scen);
  var roomUrl = base + '?room=' + encodeURIComponent(ui.room) + scenQ;
  var roleName = ui.viewer === 'passenger' ? '乘客（观战）' : L.ROLES[ui.viewer];
  var scenLabel = ui.scenario && ui.scenario.name ? ui.scenario.name : scen.toUpperCase();
  var need = ui.viewer === 'passenger'
    ? '等待机长 / 副驾连接后开始观战…'
    : (ui.viewer === 'pilot' ? '等待副驾加入' : '等待机长加入');
  var otherUrl = roomUrl + '&role=' + (ui.viewer === 'pilot' ? 'copilot' : 'pilot');
  el.innerHTML =
    '<div class="card waiting-card"><div class="big">🛫 ' + roleName + ' 已就位</div>' +
    '<div class="sub">' + need + '<br>房间 <b>' + ui.room + '</b> · 关卡 <b>' + scenLabel + '</b> · 当前在线：' +
    (ui.peers.pilot ? '<b style="color:var(--blue)">机长 ✓</b>' : '机长 ✗') + '　' +
    (ui.peers.copilot ? '<b style="color:var(--orange)">副驾 ✓</b>' : '副驾 ✗') +
    '　' + (ui.peers.passengers ? '<b style="color:#e8cd8a">乘客×' + ui.peers.passengers + '</b>' : '') +
    '</div><div class="url">' + (ui.viewer === 'passenger' ? roomUrl + '&role=pilot / …&role=copilot' : otherUrl) + '</div>' +
    '<div class="sub" style="color:var(--dim)">把链接发给搭档（须同一关卡），两人都进入后自动开始。</div></div>';
}

function roundsMax(state) {
  if (!state || !L.getScenarioConfig) return L.CONFIG.ROUNDS;
  return L.getScenarioConfig(state).ROUNDS;
}

function renderTopbar(state) {
  document.getElementById('chip-round').textContent = state ? state.round + '/' + roundsMax(state) : '—';
  document.getElementById('chip-alt').textContent = state ? (state.altitude + 'ft') : '—';
  document.getElementById('chip-dist').textContent = state ? state.distance : '—';
  document.getElementById('chip-axis').textContent = state ? state.axis : '—';
  document.getElementById('chip-brake').textContent = state ? L.brakeValue(state) : '—';
  document.getElementById('chip-coffee').textContent = state ? state.coffee + '/' + L.CONFIG.COFFEE_MAX : '—';
  document.getElementById('chip-reroll').textContent = state ? state.reroll : '—';

  document.getElementById('mode-tag').textContent = '联机 · ' + (ui.viewer === 'passenger' ? '观战' : L.ROLES[ui.viewer]);
  document.getElementById('mode-tag').classList.add('online-tag');
  document.getElementById('chip-room').textContent = ui.room;
  var scenEl = document.getElementById('chip-scenario');
  if (scenEl) {
    var label = state && state.scenarioId
      ? (ui.scenario && ui.scenario.name ? ui.scenario.name : state.scenarioId.toUpperCase())
      : (ui.scenario && ui.scenario.name ? ui.scenario.name : (ui.scenarioId || '—').toUpperCase());
    scenEl.textContent = label;
  }

  var peer = document.getElementById('peer-chip');
  if (ui.viewer !== 'passenger') {
    var other = ui.viewer === 'pilot' ? 'copilot' : 'pilot';
    var on = ui.peers[other];
    peer.textContent = (other === 'copilot' ? '副驾' : '机长') + (on ? '：在线' : '：等待中…');
    peer.style.color = on ? 'var(--green)' : 'var(--amber)';
    peer.style.display = '';
  } else {
    peer.style.display = 'none';
  }
}

function joinRoom(role) {
  var room = (document.getElementById('room-input').value || 'sky').trim() || 'sky';
  var scenario = (document.getElementById('scenario-select').value || 'yul').trim() || 'yul';
  location.href = '/?room=' + encodeURIComponent(room) + '&role=' + role + '&scenario=' + encodeURIComponent(scenario);
}

document.getElementById('app').addEventListener('click', function (e) {
  var join = e.target.closest('[data-join]');
  if (join) {
    joinRoom(join.dataset.join);
    return;
  }
  var t = e.target.closest('[data-act]');
  if (!t) return;
  controller.dispatch(t.dataset.act, {
    role: t.dataset.role,
    idx: +t.dataset.idx,
    slot: t.dataset.slot,
    delta: +t.dataset.d
  });
});

window.UI = {
  openRules: function () { document.getElementById('rules-mask').classList.add('show'); },
  closeRules: function () { document.getElementById('rules-mask').classList.remove('show'); },
  leaveRoom: function () { location.href = '/'; }
};
document.getElementById('rules-mask').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('show');
});

(function initOnline() {
  populateScenarioSelect();
  var params = new URLSearchParams(location.search);
  var role = params.get('role');
  if (!role || ['pilot', 'copilot', 'passenger'].indexOf(role) === -1) {
    ui.screen = 'lobby';
    var roomParam = params.get('room');
    if (roomParam) document.getElementById('room-input').value = roomParam;
    return;
  }
  ui.viewer = role;
  ui.room = params.get('room') || 'sky';
  var scenParam = params.get('scenario');
  ui.scenarioId = (scenParam && ScenarioRegistry.isPlayable(scenParam))
    ? ScenarioRegistry.get(scenParam).id
    : (ScenarioRegistry.defaultId || 'yul');
  ui.scenario = ScenarioRegistry.meta(ui.scenarioId);
  ui.screen = 'waiting';
  setDebug('connecting · ' + ui.room + ' · ' + role + ' · ' + ui.scenarioId);
  session.connectWS();
})();

renderAll();
