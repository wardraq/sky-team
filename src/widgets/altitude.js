/* ============================================================
 * 高度轨 Widget —— 6000→0 英尺（蒙特利尔教学局）
 * ============================================================ */
'use strict';

var AltitudeWidget = {
  render: function (ctx) {
    var state = ctx.state;
    var logic = ctx.logic;
    var cfg = logic.getScenarioConfig(state);
    var steps = logic.altitudeTrackSteps(cfg);
    var rerollSpaces = state.rerollOnTrack || [];
    var trackCells = steps.length;
    var trackOffset = logic.altitudeTrackOffset(state, cfg);
    var h = ['<div class="card"><h3>高度 · Altitude'];
    if (state.landingRound) h.push(' <span style="color:var(--green);font-size:10px">🛬 着陆轮</span>');
    else if (state.waiting) h.push(' <span style="color:var(--amber);font-size:10px">⏸ 等待航线</span>');
    h.push('</h3>');
    h.push('<div class="track-viewport" style="--track-cells:' + trackCells + ';--track-offset:' + trackOffset + '">');
    h.push('<div class="alt-row track-row">');
    steps.forEach(function (alt) {
      var cls = 'alt-cell';
      if (alt === state.altitude) cls += ' current-alt';
      if (alt === 0) cls += ' landing';
      var role = logic.altitudeStartRole(alt, cfg);
      if (role) cls += ' ' + role;
      var label = alt === 0 ? '🛬' : (alt / 1000) + 'k';
      if (rerollSpaces.indexOf(alt) !== -1) label += ' 🔄';
      h.push('<div class="' + cls + '" title="' + alt + ' ft">' + label + '</div>');
    });
    h.push('</div></div>');
    h.push('<div style="font-size:10.5px;color:var(--dim);margin-top:4px">当前 <b style="color:var(--text);font-family:var(--mono)">' +
      state.altitude + '</b> 英尺 · 🛬 = 触地高度（0）</div></div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.AltitudeWidget = AltitudeWidget;
