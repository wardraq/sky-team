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

  cellIcons: function (state, d, planeCount) {
    var isMe = d === state.distance;
    if (!isMe && planeCount === 0) return '';
    var h = ['<div class="app-icons">'];
    if (isMe) {
      h.push('<span class="app-icon me-icon" title="我机">✈️</span>');
    }
    if (planeCount === 1) {
      h.push('<span class="app-icon traffic-icon" title="交通">🛩</span>');
    } else if (planeCount > 1) {
      h.push('<span class="app-icon traffic-icon" title="交通 ×' + planeCount + '">🛩</span>');
      h.push('<span class="traffic-badge">×' + planeCount + '</span>');
    }
    h.push('</div>');
    return h.join('');
  },

  trafficSummary: function (traffic) {
    var counts = {};
    traffic.forEach(function (d) {
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.keys(counts).sort(function (a, b) { return b - a; }).map(function (d) {
      return counts[d] > 1 ? d + '（×' + counts[d] + '）' : d;
    }).join('、');
  },

  render: function (ctx) {
    var state = ctx.state;
    var logic = ctx.logic;
    var h = [];
    var self = this;

    h.push('<div class="card"><h3>航道 · Approach</h3><div class="approach-row">');
    for (var d = logic.CONFIG.DISTANCE_START; d >= 0; d--) {
      var planeCount = self.trafficAt(state, d);
      var isMe = d === state.distance;
      var cls = 'app-cell';
      if (d === 0) {
        cls += ' airport';
        if (isMe) cls += ' me waiting';
        h.push('<div class="' + cls + '"><span class="cell-no">' + d + '</span></div>');
        continue;
      }
      cls += ' has-icons';
      if (isMe) cls += ' me';
      if (planeCount > 0) cls += ' plane' + (planeCount > 1 ? ' traffic-multi' : '');
      if (isMe && planeCount > 0) cls += ' traffic-here';
      if (isMe && state.waiting) cls += ' waiting';
      h.push('<div class="' + cls + '">' + self.cellIcons(state, d, planeCount) +
        '<span class="cell-no">' + d + '</span></div>');
    }
    h.push('</div>');

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
