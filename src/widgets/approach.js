/* ============================================================
 * 航道 Widget —— 距离格（6→0，含机场）+ 空中交通警告
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

  trafficSummary: function (traffic) {
    var counts = {};
    traffic.forEach(function (d) {
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.keys(counts).sort(function (a, b) { return b - a; }).map(function (d) {
      var label = d === '0' ? '机场' : d;
      return counts[d] > 1 ? label + '（×' + counts[d] + '）' : label;
    }).join('、');
  },

  render: function (ctx) {
    var state = ctx.state;
    var logic = ctx.logic;
    var cfg = logic.getScenarioConfig(state);
    var h = [];
    var self = this;
    var dists = [];
    for (var d = cfg.DISTANCE_START; d >= 0; d--) dists.push(d);
    var trackCells = dists.length;
    var trackOffset = logic.approachTrackOffset(state, cfg);

    h.push('<div class="card"><h3>航道 · Approach</h3>');
    h.push('<div class="track-viewport approach-viewport" style="--track-cells:' + trackCells +
      ';--track-offset:' + trackOffset + '">');
    h.push('<div class="track-window" aria-hidden="true"></div>');
    h.push('<div class="approach-row track-row">');
    dists.forEach(function (dist) {
      var planeCount = self.trafficAt(state, dist);
      var isMe = dist === state.distance;
      var cls = 'app-cell';
      if (dist === 0) cls += ' airport';
      if (planeCount > 0) cls += ' has-traffic' + (planeCount > 1 ? ' traffic-multi' : '');
      if (isMe && planeCount > 0) cls += ' traffic-here';
      if (isMe && dist === 0 && state.waiting) cls += ' waiting';
      if (isMe && dist === 0) cls += ' airport-here';
      h.push('<div class="' + cls + '" title="' + (dist === 0 ? '机场' : ('距 ' + dist)) + '">');
      if (dist === 0) h.push('<span class="airport-label">机场</span>');
      if (planeCount > 0) h.push(self.trafficOverlay(planeCount));
      h.push('</div>');
    });
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
      var sorted = state.traffic.slice().sort(function (a, b) { return b - a; });
      var ahead = sorted.filter(function (dist) { return dist < state.distance; });
      var nextDanger = ahead.length > 0 ? ahead[0] : null;
      var trafficMsg = '⚠ 空中交通：距离 ' + self.trafficSummary(state.traffic) + ' 处有飞机';
      if (nextDanger !== null) {
        var needVal = logic.radioDieForDistance(state, nextDanger);
        var stepsAhead = state.distance - nextDanger;
        if (logic.hasTraffic(state, state.distance)) {
          trafficMsg += '（当前位置有飞机，必须前进将撞机——无线电骰点 ' + needVal + ' 可清除，或悬停）';
        } else {
          trafficMsg += '（前方 ' + stepsAhead + ' 格处有飞机——可前进经过；若下轮停在该格且需前进则须先清障。无线电骰点 ' + needVal + ' 可清除）';
        }
      } else {
        trafficMsg += '（已通过 — 安全）';
      }
      h.push('<div style="margin-top:8px;padding:6px 10px;background:' + (nextDanger !== null ? '#3a1a1a' : '#0f3a26') + ';border-radius:6px;font-size:12px;color:' + (nextDanger !== null ? '#ffb4b4' : '#3ddc84') + '">' + trafficMsg + '</div>');
    } else {
      h.push('<div style="margin-top:8px;padding:6px 10px;background:#0f3a26;border-radius:6px;font-size:12px;color:#3ddc84">✓ 路径清空</div>');
    }
    h.push('</div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.ApproachWidget = ApproachWidget;
