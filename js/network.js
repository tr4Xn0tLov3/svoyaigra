// WebSocket transport for the hosted realtime server. The server relays packets
// between players and the host so clients don't depend on direct WebRTC/NAT paths.
import { REALTIME_WS_URL } from './config.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(len = 5) {
  let code = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) code += CODE_CHARS[arr[i] % CODE_CHARS.length];
  return code;
}

export function generateHostToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeMsgId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeSocketUrl(roomCode, role, playerId = '', hostToken = '') {
  const url = new URL(REALTIME_WS_URL, window.location.href);
  url.searchParams.set('room', roomCode);
  url.searchParams.set('role', role);
  if (playerId) url.searchParams.set('pid', playerId);
  if (hostToken) url.searchParams.set('token', hostToken);
  return url.toString();
}

export class HostNetwork {
  constructor({ roomCode, hostToken, onPlayerMessage, onStatusChange, onPeerConnectionChange }) {
    this.roomCode = (roomCode || generateRoomCode()).toUpperCase();
    this.hostToken = hostToken;
    this.onPlayerMessage = onPlayerMessage;
    this.onStatusChange = onStatusChange || (() => {});
    this.onPeerConnectionChange = onPeerConnectionChange || (() => {});
    this.socket = null;
    this.destroyed = false;
    this.reconnectTimer = null;
    this.reconnectDelay = 1000;
    this.heartbeatTimer = null;
    this.lastBroadcast = null;
    this.onlinePlayers = new Set();
  }

  start() {
    this._connect();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) this._send({ type: 'HEARTBEAT' });
    }, 20_000);
  }

  _connect() {
    if (this.destroyed) return;
    this.onStatusChange({ mode: 'connecting', text: 'Подключение к игровому серверу…' });
    let socket;
    try { socket = new WebSocket(makeSocketUrl(this.roomCode, 'host', '', this.hostToken)); }
    catch {
      this._scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.destroyed || this.socket !== socket) return;
      this.reconnectDelay = 1000;
      this.onStatusChange({ mode: 'online', text: 'Онлайн: сервер готов' });
      this._flushLatestViews();
    });
    socket.addEventListener('message', (event) => {
      let packet;
      try { packet = JSON.parse(event.data); } catch { return; }
      if (packet.type === 'HOST_READY') {
        // Keep existing player tabs synced if host/browser server reconnects.
        this._flushLatestViews();
        return;
      }
      if (packet.type === 'PLAYER_ONLINE' && packet.playerId) {
        this.onlinePlayers.add(packet.playerId);
        this.onPeerConnectionChange(packet.playerId, true);
        return;
      }
      if (packet.type === 'PLAYER_OFFLINE' && packet.playerId) {
        this.onlinePlayers.delete(packet.playerId);
        this.onPeerConnectionChange(packet.playerId, false);
        return;
      }
      if (packet.direction !== 'to_host') return;
      if (packet.playerId && !this.onlinePlayers.has(packet.playerId)) {
        this.onlinePlayers.add(packet.playerId);
        this.onPeerConnectionChange(packet.playerId, true);
      }
      this._handleIncoming(packet);
    });
    socket.addEventListener('close', () => {
      if (this.destroyed || this.socket !== socket) return;
      this.socket = null;
      this.onStatusChange({ mode: 'reconnecting', text: 'Переподключение к игровому серверу…' });
      this._scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      try { socket.close(); } catch { /* ignore */ }
    });
  }

  _scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(15_000, Math.round(this.reconnectDelay * 1.7));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, delay);
  }

  _handleIncoming(packet) {
    if (packet.type === 'PING') {
      this.sendToPlayer(packet.playerId, { type: 'PONG', ts: packet.ts });
      return;
    }
    this.onPlayerMessage(packet.playerId, packet.payload);
  }

  _send(packet) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try { this.socket.send(JSON.stringify(packet)); } catch { /* reconnect will recover */ }
    }
  }

  sendToPlayer(playerId, payload) {
    this._send({
      msgId: makeMsgId(),
      direction: 'to_player',
      targetId: playerId,
      payload
    });
  }

  broadcastCustom(builderFn, playerIds) {
    this.lastBroadcast = { builderFn, playerIds: [...playerIds] };
    this._flushLatestViews();
  }

  _flushLatestViews() {
    if (!this.lastBroadcast || this.socket?.readyState !== WebSocket.OPEN) return;
    const { builderFn, playerIds } = this.lastBroadcast;
    for (const pid of playerIds) this.sendToPlayer(pid, builderFn(pid));
    this.sendToPlayer('__spectator__', builderFn('__spectator__'));
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.onclose = null;
      try { this.socket.close(1000, 'Host left room'); } catch { /* ignore */ }
      this.socket = null;
    }
  }
}

