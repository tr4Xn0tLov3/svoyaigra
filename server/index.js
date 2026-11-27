import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const HEARTBEAT_MS = 25_000;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const rooms = new Map();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'svoya-igra-realtime', rooms: rooms.size }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 1_000_000 });

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { host: null, players: new Map(), views: new Map(), updatedAt: Date.now() };
    rooms.set(code, room);
  }
  room.updatedAt = Date.now();
  return room;
}

function send(ws, packet) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(packet));
}

function closeWith(ws, code, reason) {
  try { ws.close(code, reason); } catch { /* already closed */ }
}

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const roomCode = (url.searchParams.get('room') || '').trim().toUpperCase();
  const role = url.searchParams.get('role');
  const playerId = url.searchParams.get('pid') || '';
  const hostToken = url.searchParams.get('token') || '';
  const currentRoom = rooms.get(roomCode);
  const badRequest = url.pathname !== '/ws' || !/^[A-Z0-9]{3,12}$/.test(roomCode) || !['host', 'player'].includes(role) || (role === 'player' && !playerId) || (role === 'host' && !/^[a-f0-9]{48}$/.test(hostToken));
  const forbiddenHost = role === 'host' && currentRoom?.hostToken && currentRoom.hostToken !== hostToken;
  if (badRequest || forbiddenHost) {
    const status = forbiddenHost ? '403 Forbidden' : '400 Bad Request';
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.roomCode = roomCode;
    ws.role = role;
    ws.playerId = playerId;
    ws.hostToken = hostToken;
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  const room = getRoom(ws.roomCode);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  if (ws.role === 'host') {
    if (room.hostToken && room.hostToken !== ws.hostToken) {
      closeWith(ws, 4003, 'Invalid host token');
      return;
    }
    room.hostToken = ws.hostToken;
    if (room.host && room.host !== ws) closeWith(room.host, 4001, 'Host reconnected');
    room.host = ws;
    send(ws, { type: 'ROOM_READY', roomCode: ws.roomCode });
    for (const client of room.players.values()) send(client, { type: 'HOST_READY' });
    // If the room already has saved individual views, immediately restore clients.
    for (const [targetId, packet] of room.views) {
      if (targetId === '__spectator__') {
        for (const client of room.players.values()) {
          if (client.isSpectator) send(client, packet);
        }
      } else {
        send(room.players.get(targetId), packet);
      }
    }
  } else {
    const previous = room.players.get(ws.playerId);
    if (previous && previous !== ws) closeWith(previous, 4001, 'Player reconnected');
    room.players.set(ws.playerId, ws);
    send(ws, { type: 'TRANSPORT_READY', roomCode: ws.roomCode });
    if (room.host) send(ws, { type: 'HOST_READY' });
    else send(ws, { type: 'HOST_OFFLINE' });
    send(room.host, { type: 'PLAYER_ONLINE', playerId: ws.playerId });
    const savedView = room.views.get(ws.playerId) || room.views.get('__spectator__');
    if (savedView) send(ws, savedView);
  }

  ws.on('message', (raw) => {
    room.updatedAt = Date.now();
    let packet;
    try { packet = JSON.parse(raw.toString()); } catch { return; }
    if (!packet || typeof packet !== 'object') return;

    if (ws.role === 'player') {
      if (packet.direction !== 'to_host') return;
      if (packet.playerId !== ws.playerId) return;
      const payload = packet.payload;
      if (payload?.action === 'JOIN') ws.isSpectator = Boolean(payload.isSpectator);
      send(room.host, packet);
      return;
    }

    if (packet.direction !== 'to_player') return;
    const targetId = packet.targetId;
    if (typeof targetId !== 'string') return;
    room.views.set(targetId, packet);
    if (targetId === '__spectator__') {
      for (const client of room.players.values()) {
        if (client.isSpectator) send(client, packet);
      }
    } else {
      send(room.players.get(targetId), packet);
    }
  });

  ws.on('close', () => {
    const current = rooms.get(ws.roomCode);
    if (!current) return;
    if (ws.role === 'host' && current.host === ws) {
      current.host = null;
      for (const client of current.players.values()) send(client, { type: 'HOST_OFFLINE' });
    }
    if (ws.role === 'player' && current.players.get(ws.playerId) === ws) {
      current.players.delete(ws.playerId);
      send(current.host, { type: 'PLAYER_OFFLINE', playerId: ws.playerId });
    }
    current.updatedAt = Date.now();
  });
  ws.on('error', () => {});
});

const heartbeat = setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      closeWith(ws, 4000, 'Heartbeat timeout');
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch { closeWith(ws, 4000, 'Heartbeat failed'); }
  }
  for (const [code, room] of rooms) {
    if (!room.host && room.players.size === 0 && now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
  }
}, HEARTBEAT_MS);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Realtime server listening on 0.0.0.0:${PORT}`);
});

function shutdown() {
  clearInterval(heartbeat);
  for (const ws of wss.clients) closeWith(ws, 1001, 'Server restarting');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
