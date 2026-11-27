// Сетевой уровень P2P для GitHub Pages:
// 1) PeerJS (WebRTC DataChannel) — игра с друзьями через интернет с разных телефонов и ПК без своего бэкенда
// 2) BroadcastChannel — мгновенный локальный мост для вкладок одного браузера и оффлайн-теста
// Дедупликация по msgId исключает дублирование пакетов при одновременной работе обоих каналов.

const PEER_PREFIX = 'svoya-igra-2026-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

export function generateRoomCode(len = 5) {
  let code = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) {
    code += CODE_CHARS[arr[i] % CODE_CHARS.length];
  }
  return code;
}

function makeMsgId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

class SeenBuffer {
  constructor(limit = 400) {
    this.limit = limit;
    this.set = new Set();
    this.queue = [];
  }
  checkAndAdd(id) {
    if (!id) return false;
    if (this.set.has(id)) return true;
    this.set.add(id);
    this.queue.push(id);
    if (this.queue.length > this.limit) {
      const oldest = this.queue.shift();
      this.set.delete(oldest);
    }
    return false;
  }
}

export class HostNetwork {
  constructor({ roomCode, onPlayerMessage, onStatusChange, onPeerConnectionChange }) {
    this.roomCode = (roomCode || generateRoomCode()).toUpperCase();
    this.onPlayerMessage = onPlayerMessage;
    this.onStatusChange = onStatusChange || (() => {});
    this.onPeerConnectionChange = onPeerConnectionChange || (() => {});

    this.peer = null;
    this.connections = new Map(); // playerId -> PeerJS DataConnection
    this.rawConns = new Set();
    this.bc = null;
    this.seen = new SeenBuffer();
    this.destroyed = false;
    this.p2pReady = false;
    this.heartbeatTimer = null;
    this.lastSeenByPlayer = new Map();
  }

  start() {
    this._setupBroadcastChannel();
    this._setupPeerJS();
    this.heartbeatTimer = setInterval(() => this._checkHeartbeats(), 4000);
  }

