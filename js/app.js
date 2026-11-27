// Главный контроллер интерфейса «Своя Игра Онлайн» (Ведущий + Игрок + Зритель)

import { sound } from './audio.js';
import { HostNetwork, PlayerNetwork, generateRoomCode, generateHostToken } from './network.js';
import { GameEngine, AVATARS, COLORS, MODIFIER_CATALOG } from './state.js';
import { PackBuilderModal } from './editor.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatScore(num) {
  const n = Number(num) || 0;
  return n.toLocaleString('ru-RU');
}

function getTabPlayerId() {
  let id = sessionStorage.getItem('si_tab_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    sessionStorage.setItem('si_tab_player_id', id);
  }
  return id;
}

class SvoyaIgraApp {
  constructor() {
    this.root = document.getElementById('app');
    this.role = null; // null | 'host' | 'player'
    this.playerId = getTabPlayerId();
    this.isSpectator = false;

    const savedAvatar = localStorage.getItem('si_player_avatar');
    this.profile = {
      name: localStorage.getItem('si_player_name') || '',
      avatar: AVATARS.includes(savedAvatar) ? savedAvatar : AVATARS[Math.floor(Math.random() * AVATARS.length)],
      color: localStorage.getItem('si_player_color') || COLORS[Math.floor(Math.random() * COLORS.length)]
    };

    this.repoPacks = [];
    this.selectedPackMeta = null;
    this.loadedPackCache = new Map();
    this.customUploadedPack = null;

    this.engine = null;
    this.hostNet = null;
    this.playerNet = null;
    this.netStatus = { connected: false, mode: 'idle', text: '' };

    this.view = null;
    this.timerSync = { kind: '', durationMs: 0, remainingMs: 0, running: false, syncedAt: 0 };
    this.scoreValues = new Map();
    this.lastPlayedSoundSeq = 0;
    this.lastBannerTs = 0;
    this.lastAnimatedQuestionKey = null;

    // Постоянный аудиоплеер для вопросов «Угадай звук» (не сбивается при ререндере DOM!)
    this.qAudio = new Audio();
    this.qAudioKey = null;
    this.qAudioPlaying = false;
    this.qAudioPausedByBuzz = false;
    this.qAudioClipStart = 0;
    this.qAudioClipSeconds = 0;
    this.qAudioVolume = 0.85;
    this.qAudio.volume = this.qAudioVolume;
    this.qAudio.addEventListener('play', () => this._updateAudioUiBadge(true));
    this.qAudio.addEventListener('pause', () => this._updateAudioUiBadge(false));
    this.qAudio.addEventListener('ended', () => this._updateAudioUiBadge(false));
    this.qAudio.addEventListener('timeupdate', () => this._updateAudioProgressUi());
    this.qAudio.addEventListener('loadedmetadata', () => {
      if (this.qAudioClipStart > 0 && Math.abs(this.qAudio.currentTime - this.qAudioClipStart) > 0.5) {
        this.qAudio.currentTime = this.qAudioClipStart;
      }
      this._updateAudioProgressUi();
    });

    // Зум картинки по клику
    this.zoomedImageUrl = null;

    // Локальное состояние пакостей у жертвы (оттирание грязи и увороты убегающей кнопки)
    this.curseQuestionKey = null;
    this.localWipesDone = 0;
    this.localBuzzerDodges = 0;
    this.localDodgeOffset = { x: 0, y: 0 };

    this.drafts = {
      joinCode: '',
      answerText: '',
      auctionBid: '',
      catChoiceCost: null,
      finalBet: '',
      finalAnswer: ''
    };

    this.hostModalOpen = false;
    this.packBuilder = new PackBuilderModal({
      onUsePack: (packObj) => this._applyCustomPackObject(packObj)
    });

    // Keep a same-device recovery copy so a host refresh can resume the room.
    window.addEventListener('pagehide', () => this._saveHostBackup());
    this._init();
  }

  async _init() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = (params.get('room') || '').trim().toUpperCase();
    if (roomParam) {
      this.drafts.joinCode = roomParam;
    }

    await this._loadRepoPacksIndex();

    // Refreshing the host tab restores its last engine snapshot and reconnects
    // with the same room code instead of silently starting a new game.
    if (!roomParam && sessionStorage.getItem('si_host_room_active') === '1') {
      try {
        const backup = JSON.parse(localStorage.getItem('si_host_room_backup') || 'null');
        if (backup?.roomCode && backup?.hostToken && backup?.pack && backup?.state && Date.now() - backup.savedAt < 12 * 60 * 60 * 1000) {
          await this._createHostRoom(backup);
          this._startSmoothTimerLoop();
          this._bindGlobalKeys();
          return;
        }
      } catch (err) {
        console.warn('Не удалось восстановить комнату ведущего:', err);
      }
      sessionStorage.removeItem('si_host_room_active');
    }

