/* ============================================================
 * 终局 Widget —— 降落成功 / 坠机
 * ============================================================ */
'use strict';

var FinalWidget = {
  render: function (ctx) {
    var state = ctx.state;
    if (state.phase !== 'win' && state.phase !== 'lose') return '';

    var win = state.phase === 'win';
    var h = ['<div class="card final ' + (win ? 'win' : 'lose') + '">'];
    h.push('<h2>' + (win ? '🏆 降落成功！' : '💥 坠机了……') + '</h2>');
    h.push('<div class="reason">' + (win ? '7 轮完成一次教科书级降落' : state.loseReason) + '</div>');
    if (win && state.finalStats) {
      h.push('<div class="stats"><span>姿态 ' + state.finalStats.axis + '</span><span>起落架 ' + state.finalStats.gear + '/' + ctx.logic.CONFIG.GEAR_COUNT + '</span><span>襟翼 ' + state.finalStats.flaps + '/' + ctx.logic.CONFIG.FLAP_COUNT + '</span><span>剩余 ☕ ' + state.finalStats.coffee + '</span></div>');
    }
    h.push('<button class="btn-primary" data-act="restart">🔄 再来一局</button>');
    h.push('</div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.FinalWidget = FinalWidget;
