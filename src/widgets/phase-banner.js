/* ============================================================
 * 阶段横幅 Widget —— 当前阶段说明 + 全局操作按钮
 * ============================================================ */
'use strict';

var PhaseBannerWidget = {
  bannerText: function (state, ui, logic, isRerollPicking) {
    if (!state) return '';
    var me = logic.ROLES[ui.viewer];
    var op = ui.viewer === 'passenger' ? '' : '　｜　你：' + me;
    var landingTag = state.landingRound ? ' · <b style="color:var(--green)">着陆轮</b>' : (state.waiting ? ' · 等待航线' : '');
    var picking = isRerollPicking || (state.rerollPick && state.rerollPick.active);
    switch (state.phase) {
      case 'discuss':
        return (state.landingRound ? '🛬 着陆轮' : '第 ' + state.round + ' 轮') + ' · 策略讨论 <span class="sub">可以讨论策略，但禁止提及骰子点数。准备好后由任一玩家开始掷骰。' + landingTag + op + '</span>';
      case 'roll':
        var both = state.rolled.pilot && state.rolled.copilot;
        return (state.landingRound ? '🛬 着陆轮' : '第 ' + state.round + ' 轮') + ' · 秘密掷骰 <span class="sub">' +
          (picking ? '重掷中：点选要重掷的骰子，再点「确认重掷」。' :
            (both ? '双方已掷。' : '各自点击自己面板的「掷骰」。')) +
          (state.reroll > 0 && !picking ? ' 重掷标记 ×' + state.reroll : '') + op + '</span>';
      case 'place':
        var who = state.currentPlayer === 'pilot' ? '机长' : '副驾';
        var myTurn = ui.viewer === state.currentPlayer;
        return (state.landingRound ? '🛬 着陆轮' : '第 ' + state.round + ' 轮') + ' · 放置骰子 <span class="sub">' +
          (picking ? '重掷中：点选未用的骰子，再点「确认重掷」。' :
            ((state.landingRound ? '完成 8 骰；引擎对比<b>刹车</b>；须满足 A–D。' : '') +
          '轮到 <b>' + who + '</b>' +
          (myTurn ? '（就是你！）' : '（等待对方）') +
          '：先点骰子，可用 ☕ 修正，再点空槽位。姿态/引擎第二颗放上即结算。')) + '</span>';
      case 'reveal':
        return (state.landingRound ? '🛬 着陆轮' : '第 ' + state.round + ' 轮') + ' · 放置完毕 <span class="sub">' +
          (state.landingRound ? '确认后判定最终降落（A–D）。' : '确认后结算本轮（降低高度等）。') + '</span>';
      case 'roundEnd':
        return '第 ' + state.round + ' 轮结算完毕 <span class="sub">高度 ' + state.altitude + ' 英尺，距机场 ' + state.distance + (state.waiting ? '，等待模式' : '') + landingTag + '</span>';
      default:
        return '';
    }
  },

  actionsHTML: function (state, ui, isRerollPicking) {
    if (ui.viewer === 'passenger') {
      return '<span style="color:#e8cd8a;font-size:12px">🧐 观战模式</span>';
    }
    var acts = '';
    var picking = isRerollPicking || (state.rerollPick && state.rerollPick.active);
    switch (state.phase) {
      case 'discuss':
        acts += '<button class="btn-primary" data-act="begin-roll">🎲 开始掷骰</button>';
        break;
      case 'roll':
        if (!picking && state.reroll > 0 && state.rolled.pilot && state.rolled.copilot) {
          acts += '<button data-act="begin-reroll">🔄 使用重掷（×' + state.reroll + '）</button>';
        }
        if (!picking && state.rolled.pilot && state.rolled.copilot) {
          acts += '<button class="btn-primary" data-act="done-roll">✔ 开始放置</button>';
        }
        break;
      case 'place':
        if (!picking && state.reroll > 0) {
          acts += '<button data-act="begin-reroll">🔄 使用重掷（×' + state.reroll + '）</button>';
        }
        break;
      case 'reveal':
        acts += '<button class="btn-ok" data-act="settle">✅ 结算本轮</button>';
        break;
      case 'roundEnd':
        if (state.altitude === 0 && state.distance === 0 && !state.landingRound) {
          acts += '<button class="btn-primary" data-act="next-round">🛬 进入着陆轮 ▶</button>';
        } else {
          acts += '<button class="btn-primary" data-act="next-round">第 ' + (state.round + 1) + ' 轮 ▶</button>';
        }
        break;
    }
    return acts;
  },

  render: function (ctx) {
    var state = ctx.state;
    var ui = ctx.ui;
    var logic = ctx.logic;
    var isRerollPicking = ctx.isRerollPicking;
    return '<div class="card banner' + (state.phase === 'lose' ? ' warn' : '') + '">' +
      '<div class="phase">' + this.bannerText(state, ui, logic, isRerollPicking) + '</div>' +
      '<div class="actions">' + this.actionsHTML(state, ui, isRerollPicking) + '</div>' +
      '</div>';
  }
};

if (typeof window !== 'undefined') window.PhaseBannerWidget = PhaseBannerWidget;
