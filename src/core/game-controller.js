/* ============================================================
 * 游戏控制器 —— 仅联机：action → WebSocket → server 仲裁
 * ============================================================ */
'use strict';

function createGameController(options) {
  var logic = options.logic;
  var ui = options.ui;
  var viewCtx = options.viewCtx;
  var session = options.session;
  var listeners = [];
  var state = null;
  var selected = null;
  var pendingCoffee = { plus: 0, minus: 0 };
  var rerollSelected = {};
  var localRerollMode = false;
  var flashFn = options.flash || function () {};
  var toastFn = options.toast || function () {};

  function notify() {
    listeners.forEach(function (fn) { fn(); });
  }

  function clearRerollSelected() {
    rerollSelected = {};
  }

  function clearRerollMode() {
    localRerollMode = false;
    clearRerollSelected();
  }

  function isRerollPicking(s) {
    s = s || state;
    return !!(s && ((s.rerollPick && s.rerollPick.active) || localRerollMode));
  }

  function normalizeState(s) {
    if (!s) return s;
    if (logic.ensureRerollPick) logic.ensureRerollPick(s);
    else if (!s.rerollPick) s.rerollPick = { active: false, pilot: null, copilot: null };
    return s;
  }

  function setState(s) {
    state = normalizeState(s);
    if (state && state.rerollPick && state.rerollPick.active) localRerollMode = false;
    if (!isRerollPicking(state)) clearRerollSelected();
  }

  function getState() {
    return state;
  }

  function getSelected() {
    return selected;
  }

  function clearSelected() {
    selected = null;
    pendingCoffee = { plus: 0, minus: 0 };
  }

  function pendingCoffeePreview(state) {
    if (!selected || !state) return null;
    var d = state.dice[selected.role][selected.idx];
    if (!d || d.used) return null;
    return clampDie(d.v + pendingCoffee.plus - pendingCoffee.minus);
  }

  function clampDie(v) {
    return Math.max(1, Math.min(6, v));
  }

  function canSpendCoffee(state, delta) {
    if (!state || state.phase !== 'place' || state.coffee <= 0) return false;
    if (!selected || state.currentPlayer !== selected.role) return false;
    if (ui.viewer !== selected.role) return false;
    var d = state.dice[selected.role][selected.idx];
    if (!d || d.used) return false;
    var spent = pendingCoffee.plus + pendingCoffee.minus;
    if (spent >= state.coffee) return false;
    var nv = d.v + pendingCoffee.plus - pendingCoffee.minus + (delta > 0 ? 1 : -1);
    return nv >= 1 && nv <= 6;
  }

  function isPlayer() {
    return ui.viewer !== 'passenger';
  }

  function dispatch(action, payload) {
    payload = payload || {};
    var role = payload.role;
    var idx = payload.idx;
    var slot = payload.slot;

    switch (action) {
      case 'begin-roll':
        if (!state || state.phase !== 'discuss') return;
        if (isPlayer()) session.sendAction('begin-roll');
        return;

      case 'roll':
        if (!state || state.phase !== 'roll') return;
        if (viewCtx.canOperate(role)) session.sendAction('roll');
        return;

      case 'begin-reroll':
      case 'reroll':
        if (!state || (state.phase !== 'roll' && state.phase !== 'place')) return;
        if (!isPlayer()) return;
        if (state.reroll <= 0) {
          toastFn('⚠ 无重掷标记');
          return;
        }
        if (state.rerollPick && state.rerollPick.active) {
          toastFn('⚠ 已在选骰重掷中');
          return;
        }
        localRerollMode = true;
        notify();
        session.sendAction('begin-reroll');
        toastFn('🔄 点选要重掷的骰子，再点「确认重掷」');
        return;

      case 'reroll-pick-die':
        if (!isRerollPicking()) return;
        if (ui.viewer !== role || !isPlayer()) return;
        if (state.rerollPick && state.rerollPick[role] != null) return;
        rerollSelected[idx] = !rerollSelected[idx];
        if (!rerollSelected[idx]) delete rerollSelected[idx];
        notify();
        return;

      case 'reroll-confirm':
        if (!isRerollPicking()) return;
        if (!isPlayer()) return;
        if (state.rerollPick && state.rerollPick[ui.viewer] != null) return;
        var pickIdx = Object.keys(rerollSelected).map(Number).filter(function (i) { return rerollSelected[i]; });
        session.sendAction('reroll-pick', pickIdx);
        clearRerollSelected();
        toastFn('✓ 已重掷' + (pickIdx.length ? ' ' + pickIdx.length + ' 颗骰' : '（未选骰）') + '，等待对方确认或继续');
        return;

      case 'coffee-plus':
        if (!canSpendCoffee(state, 1)) return;
        pendingCoffee.plus++;
        notify();
        return;

      case 'coffee-minus':
        if (!canSpendCoffee(state, -1)) return;
        pendingCoffee.minus++;
        notify();
        return;

      case 'coffee-clear':
        pendingCoffee = { plus: 0, minus: 0 };
        notify();
        return;

      case 'done-roll':
        if (!state || state.phase !== 'roll') return;
        if (isPlayer()) session.sendAction('done-roll');
        return;

      case 'pick-die':
        if (!state || state.phase !== 'place') return;
        if (ui.viewer === 'passenger') return;
        if (role !== ui.viewer) return;
        if (state.currentPlayer !== role) {
          flashFn('还没轮到' + logic.ROLES[role] + '操作');
          return;
        }
        if (state.dice[role][idx].used) return;
        selected = (selected && selected.role === role && selected.idx === idx)
          ? null : { role: role, idx: idx };
        notify();
        return;

      case 'slot':
        if (!state || state.phase !== 'place') return;
        if (ui.viewer === 'passenger') return;
        if (role !== ui.viewer) return;
        if (state.currentPlayer !== role) {
          flashFn('还没轮到' + logic.ROLES[role] + '操作');
          return;
        }
        if (!selected || selected.role !== role) {
          flashFn('先点一个自己的骰子，再点槽位');
          return;
        }
        session.sendAction('place', [selected.idx, slot, pendingCoffee.plus, pendingCoffee.minus]);
        selected = null;
        pendingCoffee = { plus: 0, minus: 0 };
        return;

      case 'coffee':
        return;

      case 'settle':
        if (isPlayer()) session.sendAction('settle');
        return;

      case 'next-round':
        if (isPlayer()) session.sendAction('next-round');
        return;

      case 'restart':
        if (isPlayer()) session.sendAction('restart');
        return;
    }
  }

  function onStateChange(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  function getContext() {
    return {
      logic: logic,
      ui: ui,
      viewCtx: viewCtx,
      state: state,
      selected: selected,
      pendingCoffee: pendingCoffee,
      rerollSelected: rerollSelected,
      isRerollPicking: isRerollPicking(),
      pendingCoffeePreview: pendingCoffeePreview,
      emit: dispatch
    };
  }

  return {
    dispatch: dispatch,
    onStateChange: onStateChange,
    setState: setState,
    getState: getState,
    getSelected: getSelected,
    getPendingCoffee: function () { return pendingCoffee; },
    clearSelected: clearSelected,
    clearRerollMode: clearRerollMode,
    getContext: getContext,
    notify: notify
  };
}

if (typeof window !== 'undefined') window.createGameController = createGameController;
