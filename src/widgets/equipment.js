/* ============================================================
 * 装备 Widget —— 起落架 / 襟翼 / 刹车激活状态
 * ============================================================ */
'use strict';

var EquipmentWidget = {
  equipRow: function (label, total, active) {
    var row = '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:var(--bg1);border-radius:6px;margin-bottom:4px;border:1px solid var(--edge)"><span style="font-size:12px;color:var(--dim)">' + label +
      '</span><span style="display:flex;gap:5px;align-items:center">' +
      '<span style="font-size:11px;color:' + (active > 0 ? 'var(--green)' : 'var(--dim)') + ';font-family:var(--mono);margin-right:4px">' + active + '/' + total + '</span>';
    for (var i = 1; i <= total; i++) {
      row += '<span class="lever' + (i <= active ? ' on' : '') + '" style="color:' + (i <= active ? 'var(--green)' : '#4a5b6f') + ';font-size:11px;font-weight:bold;line-height:16px;text-align:center">' + (i <= active ? '✓' : '○') + '</span>';
    }
    row += '</span></div>';
    return row;
  },

  render: function (ctx) {
    var state = ctx.state;
    var h = ['<div class="card"><h3>装备 · Equipment</h3>'];
    h.push(this.equipRow('🛬 起落架（机长）', ctx.logic.CONFIG.GEAR_COUNT, state.gearAct));
    h.push(this.equipRow('🪂 襟翼（副驾）', ctx.logic.CONFIG.FLAP_COUNT, state.flapsAct));
    h.push(this.equipRow('🛑 刹车（机长）', 3, state.brakesAct));
    h.push('</div>');
    return h.join('');
  }
};

if (typeof window !== 'undefined') window.EquipmentWidget = EquipmentWidget;
