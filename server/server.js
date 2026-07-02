const { WebSocketServer } = require("ws");
const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOM_TTL = 600000; // 10 min

const rooms = new Map();

function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s;
  do {
    s = "";
    for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
  } while (rooms.has(s));
  return "NEON-" + s;
}

function cleanup() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.created > ROOM_TTL || (!room.host && !room.joiner)) {
      rooms.delete(code);
    }
  }
}
setInterval(cleanup, 60000);

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Neon Stack MP Server");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let playerId = null;
  let roomCode = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    switch (msg.type) {
      case "host": {
        const code = genCode();
        roomCode = code;
        playerId = "host";
        rooms.set(code, { host: ws, joiner: null, created: Date.now() });
        ws.send(JSON.stringify({ type: "hosted", room: code }));
        break;
      }
      case "join": {
        const code = msg.room;
        const room = rooms.get(code);
        if (!room || !room.host) {
          ws.send(JSON.stringify({ type: "error", msg: "Room not found" }));
          return;
        }
        roomCode = code;
        playerId = "joiner";
        room.joiner = ws;
        room.host.send(JSON.stringify({ type: "opponent_joined" }));
        ws.send(JSON.stringify({ type: "joined", room: code }));
        break;
      }
      case "state": {
        if (!roomCode || !playerId) return;
        const room = rooms.get(roomCode);
        if (!room) return;
        const target = playerId === "host" ? room.joiner : room.host;
        if (target) target.send(JSON.stringify({ type: "state", data: msg.data }));
        break;
      }
      case "turnEnd": {
        if (!roomCode || !playerId) return;
        const room = rooms.get(roomCode);
        if (!room) return;
        const target = playerId === "host" ? room.joiner : room.host;
        if (target) target.send(JSON.stringify({ type: "turnEnd", score: msg.score, combo: msg.combo }));
        break;
      }
      case "gameOver": {
        if (!roomCode || !playerId) return;
        const room = rooms.get(roomCode);
        if (!room) return;
        const target = playerId === "host" ? room.joiner : room.host;
        if (target) target.send(JSON.stringify({ type: "gameOver", winner: msg.winner, hs: msg.hs, js: msg.js }));
        break;
      }
      case "rematchReq":
      case "rematchAccept":
      case "rematchDecline": {
        if (!roomCode || !playerId) return;
        const room = rooms.get(roomCode);
        if (!room) return;
        const target = playerId === "host" ? room.joiner : room.host;
        if (target) target.send(JSON.stringify({ type: msg.type }));
        break;
      }
    }
  });

  ws.on("close", () => {
    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room) {
        const other = playerId === "host" ? room.joiner : room.host;
        if (other) other.send(JSON.stringify({ type: "opponent_left" }));
        rooms.delete(roomCode);
      }
    }
  });
});

server.listen(PORT, () => console.log("Server on port " + PORT));
