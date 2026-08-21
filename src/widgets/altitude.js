/* ============================================================
 * 高度轨 Widget —— 7→0 高度刻度
 * ============================================================ */
'use strict';

var AltitudeWidget = {
  render: function (ctx) {
    var state = ctx.state;
    var logic = ctx.logic;
    var h = ['<div class="card"><h3>高度 · Altitude</h3><div class="alt-row">'];
    var rerollSpaces = state.rerollOnTrack || [];
    for (var alt = logic.CONFIG.ALTITUDE_START; alt >= 0; alt--) {
      var cls = 'alt-cell' + (alt === state.altitude ? ' cur' : '');
      var label = alt + (rerollSpaces.indexOf(alt) !== -1 ? ' 🔄' : '');
      h.push('<div class="' + cls + '">' + label + '</div>');
    }
    h.push('</div></div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.AltitudeWidget = AltitudeWidget;
