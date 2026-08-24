/* ============================================================
 * 天合小队 Sky Team —— 联机服务端（零依赖）
 * 职责：静态页面服务 + WebSocket 房间管理 + 规则仲裁 + 状态过滤
 * 运行：node server.js   （默认端口 8080，可用 PORT 覆盖）
 * 页面：
 *   机长  http://host:8080/?room=abc&role=pilot
 *   副驾  http://host:8080/?room=abc&role=copilot
 *   乘客  http://host:8080/?room=abc&role=passenger  （上帝视角观战）
 * ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const PORT = process.env.PORT || 8080;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* ---------- 逻辑层：从 src/logic/game-logic.js 加载（单点维护） ---------- */
const { loadGameEnvironment } = require('./src/logic/load-logic');
const { GameLogic, ScenarioRegistry } = loadGameEnvironment(DIR);
console.log('✓ 逻辑层加载成功（game-logic + scenario/module registry）');

function defaultScenarioId() {
  return ScenarioRegistry.defaultId || 'yul';
}

/* ---------- WebSocket 帧编解码（RFC 6455，文本帧） ---------- */
function encodeFrame(payload, opcode) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

class MiniWS {
  constructor(socket, onMessage, onClose) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.onMessage = onMessage;
    this.onClose = onClose;
  }
  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this._process();
  }
  _process() {
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0], b1 = this.buffer[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) { if (this.buffer.length < 4) return; len = this.buffer.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buffer.length < 10) return; len = Number(this.buffer.readBigUInt64BE(2)); off = 10; }
      const maskLen = masked ? 4 : 0;
      if (this.buffer.length < off + maskLen + len) return;
      let payload = this.buffer.slice(off + maskLen, off + maskLen + len);
      if (masked) {
        const key = this.buffer.slice(off, off + 4);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ key[i % 4];
        payload = out;
      }
      this.buffer = this.buffer.slice(off + maskLen + len);
      if (opcode === 0x8) { // close
        try { this.socket.write(encodeFrame(Buffer.alloc(0), 0x8)); this.socket.end(); } catch (e) {}
        if (this.onClose) this.onClose();
        return;
      }
      if (opcode === 0x9) { // ping -> pong
        try { this.socket.write(encodeFrame(payload, 0xA)); } catch (e) {}
        continue;
      }
      if (opcode === 0x1) { // text
        try { this.onMessage(payload.toString('utf8')); } catch (e) { console.error('WS onMessage:', e.message); }
      }
    }
  }
  sendText(str) {
    try { this.socket.write(encodeFrame(Buffer.from(str, 'utf8'), 0x1)); } catch (e) {}
  }
  close() {
    try { this.socket.end(); } catch (e) {}
  }
}

/* ---------- 房间与状态 ---------- */
const rooms = new Map(); // roomId -> { pilot, copilot, passengers:Set, conns:Map, state }

function getRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, {
      id: id,
      pilot: null,
      copilot: null,
      passengers: new Set(),
      conns: new Map(),
      state: null,
      scenarioId: null
    });
  }
  return rooms.get(id);
}

function pickScenarioId(requested) {
  if (requested && ScenarioRegistry.isPlayable(requested)) {
    return ScenarioRegistry.get(requested).id;
  }
  return ScenarioRegistry.defaultId || 'yul';
}

/** 开局前锁定房间关卡；已开局则忽略 */
function applyRoomScenario(room, requestedId, conn) {
  if (room.state) return room.scenarioId;
  var picked = pickScenarioId(requestedId);
  if (!room.scenarioId) {
    room.scenarioId = picked;
    return room.scenarioId;
  }
  if (picked !== room.scenarioId && conn && (conn.role === 'pilot' || conn.role === 'copilot')) {
    send(conn, {
      type: 'notice',
      msg: '⚠ 房间已选关卡「' + ScenarioRegistry.meta(room.scenarioId).name + '」，忽略参数 ' + picked
    });
  }
  return room.scenarioId;
}

function scenarioPayload(room) {
  var id = room.scenarioId || ScenarioRegistry.defaultId;
  return { scenarioId: id, scenario: ScenarioRegistry.meta(id) };
}
function peersOf(room) { return { pilot: !!room.pilot, copilot: !!room.copilot, passengers: room.passengers.size }; }

function isPublicPhase(p) {
  // 放置阶段开始骰子就明放（模拟实体桌游把骰子从屏风翻开放到公共面板）
  // 唯一保密窗口：roll 阶段掷完到点"开始放置"之前
  return p === 'place' || p === 'reveal' || p === 'roundEnd' || p === 'win' || p === 'lose';
}

