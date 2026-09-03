/* ============================================================
 * 空气动力学条 Widget —— 引擎窗口 + 放置预览
 * 11 格（2–12）对应实体速度表圆点；标记夹在两格之间的分割线上。
 * ============================================================ */
'use strict';

var EngineBarWidget = {
  CELL_COUNT: 11,
  MIN: 2,
  MAX: 12,

  /** 蓝标记夹在 (blue-1) 与 blue 之间 → 分割线在第 (blue-2) 格之后 */
  blueDividerPct: function (blueMark) {
    return (blueMark - this.MIN) / this.CELL_COUNT * 100;
  },

  /** 橙标记夹在 orange 与 (orange+1) 之间；满档刚过 12 → 最右沿 */
  orangeDividerPct: function (orangeMark) {
    if (orangeMark >= this.MAX) return 100;
    return (orangeMark - this.MIN + 1) / this.CELL_COUNT * 100;
  },

  render: function (ctx, preview) {
    var state = ctx.state;
    var logic = ctx.logic;
    preview = preview || PlacementPreview.compute(state, logic);
    var blue = state.blueMark;
    var orange = logic.orangeMark(state);
    var blueLabel = logic.blueMarkLabel ? logic.blueMarkLabel(blue) : ((blue - 1) + ' 与 ' + blue + ' 之间');
    var orangeLabel = logic.orangeMarkLabel ? logic.orangeMarkLabel(orange) : (orange + ' 与 ' + (orange + 1) + ' 之间');
    var blueLeft = this.blueDividerPct(blue);
    var orangeLeft = this.orangeDividerPct(orange);

    var h = [];
    h.push('<div class="card"><h3>空气动力学条 · Engine Window</h3><div class="aero-box">');
    h.push('<div class="aero-zone" style="left:' + blueLeft + '%;width:' + (orangeLeft - blueLeft) + '%"></div>');
    h.push('<div class="aero-cells">');
    for (var v = this.MIN; v <= this.MAX; v++) {
      h.push('<div class="aero-cell"><span>' + v + '</span></div>');
    }
    h.push('</div>');
    h.push('<div class="aero-mark blue" style="left:' + blueLeft + '%" title="蓝标记：' + blueLabel + '"></div>');
    h.push('<div class="aero-mark orange" style="left:' + orangeLeft + '%" title="橙标记：' + orangeLabel + '"></div>');
    h.push('</div><div class="aero-legend"><span>■ 蓝 <b>' + blueLabel + '</b>（和 ≥' + blue + ' 前进）</span><span>■ 橙 <b>' + orangeLabel + '</b>（和 &gt;' + orange + ' 走 2）</span><span>和 &lt;蓝 悬停 · 蓝~橙 +1 · &gt;橙 +2</span>');
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
if (typeof globalThis !== 'undefined') globalThis.EngineBarWidget = EngineBarWidget;
