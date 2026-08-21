/* ============================================================
 * 揭示 Widget —— 放置完毕，等待结算
 * ============================================================ */
'use strict';

var RevealWidget = {
  ROLE_ICON: { pilot: '👨‍✈️', copilot: '👩‍✈️' },

  render: function (ctx) {
    var state = ctx.state;
    var logic = ctx.logic;
    if (state.phase !== 'reveal') return '';

    var h = ['<div class="card"><h3>✅ 放置完毕</h3><p style="font-size:12px;color:var(--dim);margin-bottom:8px">即时效果已在放置时生效。确认后降低高度并检查终局条件。</p><div class="reveal-grid">'];
    ['pilot', 'copilot'].forEach(function (r) {
      h.push('<div class="reveal-col ' + r + '"><h4>' + RevealWidget.ROLE_ICON[r] + ' ' + logic.ROLES[r] + '</h4>');
      Object.keys(logic.SLOTS[r]).forEach(function (s) {
        var p = state.placements[r][s];
        if (!p) return;
        var v = logic.effVal(p);
        var def = logic.SLOTS[r][s];
        h.push('<div style="font-size:12px;margin:2px 0">' + def.name + '：<b>' + v + '</b>' +
          (p.mod ? ' <span style="color:var(--amber)">(原' + p.v + ')</span>' : '') + '</div>');
      });
      h.push('</div>');
    });
    h.push('</div></div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.RevealWidget = RevealWidget;
