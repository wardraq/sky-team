/* ============================================================
 * 进近轨道 Widget —— 距离格 + 空中交通警告
 * ============================================================ */
'use strict';

var ApproachWidget = {
  render: function (ctx) {
    var state = ctx.state;
    var logic = ctx.logic;
    var h = [];

    h.push('<div class="card"><h3>进近轨道 · Approach</h3><div class="approach-row">');
    for (var d = logic.CONFIG.DISTANCE_START; d >= 0; d--) {
      var cls = 'app-cell';
      if (d === 0) cls += ' airport';
      if (d === state.distance) cls += ' me' + (state.waiting ? ' waiting' : '');
      if (logic.hasTraffic(state, d)) cls += ' plane';
      h.push('<div class="' + cls + '"><span class="cell-no">' + d + '</span></div>');
    }
    h.push('</div>');

    var axisRules = logic.getApproachAxisRules(state);
    var ruleKeys = Object.keys(axisRules).filter(function (k) { return axisRules[k] && axisRules[k].length; });
    if (ruleKeys.length > 0) {
      var parts = ruleKeys.map(function (k) {
        return '距' + k + '→[' + axisRules[k].join(',') + ']';
      });
      h.push('<div style="margin-top:6px;font-size:11px;color:var(--dim)">进近姿态要求：' + parts.join(' · ') + '（前进时经过格须满足）</div>');
    }

    if (state.traffic.length > 0) {
      var sorted = state.traffic.slice().sort(function (a, b) { return b - a; });
      var ahead = sorted.filter(function (dist) { return dist < state.distance; });
      var nextDanger = ahead.length > 0 ? ahead[0] : null;
      var trafficMsg = '⚠ 空中交通：距离 ' + sorted.join('、') + ' 处有飞机';
      if (nextDanger !== null) {
        trafficMsg += '（前方 ' + (state.distance - nextDanger) + ' 格处，下轮推进将撞机——请无线电清除或悬停）';
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
