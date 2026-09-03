/* 着陆轮测试预设状态 */
'use strict';

var LandingRoundPresets = (function () {
  function baseYul() {
    return GameLogic.newGame('yul');
  }

  function prepAtAirport(s) {
    s.distance = 0;
    s.altitude = 0;
    s.traffic = [];
    s.axis = 0;
    s.gearAct = 3;
    s.flapsAct = 4;
    s.gearOn = { gear1: true, gear2: true, gear3: true };
    s.flapsOn = { flap1: true, flap2: true, flap3: true, flap4: true };
    s.brakesAct = 2;
    s.brakesOn = { brake1: true, brake2: true, brake3: false };
  }

  function prepReveal(s, axisP, axisC, engP, engC) {
    s.phase = 'reveal';
    s.placements.pilot.axis = { v: axisP, mod: 0 };
    s.placements.copilot.axis = { v: axisC, mod: 0 };
    s.placements.pilot.engine = { v: engP, mod: 0 };
    s.placements.copilot.engine = { v: engC, mod: 0 };
    s.roundResolved = { axis: true, engine: true };
  }

  function setDice(s, pilot, copilot) {
    pilot.forEach(function (v, i) { s.dice.pilot[i].v = v; s.dice.pilot[i].used = false; });
    copilot.forEach(function (v, i) { s.dice.copilot[i].v = v; s.dice.copilot[i].used = false; });
    s.rolled = { pilot: true, copilot: true };
  }

  function pushLog(s, msg, cls) {
    if (!s.log) s.log = [];
    s.log.unshift({ msg: msg, cls: cls || '', round: s.round });
  }

  var PRESETS = {
    'round-end-trigger': {
      title: '轮末 · 待进入着陆轮',
      desc: '距 0、高 0，roundEnd 阶段，点「进入着陆轮」',
      build: function () {
        var s = baseYul();
        prepAtAirport(s);
        s.round = 7;
        s.phase = 'roundEnd';
        s.landingRound = false;
        s.waiting = false;
        pushLog(s, '🛬 机场与触地高度对齐 — 下一轮为着陆轮，须完成放置并满足 A–D');
        return s;
      }
    },
    'landing-discuss': {
      title: '着陆轮 · 讨论',
      desc: '第 8 轮 discuss，起落架/襟翼已满',
      build: function () {
        var s = baseYul();
        prepAtAirport(s);
        s.round = 8;
        GameLogic.beginRound(s);
        return s;
      }
    },
    'landing-roll': {
      title: '着陆轮 · 掷骰',
      desc: 'roll 阶段，双方已掷示例骰',
      build: function () {
        var s = PRESETS['landing-discuss'].build();
        s.phase = 'roll';
        setDice(s, [4, 2, 6, 1], [3, 5, 2, 4]);
        return s;
      }
    },
    'landing-place': {
      title: '着陆轮 · 放置中',
      desc: 'place 阶段，姿态/引擎已放，剩起落架/刹车等',
      build: function () {
        var s = PRESETS['landing-roll'].build();
        s.phase = 'place';
        s.currentPlayer = 'copilot';
        s.placements.pilot.axis = { v: 3, mod: 0, hidden: true };
        s.placements.copilot.axis = { v: 3, mod: 0, hidden: true };
        s.placements.pilot.engine = { v: 1, mod: 0, hidden: true };
        s.placements.copilot.engine = { v: 2, mod: 0, hidden: true };
        s.dice.pilot[0].used = s.dice.pilot[1].used = true;
        s.dice.copilot[0].used = s.dice.copilot[2].used = true;
        s.roundResolved = { axis: true, engine: true };
        return s;
      }
    },
    'reveal-win': {
      title: '揭示 · 可胜利',
      desc: '引擎 1+2=3 < 限速 5（2 档刹车），满足 A–D',
      build: function () {
        var s = baseYul();
        prepAtAirport(s);
        s.round = 8;
        s.landingRound = true;
        prepReveal(s, 3, 3, 1, 2);
        return s;
      }
    },
    'reveal-overspeed': {
      title: '揭示 · 速度过快',
      desc: '引擎 4+3=7 ≥ 限速 5 → 失败',
      build: function () {
        var s = PRESETS['reveal-win'].build();
        prepReveal(s, 3, 3, 4, 3);
        return s;
      }
    },
    'reveal-bad-axis': {
      title: '揭示 · 姿态倾斜',
      desc: 'axis ≠ 0，其余正常',
      build: function () {
        var s = PRESETS['reveal-win'].build();
        s.axis = 2;
        prepReveal(s, 4, 2, 1, 2);
        return s;
      }
    },
    'reveal-traffic': {
      title: '揭示 · 路径有飞机',
      desc: 'traffic 未清空',
      build: function () {
        var s = PRESETS['reveal-win'].build();
        s.traffic = [1];
        return s;
      }
    },
    'reveal-incomplete-gear': {
      title: '揭示 · 起落架未满',
      desc: 'gearAct=2，缺第 3 组',
      build: function () {
        var s = PRESETS['reveal-win'].build();
        s.gearAct = 2;
        s.gearOn.gear3 = false;
        return s;
      }
    },
    'result-win': {
      title: '结果 · 胜利',
      desc: 'phase=win 终局展示',
      build: function () {
        var s = PRESETS['reveal-win'].build();
        GameLogic.resolveRound(s);
        return s;
      }
    },
    'result-lose': {
      title: '结果 · 失败',
      desc: 'phase=lose 超速原因',
      build: function () {
        var s = PRESETS['reveal-overspeed'].build();
        GameLogic.resolveRound(s);
        return s;
      }
    }
  };

  return {
    PRESETS: PRESETS,
    list: function () {
      return Object.keys(PRESETS).map(function (id) {
        return { id: id, title: PRESETS[id].title, desc: PRESETS[id].desc };
      });
    },
    build: function (id) {
      var p = PRESETS[id];
      if (!p) return null;
      return p.build();
    }
  };
})();

if (typeof window !== 'undefined') window.LandingRoundPresets = LandingRoundPresets;
