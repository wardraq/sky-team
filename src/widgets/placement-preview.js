/* ============================================================
 * 放置阶段预览 —— 姿态 / 引擎实时推算（place 阶段共享）
 * ============================================================ */
'use strict';

var PlacementPreview = {
  compute: function (state, logic) {
    var result = {
      axis: state.axis,
      axisLabel: '已结算',
      engine: null,
      engineLabel: '',
      collisionWarn: '',
      isPreview: false
    };
    if (state.phase !== 'place') return result;

    var rr = state.roundResolved || { axis: false, engine: false };
    var pa = logic.effVal(state.placements.pilot.axis);
    var ca = logic.effVal(state.placements.copilot.axis);
    if (rr.axis) {
      result.axis = state.axis;
      result.axisLabel = '⚡ 已生效';
    } else if (pa !== null && ca !== null) {
      var diff = Math.abs(pa - ca);
      result.axis = state.axis + (pa > ca ? -diff : diff);
      result.axisLabel = '放置预览';
      result.isPreview = true;
    } else if (pa !== null || ca !== null) {
      result.axisLabel = '等待对方姿态骰';
      result.isPreview = true;
    }

    var pe = logic.effVal(state.placements.pilot.engine);
    var ce = logic.effVal(state.placements.copilot.engine);
    if (rr.engine) {
      if (pe !== null && ce !== null) result.engine = pe + ce;
      result.engineLabel = '⚡ 已生效';
    } else if (pe !== null && ce !== null) {
      result.engine = pe + ce;
      var orange = logic.getOrangeMark(state);
      var blue = state.blueMark;
      if (result.engine > orange) result.engineLabel = '前进 2 格';
      else if (result.engine >= blue) result.engineLabel = '前进 1 格';
      else result.engineLabel = '悬停（不动）';
      result.isPreview = true;
      var k = result.engine > orange ? 2 : (result.engine >= blue ? 1 : 0);
      if (k > 0 && logic.hasTraffic(state, state.distance)) {
        result.collisionWarn = '⚠ 当前位置有飞机，前进将撞机';
      }
    } else if (pe !== null || ce !== null) {
      result.engineLabel = '等待对方引擎骰';
      result.isPreview = true;
    }
    return result;
  }
};

if (typeof window !== 'undefined') window.PlacementPreview = PlacementPreview;
