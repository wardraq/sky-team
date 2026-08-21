/* ============================================================
 * 飞行日志 Widget
 * ============================================================ */
'use strict';

var LogWidget = {
  render: function (ctx) {
    var state = ctx.state;
    var h = ['<div class="card"><h3>📜 飞行日志</h3><div class="log">'];
    state.log.forEach(function (it) {
      h.push('<div class="log-item ' + it.cls + '"><span class="rd">R' + it.rd + '</span>' + it.msg + '</div>');
    });
    h.push('</div></div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.LogWidget = LogWidget;
