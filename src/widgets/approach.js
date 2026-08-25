/* ============================================================
 * 航道 Widget —— 距离格 + 空中交通警告
 * ============================================================ */
'use strict';

var ApproachWidget = {
  trafficAt: function (state, d) {
    var n = 0;
    for (var i = 0; i < state.traffic.length; i++) {
      if (state.traffic[i] === d) n++;
    }
    return n;
  },

  trafficOverlay: function (planeCount) {
    if (planeCount === 0) return '';
    var h = ['<div class="traffic-float" title="交通' + (planeCount > 1 ? ' ×' + planeCount : '') + '">'];
    h.push('<span class="app-icon traffic-icon">✈️</span>');
    if (planeCount > 1) h.push('<span class="traffic-badge">×' + planeCount + '</span>');
    h.push('</div>');
    return h.join('');
  },

  render: function (ctx) {
    var state = ctx.state;
    var logic = ctx.logic;
    var cfg = logic.getScenarioConfig(state);
    var h = [];
    var self = this;
    var trackCells = logic.approachTrackCellCount(cfg);
    var trackOffset = logic.approachTrackOffset(state, cfg);

    h.push('<div class="card"><h3>航道 · Approach</h3>');
    h.push('<div class="track-viewport" style="--track-cells:' + trackCells + ';--track-offset:' + trackOffset + '">');
    h.push('<div class="track-window" aria-hidden="true"></div><div class="approach-row track-row">');
    for (var d = cfg.DISTANCE_START; d >= 0; d--) {
      var planeCount = self.trafficAt(state, d);
      var isMe = d === state.distance;
      var cls = 'app-cell';
      if (d === 0) cls += ' airport';
      if (planeCount > 0) cls += ' has-traffic' + (planeCount > 1 ? ' traffic-multi' : '');
      if (isMe && planeCount > 0) cls += ' traffic-here';
      if (isMe && d === 0 && state.waiting) cls += ' waiting';
      h.push('<div class="' + cls + '" title="' + (d === 0 ? '机场' : '') + '">');
      if (planeCount > 0) h.push(self.trafficOverlay(planeCount));
      h.push('</div>');
    }
    h.push('</div></div>');

    var axisRules = logic.getApproachAxisRules(state);
    var ruleKeys = Object.keys(axisRules).filter(function (k) { return axisRules[k] && axisRules[k].length; });
    if (ruleKeys.length > 0) {
      var parts = ruleKeys.map(function (k) {
        return '距' + k + '→[' + axisRules[k].join(',') + ']';
      });
      h.push('<div style="margin-top:6px;font-size:11px;color:var(--dim)">航道姿态要求：' + parts.join(' · ') + '（前进时经过格须满足）</div>');
    }

    if (state.traffic.length > 0) {
      var danger = logic.hasTraffic(state, state.distance);
      var trafficMsg = '⚠ 无线电驱离：骰点 <b>N</b> = 从当前位置起第 <b>N</b> 格（1=本格），清除该格 <b>1 架</b>飞机；同格多架须多次清除。';
      if (danger) {
        trafficMsg += ' 本格有飞机时须前进，否则撞机；可悬停（引擎和 &lt; 蓝标记）或无线电清障。';
      } else {
        trafficMsg += ' 可前进经过占机格；若下轮停在该格且须前进，须先清障。';
      }
      h.push('<div style="margin-top:8px;padding:6px 10px;background:#3a1a1a;border-radius:6px;font-size:12px;color:#ffb4b4;line-height:1.55">' + trafficMsg + '</div>');
    } else {
      h.push('<div style="margin-top:8px;padding:6px 10px;background:#0f3a26;border-radius:6px;font-size:12px;color:#3ddc84">✓ 路径清空</div>');
    }
    h.push('</div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.ApproachWidget = ApproachWidget;
