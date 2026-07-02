(function () {
  "use strict";
  window.NS = window.NS || {};

  var ws = null, roomCode = null, role = null, connected = false, remoteState = null;
  var callbacks = {};
  var reconnectTimer = null;

  var SERVER = "wss://neon-stack-server.onrender.com";
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    SERVER = "ws://localhost:3000";
  }

  function init(cb) {
    callbacks = cb || {};

    // Register CrazyGames room join listener (friend joins while already in game)
    if (typeof CrazyGames !== "undefined" && CrazyGames.SDK && CrazyGames.SDK.game && CrazyGames.SDK.game.addJoinRoomListener) {
      CrazyGames.SDK.game.addJoinRoomListener(function (params) {
        var code = params && params.room;
        if (code && !connected) {
          join(code);
        }
      });
    }
  }

  function cg() {
    if (typeof CrazyGames !== "undefined" && CrazyGames.SDK && CrazyGames.SDK.game) return CrazyGames.SDK.game;
    return null;
  }

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    try {
      ws = new WebSocket(SERVER);
    } catch (e) {
      callbacks.onError && callbacks.onError(e);
      return;
    }
    ws.onopen = function () {
      connected = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (role === "host") { ws.send(JSON.stringify({ type: "host" })); }
      else if (role === "joiner" && roomCode) {
        ws.send(JSON.stringify({ type: "join", room: roomCode }));
      }
    };
    ws.onmessage = function (e) {
      var msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      switch (msg.type) {
        case "hosted":
          roomCode = msg.room;
          // Tell CrazyGames our room is open for invites
          var g = cg();
          if (g && g.updateRoom) {
            g.updateRoom({ roomId: roomCode, isJoinable: true, inviteParams: { room: roomCode } });
          }
          callbacks.onOpen && callbacks.onOpen(roomCode);
          break;
        case "joined":
          roomCode = msg.room;
          callbacks.onConnect && callbacks.onConnect();
          break;
        case "opponent_joined":
          // Room is now full, no longer joinable
          var g = cg();
          if (g && g.updateRoom) g.updateRoom({ isJoinable: false });
          if (g && g.hideInviteButton) g.hideInviteButton();
          callbacks.onConnect && callbacks.onConnect();
          break;
        case "state":
          remoteState = msg.data;
          callbacks.onRemoteState && callbacks.onRemoteState(remoteState);
          break;
        case "turnEnd":
          callbacks.onTurnEnd && callbacks.onTurnEnd(msg.score, msg.combo);
          break;
        case "gameOver":
          callbacks.onGameOver && callbacks.onGameOver(msg.winner, msg.hs, msg.js);
          break;
        case "rematchReq":
          callbacks.onRematchRequest && callbacks.onRematchRequest();
          break;
        case "rematchAccept":
          callbacks.onRematchAccept && callbacks.onRematchAccept();
          break;
        case "rematchDecline":
          callbacks.onRematchDecline && callbacks.onRematchDecline();
          break;
        case "opponent_left":
          callbacks.onDisconnect && callbacks.onDisconnect();
          break;
        case "error":
          callbacks.onError && callbacks.onError(new Error(msg.msg));
          break;
      }
    };
    ws.onclose = function () {
      connected = false;
      if (role) {
        reconnectTimer = setTimeout(function () {
          if (role) connect();
        }, 2000);
      }
    };
    ws.onerror = function () {};
  }

  function host() {
    disconnect();
    role = "host";
    connect();
  }

  function join(code) {
    disconnect();
    role = "joiner";
    roomCode = code;
    connect();
  }

  function send(type, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(Object.assign({ type: type }, data)));
  }

  function sendState(state) { send("state", { data: state }); }
  function sendTurnEnd(score, combo) { send("turnEnd", { score: score, combo: combo }); }
  function sendGameOver(winner, hs, js) { send("gameOver", { winner: winner, hs: hs, js: js }); }
  function sendRematchRequest() { send("rematchReq", {}); }
  function sendRematchAccept() { send("rematchAccept", {}); }
  function sendRematchDecline() { send("rematchDecline", {}); }

  function disconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    connected = false; remoteState = null;
    // Tell CrazyGames we left the room
    var g = cg();
    if (g && g.leftRoom) g.leftRoom();
    if (g && g.hideInviteButton) g.hideInviteButton();
    roomCode = null; role = null;
  }

  function getCrazyGamesInviteLink() {
    if (!roomCode) return null;
    var g = cg();
    if (g && g.inviteLink) {
      try { return g.inviteLink({ room: roomCode }); } catch (e) {}
    }
    return null;
  }

  function showCrazyGamesInviteButton() {
    if (!roomCode) return false;
    var g = cg();
    if (g && g.showInviteButton) {
      try { g.showInviteButton({ room: roomCode }); return true; } catch (e) {}
    }
    return false;
  }

  function checkInstantMultiplayer() {
    var g = cg();
    if (g && g.isInstantMultiplayer) {
      var params = g.inviteParams || {};
      var code = params.room || g.getInviteParam && g.getInviteParam("room");
      if (code) {
        setTimeout(function () { join(code); }, 500);
        return true;
      }
    }
    return false;
  }

  NS.MP = {
    init: init, host: host, join: join,
    sendState: sendState, sendTurnEnd: sendTurnEnd,
    sendGameOver: sendGameOver, disconnect: disconnect,
    sendRematchRequest: sendRematchRequest,
    sendRematchAccept: sendRematchAccept,
    sendRematchDecline: sendRematchDecline,
    getCrazyGamesInviteLink: getCrazyGamesInviteLink,
    showCrazyGamesInviteButton: showCrazyGamesInviteButton,
    checkInstantMultiplayer: checkInstantMultiplayer,
    get connected() { return connected; },
    get role() { return role; },
    get roomCode() { return roomCode; },
    get remoteState() { return remoteState; },
    bufferedAmount: function () { return ws ? ws.bufferedAmount : 0; }
  };
})();
