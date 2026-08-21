/* ============================================================
 * 视图上下文 —— 联机权限（canSee / canOperate）
 * ============================================================ */
'use strict';

function createViewContext(ui, getState) {
  return {
    ui: ui,

    get state() {
      return getState();
    },

    isPublicPhase: function () {
      var state = getState();
      return state && (state.phase === 'reveal' || state.phase === 'roundEnd' ||
        state.phase === 'win' || state.phase === 'lose');
    },

    canSee: function (role) {
      var state = getState();
      if (!state) return false;
      if (ui.viewer === 'passenger') return true;
      if (this.isPublicPhase()) return true;
      return ui.viewer === role;
    },

    canOperate: function (role) {
      return ui.viewer === role;
    },

    isPassenger: function () {
      return ui.viewer === 'passenger';
    }
  };
}

if (typeof window !== 'undefined') window.createViewContext = createViewContext;
