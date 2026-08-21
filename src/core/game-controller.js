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
  var flashFn = options.flash || function () {};

  function notify() {
    listeners.forEach(function (fn) { fn(); });
  }

  function setState(s) {
    state = s;
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
    var delta = payload.delta;

    switch (action) {
      case 'begin-roll':
        if (!state || state.phase !== 'discuss') return;
        if (isPlayer()) session.sendAction('begin-roll');
        return;

      case 'roll':
        if (!state || state.phase !== 'roll') return;
        if (viewCtx.canOperate(role)) session.sendAction('roll');
        return;

      case 'reroll':
        if (!state || (state.phase !== 'roll' && state.phase !== 'place')) return;
        if (isPlayer()) session.sendAction('reroll');
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
    getContext: getContext,
    notify: notify
  };
}

if (typeof window !== 'undefined') window.createGameController = createGameController;
