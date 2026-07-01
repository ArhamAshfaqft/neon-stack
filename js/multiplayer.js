(function () {
  "use strict";
  window.NS = window.NS || {};

  var peer = null, conn = null, roomCode = null, role = null, connected = false, remoteState = null;
  var callbacks = {};
  var oppCanvas, oppCtx;
  var BLOCK_H = 30;

  function init(opponentCanvas, cb) {
    oppCanvas = opponentCanvas;
    oppCtx = opponentCanvas.getContext("2d");
    callbacks = cb || {};
  }

  function genCode() {
    var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
    return "NEON-" + s;
  }

  function host() {
    if (peer) disconnect();
    roomCode = genCode();
    role = "host";
    var id = roomCode.toLowerCase();
    peer = new Peer(id, { host: "0.peerjs.com", port: 443, path: "/" });
    peer.on("open", function () { callbacks.onOpen && callbacks.onOpen(roomCode); });
    peer.on("connection", function (c) {
      conn = c;
      connected = true;
      conn.on("data", onMsg);
      conn.on("close", onClose);
      callbacks.onConnect && callbacks.onConnect();
    });
    peer.on("error", function (e) { console.error("PeerJS:", e); callbacks.onError && callbacks.onError(e); });
    return roomCode;
  }

  function join(code) {
    if (peer) disconnect();
    role = "joiner";
    roomCode = code;
    peer = new Peer({ host: "0.peerjs.com", port: 443, path: "/" });
    peer.on("open", function () {
      conn = peer.connect(code.toLowerCase());
      conn.on("open", function () {
        connected = true;
        conn.on("data", onMsg);
        conn.on("close", onClose);
        callbacks.onConnect && callbacks.onConnect();
      });
    });
    peer.on("error", function (e) { console.error("PeerJS:", e); callbacks.onError && callbacks.onError(e); });
  }

  function onMsg(data) {
    switch (data.t) {
      case "s":
        remoteState = data.d;
        drawOpponent(remoteState);
        callbacks.onRemoteState && callbacks.onRemoteState(remoteState);
        break;
      case "done":
        callbacks.onTurnEnd && callbacks.onTurnEnd(data.s, data.c);
        break;
      case "over":
        callbacks.onGameOver && callbacks.onGameOver(data.w, data.hs, data.js);
        break;
    }
  }

  function onClose() {
    connected = false;
    callbacks.onDisconnect && callbacks.onDisconnect();
  }

  function sendState(state) {
    if (!conn || !connected) return;
    conn.send({ t: "s", d: state });
  }

  function sendTurnEnd(score, maxCombo) {
    if (!conn || !connected) return;
    conn.send({ t: "done", s: score, c: maxCombo });
  }

  function sendGameOver(winner, hostScore, joinerScore) {
    if (!conn || !connected) return;
    conn.send({ t: "over", w: winner, hs: hostScore, js: joinerScore });
  }

  function disconnect() {
    if (conn) conn.close();
    if (peer) peer.destroy();
    peer = null; conn = null; connected = false; remoteState = null;
    roomCode = null; role = null;
  }

  function drawOpponent(s) {
    if (!oppCtx) return;
    var W = oppCanvas.width, H = oppCanvas.height;
    var sx = W / s.W, sy = H / s.H;
    oppCtx.fillStyle = "#07060f";
    oppCtx.fillRect(0, 0, W, H);
    oppCtx.shadowBlur = 0;
    for (var i = 0; i < s.blocks.length; i++) {
      var b = s.blocks[i];
      var x = b.x * sx, y = (s.groundY - (i + 1) * BLOCK_H - s.camY) * sy, bw = b.w * sx;
      oppCtx.fillStyle = "hsl(" + b.hue + ",80%,55%)";
      oppCtx.shadowColor = "hsla(" + b.hue + ",80%,55%,.5)";
      oppCtx.shadowBlur = 6 * sx;
      oppCtx.fillRect(x, y, bw, BLOCK_H * sy);
      oppCtx.shadowBlur = 0;
    }
    if (s.moving && s.alive) {
      var m = s.moving;
      var mx = m.x * sx, my = (s.groundY - s.blocks.length * BLOCK_H - s.camY) * sy, mw = m.w * sx;
      oppCtx.fillStyle = "hsl(" + m.hue + ",90%,70%)";
      oppCtx.shadowColor = "hsla(" + m.hue + ",90%,70%,.8)";
      oppCtx.shadowBlur = 10 * sx;
      oppCtx.fillRect(mx, my, mw, BLOCK_H * sy);
      oppCtx.shadowBlur = 0;
    }
    if (s.falling) {
      var f = s.falling;
      var fx = f.x * sx, fy = (f.y - s.camY) * sy, fw = f.w * sx;
      oppCtx.save();
      oppCtx.translate(fx + fw / 2, fy + BLOCK_H * sy / 2);
      oppCtx.rotate(f.rot || 0);
      oppCtx.fillStyle = "hsl(" + f.hue + ",80%,55%)";
      oppCtx.fillRect(-fw / 2, -BLOCK_H * sy / 2, fw, BLOCK_H * sy);
      oppCtx.restore();
    }
    oppCtx.fillStyle = "#e8e8ff";
    oppCtx.font = "bold " + Math.round(13 * sy) + "px Outfit, sans-serif";
    oppCtx.textAlign = "center";
    oppCtx.shadowBlur = 0;
    oppCtx.fillText("SCORE " + s.score, W / 2, 20 * sy);
  }

  NS.MP = {
    init: init,
    host: host,
    join: join,
    sendState: sendState,
    sendTurnEnd: sendTurnEnd,
    sendGameOver: sendGameOver,
    disconnect: disconnect,
    get connected() { return connected; },
    get role() { return role; },
    get roomCode() { return roomCode; },
    get remoteState() { return remoteState; }
  };
})();