/* 按角色过滤状态：揭示前隐藏对方骰子数值与已放置槽位数值 */
function sanitize(s, role) {
  const c = JSON.parse(JSON.stringify(s));
  if (role !== 'passenger' && !isPublicPhase(s.phase)) {
    const other = role === 'pilot' ? 'copilot' : 'pilot';
    c.dice[other].forEach(d => { if (d.v !== 0) { d.v = 0; d.hidden = true; } });
    Object.keys(c.placements[other]).forEach(k => {
      if (c.placements[other][k]) c.placements[other][k] = { v: 0, mod: 0, hidden: true };
    });
  }
  return c;
}

function send(conn, obj) {
  try {
    if (conn && conn.ws) conn.ws.sendText(JSON.stringify(obj));
    else console.error('send 失败: conn 无效', conn && conn.role);
  } catch (e) { console.error('send 异常:', e.message); }
}

function broadcast(room, msg) {
  room.conns.forEach(function (_, conn) {
    let out = msg;
    if (msg.type === 'state') out = Object.assign({}, msg, { state: sanitize(msg.state, conn.role) });
    send(conn, out);
  });
}

function broadcastState(room) {
  if (!room.state) return;
  broadcast(room, { type: 'state', state: room.state });
}
function broadcastPeers(room) {
  broadcast(room, { type: 'peers', peers: peersOf(room) });
}

function startIfReady(room) {
  if (room.pilot && room.copilot && !room.state) {
    var sid = room.scenarioId || defaultScenarioId();
    room.scenarioId = sid;
    room.state = GameLogic.newGame(sid);
    GameLogic.beginRound(room.state);
    var meta = ScenarioRegistry.meta(sid);
    broadcast(room, {
      type: 'notice',
      msg: '🛫 机组就位，开始降落！关卡：' + (meta ? meta.name : sid)
    });
    broadcastState(room);
  }
}

/* ---------- 动作仲裁 ---------- */
function handleAction(conn, msg) {
  const room = conn.room;
  if (!room) return;
  const role = conn.role;
  const isPlayer = role === 'pilot' || role === 'copilot';
  const name = msg.name, args = msg.args || [];

  if (name === 'set-scenario') {
    if (isPlayer && !room.state && role === 'pilot') {
      var next = pickScenarioId(args[0]);
      room.scenarioId = next;
      broadcast(room, {
        type: 'notice',
        msg: '✈ 机长选择关卡：' + ScenarioRegistry.meta(next).name
      });
      broadcast(room, Object.assign({ type: 'scenario' }, scenarioPayload(room)));
    }
    return;
  }

  if (!room.state) return;
  GameLogic.ensureRerollPick(room.state);
  const s = room.state;

  try {
    switch (name) {
      case 'roll':
        if (isPlayer) GameLogic.rollDice(s, role);
        break;
      case 'begin-roll':
        if (isPlayer && s.phase === 'discuss') s.phase = 'roll';
        break;
      case 'begin-reroll':
        if (isPlayer) {
          var br = GameLogic.beginReroll(s);
          if (br && !br.ok) { send(conn, { type: 'err', msg: br.why }); return; }
        }
        break;
      case 'reroll-pick':
        if (isPlayer) {
          var pickArgs = Array.isArray(args[0]) && args.length === 1 ? args[0] : args;
          var rp = GameLogic.submitRerollPick(s, role, pickArgs);
          if (rp && !rp.ok) { send(conn, { type: 'err', msg: rp.why }); return; }
        }
        break;
      case 'reroll':
        if (isPlayer) {
          var rb = GameLogic.beginReroll(s);
          if (rb && !rb.ok) { send(conn, { type: 'err', msg: rb.why }); return; }
        }
        break;
      case 'done-roll':
        if (isPlayer && s.phase === 'roll') { s.phase = 'place'; s.currentPlayer = s.startPlayer; }
        break;
      case 'place':
        if (isPlayer) {
          var res = GameLogic.placeDie(s, role, args[0], args[1], {
            coffeePlus: args[2] || 0,
            coffeeMinus: args[3] || 0
          });
          if (res && !res.ok) {
            send(conn, { type: 'err', msg: res.why });
            return;
          }
        }
        break;
      case 'coffee':
        // args: [目标角色, 槽位, delta] —— 原版咖啡公共池，任意玩家可修正任意骰子
        if (isPlayer) GameLogic.useCoffee(s, args[0], args[1], args[2]);
        break;
      case 'settle':
        if (isPlayer) GameLogic.resolveRound(s);
        break;
      case 'next-round':
        if (isPlayer) GameLogic.nextRound(s);
        break;
      case 'restart':
        if (isPlayer) {
          var sid = room.scenarioId || defaultScenarioId();
          room.state = GameLogic.newGame(sid);
          GameLogic.beginRound(room.state);
        }
        break;
      default:
        send(conn, { type: 'err', msg: '未知动作: ' + name });
        return;
    }
  } catch (e) {
    send(conn, { type: 'err', msg: e.message });
    return;
  }
  broadcastState(room);
}

