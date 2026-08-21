/* ============================================================
 * 姿态仪表 Widget —— 人工水平仪 + 放置预览
 * ============================================================ */
'use strict';

var AttitudeWidget = {
  render: function (ctx, preview) {
    var state = ctx.state;
    preview = preview || PlacementPreview.compute(state, ctx.logic);
    var axisForUI = preview.isPreview ? preview.axis : state.axis;
    var deg = Math.max(-3, Math.min(3, axisForUI)) * 16;
    var labelColor = preview.isPreview ? '#ffc53d' : 'var(--dim)';

    return '<div class="card"><h3>姿态 · Attitude <span style="font-size:10px;color:' + labelColor + ';margin-left:8px">' + preview.axisLabel + '</span></h3><div class="ai-wrap">' +
      '<div class="ai"><div class="ai-inner" style="transform:rotate(' + deg + 'deg)">' +
      '<div class="ai-sky"></div><div class="ai-gnd"></div><div class="ai-hz"></div>' +
      '<div class="ai-scale"><i style="left:20%"></i><i style="left:40%"></i><i style="left:50%"></i><i style="left:60%"></i><i style="left:80%"></i></div>' +
      '</div><div class="ai-marks"></div><div class="ai-plane"><div class="w"></div></div></div>' +
      '<div class="ai-read"><div class="big' + (Math.abs(axisForUI) >= 2 ? ' danger' : '') + '">' + (axisForUI > 0 ? '+' : '') + axisForUI + '</div>' +
      '<div class="lbl">ROLL</div><div class="bar"><i style="left:calc(50% + ' + (axisForUI * 12) + 'px)"></i></div>' +
      '<div class="lbl">水平=0 · ±3 坠毁</div></div>' +
      '</div></div>';
  }
};

if (typeof window !== 'undefined') window.AttitudeWidget = AttitudeWidget;
