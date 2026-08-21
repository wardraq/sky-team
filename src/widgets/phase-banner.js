/* ============================================================
 * 阶段横幅 Widget —— 当前阶段说明 + 全局操作按钮
 * ============================================================ */
'use strict';

var PhaseBannerWidget = {
  bannerText: function (state, ui, logic) {
    if (!state) return '';
    var me = logic.ROLES[ui.viewer];
    var op = ui.viewer === 'passenger' ? '' : '　｜　你：' + me;
    switch (state.phase) {
      case 'discuss':
        return '第 ' + state.round + ' 轮 · 策略讨论 <span class="sub">可以讨论策略，但禁止提及骰子点数。准备好后由任一玩家开始掷骰。' + op + '</span>';
      case 'roll':
        var both = state.rolled.pilot && state.rolled.copilot;
        return '第 ' + state.round + ' 轮 · 秘密掷骰 <span class="sub">' +
          (both ? '双方已掷。' : '各自点击自己面板的「掷骰」。') +
          (state.reroll > 0 ? ' 重掷标记 ×' + state.reroll : '') + op + '</span>';
      case 'place':
        var who = state.currentPlayer === 'pilot' ? '机长' : '副驾';
        var myTurn = ui.viewer === state.currentPlayer;
        return '第 ' + state.round + ' 轮 · 放置骰子 <span class="sub">轮到 <b>' + who + '</b>' +
          (myTurn ? '（就是你！）' : '（等待对方）') +
          '：先点骰子，可用 ☕ 修正（放置时生效），再点空槽位。姿态/引擎第二颗放上即结算。</span>';
      case 'reveal':
        return '第 ' + state.round + ' 轮 · 放置完毕 <span class="sub">确认后结算本轮（降低高度等）。</span>';
      case 'roundEnd':
        return '第 ' + state.round + ' 轮结算完毕 <span class="sub">高度 ' + state.altitude + '，距机场 ' + state.distance + (state.waiting ? '，等待模式' : '') + '</span>';
      default:
        return '';
    }
  },

  actionsHTML: function (state, ui) {
    if (ui.viewer === 'passenger') {
      return '<span style="color:#e8cd8a;font-size:12px">🧐 观战模式</span>';
    }
    var acts = '';
    switch (state.phase) {
      case 'discuss':
        acts += '<button class="btn-primary" data-act="begin-roll">🎲 开始掷骰</button>';
        break;
      case 'roll':
        if (state.reroll > 0 && state.rolled.pilot && state.rolled.copilot) {
          acts += '<button data-act="reroll">🔄 重掷（×' + state.reroll + '）</button>';
        }
        if (state.rolled.pilot && state.rolled.copilot) {
          acts += '<button class="btn-primary" data-act="done-roll">✔ 开始放置</button>';
        }
        break;
      case 'place':
        if (state.reroll > 0) {
          acts += '<button data-act="reroll">🔄 重掷未用骰（×' + state.reroll + '）</button>';
        }
        break;
      case 'reveal':
        acts += '<button class="btn-ok" data-act="settle">✅ 结算本轮</button>';
        break;
      case 'roundEnd':
        acts += '<button class="btn-primary" data-act="next-round">第 ' + (state.round + 1) + ' 轮 ▶</button>';
        break;
    }
    return acts;
  },

  render: function (ctx) {
    var state = ctx.state;
    var ui = ctx.ui;
    var logic = ctx.logic;
    return '<div class="card banner' + (state.phase === 'lose' ? ' warn' : '') + '">' +
      '<div class="phase">' + this.bannerText(state, ui, logic) + '</div>' +
      '<div class="actions">' + this.actionsHTML(state, ui) + '</div>' +
      '</div>';
  }
};

if (typeof window !== 'undefined') window.PhaseBannerWidget = PhaseBannerWidget;