export class PlayerNetwork {
  constructor({ roomCode, playerId, onHostMessage, onStatusChange }) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.playerId = playerId;
    this.onHostMessage = onHostMessage;
    this.onStatusChange = onStatusChange || (() => {});
    this.socket = null;
    this.connected = false;
    this.destroyed = false;
    this.reconnectTimer = null;
    this.reconnectDelay = 1000;
    this.pingTimer = null;
    this.helloPayload = null;
    this.isSpectator = false;
  }

  start() {
    this._connect();
    this.pingTimer = setInterval(() => {
      this._sendRaw({ type: 'PING', ts: Date.now() });
    }, 5000);
  }

  _connect() {
    if (this.destroyed) return;
    this.onStatusChange({ connected: false, text: 'Подключение к игровому серверу…' });
    let socket;
    try { socket = new WebSocket(makeSocketUrl(this.roomCode, 'player', this.playerId)); }
    catch {
      this._scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.destroyed || this.socket !== socket) return;
      this.reconnectDelay = 1000;
      if (this.helloPayload) this._sendHello();
    });
    socket.addEventListener('message', (event) => {
      let packet;
      try { packet = JSON.parse(event.data); } catch { return; }
      if (packet.type === 'HOST_READY') {
        if (this.helloPayload) this._sendHello();
        return;
      }
      if (packet.type === 'HOST_OFFLINE') {
        this.onStatusChange({ connected: false, text: 'Ведущий пока не подключён к серверу' });
        return;
      }
      if (packet.type === 'TRANSPORT_READY') return;
      if (packet.direction !== 'to_player') return;
      if (packet.targetId !== this.playerId && packet.targetId !== '__all__' && !(this.isSpectator && packet.targetId === '__spectator__')) return;
      if (packet.payload?.type === 'PONG') {
        this.connected = true;
        this.onStatusChange({ connected: true, text: 'Связь с ведущим есть' });
        return;
      }
      this.connected = true;
      this.onStatusChange({ connected: true, text: 'В комнате' });
      this.onHostMessage(packet.payload);
    });
    socket.addEventListener('close', () => {
      if (this.destroyed || this.socket !== socket) return;
      this.socket = null;
      this.connected = false;
      this.onStatusChange({ connected: false, text: 'Связь прервана, подключаюсь снова…' });
      this._scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      try { socket.close(); } catch { /* ignore */ }
    });
  }

  _scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(15_000, Math.round(this.reconnectDelay * 1.7));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, delay);
  }

  _sendRaw(inner) {
    const packet = {
      msgId: makeMsgId(),
      direction: 'to_host',
      playerId: this.playerId,
      ...inner
    };
    if (this.socket?.readyState === WebSocket.OPEN) {
      try { this.socket.send(JSON.stringify(packet)); } catch { /* reconnect will recover */ }
    }
  }

  _sendHello() {
    if (!this.helloPayload) return;
    this._sendRaw({ type: 'ACTION', payload: this.helloPayload });
  }

  sendHello(joinData) {
    this.helloPayload = { action: 'JOIN', ...joinData };
    this.isSpectator = Boolean(joinData.isSpectator);
    this._sendHello();
  }

  send(payload) {
    this._sendRaw({ type: 'ACTION', payload });
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.onclose = null;
      try { this.socket.close(1000, 'Player left room'); } catch { /* ignore */ }
      this.socket = null;
    }
  }
}
