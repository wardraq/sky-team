/* ============================================================
 * 机场航道 / 高度轨配置
 *
 * 各机场可独立设置：
 *   DISTANCE_START         进近起点（距机场格数）；轨道共 DISTANCE_START+1 格（含机场 0）
 *   TRAFFIC_START          初始交通，数组每项一架飞机（值为距机场格数）
 *   ALTITUDE_START         起始高度（英尺）
 *   ALTITUDE_STEP          每轮结算下降步长
 *   ALTITUDE_MIN           最低高度（通常 0）
 *   ALTITUDE_REROLL_SPACES 高度轨上可拾取重掷标记的高度列表
 *   ROUNDS                 可选，UI 轮数显示上限
 * ============================================================ */
'use strict';

var AirportTracks = {
  yul: {
    DISTANCE_START: 7,
    TRAFFIC_START: [4, 3, 3, 2, 1, 1, 1, 0, 0],
    ALTITUDE_START: 6000,
    ALTITUDE_STEP: 1000,
    ALTITUDE_MIN: 0,
    ALTITUDE_REROLL_SPACES: [6000, 2000],
    ROUNDS: 7
  },

  /** 测试机场：2 格航道、机场 1 架飞机、高度 1000/0、1000ft 可重掷 */
  test: {
    DISTANCE_START: 1,
    TRAFFIC_START: [0],
    ALTITUDE_START: 1000,
    ALTITUDE_STEP: 1000,
    ALTITUDE_MIN: 0,
    ALTITUDE_REROLL_SPACES: [1000],
    ROUNDS: 2
  },

  lhr: {
    DISTANCE_START: 6,
    TRAFFIC_START: [1, 2, 4],
    ALTITUDE_START: 6000,
    ALTITUDE_STEP: 1000,
    ALTITUDE_MIN: 0,
    ALTITUDE_REROLL_SPACES: [6000, 2000],
    ROUNDS: 7
  },

  hnd: {
    DISTANCE_START: 6,
    TRAFFIC_START: [2, 4],
    ALTITUDE_START: 6000,
    ALTITUDE_STEP: 1000,
    ALTITUDE_MIN: 0,
    ALTITUDE_REROLL_SPACES: [6000, 2000],
    ROUNDS: 7
  }
};

/** 合并机场轨配置 + 场景专属覆盖（如 APPROACH_AXIS） */
function mergeTrack(trackId, extra) {
  var base = AirportTracks[trackId] || {};
  var cfg = {};
  Object.keys(base).forEach(function (k) { cfg[k] = base[k]; });
  if (extra) Object.keys(extra).forEach(function (k) { cfg[k] = extra[k]; });
  return cfg;
}

var root = typeof globalThis !== 'undefined' ? globalThis
  : (typeof window !== 'undefined' ? window : this);
root.AirportTracks = AirportTracks;
root.mergeTrack = mergeTrack;