    const savedSession = sessionStorage.getItem('si_active_player_session');
    if (savedSession && !params.get('fresh')) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.roomCode && (!roomParam || roomParam === parsed.roomCode)) {
          this.profile.name = parsed.name || this.profile.name;
          this.profile.avatar = AVATARS.includes(parsed.avatar) ? parsed.avatar : this.profile.avatar;
          this.profile.color = parsed.color || this.profile.color;
          this.isSpectator = Boolean(parsed.isSpectator);
          this._joinRoomAsPlayer(parsed.roomCode);
          this._startSmoothTimerLoop();
          this._bindGlobalKeys();
          return;
        }
      } catch (_) {}
    }

    this.render();
    this._startSmoothTimerLoop();
    this._bindGlobalKeys();
  }

  async _loadRepoPacksIndex() {
    try {
      const res = await fetch('./packs/index.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      this.repoPacks = Array.isArray(data.packs) ? data.packs : [];
      if (this.repoPacks.length > 0) {
        this.selectedPackMeta = this.repoPacks[0];
      }
    } catch (err) {
      console.warn('Не удалось загрузить packs/index.json:', err);
      this.repoPacks = [];
    }
  }

  async _fetchPackJson(packMeta) {
    if (!packMeta?.file) return null;
    if (this.loadedPackCache.has(packMeta.file)) {
      return this.loadedPackCache.get(packMeta.file);
    }
    const res = await fetch(packMeta.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Не удалось загрузить файл пака: ${packMeta.file}`);
    const json = await res.json();
    this.loadedPackCache.set(packMeta.file, json);
    return json;
  }

  _preparePackForGame(rawPack) {
    const pack = JSON.parse(JSON.stringify(rawPack));
    const packId = pack.id || 'custom-pack';
    pack.rounds?.forEach((round, roundIndex) => {
      round.themes?.forEach((theme, themeIndex) => {
        const pool = theme.questionPool;
        if (!Array.isArray(pool) || pool.length <= (theme.questions?.length || 5)) return;
        const count = theme.questions?.length || 5;
        const storageKey = `bb_question_rotation:${packId}:${roundIndex}:${themeIndex}`;
        const legacyMusicStorageKey = `bb_music_rotation:${packId}:${roundIndex}:${themeIndex}`;
        const getId = (question) => String(question.rotationId || question.musicId || question.audio || question.text || '');
        let previousIds = [];
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem(legacyMusicStorageKey) || '{}');
          previousIds = Array.isArray(saved.ids) ? saved.ids : [];
        } catch (_) {}

        let candidates = pool.filter((question) => !previousIds.includes(getId(question)));
        const hadEnoughFreshQuestions = candidates.length >= count;
        if (!hadEnoughFreshQuestions) candidates = pool.slice();
        for (let i = candidates.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        let selectedQuestions = candidates.slice(0, count);
        if (!hadEnoughFreshQuestions && pool.length > count && previousIds.length) {
          const previousSet = [...previousIds].sort().join('|');
          const selectedSet = selectedQuestions.map(getId).sort().join('|');
          if (selectedSet === previousSet) {
            const replacement = pool.find((question) => !previousIds.includes(getId(question))
              && !selectedQuestions.some((selected) => getId(selected) === getId(question)));
            if (replacement) selectedQuestions[count - 1] = replacement;
          }
        }
        let visibleCosts = (theme.questions || []).map((question) => Number(question.cost) || 0);
        const hasAscendingStakes = visibleCosts.length >= count
          && visibleCosts.slice(0, count).every((cost, index, all) => cost > 0 && (index === 0 || cost > all[index - 1]));
        if (!hasAscendingStakes) {
          const roundBase = [100, 500, 1000][roundIndex] || 100;
          visibleCosts = Array.from({ length: count }, (_, index) => roundBase * (index + 1));
        }
        theme.questions = selectedQuestions.map((question, index) => ({
          ...question,
          // Keep the original board's ascending stakes even when different prompts are selected.
          cost: visibleCosts[index] ?? ((index + 1) * 100)
        }));
        try {
          localStorage.setItem(storageKey, JSON.stringify({ ids: theme.questions.map(getId), updatedAt: Date.now() }));
        } catch (_) {}
        delete theme.questionPool;
      });
    });
    return pack;
  }

  // --- Управление звуковым фрагментом вопроса («Угадай звук») ---

  _syncCurseProgress(v) {
    if (!v || v.phase !== 'question' || !v.questionView) {
      this.curseQuestionKey = null;
      this.localWipesDone = 0;
      this.localBuzzerDodges = 0;
      this.localDodgeOffset = { x: 0, y: 0 };
      return;
    }
    const key = `${v.questionView.themeName}::${v.questionView.nominalCost}`;
    if (this.curseQuestionKey !== key) {
      this.curseQuestionKey = key;
      this.localWipesDone = 0;
      this.localBuzzerDodges = 0;
      this.localDodgeOffset = { x: 0, y: 0 };
    }
  }

  _handlePlayerBuzzAttempt() {
    if (this.role !== 'player' || this.isSpectator || !this.view) return;
    sound.init();
    const curse = this.view.activeCurse;
    const sub = this.view.questionView?.runtime?.substate;

    // Если на игроке висит «🤡 Убегающая кнопка» — первые N раз она выскальзывает из-под пальца!
    if (curse?.kind === 'runaway_buzzer' && curse.targetId === this.playerId && sub === 'buzzing') {
      const required = curse.dodgesCount || 3;
      if (this.localBuzzerDodges < required) {
        this.localBuzzerDodges += 1;
        const dx = (Math.random() > 0.5 ? 1 : -1) * (55 + Math.floor(Math.random() * 75));
        const dy = (Math.random() > 0.5 ? 1 : -1) * (14 + Math.floor(Math.random() * 24));
        this.localDodgeOffset = { x: dx, y: dy };
        sound.playClownDodge();
        this.render();
        return;
      }
    }

    this.playerNet?.send({ action: 'BUZZ' });
  }

  _syncQuestionAudio(v) {
    const qv = v?.phase === 'question' ? v.questionView : null;
    const audioSrc = qv?.audio || '';
    if (!audioSrc) {
      if (this.qAudioKey) {
        this.qAudio.pause();
        this.qAudio.src = '';
        this.qAudioKey = null;
        this.qAudioPlaying = false;
      }
      this.qAudioClipStart = 0;
      this.qAudioClipSeconds = 0;
      return;
    }

    const questionKey = qv.questionKey || `${qv.themeName}::${qv.nominalCost}::${qv.text || ''}`;
    const audioKey = `${questionKey}::${audioSrc}`;
    const substate = qv.runtime?.substate;

    if (this.qAudioKey !== audioKey) {
      this.qAudioKey = audioKey;
      this.qAudioPausedByBuzz = false;
      this.qAudioClipStart = Math.max(0, Number(qv.audioStartSeconds) || 0);
      this.qAudioClipSeconds = Math.max(0, Number(qv.audioClipSeconds) || 0);
      this.qAudio.src = audioSrc;
      this.qAudio.currentTime = this.qAudioClipStart;
      this.qAudio.volume = this.qAudioVolume;
      if (substate === 'answering' || substate === 'special_answering') {
        this.qAudioPausedByBuzz = true;
      } else if (!sound.muted && substate !== 'revealed') {
        this.qAudio.play().catch(() => {});
      }
    } else if (substate === 'answering' || substate === 'special_answering') {
      // Музыкальный фрагмент ставится на паузу, пока игрок отвечает.
      if (!this.qAudio.paused) {
        this.qAudioPausedByBuzz = true;
        this.qAudio.pause();
      }
    } else if (substate === 'buzzing' && this.qAudioPausedByBuzz) {
      // После неверного ответа возвращаем музыку с того же места.
      this.qAudioPausedByBuzz = false;
      if (!sound.muted) this.qAudio.play().catch(() => {});
    } else if (substate === 'revealed') {
      this.qAudioPausedByBuzz = false;
      if (!this.qAudio.paused) this.qAudio.pause();
    }
  }

  _formatAudioTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const rem = String(s % 60).padStart(2, '0');
    return `${m}:${rem}`;
  }

  _audioElapsedForUi() {
    const current = this.qAudio.currentTime || 0;
    return this.qAudioClipSeconds
      ? Math.min(this.qAudioClipSeconds, Math.max(0, current - this.qAudioClipStart))
      : current;
  }

  _audioDurationForUi() {
    return this.qAudioClipSeconds || this.qAudio.duration || 30;
  }

  _updateAudioProgressUi() {
    const cur = this.qAudio.currentTime || 0;
    const end = this.qAudioClipStart + this.qAudioClipSeconds;
    if (this.qAudioClipSeconds > 0 && cur >= end) {
      this.qAudio.pause();
      return;
    }
    const elapsed = this._audioElapsedForUi();
    const duration = this._audioDurationForUi();
    const pct = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0;
    const fill = document.getElementById('q-audio-progress-fill');
    const timeEl = document.getElementById('q-audio-time-label');
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
    if (timeEl) timeEl.textContent = `${this._formatAudioTime(elapsed)} / ${this._formatAudioTime(duration)}`;
  }

  _replayQuestionAudio() {
    if (!this.qAudio.src) return;
    this.qAudio.currentTime = this.qAudioClipStart;
    this.qAudio.play().catch(() => {});
  }

  _toggleQuestionAudio() {
    if (!this.qAudio.src) return;
    if (this.qAudio.paused) {
      if (this.qAudioClipSeconds > 0 && this.qAudio.currentTime >= this.qAudioClipStart + this.qAudioClipSeconds) {
        this.qAudio.currentTime = this.qAudioClipStart;
      }
      this.qAudio.play().catch(() => {});
    } else {
      this.qAudio.pause();
    }
  }

  _updateAudioUiBadge(isPlaying) {
    this.qAudioPlaying = isPlaying;
    const eq = document.getElementById('q-audio-visualizer');
    const btn = document.getElementById('btn-toggle-q-audio');
    if (eq) eq.classList.toggle('playing', isPlaying);
    if (btn) btn.innerHTML = isPlaying ? '⏸️ Пауза' : '▶️ Включить звук';
  }

  // --- Создание комнаты (Ведущий) ---

  async _createHostRoom(restore = null) {
    sound.init();
    const roomCode = (restore?.roomCode || generateRoomCode(5)).toUpperCase();
    const hostToken = restore?.hostToken || generateHostToken();
    this.hostToken = hostToken;
    this.role = 'host';
    sessionStorage.setItem('si_host_room_active', '1');

    this.engine = new GameEngine({
      roomCode,
      onChange: () => {},
      onSound: (soundName) => this._playSoundByName(soundName)
    });

    if (restore?.pack && restore?.state) {
      this.engine.pack = restore.pack;
      this.engine.settings = { ...this.engine.settings, ...(restore.settings || {}) };
      this.engine.state = restore.state;
      this.engine.state.roomCode = roomCode;
      this.selectedPackMeta = this.repoPacks.find((p) => p.id === restore.pack.id) || this.selectedPackMeta;
      this.engine.onChange = () => this._onHostEngineChange();
    } else {
      this.engine.onChange = () => this._onHostEngineChange();
      try {
        if (this.customUploadedPack) {
          this.engine.setPack(this._preparePackForGame(this.customUploadedPack));
        } else if (this.selectedPackMeta) {
          const packJson = await this._fetchPackJson(this.selectedPackMeta);
          if (packJson) this.engine.setPack(this._preparePackForGame(packJson));
        }
      } catch (err) {
        this._toast('Ошибка загрузки пака: ' + err.message, 'red');
      }
    }

    this.hostNet = new HostNetwork({
      roomCode,
      hostToken,
      onPlayerMessage: (playerId, payload) => this._handlePlayerActionOnHost(playerId, payload),
      onPeerConnectionChange: (playerId, online) => {
        if (this.engine) this.engine.setPlayerOnline(playerId, online);
      },
      onStatusChange: (st) => {
        if (st.mode === 'code_changed' && st.roomCode && this.engine) {
          this.engine.roomCode = st.roomCode;
          this.engine.state.roomCode = st.roomCode;
        }
        this.netStatus = st;
        this._updateNetBadgeOnly();
      }
    });
    this.hostNet.start();

    this._onHostEngineChange();
  }

  _saveHostBackup() {
    if (this.role !== 'host' || !this.engine?.pack) return;
    try {
      localStorage.setItem('si_host_room_backup', JSON.stringify({
        roomCode: this.engine.roomCode,
        hostToken: this.hostNet?.hostToken || this.hostToken || null,
        pack: this.engine.pack,
        settings: this.engine.settings,
        state: this.engine.state,
        savedAt: Date.now()
      }));
    } catch (err) {
      console.warn('Не удалось сохранить резервное состояние комнаты:', err);
    }
  }

  _scheduleHostBackup() {
    if (this.hostBackupTimer || this.role !== 'host') return;
    this.hostBackupTimer = setTimeout(() => {
      this.hostBackupTimer = null;
      this._saveHostBackup();
    }, 1000);
  }

  _onHostEngineChange() {
    if (!this.engine) return;
    this._scheduleHostBackup();
    this.view = this.engine.buildViewFor('__host__');
    this._syncLocalTimerFromView();
    this._syncQuestionAudio(this.view);
    this._syncCurseProgress(this.view);

    if (this.view.phase !== 'question') {
      this.zoomedImageUrl = null;
    }

    if (this.hostNet) {
      const playerIds = this.engine.state.players.map((p) => p.id);
      this.hostNet.broadcastCustom((pid) => this.engine.buildViewFor(pid), playerIds);
    }

    if (this.view.eventBanner && this.view.eventBanner.ts !== this.lastBannerTs) {
      this.lastBannerTs = this.view.eventBanner.ts;
      this._toast(this.view.eventBanner.text, this.view.eventBanner.tone);
    }

    this.render();
  }

  _handlePlayerActionOnHost(playerId, msg) {
    if (!this.engine || !msg || !msg.action) return;

    switch (msg.action) {
      case 'JOIN':
        this.engine.handlePlayerJoin(playerId, {
          name: msg.name,
          avatar: msg.avatar,
          color: msg.color,
          isSpectator: msg.isSpectator
        });
        break;
      case 'SELECT_CELL':
        this.engine.selectCell(playerId, Number(msg.themeIndex), Number(msg.qIndex));
        break;
      case 'RESOLVE_NOTHING_PERSONAL':
        this.engine.resolveNothingPersonal(playerId, msg.targetId);
        break;
      case 'BUZZ':
        this.engine.handleBuzz(playerId);
        break;
      case 'USE_HINT':
        this.engine.useHint(playerId, msg.hintKind);
        break;
      case 'SUBMIT_ANSWER_TEXT':
        this.engine.submitPlayerAnswerText(playerId, msg.text);
        break;
      case 'ANSWER_DONE':
        this.engine.markPlayerAnswerDone(playerId);
        break;
      case 'ASSIGN_CAT':
        this.engine.assignCatTarget(playerId, msg.targetId, msg.cost);
        break;
      case 'AUCTION_ACTION':
        this.engine.handleAuctionAction(playerId, { type: msg.type, amount: msg.amount });
        break;
      case 'ELIMINATE_FINAL_THEME':
        this.engine.eliminateFinalTheme(playerId, Number(msg.themeIndex));
        break;
      case 'SUBMIT_FINAL_BET':
        this.engine.submitFinalBet(playerId, msg.amount);
        break;
      case 'FINAL_DRAFT':
        this.engine.updateFinalDraft(playerId, msg.text);
        break;
      default:
        break;
    }
  }

  // --- Вход в комнату (Игрок / Зритель) ---

  _joinRoomAsPlayer(rawCode) {
    const code = (rawCode || '').trim().toUpperCase();
    if (code.length < 3) {
      this._toast('Введите корректный код комнаты', 'red');
      return;
    }
    if (!this.isSpectator && !this.profile.name.trim()) {
      this._toast('Пожалуйста, укажите ваше имя', 'red');
      return;
    }

    sound.init();
    localStorage.setItem('si_player_name', this.profile.name.trim());
    localStorage.setItem('si_player_avatar', this.profile.avatar);
    localStorage.setItem('si_player_color', this.profile.color);

    sessionStorage.setItem('si_active_player_session', JSON.stringify({
      roomCode: code,
      name: this.profile.name.trim(),
      avatar: this.profile.avatar,
      color: this.profile.color,
      isSpectator: this.isSpectator
    }));

    this.role = 'player';
    this.netStatus = { connected: false, text: 'Подключение к ведущему…' };

    this.playerNet = new PlayerNetwork({
      roomCode: code,
      playerId: this.playerId,
      onHostMessage: (payload) => this._onPlayerReceiveSync(payload),
      onStatusChange: (st) => {
        this.netStatus = st;
        this._updateNetBadgeOnly();
      }
    });

    this.playerNet.start();
    this.playerNet.sendHello({
      name: this.profile.name.trim() || 'Зритель',
      avatar: this.profile.avatar,
      color: this.profile.color,
      isSpectator: this.isSpectator
    });

    this.render();
  }

  _onPlayerReceiveSync(payload) {
    if (!payload || payload.type !== 'STATE_SYNC') return;

    const prevPhase = this.view?.phase;
    const prevSubstate = this.view?.questionView?.runtime?.substate;
    this.view = payload;
    this._syncLocalTimerFromView();
    this._syncQuestionAudio(this.view);
    this._syncCurseProgress(this.view);

    if (payload.phase !== 'question') {
      this.zoomedImageUrl = null;
    }

    if (payload.lastSound && payload.lastSound.seq !== this.lastPlayedSoundSeq) {
      this.lastPlayedSoundSeq = payload.lastSound.seq;
      this._playSoundByName(payload.lastSound.name);
    }

    if (payload.eventBanner && payload.eventBanner.ts !== this.lastBannerTs) {
      this.lastBannerTs = payload.eventBanner.ts;
      this._toast(payload.eventBanner.text, payload.eventBanner.tone);
    }

    if (prevPhase !== payload.phase || (prevSubstate === 'revealed' && payload.questionView?.runtime?.substate !== 'revealed')) {
      if (payload.phase !== 'question') this.drafts.answerText = '';
      if (payload.phase !== 'final_question') this.drafts.finalAnswer = '';
    }

    this.render();
  }

  _leaveRoom() {
    const wasHost = this.role === 'host';
    sessionStorage.removeItem('si_active_player_session');
    if (wasHost) {
      sessionStorage.removeItem('si_host_room_active');
      localStorage.removeItem('si_host_room_backup');
    }
    clearTimeout(this.hostBackupTimer);
    this.hostBackupTimer = null;
    this.qAudio.pause();
    this.qAudio.src = '';
    this.qAudioKey = null;
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    if (this.hostNet) {
      this.hostNet.destroy();
      this.hostNet = null;
    }
    if (this.playerNet) {
      this.playerNet.destroy();
      this.playerNet = null;
    }
    this.role = null;
    this.hostToken = null;
    this.view = null;
    window.history.replaceState({}, '', window.location.pathname);
    this.render();
  }

  _applyCustomPackObject(packObj) {
    this.customUploadedPack = packObj;
    this.selectedPackMeta = null;
    if (this.engine && this.role === 'host') {
      try {
        this.engine.setPack(packObj);
        this._toast(`Загружен пакет «${packObj.title}»`, 'emerald');
      } catch (err) {
        this._toast('Ошибка формата пака: ' + err.message, 'red');
      }
    } else {
      this.render();
      this._toast(`Пакет «${packObj.title}» выбран! Создайте комнату.`, 'emerald');
    }
  }

  // --- Таймер 60fps и звуки ---

  _syncLocalTimerFromView() {
    if (!this.view?.timer) return;
    this.timerSync = {
      kind: this.view.timer.kind || '',
      durationMs: this.view.timer.durationMs || 0,
      remainingMs: this.view.timer.remainingMs || 0,
      running: Boolean(this.view.timer.running),
      syncedAt: performance.now()
    };
  }

  _startSmoothTimerLoop() {
    const step = () => {
      const bar = document.getElementById('live-timer-fill');
      const label = document.getElementById('live-timer-sec');
      const card = this.root.querySelector('.question-card.giant-question-window');
      const duration = this.timerSync.durationMs;
      let rem = this.timerSync.remainingMs;
      if (this.timerSync.running && duration > 0) {
        rem = Math.max(0, rem - (performance.now() - this.timerSync.syncedAt));
      }
      const ratio = duration > 0 ? Math.max(0, Math.min(1, rem / duration)) : 1;
      const timerActive = Boolean(card && this.view?.phase === 'question' && this.timerSync.running && duration > 0);

      if (bar && duration > 0) {
        const pct = ratio * 100;
        bar.style.width = `${pct}%`;
        bar.classList.toggle('urgent', rem <= 4500 && rem > 0);
        if (label) label.textContent = `${Math.ceil(rem / 1000)} сек`;
      }

      if (card) {
        card.classList.toggle('timer-active', timerActive);
        card.classList.toggle('timer-critical', timerActive && ratio <= 0.25);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  _playSoundByName(name) {
    const map = {
      cellOpen: () => sound.playCellOpen(),
      categoryShot: () => sound.playTargetShot(),
      buzzReady: () => sound.playBuzzReady(),
      buzz: () => sound.playBuzz(),
      falseStart: () => sound.playFalseStart(),
      correct: () => sound.playCorrect(),
      wrong: () => sound.playWrong(),
      cat: () => sound.playCat(),
      auction: () => sound.playAuction(),
      nothingPersonal: () => sound.playNothingPersonal(),
      zeroedOut: () => sound.playZeroedOut(),
      sabotage: () => sound.playSabotage(),
      steal: () => sound.playSteal(),
      strikeTheme: () => sound.playStrikeTheme(),
      hint: () => sound.playHint(),
      tick: () => sound.playTick(),
      timeUp: () => sound.playTimeUp(),
      roundStart: () => sound.playRoundStart(),
      victory: () => sound.playVictory()
    };
    if (map[name]) map[name]();
  }

  _bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.zoomedImageUrl) {
        this.zoomedImageUrl = null;
        this.render();
        return;
      }

      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!this.view) return;

      if (this.role === 'player' && !this.isSpectator) {
        if (e.code === 'Space') {
          const sub = this.view.questionView?.runtime?.substate;
          if (this.view.phase === 'question' && (sub === 'buzzing' || sub === 'reading' || sub === 'answering')) {
            e.preventDefault();
            this._handlePlayerBuzzAttempt();
          }
        }
      }

      if (this.role === 'host' && this.engine) {
        const sub = this.view.questionView?.runtime?.substate;
        if (e.code === 'Space') {
          if (this.view.phase === 'question' && sub === 'reading') {
            e.preventDefault();
            this.engine.unlockBuzzing();
          } else if (this.view.phase === 'question' && sub === 'revealed') {
            e.preventDefault();
            this.engine.returnToBoard();
          }
        } else if ((e.key === '1' || e.key.toLowerCase() === 'y') && (sub === 'answering' || sub === 'special_answering')) {
          e.preventDefault();
          this.engine.judgeCurrentAnswer(true);
        } else if ((e.key === '2' || e.key.toLowerCase() === 'n') && (sub === 'answering' || sub === 'special_answering')) {
          e.preventDefault();
          this.engine.judgeCurrentAnswer(false);
        } else if ((e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'р') && (this.view.phase === 'question' || this.view.phase === 'final_question')) {
          e.preventDefault();
          this.engine.revealPublicHint();
        } else if (e.key.toLowerCase() === 'p' && this.view.timer?.kind) {
          e.preventDefault();
          this.engine.togglePauseTimer();
        }
      }
    });
  }

  _toast(text, tone = 'gold') {
    let box = document.getElementById('toast-container');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-container';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `toast-item tone-${tone}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 350);
    }, 3800);
  }

  _getInviteUrl(roomCode) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', roomCode);
    return url.toString();
  }

  async _copyInviteLink() {
    if (!this.view?.roomCode) return;
    const link = this._getInviteUrl(this.view.roomCode);
    try {
      await navigator.clipboard.writeText(link);
      this._toast('🔗 Ссылка на комнату скопирована! Кидайте друзьям', 'emerald');
    } catch (_) {
      prompt('Скопируйте ссылку для друзей:', link);
    }
  }

  _openTestPlayerTab() {
    if (!this.view?.roomCode) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('room', this.view.roomCode);
    url.searchParams.set('fresh', String(Date.now()).slice(-4));
    window.open(url.toString(), '_blank');
  }

  _updateNetBadgeOnly() {
    const badge = document.getElementById('net-status-pill');
    if (!badge) return;
    if (this.role === 'host') {
      const online = this.netStatus.mode === 'online';
      badge.className = `net-pill ${online ? 'ok' : 'warn'}`;
      badge.textContent = online ? '● Онлайн · сервер' : `● ${this.netStatus.text || 'Подключаем сервер…'}`;
    } else if (this.role === 'player') {
      badge.className = `net-pill ${this.netStatus.connected ? 'ok' : 'warn'}`;
      badge.textContent = this.netStatus.connected ? '● В комнате' : `● ${this.netStatus.text || 'Подключение…'}`;
    }
  }

  // =========================================================================
  // РЕНДЕРИНГ ИНТЕРФЕЙСА
  // =========================================================================

  render() {
    const activeEl = document.activeElement;
    const activeDataKey = activeEl?.dataset?.keepFocus || null;
    const selStart = activeDataKey && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
    const selEnd = activeDataKey && typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null;

    if (!this.role) {
      this.root.innerHTML = this._renderHomeScreen();
      this._bindHomeEvents();
    } else {
      this.root.innerHTML = this._renderRoomShell();
      this._bindRoomEvents();
    }

    this._animateScoreValues();

    if (activeDataKey) {
      const restored = this.root.querySelector(`[data-keep-focus="${activeDataKey}"]`);
      if (restored) {
        restored.focus();
        if (selStart !== null && typeof restored.setSelectionRange === 'function') {
          try { restored.setSelectionRange(selStart, selEnd); } catch (_) {}
        }
      }
    }
  }

  _animateScoreValues() {
    const nodes = this.root.querySelectorAll('[data-score-player]');
    nodes.forEach((node) => {
      const playerId = node.dataset.scorePlayer;
      const target = Number(node.dataset.scoreValue) || 0;
      const previous = this.scoreValues.get(playerId);
      this.scoreValues.set(playerId, target);
      if (previous === undefined || previous === target) return;

      const direction = target > previous ? 'score-up' : 'score-down';
      node.classList.remove('score-up', 'score-down');
      void node.offsetWidth;
      node.classList.add(direction);

      const startedAt = performance.now();
      const duration = 560;
      const animate = (now) => {
        if (!node.isConnected) return;
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(previous + (target - previous) * eased);
        node.textContent = formatScore(value);
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          node.textContent = formatScore(target);
          setTimeout(() => node.classList.remove('score-up', 'score-down'), 260);
        }
      };
      requestAnimationFrame(animate);
    });
  }

  // --- 1. Главный экран ---

  _renderHomeScreen() {
    const hasInviteCode = Boolean(this.drafts.joinCode);

    return `
      <div class="home-page">
        <header class="home-topbar">
          <div class="brand-logo">
            <span class="logo-diamond">◆</span>
            <div>
              <h1>Broken Brain <span class="brand-brain" role="img" aria-label="мозг">🧠</span></h1>
              <p class="subtitle">Викторина на скорость, память и сообразительность</p>
            </div>
          </div>
          <div class="topbar-actions">
            <button class="btn btn-ghost btn-sm" id="btn-open-builder">🛠️ Конструктор паков (.json)</button>
            <button class="btn-icon" id="btn-mute-home" title="Звук">${sound.muted ? '🔇' : '🔊'}</button>
          </div>
        </header>

        <main class="home-grid ${hasInviteCode ? 'invite-focus' : ''}">
          <section class="glass-panel join-panel ${hasInviteCode ? 'highlighted-invite' : ''}">
            <div class="panel-tag">${hasInviteCode ? '🎉 Вас позвали в игру!' : '📱 Для друзей (с телефона или ПК)'}</div>
            <h2>Войти в комнату</h2>
            <p class="panel-desc">Введите код комнаты от ведущего (или откройте его ссылку) и жмите кнопку ответа со своего экрана.</p>

            <div class="form-stack">
              <label>
                <span>Код комнаты</span>
                <input type="text" maxlength="8" class="code-input" data-keep-focus="joinCode" id="inp-join-code"
                  placeholder="K7M4P" value="${escapeHtml(this.drafts.joinCode)}">
              </label>

              <label>
                <span>Ваш никнейм</span>
                <input type="text" maxlength="20" data-keep-focus="playerName" id="inp-player-name"
                  placeholder="Как вас подписать?" value="${escapeHtml(this.profile.name)}">
              </label>

              <div>
                <span class="field-label">Выберите аватарку</span>
                <div class="avatar-picker">
                  ${AVATARS.map((av) => `
                    <button type="button" class="avatar-btn ${this.profile.avatar === av ? 'selected' : ''}" data-pick-avatar="${av}">${av}</button>
                  `).join('')}
                </div>
              </div>

              <label class="checkbox-row">
                <input type="checkbox" id="chk-spectator" ${this.isSpectator ? 'checked' : ''}>
                <span>Зайти просто посмотреть (зритель)</span>
              </label>

              <button class="btn btn-primary btn-lg full-w" id="btn-join-room">
                🚀 Влететь в комнату
              </button>
            </div>
          </section>

          <section class="glass-panel host-setup-panel">
            <div class="panel-tag">🎙️ Для ведущего</div>
            <h2>Создать комнату</h2>
            <p class="panel-desc">Выберите пакет вопросов из папки <code>packs/</code>, создайте комнату и киньте ссылку друзьям в Discord / Telegram.</p>

            <div class="packs-section-head">
              <span class="field-label">Пакеты вопросов (${this.repoPacks.length})</span>
              <button class="btn-link" id="btn-upload-custom-json">📂 Загрузить свой .json</button>
            </div>

            ${this.customUploadedPack ? `
              <div class="custom-pack-active-card">
                <div>
                  <strong>📦 ${escapeHtml(this.customUploadedPack.title)}</strong>
                  <div class="muted-sm">Автор: ${escapeHtml(this.customUploadedPack.author || 'Свой файл')} · Раундов: ${this.customUploadedPack.rounds?.length || 0}</div>
                </div>
                <button class="btn-tiny" id="btn-clear-custom-pack">Сбросить</button>
              </div>
            ` : ''}

            <div class="pack-cards-list">
              ${this.repoPacks.map((pk) => {
                const isSel = !this.customUploadedPack && this.selectedPackMeta?.id === pk.id;
                return `
                  <div class="pack-card ${isSel ? 'selected' : ''}" data-select-pack="${escapeHtml(pk.id)}">
                    <div class="pack-card-top">
                      <strong>${escapeHtml(pk.title)}</strong>
                      <span class="pack-badge">${escapeHtml(pk.duration || '30 мин')}</span>
                    </div>
                    <p class="pack-desc">${escapeHtml(pk.description || '')}</p>
                    <div class="pack-meta-row">
                      <span>📊 ${escapeHtml(pk.difficulty || 'Лёгкая')}</span>
                      <span>❓ Вопросов: ${pk.questionsCount || '—'}</span>
                    </div>
                    ${Array.isArray(pk.tags) ? `
                      <div class="pack-tags">
                        ${pk.tags.map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>

            <button class="btn btn-gold btn-lg full-w" id="btn-create-room">
              ✨ Создать комнату и получить ссылку
            </button>
          </section>
        </main>

        <footer class="home-footer">
          <div class="rules-pills">
            <span>🕶️ Модификатор «Ничего личного» (обнуление очков!)</span>
            <span>🖼️ Мемы и «Откуда этот кадр?»</span>
            <span>🔊 «Угадай звук»</span>
            <span>🐈 Кот в мешке & 🔨 Аукцион</span>
            <span>⏱️ Комфортный таймер 30 сек</span>
          </div>
        </footer>
      </div>
    `;
  }

  _bindHomeEvents() {
    document.getElementById('btn-mute-home')?.addEventListener('click', () => {
      const muted = sound.toggleMute();
      if (muted) this.qAudio.pause();
      this.render();
    });

    document.getElementById('btn-open-builder')?.addEventListener('click', () => {
      this.packBuilder.open();
    });

    const codeInp = document.getElementById('inp-join-code');
    codeInp?.addEventListener('input', () => {
      this.drafts.joinCode = codeInp.value.toUpperCase();
    });

    const nameInp = document.getElementById('inp-player-name');
    nameInp?.addEventListener('input', () => {
      this.profile.name = nameInp.value;
    });

    document.querySelectorAll('[data-pick-avatar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.profile.avatar = btn.dataset.pickAvatar;
        this.render();
      });
    });

    document.getElementById('chk-spectator')?.addEventListener('change', (e) => {
      this.isSpectator = e.target.checked;
    });

    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      this._joinRoomAsPlayer(this.drafts.joinCode);
    });

    codeInp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._joinRoomAsPlayer(this.drafts.joinCode);
    });
    nameInp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._joinRoomAsPlayer(this.drafts.joinCode);
    });

    document.querySelectorAll('[data-select-pack]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.selectPack;
        this.selectedPackMeta = this.repoPacks.find((p) => p.id === id) || null;
        this.customUploadedPack = null;
        this.render();
      });
    });

    document.getElementById('btn-clear-custom-pack')?.addEventListener('click', () => {
      this.customUploadedPack = null;
      this.selectedPackMeta = this.repoPacks[0] || null;
      this.render();
    });

    document.getElementById('btn-upload-custom-json')?.addEventListener('click', () => {
      this._promptUploadJsonFile();
    });

    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      this._createHostRoom();
    });
  }

  _promptUploadJsonFile() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      try {
        const txt = await f.text();
        const json = JSON.parse(txt);
        if (!Array.isArray(json.rounds)) {
          throw new Error('В JSON отсутствует массив rounds.');
        }
        this._applyCustomPackObject(json);
      } catch (err) {
        this._toast('Ошибка JSON: ' + err.message, 'red');
      }
    };
    inp.click();
  }

  // --- 2. Игровая студия: ИГРОКИ СВЕРХУ -> ТАЙМЕР -> БОЛЬШОЕ ОКНО ВОПРОСА СНИЗУ! ---

  _renderRoomShell() {
    const v = this.view;
    if (!v) {
      return `
        <div class="connecting-screen">
          <div class="spinner-ring"></div>
          <h2>Подключение к комнате <code>${escapeHtml(this.playerNet?.roomCode || '')}</code>…</h2>
          <p class="muted-sm">${escapeHtml(this.netStatus.text || 'Ищем ведущего…')}<br>Проверьте, что ведущий открыл комнату с кодом ${escapeHtml(this.playerNet?.roomCode || '')}.</p>
          <button class="btn btn-ghost" id="btn-cancel-connect">← На главную</button>
        </div>
      `;
    }

    const isHost = this.role === 'host';
    const roundTitle = this._getStageTitle(v);
    const buzzGlowing = v.phase === 'question' && v.questionView?.runtime?.substate === 'buzzing';

    return `
      <div class="studio-shell ${buzzGlowing ? 'buzz-open-frame' : ''}">
        <!-- Верхняя шапка комнаты -->
        <header class="studio-topbar">
          <div class="topbar-left">
            <span class="role-chip ${isHost ? 'host' : 'player'}">
              ${isHost ? '🎙️ Ведущий' : this.isSpectator ? '👁️ Зритель' : '🕹️ Игрок'}
            </span>
            <button class="room-code-btn" id="btn-copy-invite" title="Скопировать ссылку для друзей">
              Код: <strong>${escapeHtml(v.roomCode)}</strong> 📋
            </button>
            <span id="net-status-pill" class="net-pill ok">
              ${isHost ? (this.netStatus.mode === 'online' ? '● Онлайн · сервер' : `● ${escapeHtml(this.netStatus.text || 'Подключаем сервер…')}`) : (this.netStatus.connected ? '● В комнате' : '● Связь…')}
            </span>
          </div>

          <div class="topbar-center">
            <span class="stage-round-badge">${escapeHtml(roundTitle)}</span>
          </div>

          <div class="topbar-right">
            ${isHost ? `<button class="btn btn-sm btn-secondary" id="btn-host-tools">⚙️ Пульт</button>` : ''}
            <button class="btn-icon" id="btn-mute-room" title="Вкл/выкл звук">${sound.muted ? '🔇' : '🔊'}</button>
            <button class="btn-icon danger-hover" id="btn-leave-room" title="Выйти из комнаты">🚪</button>
          </div>
        </header>

        <!-- ИГРОКИ И ИХ БАЛЛЫ ПРЯМО НАД ОКНОМ ВОПРОСА И НАД ТАБЛО! -->
        <section class="players-top-dock" aria-label="Счёт игроков">
          ${this._renderPlayerPodiums(v)}
        </section>

        <!-- Полоса таймера между игроками и большим окном вопроса -->
        <div class="timer-strip ${v.timer?.kind ? 'visible' : ''}">
          <div class="timer-track">
            <div id="live-timer-fill" class="timer-fill"></div>
          </div>
          ${v.timer?.kind ? `<span id="live-timer-sec" class="timer-sec-label">${Math.ceil((v.timer.remainingMs || 0) / 1000)} сек</span>` : ''}
        </div>

        <!-- Огромная центральная сцена с окном вопроса / табло -->
        <main class="studio-stage">
          ${!isHost && v.timer?.kind && !v.timer.running ? `
            <div class="player-paused-overlay" role="status" aria-live="polite">
              <span>⏸ На паузе</span>
            </div>
          ` : ''}
          ${this._renderMainStage(v)}
        </main>

        ${isHost && this.hostModalOpen ? this._renderHostToolsModal(v) : ''}

        ${this.zoomedImageUrl ? `
          <div class="lightbox-backdrop" id="lightbox-close">
            <img src="${escapeHtml(this.zoomedImageUrl)}" alt="Увеличенный кадр" class="lightbox-img">
            <span class="lightbox-hint">Нажмите в любое место, чтобы закрыть</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  _getStageTitle(v) {
    if (v.phase === 'lobby') return `Лобби · ${v.packMeta?.title || 'Ожидание'}`;
    if (v.phase === 'category_select') return `Выбор категорий · ${v.categorySelection?.roundName || 'Раунд'}`;
    if (v.phase === 'board' || v.phase === 'question' || v.phase === 'cat_select' || v.phase === 'auction' || v.phase === 'nothing_personal') {
      return v.board?.name || 'Раунд';
    }
    if (v.phase.startsWith('final_')) return 'ФИНАЛЬНЫЙ РАУНД';
    if (v.phase === 'podium') return 'ИТОГИ ИГРЫ';
    return 'Своя Игра';
  }

  _renderMainStage(v) {
    switch (v.phase) {
      case 'lobby':
        return this._renderLobbyStage(v);
      case 'category_select':
        return this._renderCategorySelectionStage(v);
      case 'board':
        return this._renderBoardStage(v);
      case 'nothing_personal':
        return this._renderNothingPersonalStage(v);
      case 'cat_select':
        return this._renderCatSelectStage(v);
      case 'auction':
        return this._renderAuctionStage(v);
      case 'question':
        return this._renderQuestionStage(v);
      case 'final_no_players':
        return this._renderFinalNoPlayersStage(v);
      case 'final_themes':
        return this._renderFinalThemesStage(v);
      case 'final_bets':
        return this._renderFinalBetsStage(v);
      case 'final_question':
        return this._renderFinalQuestionStage(v);
      case 'final_reveal':
        return this._renderFinalRevealStage(v);
      case 'podium':
        return this._renderPodiumStage(v);
      default:
        return '';
    }
  }

  // --- Сцена: Лобби ---

  _renderLobbyStage(v) {
    const isHost = this.role === 'host';
    const inviteUrl = this._getInviteUrl(v.roomCode);

    return `
      <div class="lobby-stage-card">
        <div class="lobby-columns">
          <div class="lobby-invite-col">
            <div class="section-eyebrow">ПОЗВАТЬ ДРУЗЕЙ</div>
            <div class="big-room-code">${escapeHtml(v.roomCode)}</div>
            <p class="muted-sm">Киньте эту ссылку в общий чат Discord / Telegram — друзья зайдут с телефонов или ПК:</p>
            <div class="invite-url-box">
              <input type="text" readonly value="${escapeHtml(inviteUrl)}" id="readonly-invite-url">
              <button class="btn btn-gold" id="btn-lobby-copy">Скопировать</button>
            </div>

            ${isHost ? `
              <div class="lobby-quick-actions">
                <button class="btn btn-secondary btn-sm" id="btn-test-tab">🧪 Открыть вкладку тестового игрока</button>
                <button class="btn btn-ghost btn-sm" id="btn-lobby-builder">🛠️ Конструктор паков</button>
              </div>
            ` : `
              <div class="player-waiting-banner">
                ✅ Вы в игре! Ваша тумба уже горит сверху — ждём старта от ведущего…
              </div>
            `}
          </div>

          <div class="lobby-settings-col">
            <div class="section-eyebrow">ПАКЕТ И ПРАВИЛА ВЕЧЕРА</div>
            <div class="selected-pack-banner">
              <div>
                <strong>📦 ${escapeHtml(v.packMeta?.title || 'Не выбран')}</strong>
                <div class="muted-sm">Раундов: ${v.packMeta?.roundsCount || 0}${v.packMeta?.hasFinal ? ' + Финал' : ''} · ${escapeHtml(v.packMeta?.difficulty || '')}</div>
              </div>
              ${isHost ? `
                <select id="sel-lobby-pack" class="compact-select">
                  ${this.customUploadedPack ? `<option value="__custom__" selected>Свой файл: ${escapeHtml(this.customUploadedPack.title)}</option>` : ''}
                  ${this.repoPacks.map((pk) => `
                    <option value="${escapeHtml(pk.id)}" ${!this.customUploadedPack && v.packMeta?.id === pk.id ? 'selected' : ''}>
                      ${escapeHtml(pk.title)}
                    </option>
                  `).join('')}
                </select>
              ` : ''}
            </div>

            ${isHost ? `
              <div class="settings-grid">
                <label>
                  <span>😈 Пакостные модификаторы</span>
                  <select id="set-np-mode">
                    <option value="party" ${(v.settings.nothingPersonalMode === 'party' || v.settings.nothingPersonalMode === 'auto') ? 'selected' : ''}>🎉 Вечеринка! (все 7 пакостей — по 5 в раунд)</option>
                    <option value="chaos" ${v.settings.nothingPersonalMode === 'chaos' ? 'selected' : ''}>🔥 Полный ХАОС! (по 9 пакостей в раунд)</option>
                    <option value="pack_only" ${v.settings.nothingPersonalMode === 'pack_only' ? 'selected' : ''}>📦 Только те, что прописаны в JSON</option>
                    <option value="0" ${v.settings.nothingPersonalMode === '0' ? 'selected' : ''}>🚫 Выключить пакости (классика)</option>
                  </select>
                </label>

                <label>
                  <span>📈 Цены вопросов (камбэк)</span>
                  <select id="set-price-scale">
                    <option value="comeback" ${v.settings.priceScaleMode !== 'pack' ? 'selected' : ''}>Ур.1 от 100 → Ур.2 от 500 → Ур.3 от 1000</option>
                    <option value="pack" ${v.settings.priceScaleMode === 'pack' ? 'selected' : ''}>Оставить цены из JSON-файла</option>
                  </select>
                </label>

                <label>
                  <span>💡 Подсказки в игре</span>
                  <select id="set-hints-mode">
                    <option value="standard" ${(v.settings.hintsMode || 'standard') === 'standard' ? 'selected' : ''}>💡 Стандарт (по 3 игроку + подсказка ведущего)</option>
                    <option value="generous" ${v.settings.hintsMode === 'generous' ? 'selected' : ''}>🎁 Щедрый вечер (по 6 игроку + ведущий)</option>
                    <option value="host_only" ${v.settings.hintsMode === 'host_only' ? 'selected' : ''}>🎙️ Только общая подсказка от ведущего</option>
                    <option value="off" ${v.settings.hintsMode === 'off' ? 'selected' : ''}>🚫 Выключить подсказки</option>
                  </select>
                </label>

                <label>
                  <span>Режим кнопки ответа</span>
                  <select id="set-buzz-mode">
                    <option value="immediate" ${v.settings.buzzMode === 'immediate' ? 'selected' : ''}>Сразу при открытии вопроса</option>
                    <option value="auto_delay" ${v.settings.buzzMode === 'auto_delay' ? 'selected' : ''}>Через 3–5 сек чтения (+ фальстарт)</option>
                    <option value="host_manual" ${v.settings.buzzMode === 'host_manual' ? 'selected' : ''}>По команде ведущего (+ фальстарт)</option>
                  </select>
                </label>

                <label>
                  <span>Штраф за неправильный ответ</span>
                  <select id="set-penalty">
                    <option value="full" ${v.settings.wrongPenalty === 'full' ? 'selected' : ''}>Классика (−100% цены вопроса)</option>
                    <option value="half" ${v.settings.wrongPenalty === 'half' ? 'selected' : ''}>Щадящий (−50% цены вопроса)</option>
                    <option value="none" ${v.settings.wrongPenalty === 'none' ? 'selected' : ''}>Без минусов (очки не отнимаются!)</option>
                  </select>
                </label>

                <label>
                  <span>Время подумать и нажать (сек)</span>
                  <input type="number" min="5" max="120" id="set-buzz-sec" value="${v.settings.buzzTimeSec}">
                </label>

                <label>
                  <span>Время дать ответ (сек)</span>
                  <input type="number" min="5" max="120" id="set-ans-sec" value="${v.settings.answerTimeSec}">
                </label>
              </div>

              <div class="modifiers-showcase-strip">
                <span title="Обнулить счёт соперника в 0">🕶️ Ничего личного</span>
                <span title="Отключить кнопку сопернику">🤐 Кляп</span>
                <span title="Перевернуть вопрос на 180°">🙃 Вверх дном</span>
                <span title="Заляпать экран — нужно тереть 8 раз">🧽 Грязь</span>
                <span title="Кнопка упрыгивает 3 раза">🤡 Убегающая кнопка</span>
                <span title="Украсть 25% баллов соперника">🧛 Грабёж</span>
                <span title="+2× за ответ, −2× за ошибку">💣 Чёрная метка</span>
              </div>

              <button class="btn btn-gold btn-lg full-w start-game-cta" id="btn-start-game">
                🎬 Начать игру (${v.players.length} игр.)
              </button>
            ` : `
              <div class="readonly-rules-summary">
                <div>😈 Модификаторы-пакости: <b>${v.settings.nothingPersonalMode === '0' ? 'Выключены' : v.settings.nothingPersonalMode === 'chaos' ? '🔥 ПОЛНЫЙ ХАОС!' : 'Включены все 7 пакостей!'}</b></div>
                <div>💡 Подсказки: <b>${v.settings.hintsMode === 'off' ? 'Выключены' : v.settings.hintsMode === 'host_only' ? 'Только от ведущего' : v.settings.hintsMode === 'generous' ? 'По 6 подсказок каждому!' : 'По 3 подсказки каждому (💡 Наводка, 🔤 Буквы, 🛡️ Страховка)'}</b></div>
                <div>📈 Шкала камбэка: <b>${v.settings.priceScaleMode !== 'pack' ? '100 → 500 → 1000+' : 'По паку'}</b></div>
                <div>⏱️ Подумать: <b>${v.settings.buzzTimeSec} сек</b> · На ответ: <b>${v.settings.answerTimeSec} сек</b></div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // --- Сцена: Игровое табло ---

  _renderCategorySelectionStage(v) {
    const selection = v.categorySelection;
    if (!selection) return '';
    const isHost = this.role === 'host';
    const count = selection.selectedThemeIndexes.length;
    const required = selection.requiredCount;
    const canUndo = isHost && count > 0;
    const canConfirm = isHost && count === required;

    return `
      <section class="category-select-screen">
        <header class="category-select-header">
          <div>
            <div class="panel-tag">🎯 ПОДГОТОВКА ${escapeHtml(selection.roundName)}</div>
            <h2>Выстрели по пяти категориям</h2>
            <p>${isHost
              ? 'Нажми на мишень — попадание добавит категорию на табло.'
              : 'Ведущий выбирает категории для этого раунда. Смотри на попадания!'}
            </p>
          </div>
          <div class="category-hit-counter"><strong>${count}</strong><span>из ${required}</span></div>
        </header>

        <div class="category-wheel-shell">
          <div class="category-wheel-dial" aria-hidden="true"></div>
          <div class="category-wheel-hub">
            <span class="hub-crosshair">⌖</span>
            <strong>${count}/${required}</strong>
            <small>попаданий</small>
          </div>
          <div class="category-targets">
            ${selection.themes.map((theme, index) => {
              const angle = (-90 + (360 * index) / Math.max(1, selection.themes.length)) * Math.PI / 180;
              const left = 50 + Math.cos(angle) * 37;
              const top = 50 + Math.sin(angle) * 37;
              const hit = theme.selected;
              const lastShot = selection.lastShotThemeIndex === theme.themeIndex;
              const canShoot = isHost && !hit && count < required;
              return `
                <button type="button" class="category-target ${hit ? 'target-hit' : ''} ${lastShot ? 'target-last-shot' : ''}"
                  style="--target-left:${left.toFixed(2)}%;--target-top:${top.toFixed(2)}%"
                  data-shoot-theme="${theme.themeIndex}" ${canShoot ? '' : 'disabled'}
                  aria-label="${hit ? 'Попадание: ' : 'Выбрать категорию: '}${escapeHtml(theme.name)}">
                  <span class="target-art" aria-hidden="true">
                    <span class="target-rings">◎</span>
                    ${hit ? '<span class="target-bullet-hole">●</span>' : '<span class="target-crosshair">＋</span>'}
                    ${lastShot ? '<span class="target-impact">✦</span>' : ''}
                  </span>
                  <span class="target-label">${escapeHtml(theme.name)}</span>
                  <span class="target-state">${hit ? 'ПОПАДАНИЕ' : 'МИШЕНЬ'}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <footer class="category-select-actions">
          <div class="category-select-note">${count < required ? `Осталось выбрать: ${required - count}` : 'Пять категорий готовы к игре!'}</div>
          ${isHost ? `
            <div class="category-action-buttons">
              <button type="button" class="btn btn-secondary" id="btn-undo-category-shot" ${canUndo ? '' : 'disabled'}>↶ Отменить выстрел</button>
              <button type="button" class="btn btn-gold btn-lg" id="btn-confirm-categories" ${canConfirm ? '' : 'disabled'}>Начать раунд →</button>
            </div>
          ` : '<div class="muted-sm">Ожидаем ведущего…</div>'}
        </footer>
      </section>
    `;
  }

  _renderBoardStage(v) {
    const b = v.board;
    if (!b) return '';
    const isHost = this.role === 'host';
    const isMyChooseTurn = this.role === 'player' && !this.isSpectator && v.chooserId === this.playerId;
    const canClickCells = isHost || isMyChooseTurn;
    const chooser = v.players.find((p) => p.id === v.chooserId);

    const maxCols = Math.max(1, ...b.themes.map((t) => t.cells.length));

    return `
      <div class="board-wrapper">
        <div class="board-Prompt-bar">
          ${chooser
            ? (isMyChooseTurn
                ? `<span class="turn-highlight mine">👑 ВАШ ВЫБОР! Нажмите на любую ячейку с очками</span>`
                : `<span>Выбирает вопрос: <strong class="gold-text">👑 ${escapeHtml(chooser.avatar)} ${escapeHtml(chooser.name)}</strong></span>`)
            : `<span>Ведущий выбирает вопрос на табло</span>`
          }
          ${isHost ? `<button class="btn btn-tiny-outline" id="btn-skip-round">Следующий этап →</button>` : ''}
        </div>

        <div class="si-board-grid" style="--cols: ${maxCols}">
          ${b.themes.map((theme, tIdx) => `
            <div class="si-theme-cell">${escapeHtml(theme.name)}</div>
            ${theme.cells.map((cell, qIdx) => {
              if (cell.played) {
                return `<div class="si-price-cell played" aria-disabled="true"></div>`;
              }
              let secretIcons = '';
              if (isHost) {
                if (cell.hostHintModifier && MODIFIER_CATALOG[cell.hostHintModifier]) {
                  secretIcons += MODIFIER_CATALOG[cell.hostHintModifier].icon;
                }
                if (cell.hostHintType === 'cat') secretIcons += '🐈';
                else if (cell.hostHintType === 'auction') secretIcons += '🔨';
                else if (cell.hostHintType === 'noRisk') secretIcons += '🛡️';
              }
              return `
                <button type="button"
                  class="si-price-cell ${canClickCells ? 'clickable' : 'readonly'}"
                  ${canClickCells ? `data-cell="${theme.themeIndex ?? tIdx}:${qIdx}"` : 'disabled'}>
                  <span class="price-digits">${cell.cost}</span>
                  ${secretIcons ? `<span class="host-cell-secret" title="Секрет ячейки (видно только ведущему)">${secretIcons}</span>` : ''}
                </button>
              `;
            }).join('')}
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- Сцена: Розыгрыш пакостного модификатора (все 7 видов!) ---

  _renderNothingPersonalStage(v) {
    const ms = v.modifierState;
    if (!ms) return '';
    const meta = MODIFIER_CATALOG[ms.kind] || MODIFIER_CATALOG.nothing_personal;
    const isHost = this.role === 'host';
    const actor = v.players.find((p) => p.id === ms.actorId);
    const isMyChoice = this.role === 'player' && !this.isSpectator && ms.actorId === this.playerId;
    const canDecide = isHost || isMyChoice;

    const targetList = meta.allowSelf
      ? v.players
      : (v.players.length >= 2 ? v.players.filter((p) => p.id !== ms.actorId) : v.players);

    const renderTargetPreview = (p) => {
      if (meta.id === 'nothing_personal') {
        return `Было: <b>${formatScore(p.score)}</b> → Станет: <b class="zero-tag">0</b>`;
      }
      if (meta.id === 'score_steal') {
        const minSteal = Math.max(100, Math.round((v.questionView?.nominalCost || 200) * 0.4 / 50) * 50);
        const amt = p.score > 0 ? Math.min(p.score, Math.max(minSteal, Math.round((p.score * 0.25) / 50) * 50)) : minSteal;
        return `Откусим: <b class="zero-tag">−${formatScore(amt)}</b> к вам!`;
      }
      if (meta.id === 'mute_player') {
        return `Счёт: <b>${formatScore(p.score)}</b> · 🤐 Без кнопки`;
      }
      if (meta.id === 'upside_down') {
        return `Счёт: <b>${formatScore(p.score)}</b> · 🙃 Экран 180°`;
      }
      if (meta.id === 'mud_screen') {
        return `Счёт: <b>${formatScore(p.score)}</b> · 🧽 8 протирок`;
      }
      if (meta.id === 'runaway_buzzer') {
        return `Счёт: <b>${formatScore(p.score)}</b> · 🤡 3 уворота`;
      }
      if (meta.id === 'cursed_mark') {
        const isSelf = p.id === ms.actorId;
        return isSelf ? `🎲 НА СЕБЯ: <b>+2× куш / −2× штраф</b>` : `На соперника: <b>+2× / −2×</b>`;
      }
      return `Счёт: <b>${formatScore(p.score)}</b>`;
    };

    return `
      <div class="special-event-card np-theme tone-${escapeHtml(meta.tone || 'crimson')}">
        <div class="np-badge">${escapeHtml(meta.badge)}</div>
        <h2>${escapeHtml(meta.title)}</h2>
        <p class="special-sub">
          ${actor
            ? `Игрок <strong class="gold-text">${escapeHtml(actor.avatar)} ${escapeHtml(actor.name)}</strong> вытянул пакость перед вопросом <b>«${escapeHtml(v.questionView?.themeName || '')}» (${formatScore(v.questionView?.nominalCost || 0)})</b>!<br>${escapeHtml(meta.desc)}`
            : escapeHtml(meta.desc)}
        </p>

        ${canDecide ? `
          <div class="target-players-grid">
            ${targetList.map((p) => `
              <button type="button" class="target-player-btn np-victim-btn" data-np-target="${escapeHtml(p.id)}">
                <span class="tp-avatar">${escapeHtml(p.avatar)}</span>
                <span class="tp-name">${escapeHtml(p.name)}${p.id === ms.actorId ? ' (Вы!)' : ''}</span>
                <span class="np-score-preview">${renderTargetPreview(p)}</span>
                <span class="np-kill-cta">${escapeHtml(meta.cta)}</span>
              </button>
            `).join('')}
          </div>

          <div class="mt-md">
            <button type="button" class="btn btn-secondary btn-lg" data-np-target="__spare__">
              😇 Пощадить всех и сразу открыть вопрос
            </button>
          </div>
        ` : `
          <div class="waiting-note np-pulse">
            😨 Затаили дыхание! Сейчас <strong>${escapeHtml(actor?.name || 'выбирающий')}</strong> выбирает жертву для пакости «${escapeHtml(meta.badge)}»…
          </div>
        `}
      </div>
    `;
  }

  // --- Сцена: Кот в мешке ---

  _renderCatSelectStage(v) {
    const cs = v.catState;
    if (!cs) return '';
    const isHost = this.role === 'host';
    const isGiver = this.role === 'player' && cs.giverId === this.playerId;
    const canPick = isHost || isGiver;
    const giver = v.players.find((p) => p.id === cs.giverId);

    const eligibleTargets = v.players.length >= 2
      ? v.players.filter((p) => p.id !== cs.giverId)
      : v.players;

    const activeCost = this.drafts.catChoiceCost || cs.chosenCost;

    return `
      <div class="special-event-card cat-theme">
        <div class="special-badge">🐈 КОТ В МЕШКЕ!</div>
        <h2>Нельзя отвечать самому — отдайте вопрос другу!</h2>
        <p class="special-sub">
          Секретная тема: <strong class="gold-text">«${escapeHtml(cs.secretTheme)}»</strong>
          ${!cs.costOptions ? ` · Цена вопроса: <strong>${cs.chosenCost}</strong>` : ''}
        </p>

        ${cs.costOptions && canPick ? `
          <div class="cost-choice-row">
            <span>Выберите стоимость Кота:</span>
            ${cs.costOptions.map((c) => `
              <button class="btn btn-sm ${activeCost === c ? 'btn-gold' : 'btn-secondary'}" data-cat-cost="${c}">${c}</button>
            `).join('')}
          </div>
        ` : ''}

        ${canPick ? `
          <div class="target-players-grid">
            ${eligibleTargets.length > 0 ? eligibleTargets.map((p) => `
              <button class="target-player-btn" data-cat-target="${escapeHtml(p.id)}">
                <span class="tp-avatar">${escapeHtml(p.avatar)}</span>
                <span class="tp-name">${escapeHtml(p.name)}</span>
                <span class="tp-score">${formatScore(p.score)}</span>
              </button>
            `).join('') : `
              <button class="btn btn-gold btn-lg" data-cat-target="__demo__">Открыть вопрос Кота</button>
            `}
          </div>
        ` : `
          <div class="waiting-note">
            Ждём, кому <strong>${escapeHtml(giver?.name || 'игрок')}</strong> подкинет Кота в мешке…
          </div>
        `}
      </div>
    `;
  }

  // --- Сцена: Вопрос-аукцион ---

  _renderAuctionStage(v) {
    const auc = v.auctionState;
    if (!auc) return '';
    const isHost = this.role === 'host';
    const turnPlayer = v.players.find((p) => p.id === auc.turnPlayerId);
    const highBidder = v.players.find((p) => p.id === auc.highBidderId);
    const isMyTurn = this.role === 'player' && !this.isSpectator && auc.turnPlayerId === this.playerId;

    const myPlayer = v.players.find((p) => p.id === this.playerId);
    const activeBidderObj = isHost ? turnPlayer : myPlayer;
    const minBid = auc.mode === 'sole_bidder'
      ? auc.nominalCost
      : (auc.currentBid === 0 ? auc.nominalCost : auc.currentBid + 100);
    const maxBid = activeBidderObj ? activeBidderObj.score : minBid;
    const currentInputBid = this.drafts.auctionBid || minBid;

    return `
      <div class="special-event-card auction-theme">
        <div class="special-badge">🔨 ВОПРОС-АУКЦИОН!</div>
        <h2>Тема: «${escapeHtml(v.questionView?.themeName || '')}» · Номинал: ${auc.nominalCost}</h2>

        <div class="auction-status-board">
          <div class="auc-stat">
            <span>Текущая ставка</span>
            <strong>${auc.currentBid > 0 ? formatScore(auc.currentBid) : `Старт от ${auc.nominalCost}`} ${auc.isAllIn ? '🔥 ВА-БАНК' : ''}</strong>
          </div>
          <div class="auc-stat">
            <span>Лидер торгов</span>
            <strong>${highBidder ? `${escapeHtml(highBidder.avatar)} ${escapeHtml(highBidder.name)}` : '—'}</strong>
          </div>
        </div>

        ${auc.history?.length ? `
          <div class="auction-log">
            ${auc.history.slice(-4).map((h) => `<span class="auc-log-chip">${escapeHtml(h.text)}</span>`).join('')}
          </div>
        ` : ''}

        ${auc.mode === 'auto_nominal' ? `
          <p class="muted-sm">Ни у кого нет ${auc.nominalCost} очков для повышения ставки — играет выбирающий за номинал!</p>
          ${(isHost || isMyTurn) ? `<button class="btn btn-gold btn-lg" id="btn-auc-auto-open">Открыть вопрос за ${auc.nominalCost}</button>` : ''}
        ` : (isMyTurn || isHost) && turnPlayer ? `
          <div class="auction-controls-box">
            <div class="turn-banner">
              Ход в торгах: <strong>${escapeHtml(turnPlayer.avatar)} ${escapeHtml(turnPlayer.name)}</strong> (в банке: ${formatScore(turnPlayer.score)})
            </div>
            <div class="bid-input-row">
              ${!auc.isAllIn && minBid < maxBid ? `
                <input type="number" step="100" min="${minBid}" max="${maxBid}"
                  data-keep-focus="auctionBid" id="inp-auc-bid" value="${currentInputBid}">
                <button class="btn btn-primary" id="btn-auc-bid">Поставить</button>
              ` : ''}
              <button class="btn btn-gold" id="btn-auc-allin">🔥 Ва-банк (${formatScore(maxBid)})</button>
              ${auc.mode === 'bidding' ? `<button class="btn btn-secondary" id="btn-auc-pass">Пас</button>` : ''}
            </div>
          </div>
        ` : `
          <div class="waiting-note">
            Сейчас делает ставку <strong>${escapeHtml(turnPlayer?.name || 'соперник')}</strong>…
          </div>
        `}

        ${isHost && v.players.length > 0 ? `
          <details class="host-auc-override">
            <summary>⚡ Быстро назначить победителя торгов вручную (голосом)</summary>
            <div class="override-inline">
              <select id="sel-force-auc-player">
                ${v.players.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === (auc.highBidderId || v.chooserId) ? 'selected' : ''}>${escapeHtml(p.name)} (${p.score})</option>`).join('')}
              </select>
              <input type="number" step="100" id="inp-force-auc-stake" value="${Math.max(auc.nominalCost, auc.currentBid || auc.nominalCost)}">
              <button class="btn btn-sm btn-gold" id="btn-force-auc-go">Открыть вопрос</button>
            </div>
          </details>
        ` : ''}
      </div>
    `;
  }

  // --- Сцена: БОЛЬШОЕ ОКНО ВОПРОСА! ---

  _renderQuestionStage(v) {
    const qv = v.questionView;
    const rt = qv?.runtime;
    if (!qv || !rt) return '';

    const isHost = this.role === 'host';
    const responder = v.players.find((p) => p.id === rt.activeResponderId);
    const curse = v.activeCurse;
    const isRevealed = rt.substate === 'revealed';
    const noOneAnswered = isRevealed && !rt.lastJudgment;
    const openingQuestion = this.lastAnimatedQuestionKey !== qv.questionKey;
    if (openingQuestion) this.lastAnimatedQuestionKey = qv.questionKey;
    const isCursedVictim = this.role === 'player' && !this.isSpectator && curse?.targetId === this.playerId && !isRevealed;

    const isUpsideDownMe = isCursedVictim && curse.kind === 'upside_down';
    const mudWipesRequired = curse?.wipesRequired || 8;
    const mudWipesLeft = (isCursedVictim && curse.kind === 'mud_screen')
      ? Math.max(0, mudWipesRequired - this.localWipesDone)
      : 0;

    const badges = [];
    if (qv.modifier && MODIFIER_CATALOG[qv.modifier]) {
      const m = MODIFIER_CATALOG[qv.modifier];
      badges.push(`<span class="q-special-pill np">${escapeHtml(m.icon)} ${escapeHtml(m.badge.replace(/^[^\s]+\s*/, ''))}</span>`);
    }
    if (curse?.kind === 'cursed_mark' && curse.targetName) {
      badges.push(`<span class="q-special-pill np">💣 Метка ×2: ${escapeHtml(curse.targetName)}</span>`);
    }
    if (rt.specialKind === 'cat') {
      badges.push('<span class="q-special-pill cat">🐈 Кот в мешке</span>');
    } else if (rt.specialKind === 'auction') {
      badges.push('<span class="q-special-pill auction">🔨 Аукцион</span>');
    } else if (rt.specialKind === 'noRisk') {
      badges.push('<span class="q-special-pill norisk">🛡️ Без риска</span>');
    }

    return `
      <div class="question-stage-layout">
        <div class="question-card giant-question-window ${rt.substate === 'buzzing' ? 'buzz-ready-glow' : ''} ${openingQuestion ? 'question-opening' : ''} ${isRevealed ? 'question-fold-after-answer' : ''} ${noOneAnswered ? 'no-answer-revealed' : ''}">
          <div class="question-header">
            <div class="q-theme-title">
              ${badges.join('')}
              <span>${escapeHtml(qv.themeName)}</span>
            </div>
            <div class="q-cost-badge">${formatScore(qv.effectiveCost)}</div>
          </div>

          ${isUpsideDownMe ? `
            <div class="curse-victim-alert">🙃 ПРОКЛЯТИЕ «ВВЕРХ ДНОМ» от ${escapeHtml(curse.actorName)}! Читайте вопрос вверх ногами!</div>
          ` : ''}

          <div class="question-body-wrap">
            <div class="question-body ${isUpsideDownMe ? 'cursed-upside-down' : ''}"
              ${mudWipesLeft > 0 ? `style="filter: blur(${(mudWipesLeft * 2.4).toFixed(1)}px); user-select: none;"` : ''}>
              ${qv.image ? `
                <div class="q-media-box">
                  <img src="${escapeHtml(qv.image)}" alt="Кадр к вопросу" class="q-image zoomable" id="btn-zoom-q-img" title="Нажмите, чтобы развернуть картинку на весь экран">
                </div>
              ` : ''}

              ${qv.audio ? `
                <div class="studio-audio-card">
                  <div class="audio-visualizer ${this.qAudioPlaying ? 'playing' : ''}" id="q-audio-visualizer">
                    <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                  </div>
                  <div class="audio-card-info">
                    <div class="audio-card-head-row">
                      <strong>${/только мелодия/i.test(qv.themeName) || qv.audio.includes('melody-') ? '🎹 Только мелодия (без слов) — угадайте хит!' : '🎵 Музыкальный вопрос — угадайте трек!'}</strong>
                      <span class="audio-time-label" id="q-audio-time-label">${this._formatAudioTime(this._audioElapsedForUi())} / ${this._formatAudioTime(this._audioDurationForUi())}</span>
                    </div>
                    <div class="audio-progress-track">
                      <div class="audio-progress-fill" id="q-audio-progress-fill" style="width:${this._audioDurationForUi() ? Math.min(100, (this._audioElapsedForUi() / this._audioDurationForUi()) * 100).toFixed(1) : 0}%"></div>
                    </div>
                    <span class="muted-sm">При нажатии кнопки ответа трек ставится на паузу</span>
                    ${qv.audioCredit ? `<a class="audio-credit" href="${escapeHtml(qv.audioCreditUrl || '#')}" target="_blank" rel="noopener">Источник: ${escapeHtml(qv.audioCredit)}${qv.audioLicense ? ` · ${escapeHtml(qv.audioLicense)}` : ''}</a>` : ''}
                  </div>
                  <div class="audio-card-btns">
                    <button type="button" class="btn btn-gold" id="btn-toggle-q-audio">
                      ${this.qAudioPlaying ? '⏸️ Пауза' : '▶️ Включить трек'}
                    </button>
                    <button type="button" class="btn btn-secondary" id="btn-replay-q-audio" title="Включить отрывок сначала">
                      🔁 Сначала
                    </button>
                    <label class="audio-vol-wrap" title="Громкость музыки">
                      <span>🔊</span>
                      <input type="range" id="inp-q-audio-vol" min="0.05" max="1" step="0.05" value="${this.qAudioVolume}">
                    </label>
                  </div>
                </div>
              ` : ''}

              ${qv.videoEmbedUrl ? `
                <div class="q-media-box q-video-embed-box">
                  <iframe class="q-video-embed" src="${escapeHtml(qv.videoEmbedUrl)}" title="Видеофрагмент вопроса" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                  ${qv.videoCredit ? `<a class="audio-credit" href="${escapeHtml(qv.videoSourceUrl || qv.videoEmbedUrl)}" target="_blank" rel="noopener">${escapeHtml(qv.videoCredit)} ↗</a>` : ''}
                </div>
              ` : qv.video ? `
                <div class="q-media-box">
                  <video controls autoplay src="${escapeHtml(qv.video)}" class="q-video"></video>
                </div>
              ` : ''}

              <div class="q-text">${escapeHtml(qv.text)}</div>
            </div>

            ${mudWipesLeft > 0 ? `
              <div class="mud-splat-overlay">
                <div class="mud-splat-title">🧽 ВАШ ЭКРАН ЗАЛЯПАЛИ ГРЯЗЬЮ!</div>
                <p>Быстрее жмите кнопку ниже, чтобы протереть стекло и увидеть вопрос!</p>
                <button type="button" class="btn btn-gold btn-lg mud-wipe-btn" id="btn-wipe-mud">
                  🧽 ОТТЕРЕТЬ ЭКРАН! (осталось раз: ${mudWipesLeft})
                </button>
              </div>
            ` : ''}
          </div>

          ${this._renderQuestionHintsZone(v, qv, rt)}

          ${this._renderQuestionStatusBanner(v, qv, rt, responder)}

          ${rt.substate === 'revealed' ? `
            <div class="revealed-answer-banner ${noOneAnswered ? 'no-answer-center' : ''}">
              <div class="ans-label">ПРАВИЛЬНЫЙ ОТВЕТ:</div>
              <div class="ans-value">${escapeHtml(qv.answer || '')}</div>
              ${qv.answerImage ? `
                <div class="ans-reveal-media">
                  <img src="${escapeHtml(qv.answerImage)}" alt="Разрез / разоблачение" class="ans-reveal-image zoomable" id="btn-zoom-ans-img" title="Нажмите, чтобы увеличить фото ответа">
                </div>
              ` : ''}
              ${qv.comment ? `<div class="ans-comment">💡 ${escapeHtml(qv.comment)}</div>` : ''}
              ${isHost ? `
                <button class="btn btn-gold btn-lg mt-sm" id="btn-back-to-board">
                  Вернуться на табло (Пробел) →
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>

        ${isHost ? this._renderHostQuestionPanel(qv, rt, responder) : this._renderPlayerQuestionControls(qv, rt)}
      </div>
    `;
  }

  _renderQuestionHintsZone(v, qv, rt) {
    const h = qv.hints;
    if (!h || !h.enabled) return '';

    const isHost = this.role === 'host';
    const me = (!isHost && this.role === 'player' && !this.isSpectator)
      ? v.players.find((p) => p.id === this.playerId)
      : null;
    const isLocked = me ? Boolean(rt.lockedPlayerIds?.includes(me.id)) : false;
    const canUseLifelines = Boolean(
      me &&
      me.hints &&
      h.playerHintsEnabled &&
      rt.substate !== 'revealed' &&
      !isLocked &&
      (!rt.specialKind || rt.activeResponderId === me.id)
    );

    const hasCursedMarkOnMe = Boolean(
      me &&
      v.activeCurse?.kind === 'cursed_mark' &&
      v.activeCurse.targetId === me.id
    );
    const noRiskAlreadySafe = rt.specialKind === 'noRisk' && !hasCursedMarkOnMe;

    const banners = [];
    if (h.publicHintText) {
      banners.push(`
        <div class="hint-banner public-hint">
          <span class="hint-chip">💡 ПОДСКАЗКА ВЕДУЩЕГО ДЛЯ ВСЕХ</span>
          <div class="hint-body">${escapeHtml(h.publicHintText)}</div>
        </div>
      `);
    }
    if (!h.publicHintText && h.myClueText) {
      banners.push(`
        <div class="hint-banner private-hint">
          <span class="hint-chip">💡 ВАША ЛИЧНАЯ НАВОДКА (видите только вы)</span>
          <div class="hint-body">${escapeHtml(h.myClueText)}</div>
        </div>
      `);
    }
    if (h.myLettersMask) {
      banners.push(`
        <div class="hint-banner mask-hint">
          <span class="hint-chip">🔤 МАСКА ОТВЕТА (видите только вы)</span>
          <div class="hint-body hint-mask-code">${escapeHtml(h.myLettersMask)}</div>
        </div>
      `);
    }
    if (h.myShieldActive && rt.substate !== 'revealed') {
      banners.push(`
        <div class="hint-banner shield-hint">
          <span class="hint-chip">🛡️ СТРАХОВКА АКТИВНА</span>
          <div class="hint-body">Если вы ошибётесь на этом вопросе, очки с вас не спишутся (0 вместо минуса)!</div>
        </div>
      `);
    }

    let controlsHtml = '';
    if (canUseLifelines) {
      const clueLeft = me.hints.clue || 0;
      const lettersLeft = me.hints.letters || 0;
      const shieldLeft = me.hints.shield || 0;

      const clueDisabled = clueLeft <= 0 || h.publicHintRevealed || Boolean(h.myClueText);
      const lettersDisabled = lettersLeft <= 0 || Boolean(h.myLettersMask);
      const shieldDisabled = shieldLeft <= 0 || Boolean(h.myShieldActive) || noRiskAlreadySafe;

      controlsHtml = `
        <div class="player-hints-toolbar" aria-label="Ваши подсказки">
          <span class="hints-toolbar-label">💡 Подсказки:</span>
          <button type="button" class="btn-lifeline ${h.myClueText ? 'used-now' : ''}" data-use-hint="clue"
            ${clueDisabled ? 'disabled' : ''} title="Показать текстовую наводку только вам">
            💡 Наводка <span class="lifeline-cnt">${clueLeft}</span>
          </button>
          <button type="button" class="btn-lifeline ${h.myLettersMask ? 'used-now' : ''}" data-use-hint="letters"
            ${lettersDisabled ? 'disabled' : ''} title="Открыть первые буквы слов и длину ответа только вам">
            🔤 Первые буквы <span class="lifeline-cnt">${lettersLeft}</span>
          </button>
          <button type="button" class="btn-lifeline ${h.myShieldActive ? 'used-now' : ''}" data-use-hint="shield"
            ${shieldDisabled ? 'disabled' : ''} title="Защититься от списания очков при ошибке на этом вопросе">
            🛡️ Страховка 0− <span class="lifeline-cnt">${shieldLeft}</span>
          </button>
        </div>
      `;
    }

    if (banners.length === 0 && !controlsHtml) return '';
    return `
      <div class="question-hints-zone">
        ${banners.join('')}
        ${controlsHtml}
      </div>
    `;
  }

  _renderQuestionStatusBanner(v, qv, rt, responder) {
    if (rt.substate === 'reading') {
      return `<div class="q-live-status reading">🎙️ Читаем вопрос — подождите сигнала рамки!</div>`;
    }
    if (rt.substate === 'buzzing') {
      return `
        <div class="q-live-status buzzing">
          🟢 КНОПКА ОТКРЫТА — МОЖНО ОТВЕЧАТЬ!
          ${rt.lastJudgment && !rt.lastJudgment.correct
            ? `<span class="prev-miss-chip">${rt.lastJudgment.shieldSaved ? '🛡️' : '❌'} ${escapeHtml(rt.lastJudgment.name)} (${rt.lastJudgment.delta})</span>`
            : ''}
        </div>
      `;
    }
    if ((rt.substate === 'answering' || rt.substate === 'special_answering') && responder) {
      const respHasShield = Boolean(qv.hints?.shieldUsedBy?.includes(responder.id));
      return `
        <div class="responder-spotlight">
          <div class="resp-main">
            <span class="resp-avatar">${escapeHtml(responder.avatar)}</span>
            <div>
              <div class="resp-title">Отвечает: <strong>${escapeHtml(responder.name)}</strong>
                ${respHasShield ? `<span class="reaction-chip">🛡️ Страховка 0−</span>` : ''}
                ${rt.reactionMs ? `<span class="reaction-chip">⚡ ${(rt.reactionMs / 1000).toFixed(2)} с</span>` : ''}
              </div>
              ${rt.submittedText
                ? `<div class="submitted-answer-bubble">💬 «${escapeHtml(rt.submittedText)}»</div>`
                : `<div class="muted-sm">Говорите ответ в голос или напишите текстом…</div>`}
            </div>
          </div>
          ${rt.lateBuzzes?.length ? `
            <div class="late-buzz-row">
              Чуть позже нажали:
              ${rt.lateBuzzes.map((lb) => `<span>${escapeHtml(lb.name)} (+${(lb.deltaMs / 1000).toFixed(2)} с)</span>`).join(' · ')}
            </div>
          ` : ''}
        </div>
      `;
    }
    if (rt.substate === 'revealed' && rt.lastJudgment) {
      return `
        <div class="q-live-status ${rt.lastJudgment.correct ? 'correct' : 'wrong'}">
          ${rt.lastJudgment.correct
            ? `✅ Красавчик! Верно ответил ${escapeHtml(rt.lastJudgment.name)} (+${formatScore(rt.lastJudgment.delta)})!`
            : `❌ Никто не дал точного ответа`}
        </div>
      `;
    }
    return '';
  }

  _renderHostQuestionPanel(qv, rt) {
    if (rt.substate === 'revealed') return '';
    const judgeWaitMs = Math.max(0, (rt.judgeAvailableAt || 0) - Date.now());
    return `
      <div class="host-control-bar">
        <div class="host-secret-answer">
          <span class="secret-tag">🔒 Правильный ответ (видно только ведущему):</span>
          <strong>${escapeHtml(qv.answer || '')}</strong>
          ${qv.comment ? `<div class="secret-comment">💬 ${escapeHtml(qv.comment)}</div>` : ''}
          ${qv.hints?.enabled && qv.hints?.hostHintPreview ? `
            <div class="secret-comment host-hint-preview">
              💡 Подсказка ${qv.hints.publicHintRevealed ? '(открыта всем)' : '(скрыта)'}: ${escapeHtml(qv.hints.hostHintPreview)}
            </div>
          ` : ''}
        </div>

        <div class="host-judge-buttons">
          ${rt.substate === 'reading' ? `
            <button class="btn btn-gold btn-lg" id="btn-host-unlock">🔓 Открыть кнопку (Пробел)</button>
          ` : ''}

          ${(rt.substate === 'answering' || rt.substate === 'special_answering') ? `
            <button class="btn btn-correct btn-lg" id="btn-judge-yes" ${judgeWaitMs > 0 ? 'disabled' : ''}>
              ✅ Засчитать (+${formatScore(qv.effectiveCost)}) <kbd>1</kbd>
            </button>
            <button class="btn btn-wrong btn-lg" id="btn-judge-no" ${judgeWaitMs > 0 ? 'disabled' : ''}>
              ❌ Неверно <kbd>2</kbd>
            </button>
            ${judgeWaitMs > 0 ? `<span class="judge-wait-note">⏳ Подождите 1,5 с перед оценкой ответа</span>` : ''}
          ` : ''}

          ${qv.hints?.enabled && !qv.hints?.publicHintRevealed ? `
            <button class="btn btn-secondary btn-sm" id="btn-host-public-hint" title="Открыть подсказку сразу всем игрокам (клавиша H)">
              💡 Подсказка всем <kbd>H</kbd>
            </button>
          ` : ''}

          <button class="btn btn-ghost btn-sm" id="btn-pause-timer" title="Пауза таймера (P)">⏯️ Пауза</button>
          <button class="btn btn-ghost btn-sm" id="btn-skip-question">Показать ответ</button>
        </div>
      </div>
    `;
  }

  _renderPlayerQuestionControls(qv, rt) {
    if (this.isSpectator || rt.substate === 'revealed') return '';

    const isMeAnswering = rt.activeResponderId === this.playerId &&
      (rt.substate === 'answering' || rt.substate === 'special_answering');
    const isLocked = rt.lockedPlayerIds?.includes(this.playerId);
    const isFalseStartLocked = rt.falseStartUntil?.[this.playerId] && Date.now() < rt.falseStartUntil[this.playerId];

    if (isMeAnswering) {
      return `
        <div class="player-answer-box">
          <div class="your-turn-shout">🎤 ВАШ ОТВЕТ! Скажите голосом в Discord или напишите здесь:</div>
          <form id="form-player-answer" class="answer-input-row">
            <input type="text" data-keep-focus="answerText" id="inp-player-answer"
              placeholder="Напишите ответ (если удобнее текстом)…"
              value="${escapeHtml(this.drafts.answerText)}">
            <button type="submit" class="btn btn-gold">Отправить</button>
          </form>
          <button type="button" class="btn btn-secondary btn-sm answer-done-btn" id="btn-player-answer-done">
            🎙️ Закончил отвечать — подождать 1,5 с
          </button>
        </div>
      `;
    }

    if (rt.specialKind) {
      return `<div class="player-passive-note">Сейчас на спецвопрос отвечает выбранный игрок.</div>`;
    }

    const curse = this.view?.activeCurse;
    const isMutedMe = curse?.kind === 'mute_player' && curse.targetId === this.playerId;

    if (isMutedMe) {
      return `
        <div class="buzzer-btn locked gagged-buzzer" aria-disabled="true">
          🤐 ВАМ ЗАКЛЕИЛИ РОТ! (${escapeHtml(curse.actorName)} отключил вашу кнопку на этот вопрос)
        </div>
      `;
    }

    if (isLocked) {
      return `<div class="buzzer-btn locked" aria-disabled="true">ВЫ УЖЕ ПРОБОВАЛИ ОТВЕТИТЬ НА ЭТОТ ВОПРОС</div>`;
    }

    if (isFalseStartLocked) {
      return `<div class="buzzer-btn falsestart" aria-disabled="true">⚡ ФАЛЬСТАРТ! КНОПКА ЗАБЛОКИРОВАНА НА 3 СЕК…</div>`;
    }

    const waitingRead = rt.substate === 'reading';
    const someoneElseAnswering = rt.substate === 'answering';
    const isRunawayMe = curse?.kind === 'runaway_buzzer' && curse.targetId === this.playerId && rt.substate === 'buzzing';
    const dodgesLeft = isRunawayMe ? Math.max(0, (curse.dodgesCount || 3) - this.localBuzzerDodges) : 0;
    const dodgeStyle = (isRunawayMe && this.localBuzzerDodges > 0 && dodgesLeft > 0)
      ? `style="transform: translate(${this.localDodgeOffset.x}px, ${this.localDodgeOffset.y}px) scale(0.92);"`
      : '';

    return `
      <div class="buzzer-zone ${dodgesLeft > 0 ? 'runaway-zone' : ''}">
        <button type="button" id="btn-big-buzzer" ${dodgeStyle}
          class="buzzer-btn ${waitingRead ? 'armed-wait' : someoneElseAnswering ? 'late-try' : 'ready'} ${dodgesLeft > 0 ? 'runaway-active' : ''}">
          <span class="buzzer-main-text">
            ${waitingRead
              ? 'ЖДИТЕ РАМКУ…'
              : someoneElseAnswering
                ? 'ОТВЕЧАЕТ ДРУГОЙ ИГРОК'
                : (this.localBuzzerDodges > 0 && dodgesLeft > 0)
                  ? `🤡 ХОБА, МИМО! ЛОВИ ЕЩЁ ${dodgesLeft} РАЗА!`
                  : 'Я ЗНАЮ! ОТВЕТИТЬ!'}
          </span>
          <span class="buzzer-sub-text">
            ${dodgesLeft > 0 ? '🤡 Проклятие «Убегающая кнопка» активно!' : 'Тапните по кнопке или нажмите ПРОБЕЛ'}
          </span>
        </button>
      </div>
    `;
  }

  // --- Сцены Финального раунда ---

  _renderFinalNoPlayersStage(v) {
    const isHost = this.role === 'host';
    return `
      <div class="special-event-card">
        <div class="special-badge">🏆 ПЕРЕД ФИНАЛОМ</div>
        <h2>Ни у кого нет плюсового счёта (все ушли в ноль или минус)!</h2>
        <p class="special-sub">Но вечер портить не будем — ведущий может выдать всем стартовые очки на Финал!</p>
        ${isHost ? `
          <div class="btn-row center">
            <button class="btn btn-gold btn-lg" id="btn-rescue-final">🎁 Выдать всем по 500 очков и сыграть Финал!</button>
            <button class="btn btn-secondary btn-lg" id="btn-end-no-final">Подвести итоги сейчас</button>
          </div>
        ` : `<div class="waiting-note">Ведущий решает судьбу Финального раунда…</div>`}
      </div>
    `;
  }

  _renderFinalThemesStage(v) {
    const fv = v.finalView;
    if (!fv) return '';
    const isHost = this.role === 'host';
    const eliminator = v.players.find((p) => p.id === fv.currentEliminatorId);
    const isMyEliminate = this.role === 'player' && !this.isSpectator && fv.currentEliminatorId === this.playerId;
    const canStrike = isHost || isMyEliminate;

    return `
      <div class="final-stage-card">
        <div class="special-badge">🏆 ФИНАЛ · УБИРАЕМ ТЕМЫ</div>
        <h2>По очереди вычёркиваем страшные темы, пока не останется одна!</h2>
        <p class="special-sub">
          ${isMyEliminate
            ? `<strong class="gold-text">👉 ВАША ОЧЕРЕДЬ! Нажмите на тему, которую хотите вычеркнуть</strong>`
            : `Сейчас тему убирает: <strong>${escapeHtml(eliminator ? `${eliminator.avatar} ${eliminator.name}` : 'Ведущий')}</strong>`}
        </p>

        <div class="final-themes-grid">
          ${fv.themes.map((t) => `
            <button type="button"
              class="final-theme-card ${t.eliminated ? 'eliminated' : canStrike ? 'clickable' : ''}"
              ${!t.eliminated && canStrike ? `data-strike-theme="${t.index}"` : 'disabled'}>
              <span class="ft-title">${escapeHtml(t.name)}</span>
              ${t.eliminated ? `<span class="ft-struck-by">✕ Убрал: ${escapeHtml(t.eliminatedBy)}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderFinalBetsStage(v) {
    const fv = v.finalView;
    if (!fv) return '';
    const isHost = this.role === 'host';
    const isFinalist = fv.finalistIds.includes(this.playerId);
    const me = v.players.find((p) => p.id === this.playerId);
    const maxBet = me ? Math.max(1, me.score) : 1;
    const draftBetVal = this.drafts.finalBet || Math.max(1, Math.floor(maxBet / 2));

    return `
      <div class="final-stage-card">
        <div class="special-badge">🔒 ФИНАЛ · СЕКРЕТНЫЕ СТАВКИ</div>
        <h2>Тема финала: <span class="gold-text">«${escapeHtml(fv.chosenThemeName || '')}»</span></h2>

        <div class="finalists-status-pills">
          ${fv.finalistIds.map((id) => {
            const p = v.players.find((x) => x.id === id);
            const done = fv.betStatusByPlayer?.[id];
            return `
              <div class="fin-status-chip ${done ? 'done' : ''}">
                <span>${escapeHtml(p?.avatar || '')} ${escapeHtml(p?.name || '')}</span>
                <strong>${done ? '🔒 Ставка принята' : '⏳ Ставит…'}</strong>
              </div>
            `;
          }).join('')}
        </div>

        ${this.role === 'player' && isFinalist ? (
          fv.myBet !== null ? `
            <div class="locked-confirm-card">
              ✅ Ваша секретная ставка <strong>${formatScore(fv.myBet)}</strong> принята! Ждём остальных…
            </div>
          ` : `
            <div class="bet-form-card">
              <p>У вас <strong>${formatScore(maxBet)}</strong> очков. Сколько ставите?</p>
              <div class="quick-bets-row">
                <button type="button" class="btn btn-sm btn-secondary" data-qbet="1">Минимум (1)</button>
                <button type="button" class="btn btn-sm btn-secondary" data-qbet="${Math.max(1, Math.floor(maxBet * 0.5))}">Половина (${formatScore(Math.max(1, Math.floor(maxBet * 0.5)))})</button>
                ${maxBet > 2 ? `<button type="button" class="btn btn-sm btn-secondary" data-qbet="${maxBet - 1}">Ва-банк − 1 (${formatScore(maxBet - 1)})</button>` : ''}
                <button type="button" class="btn btn-sm btn-gold" data-qbet="${maxBet}">🔥 Ва-банк (${formatScore(maxBet)})</button>
              </div>
              <div class="bid-input-row">
                <input type="number" min="1" max="${maxBet}" data-keep-focus="finalBet" id="inp-final-bet" value="${draftBetVal}">
                <button type="button" class="btn btn-gold btn-lg" id="btn-submit-final-bet">Поставить</button>
              </div>
            </div>
          `
        ) : (!isHost && this.role === 'player' ? `
          <div class="waiting-note">В Финале делают ставки игроки с плюсовым счётом.</div>
        ` : '')}

        ${isHost ? `
          <div class="mt-sm">
            <button class="btn btn-gold" id="btn-host-force-final-q">Открыть финальный вопрос →</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderFinalQuestionStage(v) {
    const fv = v.finalView;
    if (!fv) return '';
    const isHost = this.role === 'host';
    const isFinalist = fv.finalistIds.includes(this.playerId);
    const myAnsLocked = Boolean(fv.myAnswer?.locked);

    return `
      <div class="final-stage-card">
        <div class="special-badge">⏱️ ФИНАЛЬНЫЙ ВОПРОС · «${escapeHtml(fv.chosenThemeName || '')}»</div>

        ${fv.questionImage ? `
          <div class="q-media-box">
            <img src="${escapeHtml(fv.questionImage)}" alt="Финал" class="q-image">
          </div>
        ` : ''}

        <div class="q-text final-q-text">${escapeHtml(fv.questionText || '')}</div>

        ${fv.publicHintText ? `
          <div class="hint-banner public-hint mt-sm">
            <span class="hint-chip">💡 ПОДСКАЗКА ВЕДУЩЕГО ДЛЯ ВСЕХ</span>
            <div class="hint-body">${escapeHtml(fv.publicHintText)}</div>
          </div>
        ` : ''}

        <div class="finalists-status-pills">
          ${fv.finalistIds.map((id) => {
            const p = v.players.find((x) => x.id === id);
            const done = fv.answerStatusByPlayer?.[id];
            return `
              <div class="fin-status-chip ${done ? 'done' : ''}">
                <span>${escapeHtml(p?.avatar || '')} ${escapeHtml(p?.name || '')}</span>
                <strong>${done ? '✍️ Сдал ответ' : '✍️ Думает (60 сек)…'}</strong>
              </div>
            `;
          }).join('')}
        </div>

        ${this.role === 'player' && isFinalist ? (
          myAnsLocked ? `
            <div class="locked-confirm-card">
              ✅ Ваш ответ <strong>«${escapeHtml(fv.myAnswer?.text || '')}»</strong> принят!
            </div>
          ` : `
            <form id="form-final-answer" class="bet-form-card">
              <label><span>Напишите ваш финальный ответ (у вас целая минута!):</span></label>
              <div class="answer-input-row">
                <input type="text" maxlength="160" data-keep-focus="finalAnswer" id="inp-final-answer"
                  placeholder="Ваш ответ…" value="${escapeHtml(this.drafts.finalAnswer)}">
                <button type="submit" class="btn btn-gold btn-lg">Отправить ответ</button>
              </div>
            </form>
          `
        ) : ''}

        ${isHost ? `
          <div class="host-control-bar mt-sm">
            <div class="host-secret-answer">
              <span class="secret-tag">🔒 Правильный ответ финала:</span>
              <strong>${escapeHtml(fv.correctAnswer || '')}</strong>
              ${fv.hostHintPreview ? `
                <div class="secret-comment host-hint-preview">
                  💡 Подсказка ${fv.publicHintRevealed ? '(открыта всем)' : '(скрыта)'}: ${escapeHtml(fv.hostHintPreview)}
                </div>
              ` : ''}
            </div>
            <div class="host-judge-buttons">
              ${!fv.publicHintRevealed && v.settings?.hintsMode !== 'off' ? `
                <button class="btn btn-secondary btn-sm" id="btn-host-public-hint">💡 Подсказка всем <kbd>H</kbd></button>
              ` : ''}
              <button class="btn btn-gold" id="btn-host-force-reveal">Перейти к открытию ответов →</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderFinalRevealStage(v) {
    const fv = v.finalView;
    if (!fv) return '';
    const isHost = this.role === 'host';
    const currentPid = fv.revealOrder[fv.revealCursor];
    const currentPlayer = v.players.find((p) => p.id === currentPid);

    return `
      <div class="final-stage-card">
        <div class="special-badge">🎭 ФИНАЛ · ПРОВЕРКА ОТВЕТОВ</div>
        <h2>Тема: «${escapeHtml(fv.chosenThemeName || '')}»</h2>
        <p class="muted-sm">${escapeHtml(fv.questionText || '')}</p>

        <div class="final-reveal-cards">
          ${fv.revealOrder.map((pid, idx) => {
            const p = v.players.find((x) => x.id === pid);
            const rd = fv.revealedData?.[pid] || {};
            const isCurrent = idx === fv.revealCursor && fv.revealStep !== 'done';
            return `
              <div class="reveal-player-card ${isCurrent ? 'spotlight' : ''} ${rd.judged ? (rd.correct ? 'judged-ok' : 'judged-bad') : ''}">
                <div class="rpc-head">
                  <span>${escapeHtml(p?.avatar || '')} <strong>${escapeHtml(p?.name || '')}</strong></span>
                  <span class="rpc-score">${formatScore(p?.score || 0)}</span>
                </div>
                <div class="rpc-answer">
                  ${rd.answerOpened
                    ? `Ответ: <strong>«${escapeHtml(rd.answerText || '—')}»</strong>`
                    : `<span class="muted-sm">🔒 Ответ закрыт</span>`}
                </div>
                <div class="rpc-bet">
                  ${rd.judged
                    ? `${rd.correct ? '✅ Верно' : '❌ Мимо'} · Ставка: <strong>${formatScore(rd.bet || 0)}</strong> (${rd.delta >= 0 ? '+' : ''}${formatScore(rd.delta)})`
                    : `<span class="muted-sm">🔒 Ставка скрыта</span>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${fv.revealStep === 'done' ? `
          <div class="revealed-answer-banner mt-sm">
            <div class="ans-label">ПРАВИЛЬНЫЙ ОТВЕТ ФИНАЛА:</div>
            <div class="ans-value">${escapeHtml(fv.correctAnswer || '')}</div>
            ${fv.comment ? `<div class="ans-comment">💡 ${escapeHtml(fv.comment)}</div>` : ''}
            ${isHost ? `<button class="btn btn-gold btn-lg mt-sm" id="btn-show-podium">🏆 Показать победителя!</button>` : ''}
          </div>
        ` : isHost && currentPlayer ? `
          <div class="host-control-bar mt-sm">
            <div class="host-secret-answer">
              <span class="secret-tag">🔒 Правильный ответ:</span>
              <strong>${escapeHtml(fv.correctAnswer || '')}</strong>
            </div>
            <div class="host-judge-buttons">
              ${fv.revealStep === 'hidden' ? `
                <button class="btn btn-gold btn-lg" id="btn-reveal-fin-ans">
                  👁️ Открыть ответ игрока ${escapeHtml(currentPlayer.name)}
                </button>
              ` : `
                <button class="btn btn-correct btn-lg" id="btn-fin-judge-yes">✅ Верно!</button>
                <button class="btn btn-wrong btn-lg" id="btn-fin-judge-no">❌ Неверно</button>
              `}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // --- Сцена: Пьедестал ---

  _renderPodiumStage(v) {
    const sorted = [...v.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const fastest = [...v.players]
      .filter((p) => p.stats?.fastestReactionMs !== null)
      .sort((a, b) => a.stats.fastestReactionMs - b.stats.fastestReactionMs)[0];
    const topKiller = [...v.players]
      .filter((p) => (p.stats?.sabotagesUsed || p.stats?.zeroedOthers || 0) > 0)
      .sort((a, b) => (b.stats?.sabotagesUsed || 0) - (a.stats?.sabotagesUsed || 0))[0];

    return `
      <div class="podium-stage-card">
        <div class="special-badge">🏆 ИГРА ОКОНЧЕНА!</div>
        ${winner ? `
          <div class="champion-hero">
            <div class="champ-crown">👑</div>
            <div class="champ-avatar">${escapeHtml(winner.avatar)}</div>
            <h2>Победитель: ${escapeHtml(winner.name)}!</h2>
            <div class="champ-score">${formatScore(winner.score)} очков</div>
          </div>
        ` : `<h2>Партия завершена!</h2>`}

        <div class="leaderboard-list">
          ${sorted.map((p, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
            return `
              <div class="leader-row ${idx === 0 ? 'first' : ''}">
                <span class="leader-rank">${medal}</span>
                <span class="leader-name">${escapeHtml(p.avatar)} ${escapeHtml(p.name)}</span>
                <span class="leader-stats">✅ ${p.stats?.correct || 0} · ❌ ${p.stats?.wrong || 0} · 💡 ${p.stats?.hintsUsed || 0}</span>
                <strong class="leader-points">${formatScore(p.score)}</strong>
              </div>
            `;
          }).join('')}
        </div>

        <div class="awards-row">
          ${fastest ? `
            <div class="award-chip">⚡ Самый быстрый палец: <strong>${escapeHtml(fastest.name)}</strong> (${(fastest.stats.fastestReactionMs / 1000).toFixed(2)} с)</div>
          ` : ''}
          ${topKiller ? `
            <div class="award-chip">😈 Главный пакостник стола: <strong>${escapeHtml(topKiller.name)}</strong> (пакостей: ${topKiller.stats.sabotagesUsed || topKiller.stats.zeroedOthers || 0})</div>
          ` : ''}
        </div>

        ${this.role === 'host' ? `
          <div class="btn-row center mt-sm">
            <button class="btn btn-gold btn-lg" id="btn-play-again-lobby">🔄 Выбрать следующий пак в этой же комнате</button>
          </div>
        ` : `<p class="muted-sm mt-sm">Ведущий может запустить следующий пак прямо в этой комнате!</p>`}
      </div>
    `;
  }

  // --- Верхняя панель игроков с баллами (НАД окном вопроса!) ---

  _renderPlayerPodiums(v) {
    if (!v.players || v.players.length === 0) {
      return `
        <div class="empty-podiums-hint">
          👥 Игроки и их баллы появятся здесь сверху сразу после входа по коду <strong>${escapeHtml(v.roomCode)}</strong>
        </div>
      `;
    }

    const rt = v.questionView?.runtime;
    return `
      <div class="podiums-row">
        ${v.players.map((p) => {
          const isMe = this.role === 'player' && p.id === this.playerId;
          const isChooser = v.chooserId === p.id;
          const isAnswering = rt && rt.activeResponderId === p.id && (rt.substate === 'answering' || rt.substate === 'special_answering');
          const isLocked = rt?.lockedPlayerIds?.includes(p.id);
          const wasJustZeroed = v.lastZeroedPlayerId === p.id;
          const activeCurseOnPlayer = v.activeCurse?.targetId === p.id ? v.activeCurse : null;
          const curseIcon = activeCurseOnPlayer ? (MODIFIER_CATALOG[activeCurseOnPlayer.kind]?.icon || '😈') : '';
          const showHintsCount = v.settings?.hintsMode === 'standard' || v.settings?.hintsMode === 'generous';
          const totalHintsLeft = p.hints ? ((p.hints.clue || 0) + (p.hints.letters || 0) + (p.hints.shield || 0)) : 0;
          const hasShieldOnQ = Boolean(v.questionView?.hints?.shieldUsedBy?.includes(p.id) && rt?.substate !== 'revealed');
          return `
            <div class="player-podium ${isAnswering ? 'answering' : ''} ${isChooser ? 'choosing' : ''} ${wasJustZeroed || activeCurseOnPlayer ? 'zeroed-flash' : ''} ${isMe ? 'me' : ''} ${!p.online ? 'offline' : ''}"
              style="--p-color: ${escapeHtml(p.color || '#f5c451')}">
              <div class="podium-left-avatar">
                <span class="podium-avatar">${escapeHtml(p.avatar)}</span>
                <span class="online-dot ${p.online ? 'on' : 'off'}" title="${p.online ? 'Онлайн' : 'Оффлайн'}"></span>
              </div>
              <div class="podium-mid-info">
                <div class="podium-name">
                  ${isChooser ? `<span class="chooser-crown" title="Выбирает вопрос">👑</span> ` : ''}
                  ${escapeHtml(p.name)}${isMe ? ' (Вы)' : ''}
                </div>
                <div class="podium-score ${p.score < 0 ? 'negative' : ''}">
                  <span class="score-value" data-score-player="${escapeHtml(p.id)}" data-score-value="${Number(p.score) || 0}">${formatScore(p.score)}</span>
                  ${showHintsCount ? `<span class="hints-left-pill" title="Осталось подсказок: 💡${p.hints?.clue || 0} · 🔤${p.hints?.letters || 0} · 🛡️${p.hints?.shield || 0}">💡${totalHintsLeft}</span>` : ''}
                  ${hasShieldOnQ ? `<span class="hints-left-pill shield-on" title="Страховка от минуса активна на этом вопросе">🛡️</span>` : ''}
                  ${wasJustZeroed ? `<span class="zeroed-pill">💥!</span>` : ''}
                  ${curseIcon ? `<span class="zeroed-pill" title="Под действием модификатора">${curseIcon}</span>` : ''}
                  ${isLocked ? `<span class="miss-badge" title="Кнопка заблокирована / уже отвечал">✕</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _renderHostToolsModal(v) {
    return `
      <div class="modal-backdrop" id="host-tools-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <h3>⚙️ Пульт ведущего</h3>
            <button class="btn-icon" id="btn-close-host-tools">✕</button>
          </div>

          <div class="host-tools-section">
            <h4>Игроки, баллы и право хода</h4>
            ${v.players.length === 0 ? `<p class="muted-sm">Пока нет подключённых игроков.</p>` : ''}
            <div class="host-players-table">
              ${v.players.map((p) => `
                <div class="hp-row">
                  <span class="hp-title">${escapeHtml(p.avatar)} <strong>${escapeHtml(p.name)}</strong></span>
                  <div class="hp-controls">
                    <button class="btn-tiny" data-adj-score="${escapeHtml(p.id)}:-100">−100</button>
                    <input type="number" step="100" class="hp-score-inp" data-exact-score="${escapeHtml(p.id)}" value="${p.score}">
                    <button class="btn-tiny" data-adj-score="${escapeHtml(p.id)}:100">+100</button>
                    <button class="btn-tiny" data-zero-player="${escapeHtml(p.id)}" title="Обнулить счёт">0</button>
                    <button class="btn-tiny ${v.chooserId === p.id ? 'gold-active' : ''}" data-set-chooser="${escapeHtml(p.id)}" title="Передать ход">👑 Ход</button>
                    <button class="btn-tiny danger" data-kick-player="${escapeHtml(p.id)}" title="Удалить">✕</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="host-tools-section">
            <h4>Управление игрой</h4>
            <div class="btn-row wrap">
              ${v.phase === 'question' ? `<button class="btn btn-sm btn-secondary" id="btn-ht-return-board">Вернуться на табло</button>` : ''}
              ${v.phase !== 'lobby' && v.phase !== 'podium' ? `<button class="btn btn-sm btn-secondary" id="btn-ht-next-round">Следующий раунд / Финал →</button>` : ''}
              <button class="btn btn-sm btn-danger-ghost" id="btn-ht-reset-lobby">Вернуть комнату в лобби</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- События игровой комнаты ---

  _bindRoomEvents() {
    document.getElementById('btn-cancel-connect')?.addEventListener('click', () => this._leaveRoom());
    document.getElementById('btn-leave-room')?.addEventListener('click', () => {
      if (confirm('Выйти из текущей комнаты?')) this._leaveRoom();
    });

    document.getElementById('btn-mute-room')?.addEventListener('click', () => {
      const muted = sound.toggleMute();
      if (muted) {
        this.qAudio.pause();
      }
      this.render();
    });

    document.getElementById('btn-copy-invite')?.addEventListener('click', () => this._copyInviteLink());
    document.getElementById('btn-lobby-copy')?.addEventListener('click', () => this._copyInviteLink());
    document.getElementById('btn-test-tab')?.addEventListener('click', () => this._openTestPlayerTab());
    document.getElementById('btn-lobby-builder')?.addEventListener('click', () => {
      this.packBuilder.open(this.engine?.pack || null);
    });

    // Зум картинки
    document.getElementById('btn-zoom-q-img')?.addEventListener('click', () => {
      const src = this.view?.questionView?.image;
      if (src) {
        this.zoomedImageUrl = src;
        this.render();
      }
    });
    document.getElementById('btn-zoom-ans-img')?.addEventListener('click', () => {
      const src = this.view?.questionView?.answerImage;
      if (src) {
        this.zoomedImageUrl = src;
        this.render();
      }
    });
    document.getElementById('lightbox-close')?.addEventListener('click', () => {
      this.zoomedImageUrl = null;
      this.render();
    });

    // Кнопки управления звуком в музыкальном вопросе
    document.getElementById('btn-toggle-q-audio')?.addEventListener('click', () => this._toggleQuestionAudio());
    document.getElementById('btn-replay-q-audio')?.addEventListener('click', () => this._replayQuestionAudio());
    document.getElementById('inp-q-audio-vol')?.addEventListener('input', (e) => {
      this.qAudioVolume = Math.max(0.05, Math.min(1, Number(e.target.value) || 0.85));
      this.qAudio.volume = this.qAudioVolume;
    });

    // Настройки лобби
    document.getElementById('sel-lobby-pack')?.addEventListener('change', async (e) => {
      const val = e.target.value;
      if (val === '__custom__' && this.customUploadedPack) {
        this.engine?.setPack(this.customUploadedPack);
        return;
      }
      const meta = this.repoPacks.find((p) => p.id === val);
      if (meta && this.engine) {
        this.customUploadedPack = null;
        this.selectedPackMeta = meta;
        const json = await this._fetchPackJson(meta);
        if (json) this.engine.setPack(json);
      }
    });

    document.getElementById('set-np-mode')?.addEventListener('change', (e) => {
      this.engine?.updateSettings({ nothingPersonalMode: e.target.value });
    });
    document.getElementById('set-price-scale')?.addEventListener('change', (e) => {
      this.engine?.updateSettings({ priceScaleMode: e.target.value });
    });
    document.getElementById('set-hints-mode')?.addEventListener('change', (e) => {
      this.engine?.updateSettings({ hintsMode: e.target.value });
    });
    document.getElementById('set-buzz-mode')?.addEventListener('change', (e) => {
      this.engine?.updateSettings({ buzzMode: e.target.value });
    });
    document.getElementById('set-penalty')?.addEventListener('change', (e) => {
      this.engine?.updateSettings({ wrongPenalty: e.target.value });
    });
    document.getElementById('set-buzz-sec')?.addEventListener('change', (e) => {
      this.engine?.updateSettings({ buzzTimeSec: Math.max(5, Number(e.target.value) || 30) });
    });
    document.getElementById('set-ans-sec')?.addEventListener('change', (e) => {
      this.engine?.updateSettings({ answerTimeSec: Math.max(5, Number(e.target.value) || 30) });
    });

    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.engine?.startGame();
    });

    document.querySelectorAll('[data-shoot-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.role === 'host') this.engine?.shootCategory('__host__', Number(btn.dataset.shootTheme));
      });
    });
    document.getElementById('btn-undo-category-shot')?.addEventListener('click', () => {
      this.engine?.undoLastCategoryShot('__host__');
    });
    document.getElementById('btn-confirm-categories')?.addEventListener('click', () => {
      this.engine?.confirmCategorySelection('__host__');
    });

    // Выбор ячейки на табло
    document.querySelectorAll('[data-cell]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tIdx, qIdx] = btn.dataset.cell.split(':').map(Number);
        if (this.role === 'host') {
          this.engine?.selectCell('__host__', tIdx, qIdx);
        } else if (this.role === 'player') {
          this.playerNet?.send({ action: 'SELECT_CELL', themeIndex: tIdx, qIndex: qIdx });
        }
      });
    });

    document.getElementById('btn-skip-round')?.addEventListener('click', () => {
      if (confirm('Завершить текущий раунд и перейти дальше?')) {
        this.engine?.advanceRoundOrFinal();
      }
    });

    // Модификатор «Ничего личного»
    document.querySelectorAll('[data-np-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.npTarget;
        if (this.role === 'host') {
          this.engine?.resolveNothingPersonal('__host__', targetId);
        } else {
          this.playerNet?.send({ action: 'RESOLVE_NOTHING_PERSONAL', targetId });
        }
      });
    });

    // Кот в мешке
    document.querySelectorAll('[data-cat-cost]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.drafts.catChoiceCost = Number(btn.dataset.catCost);
        this.render();
      });
    });

    document.querySelectorAll('[data-cat-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.catTarget === '__demo__' ? null : btn.dataset.catTarget;
        const cost = this.drafts.catChoiceCost || this.view?.catState?.chosenCost;
        this.drafts.catChoiceCost = null;
        if (this.role === 'host') {
          this.engine?.assignCatTarget('__host__', targetId, cost);
        } else {
          this.playerNet?.send({ action: 'ASSIGN_CAT', targetId, cost });
        }
      });
    });

    // Аукцион
    const aucInp = document.getElementById('inp-auc-bid');
    aucInp?.addEventListener('input', () => {
      this.drafts.auctionBid = aucInp.value;
    });

    const sendAuc = (type, amount = null) => {
      this.drafts.auctionBid = '';
      if (this.role === 'host') {
        this.engine?.handleAuctionAction('__host__', { type, amount });
      } else {
        this.playerNet?.send({ action: 'AUCTION_ACTION', type, amount });
      }
    };

    document.getElementById('btn-auc-auto-open')?.addEventListener('click', () => sendAuc('bid', this.view?.auctionState?.nominalCost));
    document.getElementById('btn-auc-bid')?.addEventListener('click', () => sendAuc('bid', Number(aucInp?.value)));
    document.getElementById('btn-auc-allin')?.addEventListener('click', () => sendAuc('all_in'));
    document.getElementById('btn-auc-pass')?.addEventListener('click', () => sendAuc('pass'));

    document.getElementById('btn-force-auc-go')?.addEventListener('click', () => {
      const pid = document.getElementById('sel-force-auc-player')?.value;
      const stake = Number(document.getElementById('inp-force-auc-stake')?.value);
      if (pid) this.engine?.hostForceAuction(pid, stake);
    });

    // Протирание экрана при пакости «🧽 Грязь в экран»
    document.getElementById('btn-wipe-mud')?.addEventListener('click', () => {
      sound.init();
      sound.playWipeSqueak();
      this.localWipesDone += 1;
      this.render();
    });

    // Кнопка ответа игрока (с учётом «🤡 Убегающей кнопки»!)
    const buzzerBtn = document.getElementById('btn-big-buzzer');
    if (buzzerBtn) {
      let triggered = false;
      const fireBuzz = (e) => {
        e.preventDefault();
        if (triggered) return;
        triggered = true;
        this._handlePlayerBuzzAttempt();
        setTimeout(() => { triggered = false; }, 180);
      };
      buzzerBtn.addEventListener('pointerdown', fireBuzz);
      buzzerBtn.addEventListener('click', fireBuzz);
    }

    const pAnsInp = document.getElementById('inp-player-answer');
    pAnsInp?.addEventListener('input', () => {
      this.drafts.answerText = pAnsInp.value;
    });

    document.getElementById('form-player-answer')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.drafts.answerText.trim()) return;
      this.playerNet?.send({ action: 'SUBMIT_ANSWER_TEXT', text: this.drafts.answerText.trim() });
    });
    document.getElementById('btn-player-answer-done')?.addEventListener('click', () => {
      this.playerNet?.send({ action: 'ANSWER_DONE' });
    });

    // Кнопки подсказок игроков
    document.querySelectorAll('[data-use-hint]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hintKind = btn.dataset.useHint;
        if (!hintKind) return;
        sound.init();
        if (this.role === 'player') {
          this.playerNet?.send({ action: 'USE_HINT', hintKind });
        }
      });
    });

    // Кнопки Ведущего
    document.getElementById('btn-host-unlock')?.addEventListener('click', () => this.engine?.unlockBuzzing());
    document.getElementById('btn-host-public-hint')?.addEventListener('click', () => this.engine?.revealPublicHint());
    document.getElementById('btn-judge-yes')?.addEventListener('click', () => this.engine?.judgeCurrentAnswer(true));
    document.getElementById('btn-judge-no')?.addEventListener('click', () => this.engine?.judgeCurrentAnswer(false));
    document.getElementById('btn-pause-timer')?.addEventListener('click', () => this.engine?.togglePauseTimer());
    document.getElementById('btn-skip-question')?.addEventListener('click', () => this.engine?.skipOrRevealQuestion());
    document.getElementById('btn-back-to-board')?.addEventListener('click', () => this.engine?.returnToBoard());

    // Финал
    document.getElementById('btn-rescue-final')?.addEventListener('click', () => this.engine?.grantFinalRescueBonus());
    document.getElementById('btn-end-no-final')?.addEventListener('click', () => this.engine?.finishWithoutFinal());

    document.querySelectorAll('[data-strike-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.strikeTheme);
        if (this.role === 'host') {
          this.engine?.eliminateFinalTheme('__host__', idx);
        } else {
          this.playerNet?.send({ action: 'ELIMINATE_FINAL_THEME', themeIndex: idx });
        }
      });
    });

    document.querySelectorAll('[data-qbet]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.drafts.finalBet = btn.dataset.qbet;
        this.render();
      });
    });

    const finBetInp = document.getElementById('inp-final-bet');
    finBetInp?.addEventListener('input', () => {
      this.drafts.finalBet = finBetInp.value;
    });

    document.getElementById('btn-submit-final-bet')?.addEventListener('click', () => {
      const val = Number(finBetInp?.value || this.drafts.finalBet || 1);
      this.playerNet?.send({ action: 'SUBMIT_FINAL_BET', amount: val });
    });

    document.getElementById('btn-host-force-final-q')?.addEventListener('click', () => {
      this.engine?.hostForceStartFinalQuestion();
    });

    const finAnsInp = document.getElementById('inp-final-answer');
    finAnsInp?.addEventListener('input', () => {
      this.drafts.finalAnswer = finAnsInp.value;
      this.playerNet?.send({ action: 'FINAL_DRAFT', text: finAnsInp.value });
    });

    document.getElementById('form-final-answer')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.playerNet?.send({ action: 'SUBMIT_ANSWER_TEXT', text: this.drafts.finalAnswer });
    });

    document.getElementById('btn-host-force-reveal')?.addEventListener('click', () => {
      this.engine?.hostForceFinalReveal();
    });

    document.getElementById('btn-reveal-fin-ans')?.addEventListener('click', () => {
      this.engine?.revealNextFinalistAnswer();
    });
    document.getElementById('btn-fin-judge-yes')?.addEventListener('click', () => {
      this.engine?.judgeFinalist(true);
    });
    document.getElementById('btn-fin-judge-no')?.addEventListener('click', () => {
      this.engine?.judgeFinalist(false);
    });
    document.getElementById('btn-show-podium')?.addEventListener('click', () => {
      this.engine?.finishGameToPodium();
    });
    document.getElementById('btn-play-again-lobby')?.addEventListener('click', () => {
      this.engine?.resetToLobby();
    });

    // Пульт ведущего
    document.getElementById('btn-host-tools')?.addEventListener('click', () => {
      this.hostModalOpen = true;
      this.render();
    });
    document.getElementById('btn-close-host-tools')?.addEventListener('click', () => {
      this.hostModalOpen = false;
      this.render();
    });
    document.getElementById('host-tools-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'host-tools-backdrop') {
        this.hostModalOpen = false;
        this.render();
      }
    });

    document.querySelectorAll('[data-adj-score]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [pid, deltaStr] = btn.dataset.adjScore.split(':');
        this.engine?.adjustScore(pid, Number(deltaStr), false);
      });
    });

    document.querySelectorAll('[data-zero-player]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engine?.adjustScore(btn.dataset.zeroPlayer, 0, true);
      });
    });

    document.querySelectorAll('[data-exact-score]').forEach((inp) => {
      inp.addEventListener('change', () => {
        this.engine?.adjustScore(inp.dataset.exactScore, Number(inp.value), true);
      });
    });

    document.querySelectorAll('[data-set-chooser]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engine?.setChooser(btn.dataset.setChooser);
      });
    });

    document.querySelectorAll('[data-kick-player]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm('Удалить игрока из комнаты?')) {
          this.engine?.removePlayer(btn.dataset.kickPlayer);
        }
      });
    });

    document.getElementById('btn-ht-return-board')?.addEventListener('click', () => {
      this.hostModalOpen = false;
      this.engine?.returnToBoard();
    });
    document.getElementById('btn-ht-next-round')?.addEventListener('click', () => {
      this.hostModalOpen = false;
      this.engine?.advanceRoundOrFinal();
    });
    document.getElementById('btn-ht-reset-lobby')?.addEventListener('click', () => {
      if (confirm('Сбросить текущую партию и вернуть всех игроков в лобби?')) {
        this.hostModalOpen = false;
        this.engine?.resetToLobby();
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__svoyaIgraApp = new SvoyaIgraApp();
});