  _setupBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`si_room_${this.roomCode}`);
      this.bc.onmessage = (ev) => {
        const pkt = ev.data;
        if (!pkt || pkt.direction !== 'to_host') return;
        this._handleIncoming(pkt, null);
      };
    }
  }

  _setupPeerJS() {
    if (typeof window.Peer === 'undefined') {
      this.onStatusChange({ mode: 'local_only', text: 'Локальный режим (PeerJS недоступен)' });
      return;
    }

    this.onStatusChange({ mode: 'connecting', text: 'Подключение P2P-комнаты…' });

    try {
      this.peer = new window.Peer(PEER_PREFIX + this.roomCode, {
        debug: 0,
        config: { iceServers: ICE_SERVERS }
      });
    } catch (err) {
      this.onStatusChange({ mode: 'local_only', text: 'Локальный мост активен' });
      return;
    }

    this.peer.on('open', () => {
      if (this.destroyed) return;
      this.p2pReady = true;
      this.onStatusChange({ mode: 'online', text: 'Онлайн P2P готов' });
    });

    this.peer.on('connection', (conn) => {
      this.rawConns.add(conn);
      conn.on('data', (pkt) => {
        if (!pkt || pkt.direction !== 'to_host') return;
        if (pkt.playerId) {
          this.connections.set(pkt.playerId, conn);
          conn._playerId = pkt.playerId;
        }
        this._handleIncoming(pkt, conn);
      });

      const handleClose = () => {
        this.rawConns.delete(conn);
        if (conn._playerId && this.connections.get(conn._playerId) === conn) {
          this.connections.delete(conn._playerId);
        }
      };
      conn.on('close', handleClose);
      conn.on('error', handleClose);
    });

    this.peer.on('disconnected', () => {
      if (this.destroyed || !this.peer) return;
      this.p2pReady = false;
      this.onStatusChange({ mode: 'reconnecting', text: 'Переподключение к серверу комнат…' });
      setTimeout(() => {
        if (!this.destroyed && this.peer && this.peer.disconnected) {
          try { this.peer.reconnect(); } catch (_) {}
        }
      }, 1800);
    });

    this.peer.on('error', (err) => {
      if (this.destroyed) return;
      if (err && err.type === 'unavailable-id') {
        // Код случайно занят — генерируем новый
        this.roomCode = generateRoomCode();
        if (this.bc) {
          this.bc.close();
          this._setupBroadcastChannel();
        }
        try { this.peer.destroy(); } catch (_) {}
        this._setupPeerJS();
        this.onStatusChange({ mode: 'code_changed', roomCode: this.roomCode, text: 'Обновлён код комнаты' });
      } else {
        this.onStatusChange({ mode: 'degraded', text: 'Сеть: резервный канал' });
      }
    });
  }

  _handleIncoming(pkt, conn) {
    if (this.seen.checkAndAdd(pkt.msgId)) return;
    if (pkt.playerId) {
      const wasOnline = this.lastSeenByPlayer.has(pkt.playerId);
      this.lastSeenByPlayer.set(pkt.playerId, Date.now());
      if (!wasOnline) {
        this.onPeerConnectionChange(pkt.playerId, true);
      }
    }
    if (pkt.type === 'PING') {
      this.sendToPlayer(pkt.playerId, { type: 'PONG', ts: pkt.ts });
      return;
    }
    this.onPlayerMessage(pkt.playerId, pkt.payload, conn);
  }

  _checkHeartbeats() {
    const now = Date.now();
    for (const [playerId, lastTs] of this.lastSeenByPlayer.entries()) {
      if (now - lastTs > 14000) {
        this.lastSeenByPlayer.delete(playerId);
        this.onPeerConnectionChange(playerId, false);
      }
    }
  }

  sendToPlayer(playerId, payload) {
    const pkt = {
      msgId: makeMsgId(),
      direction: 'to_player',
      targetId: playerId,
      payload
    };
    const conn = this.connections.get(playerId);
    if (conn && conn.open) {
      try { conn.send(pkt); } catch (_) {}
    }
    if (this.bc) {
      try { this.bc.postMessage(pkt); } catch (_) {}
    }
  }

  broadcastCustom(builderFn, playerIds) {
    // builderFn(playerId) -> индивидуально подготовленный state без спойлеров!
    for (const pid of playerIds) {
      const payload = builderFn(pid);
      this.sendToPlayer(pid, payload);
    }
    // Плюс общий пакет для зрителей
    const spectatorPayload = builderFn('__spectator__');
    const specPkt = {
      msgId: makeMsgId(),
      direction: 'to_player',
      targetId: '__spectator__',
      payload: spectatorPayload
    };
    for (const conn of this.rawConns) {
      if (!conn._playerId && conn.open) {
        try { conn.send(specPkt); } catch (_) {}
      }
    }
    if (this.bc) {
      try { this.bc.postMessage(specPkt); } catch (_) {}
    }
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.heartbeatTimer);
    if (this.bc) {
      try { this.bc.close(); } catch (_) {}
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
    }
  }
}

export class PlayerNetwork {
  constructor({ roomCode, playerId, onHostMessage, onStatusChange }) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.playerId = playerId;
    this.onHostMessage = onHostMessage;
    this.onStatusChange = onStatusChange || (() => {});

