/* ============================================================
 * 刹车 & 集中精力 Widget —— 对齐实体控制面板底栏布局
 * 刹车（机长）横排 · 下方共用 ☕ 放骰槽 ×3
 * ============================================================ */
'use strict';

var BrakesBoardWidget = {
  brakeTrackHTML: function (state, logic) {
    var val = logic.brakeValue(state);
    var marks = [0, 2, 3, 4, 5, 6];
    var h = ['<div class="brake-track" aria-label="刹车刻度轨">'];
    h.push('<span class="brake-track-label">刹车</span>');
    marks.forEach(function (m) {
      var active = val >= m;
      var cur = val === m;
      h.push('<span class="brake-tick' + (active ? ' past' : '') + (cur ? ' cur' : '') + '">' + m + '</span>');
    });
    h.push('<span class="brake-track-val">标记 <b>' + val + '</b></span>');
    h.push('</div>');
    return h.join('');
  },

  coffeeTokensHTML: function (state, logic) {
    var max = logic.CONFIG.COFFEE_MAX;
    var n = state.coffee;
    var h = ['<div class="coffee-tokens" aria-label="咖啡 token 存放">'];
    for (var i = 0; i < max; i++) {
      h.push('<span class="coffee-token' + (i < n ? ' filled' : '') + '">☕</span>');
    }
    h.push('<span class="coffee-token-hint">' + n + '/' + max + ' 未用 token</span>');
    h.push('</div>');
    return h.join('');
  },

  render: function (ctx) {
    var state = ctx.state;
    var logic = ctx.logic;
    var viewerRole = ctx.ui.viewer === 'passenger' ? 'pilot' : ctx.ui.viewer;
    var brakes = ['brake1', 'brake2', 'brake3'];

    var h = ['<div class="card brakes-board"><h3>刹车 · Brakes</h3>'];
    h.push(this.brakeTrackHTML(state, logic));
    h.push('<div class="brake-slots-row">');
    brakes.forEach(function (slot) {
      h.push(PlayerPanel.slotHTML(ctx, 'pilot', slot));
    });
    h.push('</div>');

    h.push('<div class="concentration-block">');
    h.push('<div class="concentration-label">☕ 集中精力 · Concentration</div>');
    h.push('<div class="coffee-slots-row">');
    Object.keys(logic.SHARED_SLOTS || {}).forEach(function (slot) {
      h.push(PlayerPanel.slotHTML(ctx, viewerRole, slot));
    });
    h.push('</div>');
    h.push(this.coffeeTokensHTML(state, logic));
    h.push('</div></div>');

    return h.join('');
  }
};

if (typeof window !== 'undefined') window.BrakesBoardWidget = BrakesBoardWidget;
