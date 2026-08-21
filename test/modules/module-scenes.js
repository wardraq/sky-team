/* 各模块预览场景配置 —— 供 test/modules/preview.html 使用 */
'use strict';

var ModulePreviewCatalog = {
  traffic: {
    status: 'core',
    statusLabel: '核心已实现',
    widget: { script: '/src/widgets/approach.js', global: 'ApproachWidget' },
    scenes: [
      {
        id: 'same-cell',
        title: '场景一 · 与交通飞机同格',
        desc: '我机在距 3，交通飞机也在距 3。须前进且当前位置有飞机才会撞机。',
        patch: { distance: 3, traffic: [3], phase: 'place', round: 1 }
      },
      {
        id: 'multi-ahead',
        title: '场景二 · 前方一格多架飞机',
        desc: '我机在距 4，距 3 堆叠 3 架。无线电每次清除 1 架。',
        patch: { distance: 4, traffic: [3, 3, 3], phase: 'place', round: 1 }
      }
    ]
  },
  turbulence: {
    status: 'stub',
    statusLabel: 'Hook 预留',
    placeholder: {
      icon: '🌪',
      hint: '湍流轮：放置骰子后重掷该玩家剩余骰子。',
      hooks: ['initState', 'onPlaceDie']
    },
    scenes: [
      {
        id: 'round-marked',
        title: '场景 · 湍流轮标记',
        desc: '第 3 轮为湍流轮，放置任意骰后应触发剩余骰重掷。',
        patch: { phase: 'place', round: 3, currentPlayer: 'pilot' },
        modulePatch: { turbulence: { turbulenceRounds: [3] } }
      }
    ]
  },
  visibility: {
    status: 'stub',
    statusLabel: 'Hook 预留',
    placeholder: {
      icon: '🌫',
      hint: '低能见度：每轮仅 2 颗骰可用，UI 需展示可用/禁用骰子。',
      hooks: ['initState', 'getDiceLimit']
    },
    scenes: [
      {
        id: 'dice-limit',
        title: '场景 · 骰子上限 2',
        desc: 'activeDiceLimit=2，第 3、4 颗骰在 UI 上应置灰或不可选。',
        patch: { phase: 'roll', round: 2 },
        modulePatch: { visibility: { activeDiceLimit: 2 } }
      }
    ]
  },
  alarms: {
    status: 'stub',
    statusLabel: 'Hook 预留',
    placeholder: {
      icon: '🚨',
      hint: '高度轨警报 token 锁定对应槽位，需专门 Widget 展示锁定状态。',
      hooks: ['initState', 'slotAllowed']
    },
    scenes: [
      {
        id: 'engine-blocked',
        title: '场景 · 引擎槽锁定',
        desc: '机长引擎槽被警报锁定，slotAllowed 应拒绝放置。',
        patch: { phase: 'place', round: 4, currentPlayer: 'pilot' },
        modulePatch: { alarms: { blockedSlots: { 'pilot.engine': true } } }
      }
    ]
  },
  wind: {
    status: 'stub',
    statusLabel: 'Hook 预留',
    placeholder: {
      icon: '💨',
      hint: '风向环 + 风速修正引擎推进与终局判定。',
      hooks: ['initState', 'beforeResolveRound']
    },
    scenes: [
      {
        id: 'neutral-wind',
        title: '场景 · 默认风向',
        desc: 'wind.speed=0，Widget 预留展示风向指针与修正预览。',
        patch: { phase: 'reveal', round: 5 },
        modulePatch: { wind: { speed: 0, direction: 'neutral' } }
      }
    ]
  },
  kerosene: {
    status: 'stub',
    statusLabel: 'Hook 预留',
    placeholder: {
      icon: '⛽',
      hint: '燃油表 Widget：每轮结算 -6，≤0 坠毁。',
      hooks: ['initState', 'afterResolveRound', 'checkWin']
    },
    scenes: [
      {
        id: 'fuel-low',
        title: '场景 · 燃油告急',
        desc: 'fuel=8，下轮结算后应触发燃油耗尽。',
        patch: { phase: 'reveal', round: 6 },
        modulePatch: { kerosene: { fuel: 8 } }
      }
    ]
  },
  interns: {
    status: 'stub',
    statusLabel: 'Hook 预留',
    placeholder: {
      icon: '🎓',
      hint: '实习生轨道：放置骰训练实习生 token。',
      hooks: ['initState']
    },
    scenes: [
      {
        id: 'track-start',
        title: '场景 · 轨道初始',
        desc: 'track=0，预留 UI 展示实习生面板与 token 队列。',
        patch: { phase: 'place', round: 2 },
        modulePatch: { interns: { track: 0 } }
      }
    ]
  },
  penguins: {
    status: 'stub',
    statusLabel: 'Hook 预留',
    placeholder: {
      icon: '🐧',
      hint: '冰跑道企鹅障碍，行为类似空中交通，主题不同。',
      hooks: ['initState']
    },
    scenes: [
      {
        id: 'penguin-ahead',
        title: '场景 · 前方企鹅',
        desc: 'traffic 语义复用为企鹅位置，航道 Widget 可换肤展示。',
        patch: { distance: 5, traffic: [4], phase: 'place', round: 3 }
      }
    ]
  },
  'ice-brakes': {
    status: 'stub',
    statusLabel: 'Hook 预留',
    placeholder: {
      icon: '🧊',
      hint: '冰面刹车：刹车槽点数顺序与终局判定扩展。',
      hooks: ['initState']
    },
    scenes: [
      {
        id: 'brake-seq',
        title: '场景 · 刹车顺序',
        desc: '着陆轮前需按 2→4→6 激活刹车，预留冰面主题样式。',
        patch: { phase: 'place', round: 7, distance: 0, altitude: 1, landingRound: true },
        modulePatch: { 'ice-brakes': {} }
      }
    ]
  }
};

if (typeof window !== 'undefined') window.ModulePreviewCatalog = ModulePreviewCatalog;