    this.peer = null;
    this.conn = null;
    this.bc = null;
    this.seen = new SeenBuffer();
    this.connected = false;
    this.destroyed = false;
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.lastPongAt = 0;
  }

  start() {
    this._setupBroadcastChannel();
    this._setupPeerJS();

    this.pingTimer = setInterval(() => {
      this._sendRaw({ type: 'PING', ts: Date.now() });
      if (this.connected && Date.now() - this.lastPongAt > 15000) {
        this.connected = false;
        this.onStatusChange({ connected: false, text: 'Связь с ведущим потеряна, переподключение…' });
        this._schedulePeerReconnect();
      }
    }, 3500);

    this._onVisibility = () => {
      if (document.visibilityState === 'visible' && !this.destroyed) {
        this._sendRaw({ type: 'PING', ts: Date.now() });
        if (!this.conn || !this.conn.open) {
          this._schedulePeerReconnect(200);
        }
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  _setupBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`si_room_${this.roomCode}`);
      this.bc.onmessage = (ev) => {
        const pkt = ev.data;
        if (!pkt || pkt.direction !== 'to_player') return;
        if (pkt.targetId !== this.playerId && pkt.targetId !== '__all__' && !(this.isSpectator && pkt.targetId === '__spectator__')) {
          return;
        }
        this._handleIncoming(pkt);
      };
      // Пробуем сразу пингануть локальную вкладку ведущего
      setTimeout(() => this._sendRaw({ type: 'PING', ts: Date.now() }), 30);
    }
  }

  _setupPeerJS() {
    if (typeof window.Peer === 'undefined') return;

    this.onStatusChange({ connected: this.connected, text: 'Поиск комнаты…' });

    try {
      this.peer = new window.Peer({
        debug: 0,
        config: { iceServers: ICE_SERVERS }
      });
    } catch (_) {
      return;
    }

    this.peer.on('open', () => {
      if (this.destroyed) return;
      this._connectToHostPeer();
    });

    this.peer.on('disconnected', () => {
      if (this.destroyed) return;
      try { this.peer.reconnect(); } catch (_) {}
      this._schedulePeerReconnect(1500);
    });

    this.peer.on('error', () => {
      if (this.destroyed) return;
      this._schedulePeerReconnect(2500);
    });
  }

  _connectToHostPeer() {
    if (this.destroyed || !this.peer || !this.peer.open) return;
    if (this.conn) {
      try { this.conn.close(); } catch (_) {}
    }

    const conn = this.peer.connect(PEER_PREFIX + this.roomCode, { reliable: true });
    this.conn = conn;

    conn.on('open', () => {
      if (this.destroyed) return;
      this._markConnected();
      this._sendRaw({ type: 'PING', ts: Date.now() });
      if (this._helloPayload) {
        this.send(this._helloPayload);
      }
    });

    conn.on('data', (pkt) => {
      if (!pkt || pkt.direction !== 'to_player') return;
      if (pkt.targetId !== this.playerId && pkt.targetId !== '__all__' && !(this.isSpectator && pkt.targetId === '__spectator__')) {
        return;
      }
      this._handleIncoming(pkt);
    });

    conn.on('close', () => {
      if (!this.destroyed) this._schedulePeerReconnect(2000);
    });
    conn.on('error', () => {
      if (!this.destroyed) this._schedulePeerReconnect(2500);
    });
  }

  _schedulePeerReconnect(delay = 2000) {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed) return;
      if (!this.peer || this.peer.destroyed) {
        this._setupPeerJS();
      } else if (this.peer.disconnected) {
        try { this.peer.reconnect(); } catch (_) { this._setupPeerJS(); }
      } else {
        this._connectToHostPeer();
      }
    }, delay);
  }

  _markConnected() {
    this.lastPongAt = Date.now();
    if (!this.connected) {
      this.connected = true;
      this.onStatusChange({ connected: true, text: 'Подключено к комнате' });
    }
  }

  _handleIncoming(pkt) {
    if (this.seen.checkAndAdd(pkt.msgId)) return;
    this._markConnected();
    if (pkt.payload && pkt.payload.type === 'PONG') {
      return;
    }
    this.onHostMessage(pkt.payload);
  }

  _sendRaw(inner) {
    const pkt = {
      msgId: makeMsgId(),
      direction: 'to_host',
      playerId: this.playerId,
      ...inner
    };
    if (this.conn && this.conn.open) {
      try { this.conn.send(pkt); } catch (_) {}
    }
    if (this.bc) {
      try { this.bc.postMessage(pkt); } catch (_) {}
    }
  }

  sendHello(joinData) {
    this._helloPayload = { action: 'JOIN', ...joinData };
    this.isSpectator = Boolean(joinData.isSpectator);
    this.send(this._helloPayload);
  }

  send(payload) {
    this._sendRaw({ type: 'ACTION', payload });
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    document.removeEventListener('visibilitychange', this._onVisibility);
    if (this.bc) {
      try { this.bc.close(); } catch (_) {}
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
    }
  }
}
