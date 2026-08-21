/* ============================================================
 * 中央仪表编排 —— 组合各 Widget + 模块扩展
 * ============================================================ */
'use strict';

var CenterDashboard = {
  WAITING_HTML: '<div class="card" style="text-align:center;padding:40px"><h3>⏳ 等待游戏开始…</h3><div style="color:var(--dim);font-size:12px;margin-top:8px">机长与副驾都就位后将出现仪表与操作面板</div></div>',

  WIDGETS: [
    { id: 'phase-banner', render: function (ctx, preview) { return PhaseBannerWidget.render(ctx); } },
    { id: 'approach', render: function (ctx, preview) { return ApproachWidget.render(ctx); } },
    { id: 'altitude', render: function (ctx, preview) { return AltitudeWidget.render(ctx); } },
    { id: 'attitude', render: function (ctx, preview) { return AttitudeWidget.render(ctx, preview); } },
    { id: 'engine-bar', render: function (ctx, preview) { return EngineBarWidget.render(ctx, preview); } },
    { id: 'brakes-board', render: function (ctx, preview) { return BrakesBoardWidget.render(ctx); } }
  ],

  safeRender: function (id, fn) {
    try {
      return fn();
    } catch (e) {
      return '<div class="card" style="border-color:#7a2f2f"><h3 style="color:var(--red)">' + id + ' 渲染错误</h3>' +
        '<pre style="color:#ffb4b4;font-size:11px;white-space:pre-wrap">' + (e.stack || e.message) + '</pre></div>';
    }
  },

  renderModuleWidgets: function (ctx) {
    if (typeof ModuleRegistry === 'undefined') return '';
    var h = [];
    ModuleRegistry.collectWidgets(ctx.state, ctx).forEach(function (w) {
      if (w.render) {
        h.push(CenterDashboard.safeRender(w.id || 'module', function () { return w.render(ctx); }));
      }
    });
    return h.join('');
  },

  render: function (ctx) {
    var state = ctx.state;
    if (!state) return this.WAITING_HTML;

    var preview = PlacementPreview.compute(state, ctx.logic);
    var h = [];

    this.WIDGETS.forEach(function (w) {
      h.push(CenterDashboard.safeRender(w.id, function () { return w.render(ctx, preview); }));
    });

    h.push(this.renderModuleWidgets(ctx));
    h.push(this.safeRender('reveal', function () { return RevealWidget.render(ctx); }));
    h.push(this.safeRender('final', function () { return FinalWidget.render(ctx); }));
    h.push(this.safeRender('log', function () { return LogWidget.render(ctx); }));

    return h.join('');
  },

  mount: function (ctx) {
    var el = document.getElementById('center');
    try {
      el.innerHTML = this.render(ctx);
    } catch (e) {
      el.innerHTML = '<div style="border:1px solid #7a2f2f;color:#ffb4b4;padding:14px;background:#2a1010;border-radius:8px;margin:10px">中央仪表渲染错误：' +
        e.message + '<pre style="font-size:11px;margin-top:6px;white-space:pre-wrap">' + (e.stack || '') + '</pre></div>';
    }
  }
};

if (typeof window !== 'undefined') window.CenterDashboard = CenterDashboard;
