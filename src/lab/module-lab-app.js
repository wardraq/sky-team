/* ============================================================
 * 模块实验室 UI
 * ============================================================ */
'use strict';

var LabApp = {
  state: null,
  selectedModuleId: 'turbulence',

  init: function () {
    if (!window.GameLogic || !window.ModuleRegistry) {
      document.body.innerHTML = '<div class="lab-err">请通过 node server.js 启动后访问 /module-lab.html</div>';
      return;
    }
    this.renderModuleList();
    this.renderContract();
    this.selectModule(this.selectedModuleId);
    this.bindEvents();
  },

  bindEvents: function () {
    var self = this;
    document.getElementById('lab-modules').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-module]');
      if (btn) self.selectModule(btn.dataset.module);
    });
    document.getElementById('lab-actions').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      self.runAction(btn.dataset.action, btn.dataset);
    });
    document.getElementById('lab-hooks').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-hook]');
      if (!btn) return;
      self.runHook(btn.dataset.hook);
    });
    document.getElementById('lab-presets').addEventListener('change', function (e) {
      if (e.target.value) self.loadPreset(e.target.value);
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      ModuleRunner.clearLog();
      self.state = ModuleRunner.newLabState(self.selectedModuleId);
      self.refresh();
    });
    document.getElementById('btn-clear-log').addEventListener('click', function () {
      ModuleRunner.clearLog();
      self.renderLog();
    });
  },

  selectModule: function (moduleId) {
    this.selectedModuleId = moduleId;
    ModuleRunner.clearLog();
    this.state = ModuleRunner.newLabState(moduleId);
    this.renderModuleList();
    this.renderModuleDetail();
    this.renderPresets();
    this.renderHookButtons();
    this.refresh();
  },

  loadPreset: function (presetKey) {
    this.state = ModuleRunner.applyPreset(presetKey, this.selectedModuleId);
    document.getElementById('lab-presets').value = '';
    this.refresh();
  },

  runAction: function (actionId, dataset) {
    if (!this.state) return;
    var args = {
      moduleId: this.selectedModuleId,
      role: dataset.role || 'pilot',
      dieIdx: +(dataset.idx || 0),
      slot: dataset.slot || 'axis',
      delta: +(dataset.delta || 1)
    };
    if (actionId === 'newGame') {
      this.state = ModuleRunner.newLabState(this.selectedModuleId);
    } else {
      ModuleRunner.runCore(this.state, actionId, args);
    }
    this.refresh();
  },

  runHook: function (hookName) {
    if (!this.state) return;
    var args = [];
    if (hookName === 'onRollDice') args = ['pilot'];
    if (hookName === 'onPlaceDie') args = ['pilot', 0, 'axis'];
    if (hookName === 'slotAllowed') {
      var r = ModuleRunner.runHook(this.state, this.selectedModuleId, hookName, ['pilot', 'engine', window.GameLogic.SLOTS.pilot.engine]);
      this.refresh();
      return;
    }
    ModuleRunner.runHook(this.state, this.selectedModuleId, hookName, args);
    this.refresh();
  },

  renderModuleList: function () {
    var el = document.getElementById('lab-modules');
    el.innerHTML = ModuleRegistry.listAll().map(function (m) {
      var hooks = ModuleRunner.getModuleHooks(m.id).length;
      var owner = m.logicOwner === 'core' ? 'core' : 'module';
      return '<button class="lab-mod-btn' + (m.id === LabApp.selectedModuleId ? ' active' : '') + '" data-module="' + m.id + '">' +
        '<span class="name">' + m.name + '</span>' +
        '<span class="meta">' + m.id + ' · ' + owner + ' · ' + hooks + ' hooks</span></button>';
    }).join('');
  },

  renderModuleDetail: function () {
    var mod = ModuleRegistry.get(this.selectedModuleId);
    var el = document.getElementById('lab-mod-detail');
    if (!mod) { el.innerHTML = ''; return; }
    var hooks = ModuleRunner.getModuleHooks(mod.id);
    var ownerNote = mod.logicOwner === 'core'
      ? '<div class="lab-note warn">⚠ 核心逻辑在 <code>' + (mod.logicFile || 'game-logic.js') + '</code>，ModuleRegistry 仅登记元数据</div>'
      : '<div class="lab-note">玩法逻辑在本模块 Hook 中实现</div>';
    el.innerHTML =
      '<h2>' + mod.name + ' <code>' + mod.id + '</code></h2>' +
      '<p>' + (mod.description || '') + '</p>' + ownerNote +
      '<div class="lab-hook-tags">' + hooks.map(function (h) {
        return '<span class="tag">' + h.hook + '</span>';
      }).join('') + (hooks.length ? '' : '<span class="lab-muted">无 Hook（仅元数据）</span>') + '</div>';
  },

  renderContract: function () {
    var layers = document.getElementById('lab-layers');
    layers.innerHTML = ModuleContract.LAYERS.map(function (L) {
      return '<div class="lab-layer" style="border-left:3px solid ' + L.color + '">' +
        '<div class="lab-layer-head"><b>' + L.name + '</b><code>' + L.file + '</code></div>' +
        '<ul>' + L.owns.map(function (o) { return '<li>' + o + '</li>'; }).join('') + '</ul></div>';
    }).join('');

    var life = document.getElementById('lab-lifecycle');
    life.innerHTML = '<table class="lab-table"><thead><tr><th>阶段</th><th>维护者</th><th>说明</th></tr></thead><tbody>' +
      ModuleContract.LIFECYCLE.map(function (s) {
        return '<tr><td>' + s.label + '</td><td><code>' + s.owner + '</code></td><td>' + s.desc + '</td></tr>';
      }).join('') + '</tbody></table>';
  },

  renderPresets: function () {
    var sel = document.getElementById('lab-presets');
    var opts = ['<option value="">— 加载测试预设 —</option>'];
    Object.keys(ModuleRunner.PRESETS).forEach(function (k) {
      var p = ModuleRunner.PRESETS[k];
      if (p.moduleId === LabApp.selectedModuleId) {
        opts.push('<option value="' + k + '">' + p.label + '</option>');
      }
    });
    sel.innerHTML = opts.join('');
  },

  renderHookButtons: function () {
    var el = document.getElementById('lab-hooks');
    var mod = ModuleRegistry.get(this.selectedModuleId);
    if (!mod) { el.innerHTML = ''; return; }
    el.innerHTML = ModuleContract.HOOKS.map(function (h) {
      var has = typeof mod[h.hook] === 'function';
      return '<button class="lab-hook-btn' + (has ? '' : ' disabled') + '" data-hook="' + h.hook + '" ' + (has ? '' : 'disabled') + '>' +
        h.hook + '<small>' + h.phase + '</small></button>';
    }).join('');
  },

  renderState: function () {
    var el = document.getElementById('lab-state');
    if (!this.state) { el.textContent = '{}'; return; }
    var view = {
      phase: this.state.phase,
      round: this.state.round,
      axis: this.state.axis,
      altitude: this.state.altitude,
      distance: this.state.distance,
      traffic: this.state.traffic,
      moduleState: this.state.moduleState,
      dice: this.state.dice,
      placements: this.state.placements
    };
    el.textContent = JSON.stringify(view, null, 2);
  },

  renderLog: function () {
    var el = document.getElementById('lab-log');
    el.innerHTML = ModuleRunner.log.map(function (it) {
      return '<div class="lab-log-item ' + it.level + '"><span class="t">' + it.t + '</span> ' + it.msg +
        (it.detail ? '<pre>' + JSON.stringify(it.detail, null, 2) + '</pre>' : '') + '</div>';
    }).join('') || '<div class="lab-muted">暂无操作记录</div>';
  },

  renderWidget: function () {
    var el = document.getElementById('lab-widget');
    el.innerHTML = ModuleRunner.renderWidgetPreview(this.state, this.selectedModuleId);
  },

  refresh: function () {
    this.renderModuleDetail();
    this.renderState();
    this.renderLog();
    this.renderWidget();
    document.getElementById('lab-phase').textContent = this.state ? this.state.phase : '—';
    document.getElementById('lab-round').textContent = this.state ? ('R' + this.state.round) : '—';
  }
};

document.addEventListener('DOMContentLoaded', function () { LabApp.init(); });
