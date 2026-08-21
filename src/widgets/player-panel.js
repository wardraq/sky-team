/* ============================================================
 * 玩家面板 Widget —— 机长 / 副驾侧栏（渲染 + UI 预校验提示）
 * ============================================================ */
'use strict';

var ROLE_ICON = { pilot: '👨‍✈️', copilot: '👩‍✈️', passenger: '🧐' };

var PlayerPanel = {
  panelId: function (role) {
    return role === 'pilot' ? 'panel-pilot' : 'panel-copilot';
  },

  dieHTML: function (ctx, role, idx) {
    var L = ctx.logic;
    var state = ctx.state;
    var ui = ctx.ui;
    var viewCtx = ctx.viewCtx;
    var selected = ctx.selected;
    var d = state.dice[role][idx];
    var sel = !d.used && selected && selected.role === role && selected.idx === idx ? ' selected' : '';
    var cls = 'die ' + (role === 'pilot' ? 'pilot' : 'copilot');
    if (d.used) cls += ' used';
    var inner;
    if (d.v === 0) {
      cls += ' blank';
      inner = d.hidden ? '<span class="lock">🔒</span>' : '<span class="q">?</span>';
    } else if (!viewCtx.canSee(role)) {
      inner = '<span class="lock">🔒</span>';
    } else {
      var pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[d.v];
      var cells = [];
      for (var i = 0; i < 9; i++) cells.push(pips.indexOf(i) !== -1 ? '<div class="pip"></div>' : '<div></div>');
      inner = cells.join('');
    }
    var attrs = ' data-role="' + role + '" data-idx="' + idx + '"';
    if (!d.used && state.phase === 'place' && viewCtx.canOperate(role) && state.currentPlayer === role) {
      attrs = ' data-act="pick-die"' + attrs;
    }
    return '<div class="' + cls + sel + '"' + attrs + '>' + inner + '</div>';
  },

  slotHTML: function (ctx, role, slotName) {
    var L = ctx.logic;
    var state = ctx.state;
    var def = L.SLOTS[role][slotName];
    var p = state.placements[role][slotName];
    var chk = (p === null) ? L.slotAllowed(state, role, slotName) : null;
    var cls = ['slot'];
    var extra = '';
    if (p !== null) {
      cls.push('filled');
      if (p.hidden) {
        extra = '<div class="s-die"><span class="v" style="color:var(--dim)">■</span></div>';
      } else {
        var v = L.effVal(p);
        var col = role === 'pilot' ? 'var(--blue)' : 'var(--orange)';
        extra = '<div class="s-die"><span class="v" style="color:' + col + ';text-shadow:0 0 8px ' +
          (role === 'pilot' ? 'var(--blue-glow)' : 'var(--orange-glow)') + '">' + v + '</span>' +
          (p.mod ? '<span style="color:var(--amber);font-size:11px">(' + (p.mod > 0 ? '+' : '') + p.mod + ')</span>' : '') + '</div>';
      }
    } else {
      if (chk && !chk.ok) cls.push('disabled');
      if (def.mandatory) cls.push('mandatory');
      extra = '<div class="s-die"><span style="color:#45576a;font-size:16px">＋</span></div>';
    }
    var isEquip = def.gear || def.order;
    if (isEquip) {
      var active = false;
      if (def.gear) active = (state.gearOn && state.gearOn[slotName]) || p !== null;
      if (def.order === 'flap') active = (state.flapsOn && state.flapsOn[slotName]) || p !== null;
      if (def.order === 'brake') active = (state.brakesOn && state.brakesOn[slotName]) || p !== null;
      var lever = '<span class="lever' + (active ? ' on' : '') + '"></span>';
      var nameHtml = '<span class="s-name">' + def.name +
        (def.mandatory ? '<span class="tag-mand">强制</span>' : '') + '</span>';
      return '<div class="' + cls.join(' ') + '" data-act="slot" data-role="' + role + '" data-slot="' + slotName + '">' +
        '<div class="slot-head">' + nameHtml + lever + '</div>' + extra + '</div>';
    }
    var nameHtml = '<span class="s-name">' + def.name +
      (def.mandatory ? '<span class="tag-mand">强制</span>' : '') +
      (def.limit ? '<span class="val-lim">限 ' + def.limit.join('/') + '</span>' : '') + '</span>';
    return '<div class="' + cls.join(' ') + '" data-act="slot" data-role="' + role + '" data-slot="' + slotName + '">' +
      '<div class="slot-head">' + nameHtml + '</div>' + extra + '</div>';
  },

  render: function (role, ctx) {
    var el = document.getElementById(this.panelId(role));
    var L = ctx.logic;
    var state = ctx.state;
    var ui = ctx.ui;
    var viewCtx = ctx.viewCtx;
    var selected = ctx.selected;
    var isPilot = role === 'pilot';
    var duty = isPilot ? '起落架 · 刹车 · 无线电' : '襟翼 · 无线电 ×2';

    try {
      if (!state) {
        el.innerHTML = '<div style="text-align:center;color:var(--dim);padding:30px">⏳ 等待游戏开始…</div>';
        el.className = 'panel ' + role;
        return;
      }

      var hl = '';
      if (state.phase === 'place' && state.currentPlayer === role) {
        hl = ' highlight' + (isPilot ? '' : ' co');
      }

      var h = [];
      h.push('<h2>' + ROLE_ICON[role] + ' ' + L.ROLES[role] +
        (ui.viewer === role
          ? ' <span style="font-size:10.5px;background:var(--green);color:#0a1119;padding:2px 8px;border-radius:5px;margin-left:6px;vertical-align:middle;font-weight:800;letter-spacing:.5px">🎮 我</span>'
          : (ui.viewer === 'passenger' ? '' : ' <span style="font-size:10.5px;color:var(--dim);margin-left:6px;font-weight:normal">（对方）</span>')) +
        ' <span class="role-tag">' + (isPilot ? '蓝骰' : '橙骰') + '</span></h2>');
      h.push('<div class="subduty">职责：姿态 · 引擎 · ' + duty + '</div>');

      h.push('<div class="dice-well"><div class="dice-row">');
      for (var i = 0; i < L.CONFIG.DICE_PER_PLAYER; i++) h.push(this.dieHTML(ctx, role, i));
      h.push('</div><div class="dice-actions">');
      var canRoll = state.phase === 'roll' && !state.rolled[role] && viewCtx.canOperate(role);
      if (canRoll) h.push('<button class="btn-primary" data-act="roll" data-role="' + role + '">🎲 掷骰（保密）</button>');
      if (state.phase === 'roll' && state.rolled[role] && !viewCtx.canSee(role)) {
        h.push('<span style="font-size:11px;color:var(--dim)">已掷 ✓ 请勿偷看对方</span>');
      }
      h.push('</div>');
      if (state.phase === 'roll' && state.rolled[role] && viewCtx.canSee(role)) {
        h.push('<div class="hide-banner you">🎯 你的骰子已就位，等待开始放置</div>');
      }
      if (state.phase === 'place') {
        if (state.currentPlayer === role && viewCtx.canOperate(role)) {
          h.push('<div class="hide-banner you">🎯 轮到你了：点骰子 → 可选 ☕ 修正 → 点槽位</div>');
          if (selected && selected.role === role && ctx.pendingCoffee) {
            var pv = ctx.pendingCoffeePreview ? ctx.pendingCoffeePreview(state) : null;
            var pc = ctx.pendingCoffee;
            var spent = pc.plus + pc.minus;
            if (pv !== null && (spent > 0 || state.coffee > 0)) {
              h.push('<div class="hide-banner" style="border-color:var(--amber);color:#ffc53d">☕ 修正预览：' +
                state.dice[role][selected.idx].v + ' → <b>' + pv + '</b>（+' + pc.plus + '/−' + pc.minus + '，剩 ' + state.coffee + '） ' +
                (state.coffee > spent ? '<button data-act="coffee-plus" style="margin-left:6px">+1</button><button data-act="coffee-minus">−1</button>' : '') +
                (spent > 0 ? ' <button data-act="coffee-clear">清除</button>' : '') +
                '</div>');
            }
          }
        } else if (viewCtx.canOperate(role)) {
          h.push('<div class="hide-banner">⏳ 等待对方放置……</div>');
        } else if (ui.viewer !== 'passenger' && state.currentPlayer !== role) {
          h.push('<div class="hide-banner">🔒 对方操作中，请勿窥视对方骰子</div>');
        }
      }
      if (ui.viewer === 'passenger') {
        h.push('<div class="hide-banner" style="color:#e8cd8a">🧐 观战模式 · 只读</div>');
      }
      h.push('</div>');

      var order = ['axis', 'engine', 'radio'];
      if (role === 'copilot') order.push('radio2');
      order.push('coffee');
      Object.keys(L.SLOTS[role]).forEach(function (s) { if (order.indexOf(s) === -1) order.push(s); });
      var single = [], grid = [];
      order.forEach(function (s) {
        var def = L.SLOTS[role][s];
        if (def.gear || def.order) grid.push(s); else single.push(s);
      });
      h.push('<div style="display:flex;flex-direction:column;gap:6px">');
      single.forEach(function (s) { h.push(PlayerPanel.slotHTML(ctx, role, s)); });
      h.push('</div>');
      if (grid.length) {
        h.push('<div class="slot-group">');
        grid.forEach(function (s) { h.push(PlayerPanel.slotHTML(ctx, role, s)); });
        h.push('</div>');
      }

      el.innerHTML = h.join('');
      el.classList.remove('highlight', 'co');
      if (hl) hl.trim().split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
    } catch (e) {
      try {
        el.innerHTML = '<div style="border:1px solid #7a2f2f;color:#ffb4b4;padding:14px;background:#2a1010;border-radius:8px">面板渲染错误：' +
          e.message + '<pre style="font-size:11px;margin-top:6px;white-space:pre-wrap">' + (e.stack || '') + '</pre></div>';
      } catch (e2) { /* ignore */ }
    }
  }
};

if (typeof window !== 'undefined') window.PlayerPanel = PlayerPanel;
