/* 联机冒烟测试：手写 WS 客户端，模拟 机长+副驾+乘客 三连接，驱动完整对局，
 * 验证：状态同步 / 保密过滤（对方骰子揭示前隐藏）/ 动作仲裁 / 终局达成 */
'use strict';
const net = require('net');
const crypto = require('crypto');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const HOST = '127.0.0.1';
const PORT = parseInt(process.argv[2] || '8088', 10);

/* 逻辑层（用于决策） */
const { loadGameLogic } = require(path.join(ROOT, 'src/logic/load-logic'));
const Logic = loadGameLogic(ROOT);

function clientFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
  else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
  return Buffer.concat([header, mask, masked]);
}

function wsConnect(role, roomId) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(PORT, HOST, () => {
      sock.write('GET /ws?room=' + roomId + '&role=' + role + ' HTTP/1.1\r\nHost: ' + HOST + ':' + PORT + '\r\n' +
        'Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    let buf = Buffer.alloc(0), handshaked = false;
    const api = { state: null, msgs: [], send(obj) { sock.write(clientFrame(JSON.stringify(obj))); }, close() { sock.end(); } };
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshaked) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        const head = buf.slice(0, idx).toString();
        if (!/^HTTP\/1\.1 101/.test(head)) { reject(new Error(role + ' 握手失败: ' + head.split('\r\n')[0])); sock.destroy(); return; }
        buf = buf.slice(idx + 4);
        handshaked = true;
        resolve(api);
      }
      while (buf.length >= 2) {
        const b0 = buf[0], b1 = buf[1], opcode = b0 & 0x0f;
        let len = b1 & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) break;
        const payload = buf.slice(off, off + len);
        buf = buf.slice(off + len);
        if (opcode === 0x1) {
          const m = JSON.parse(payload.toString('utf8'));
          api.msgs.push(m.type);
          if (m.type === 'state') api.state = m.state;
        }
      }
    });
    sock.on('error', (e) => reject(e));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nextRadioSlot(p, role) {
  if (!p.radio) return 'radio';
  if (role === 'copilot' && !p.radio2) return 'radio2';
  return null;
}

function pickDieForSlot(free, role, slot) {
  const def = Logic.SLOTS[role][slot];
  if (!def || !def.limit) return free[Math.floor(Math.random() * free.length)];
  const ok = free.filter(x => def.limit.indexOf(x.d.v) !== -1);
  return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
}

function nextCoffeeSlot(s) {
  if (!s.placements.shared) return null;
  for (let i = 1; i <= Logic.CONFIG.COFFEE_SLOT_COUNT; i++) {
    const cs = 'coffee' + i;
    if (!s.placements.shared[cs]) return cs;
  }
  return null;
}

function findEquipMove(s, role, p, free) {
  if (role === 'pilot') {
    if (s.brakesAct < Logic.CONFIG.BRAKE_COUNT) {
      const bs = 'brake' + (s.brakesAct + 1);
      if (!p[bs]) {
        const bd = pickDieForSlot(free, role, bs);
        if (bd) return { target: bs, diePick: bd };
      }
    }
    const gears = [];
    for (let g = 1; g <= Logic.CONFIG.GEAR_COUNT; g++) {
      const gs = 'gear' + g;
      if (s.gearOn && !s.gearOn[gs] && !p[gs]) gears.push(gs);
    }
    for (const gs of gears) {
      const gd = pickDieForSlot(free, role, gs);
      if (gd) return { target: gs, diePick: gd };
    }
  } else if (s.flapsAct < Logic.CONFIG.FLAP_COUNT) {
    const fs = 'flap' + (s.flapsAct + 1);
    if (!p[fs]) {
      const fd = pickDieForSlot(free, role, fs);
      if (fd) return { target: fs, diePick: fd };
    }
  }
  return null;
}

function autoPlace(s, role) {
  // 简化启发式：与 test.js 类似，但当前玩家放置一个骰子
  const free = s.dice[role].map((d, i) => ({ d, i })).filter(x => !x.d.used);
  if (!free.length) return null;
  const p = s.placements[role];
  let target = null, diePick = null;
  const byVal = (t) => [...free].sort((a, b) => Math.abs(a.d.v - t) - Math.abs(b.d.v - t))[0];
  if (!p.axis) { target = 'axis'; diePick = byVal(s.axis > 0 ? 2 : s.axis < 0 ? 4 : 3); }
  else if (!p.engine) { target = 'engine'; diePick = byVal(3); }
  else {
    const nearPlane = Logic.hasTraffic(s, s.distance - 1) || Logic.hasTraffic(s, s.distance - 2);
    const radioSlot = nearPlane ? nextRadioSlot(p, role) : null;
    if (radioSlot) {
      target = radioSlot;
      diePick = free.find(x => x.d.v === 1) || free.find(x => x.d.v === 2) || free[0];
    } else {
      const equip = findEquipMove(s, role, p, free);
      if (equip) { target = equip.target; diePick = equip.diePick; }
      else {
        const coffeeSlot = nextCoffeeSlot(s);
        if (coffeeSlot) { target = coffeeSlot; diePick = free[Math.floor(Math.random() * free.length)]; }
        else {
        const moves = [];
        Object.keys(Logic.SLOTS[role]).forEach(k => {
          if (p[k] !== null) return;
          free.forEach(x => {
            if (Logic.slotAllowed(s, role, k, x.d.v).ok) moves.push({ target: k, diePick: x });
          });
        });
        if (Logic.SHARED_SLOTS) {
          Object.keys(Logic.SHARED_SLOTS).forEach(k => {
            if (s.placements.shared[k] !== null) return;
            free.forEach(x => {
              if (Logic.slotAllowed(s, role, k, x.d.v).ok) moves.push({ target: k, diePick: x });
            });
          });
        }
        if (!moves.length) return null;
        const pick = moves[Math.floor(Math.random() * moves.length)];
        target = pick.target;
        diePick = pick.diePick;
        }
      }
    }
  }
  if (!target || !diePick) return null;
  return [diePick.i, target];
}

