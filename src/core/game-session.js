/* ============================================================
 * 联机会话 —— WebSocket 连接与消息分发
 * ============================================================ */
'use strict';

function createGameSession(ui, handlers) {
  handlers = handlers || {};

  function connectWS() {
    var proto = location.protocol === 'https:' ? 'wss' : 'ws';
    var ws = new WebSocket(
      proto + '://' + location.host + '/ws?room=' + encodeURIComponent(ui.room) +
      '&role=' + ui.viewer +
      '&scenario=' + encodeURIComponent(ui.scenarioId || 'yul')
    );
    ui.ws = ws;
    ws.onmessage = function (e) {
      try {
        var m = JSON.parse(e.data);
        if (handlers.onMessage) handlers.onMessage(m);
      } catch (err) { /* ignore */ }
    };
    ws.onopen = function () {
      ui.wsConnected = true;
      if (handlers.onOpen) handlers.onOpen();
    };
    ws.onclose = function () {
      ui.wsConnected = false;
      if (handlers.onClose) handlers.onClose();
      if (handlers.toast) handlers.toast('⚠ 连接断开，3 秒后重连…');
      setTimeout(function () {
        if (ui.viewer) connectWS();
      }, 3000);
    };
    ws.onerror = function () {};
  }

  function sendAction(name, args) {
    if (ui.ws && ui.ws.readyState === 1) {
      ui.ws.send(JSON.stringify({ type: 'action', name: name, args: args || [] }));
    } else if (handlers.toast) {
      handlers.toast('连接未就绪');
    }
  }

  function handleWSMessage(m, controller) {
    switch (m.type) {
      case 'init':
        ui.peers = m.peers || ui.peers;
        if (m.scenarioId) ui.scenarioId = m.scenarioId;
        if (m.scenario) ui.scenario = m.scenario;
        ui.screen = 'game';
        break;
      case 'scenario':
        if (m.scenarioId) ui.scenarioId = m.scenarioId;
        if (m.scenario) ui.scenario = m.scenario;
        break;
      case 'state':
        controller.setState(m.state);
        controller.clearSelected();
        ui.screen = 'game';
        break;
      case 'peers':
        ui.peers = m.peers;
        break;
      case 'notice':
        if (handlers.toast) handlers.toast(m.msg);
        break;
      case 'err':
        if (handlers.toast) handlers.toast('⚠ ' + m.msg);
        break;
    }
  }

  return {
    connectWS: connectWS,
    sendAction: sendAction,
    handleWSMessage: handleWSMessage
  };
}

if (typeof window !== 'undefined') window.createGameSession = createGameSession;