/* ---------- HTTP 静态服务 ---------- */
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  let filePath = u.pathname === '/' ? '/index.html' : u.pathname;
  const file = path.join(DIR, path.normalize(filePath));
  if (file.startsWith(DIR) && fs.existsSync(file) && /\.(html|js|css)$/.test(file)) {
    const type = file.endsWith('.html') ? 'text/html; charset=utf-8'
      : file.endsWith('.js') ? 'text/javascript; charset=utf-8'
      : 'text/css; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(file));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

/* ---------- WebSocket 升级 ---------- */
server.on('upgrade', (req, socket) => {
  try {
    upgradeHandler(req, socket);
  } catch (e) {
    console.error('upgrade 异常:', e.stack || e.message);
    try { socket.destroy(); } catch (e2) {}
  }
});

function upgradeHandler(req, socket) {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname !== '/ws') { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }

  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');

  const roomId = u.searchParams.get('room') || 'default';
  const role = ['pilot', 'copilot', 'passenger'].indexOf(u.searchParams.get('role')) !== -1 ? u.searchParams.get('role') : 'passenger';
  const scenarioParam = u.searchParams.get('scenario');
  const room = getRoom(roomId);

  // 占位：pilot/copilot 顶替旧连接
  if (role === 'pilot' || role === 'copilot') {
    const old = room[role];
    if (old && old.ws) { try { old.ws.close(); } catch (e) {} room.conns.delete(old); }
    room[role] = null;
    room.passengers.delete(old);
  }

  const conn = { role, room, ws: null };
  const mini = new MiniWS(socket,
    (text) => {
      try { handleAction(conn, JSON.parse(text)); } catch (e) { console.error('动作解析失败:', text, e.message); }
    },
    () => { /* close 在 socket close 时统一处理 */ }
  );
  conn.ws = mini;

  if (role === 'passenger') { room.passengers.add(conn); }
  else { room[role] = conn; }
  room.conns.set(conn, true);

  if (scenarioParam) applyRoomScenario(room, scenarioParam, conn);

  send(conn, Object.assign({
    type: 'init',
    role: role,
    room: roomId,
    peers: peersOf(room)
  }, scenarioPayload(room)));
  if (room.state) send(conn, { type: 'state', state: sanitize(room.state, role) });

  socket.on('data', (chunk) => mini.handleData(chunk));
  socket.on('error', () => {});
  socket.on('close', () => {
    room.conns.delete(conn);
    room.passengers.delete(conn);
    if (room.pilot === conn) room.pilot = null;
    if (room.copilot === conn) room.copilot = null;
    if (role === 'pilot' || role === 'copilot') {
      broadcast(room, { type: 'notice', msg: '⚠ ' + GameLogic.ROLES[role] + ' 已断开连接' });
    }
    broadcastPeers(room);
    if (!room.pilot && !room.copilot && room.passengers.size === 0) rooms.delete(roomId);
  });

  startIfReady(room);
  broadcastPeers(room);
}

server.listen(PORT, () => {
  if (process.env.QUIET) return;   // QUIET=1 完全静默（配合 nohup 重定向日志使用）
  console.log('==============================================');
  console.log('  🛫 天合小队 Sky Team 联机服务已启动');
  console.log('  大厅:  http://localhost:' + PORT + '/');
  console.log('  机长:  http://localhost:' + PORT + '/?room=sky&role=pilot');
  console.log('  副驾:  http://localhost:' + PORT + '/?room=sky&role=copilot');
  console.log('  乘客:  http://localhost:' + PORT + '/?room=sky&role=passenger');
  console.log('  模块实验室: http://localhost:' + PORT + '/test/module-lab.html');
  console.log('  着陆轮测试: http://localhost:' + PORT + '/test/landing-round-lab.html');
  console.log('==============================================');
});