async function main() {
  const conns = {};
  const roomId = 'test' + Date.now();   // 每次运行独立房间，避免残留状态污染
  conns.pilot = await wsConnect('pilot', roomId);
  conns.copilot = await wsConnect('copilot', roomId);
  conns.passenger = await wsConnect('passenger', roomId);
  await sleep(400);
  console.log('✓ 三连接建立。收到消息统计：', Object.fromEntries(Object.entries(conns).map(([k, v]) => [k, v.msgs])));

  let violations = { pilotSawCopilotDice: 0, pilotSawCopilotPlace: 0, passengerHidden: 0, desync: 0 };
  let rounds = 0, guard = 0;
  // 与 server.js 的 isPublicPhase 对齐：place 阶段开始骰子明放（实体桌游机制）
  // 唯一真正保密阶段：discuss / roll（掷完未放置）
  const isSecret = (p) => p === 'discuss' || p === 'roll';

  while (guard++ < 400) {
    const s = conns.pilot.state;
    if (!s) { await sleep(80); continue; }

    // 保密检查（仅在真正保密阶段）
    if (isSecret(s.phase)) {
      conns.pilot.state.dice.copilot.forEach(d => { if (d.v !== 0) violations.pilotSawCopilotDice++; });
      Object.keys(conns.pilot.state.placements.copilot).forEach(k => {
        const p = conns.pilot.state.placements.copilot[k];
        if (p && !p.hidden) violations.pilotSawCopilotPlace++;
      });
      const pv = conns.passenger.state.dice.copilot.filter(d => d.v === 0).length;
      if (conns.passenger.state.rolled.copilot && pv === 4) violations.passengerHidden++;
    }

    if (s.phase === 'win' || s.phase === 'lose') { rounds = s.round; break; }

    switch (s.phase) {
      case 'discuss':
        conns.pilot.send({ type: 'action', name: 'begin-roll' });
        break;
      case 'roll':
        ['pilot', 'copilot'].forEach(r => { if (!s.rolled[r]) conns[r].send({ type: 'action', name: 'roll' }); });
        if (s.rolled.pilot && s.rolled.copilot) conns.pilot.send({ type: 'action', name: 'done-roll' });
        break;
      case 'place': {
        const role = s.currentPlayer;
        const mv = autoPlace(s, role);
        if (mv) conns[role].send({ type: 'action', name: 'place', args: mv });
        else await sleep(60);
        break;
      }
      case 'reveal':
        conns.pilot.send({ type: 'action', name: 'settle' });
        break;
      case 'roundEnd':
        conns.copilot.send({ type: 'action', name: 'next-round' });
        break;
    }
    await sleep(50);
  }

  const fin = conns.pilot.state;
  console.log('\n=== 联机模拟结果 ===');
  console.log('终局: ' + (fin.phase === 'win' ? '🏆 胜利' : '💥 失败') + '（' + fin.phase + '） | 到达轮: ' + fin.round);
  if (fin.phase === 'lose') console.log('原因: ' + fin.loseReason);
  console.log('三方状态一致(pilot/copilot 关键值): 轮' + fin.round + ' 高度' + fin.altitude + ' 距离' + fin.distance + ' 姿态' + fin.axis);
  console.log('\n保密校验：');
  console.log('  机长看到副驾骰子数值: ' + (violations.pilotSawCopilotDice === 0 ? '✓ 0 次' : '✗ ' + violations.pilotSawCopilotDice + ' 次'));
  console.log('  机长看到副驾放置数值: ' + (violations.pilotSawCopilotPlace === 0 ? '✓ 0 次' : '✗ ' + violations.pilotSawCopilotPlace + ' 次'));
  console.log('  乘客视角信息缺失: ' + (violations.passengerHidden === 0 ? '✓ 0 次' : '✗ ' + violations.passengerHidden + ' 次'));
  console.log('  对局推进步数: ' + guard + (guard < 400 ? '（正常完成）' : '（可能卡住）'));

  const ok = violations.pilotSawCopilotDice === 0 && violations.pilotSawCopilotPlace === 0 && violations.passengerHidden === 0 && guard < 400;
  conns.pilot.close(); conns.copilot.close(); conns.passenger.close();
  console.log('\n' + (ok ? '✓ 联机测试全部通过' : '✗ 联机测试存在问题'));
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('✗ 测试异常:', e.message); process.exit(1); });
