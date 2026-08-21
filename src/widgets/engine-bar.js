/* ============================================================
 * 空气动力学条 Widget —— 引擎窗口 + 放置预览
 * ============================================================ */
'use strict';

var EngineBarWidget = {
  render: function (ctx, preview) {
    var state = ctx.state;
    var logic = ctx.logic;
    preview = preview || PlacementPreview.compute(state, logic);
    var blue = state.blueMark;
    var orange = logic.orangeMark(state);
    var pct = function (v) { return (v - 2) / 10 * 100 + '%'; };

    var h = [];
    h.push('<div class="card"><h3>空气动力学条 · Engine Window</h3><div class="aero-box">');
    h.push('<div class="aero-zone" style="left:' + pct(blue) + ';width:' + pct(orange - blue) + '"></div>');
    for (var v = 2; v <= 12; v++) h.push('<div class="tick" style="left:' + pct(v) + '"><span>' + v + '</span></div>');
    h.push('<div class="aero-mark blue" style="left:calc(' + pct(blue) + ' - 3px)"></div>');
    h.push('<div class="aero-mark orange" style="left:calc(' + pct(orange) + ' - 3px)"></div>');
    h.push('</div><div class="aero-legend"><span>■ 蓝 <b>' + blue + '</b>（起落架）</span><span>■ 橙 <b>' + orange + '</b>（襟翼）</span><span>和 &lt;蓝 悬停 · 蓝~橙 +1 · ≥橙 +2</span>');
    if (preview.engine !== null) {
      h.push(' <b style="color:#dfe9f2;font-family:var(--mono);margin-left:8px">和 = ' + preview.engine + ' → ' + preview.engineLabel + '</b>');
    }
    if (preview.collisionWarn) {
      h.push(' <span style="color:var(--red);font-weight:700;margin-left:8px">' + preview.collisionWarn + '</span>');
    }
    h.push('</div></div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.EngineBarWidget = EngineBarWidget;
