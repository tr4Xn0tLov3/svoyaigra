import { DurableObject } from 'cloudflare:workers';

const ROOM_RE = /^[A-Z0-9]{3,12}$/;
const HOST_TOKEN_RE = /^[a-f0-9]{48}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'svoya-igra-realtime-cloudflare' });
    }
    if (url.pathname !== '/ws') return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const roomCode = (url.searchParams.get('room') || '').trim().toUpperCase();
    const role = url.searchParams.get('role') || '';
    const playerId = url.searchParams.get('pid') || '';
    const token = url.searchParams.get('token') || '';
    if (!ROOM_RE.test(roomCode) || !['host', 'player'].includes(role) || (role === 'player' && !playerId) || (role === 'host' && !HOST_TOKEN_RE.test(token))) {
      return new Response('Invalid room connection parameters', { status: 400 });
    }

    const id = env.ROOMS.idFromName(roomCode);
    return env.ROOMS.get(id).fetch(request);
  }
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Automatic ping/pong does not wake a hibernating room object.
    try {
      this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch { /* older compatibility runtimes still support normal WebSocket traffic */ }
  }

  _sessions() {
    return this.ctx.getWebSockets();
  }

  _attachment(ws) {
    try { return ws.deserializeAttachment() || {}; } catch { return {}; }
  }

  _send(ws, packet) {
    if (ws?.readyState !== WebSocket.OPEN) return;
    try { ws.send(JSON.stringify(packet)); } catch { /* the client will reconnect */ }
  }

  _allPlayers() {
    return this._sessions().filter((ws) => this._attachment(ws).role === 'player');
  }

  _host() {
    return this._sessions().find((ws) => this._attachment(ws).role === 'host') || null;
  }

  _player(playerId) {
    return this._sessions().find((ws) => {
      const a = this._attachment(ws);
      return a.role === 'player' && a.playerId === playerId;
    }) || null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const roomCode = (url.searchParams.get('room') || '').trim().toUpperCase();
    const role = url.searchParams.get('role') || '';
    const playerId = url.searchParams.get('pid') || '';
    const token = url.searchParams.get('token') || '';
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    if (role === 'host') {
      const savedToken = await this.ctx.storage.get('hostToken');
      if (savedToken && savedToken !== token) return new Response('Invalid host token', { status: 403 });
      if (!savedToken) await this.ctx.storage.put('hostToken', token);
      // A refreshed host tab replaces the previous host socket without ending the room.
      for (const ws of this._sessions()) {
        if (this._attachment(ws).role === 'host') {
          try { ws.close(4001, 'Host reconnected'); } catch { /* ignore */ }
        }
      }
    } else {
      for (const ws of this._sessions()) {
        const a = this._attachment(ws);
        if (a.role === 'player' && a.playerId === playerId) {
          try { ws.close(4001, 'Player reconnected'); } catch { /* ignore */ }
        }
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      roomCode,
      role,
      playerId: role === 'player' ? playerId : '',
      hostToken: role === 'host' ? token : '',
      isSpectator: false
    });

    if (role === 'host') {
      this._send(server, { type: 'ROOM_READY', roomCode });
      for (const player of this._allPlayers()) this._send(player, { type: 'HOST_READY' });
    } else {
      this._send(server, { type: 'TRANSPORT_READY', roomCode });
      const host = this._host();
      this._send(server, { type: host ? 'HOST_READY' : 'HOST_OFFLINE' });
      this._send(host, { type: 'PLAYER_ONLINE', playerId });
      const savedView = await this.ctx.storage.get(`view:${playerId}`);
      if (savedView) this._send(server, savedView);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, rawMessage) {
    let packet;
    try {
      const text = typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage);
      packet = JSON.parse(text);
    } catch { return; }
    if (!packet || typeof packet !== 'object') return;

    const session = this._attachment(ws);
    if (session.role === 'player') {
      if (packet.direction !== 'to_host' || packet.playerId !== session.playerId) return;
      if (packet.payload?.action === 'JOIN') {
        session.isSpectator = Boolean(packet.payload.isSpectator);
        ws.serializeAttachment(session);
      }
      const host = this._host();
      if (host) this._send(host, packet);
      else this._send(ws, { type: 'HOST_OFFLINE' });
      return;
    }

    if (session.role !== 'host' || packet.direction !== 'to_player' || typeof packet.targetId !== 'string') return;
    const targetId = packet.targetId;
    // Persist only the latest safe per-player view so a reconnect can recover after hibernation.
    await this.ctx.storage.put(`view:${targetId}`, packet);
    if (targetId === '__spectator__') {
      for (const client of this._allPlayers()) {
        if (this._attachment(client).isSpectator) this._send(client, packet);
      }
    } else {
      this._send(this._player(targetId), packet);
    }
  }

  async webSocketClose(ws) {
    const session = this._attachment(ws);
    if (session.role === 'host') {
      for (const player of this._allPlayers()) this._send(player, { type: 'HOST_OFFLINE' });
    } else if (session.role === 'player') {
      this._send(this._host(), { type: 'PLAYER_OFFLINE', playerId: session.playerId });
    }
  }

  async webSocketError(ws) {
    try { ws.close(1011, 'Socket error'); } catch { /* ignore */ }
  }
}
