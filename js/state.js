// Авторитетный игровой движок «Своей игры» (работает на стороне Ведущего)

export const AVATARS = [
  './packs/media/avatars/animal-cat.jpg',
  './packs/media/avatars/animal-fox.jpg',
  './packs/media/avatars/animal-hyena.jpg',
  './packs/media/avatars/animal-gorilla.jpg',
  './packs/media/avatars/animal-eagle.jpg',
  './packs/media/avatars/animal-monkey.jpg',
  './packs/media/avatars/animal-goat.jpg',
  './packs/media/avatars/animal-pig.jpg',
  './packs/media/avatars/animal-elephant.jpg',
  './packs/media/avatars/animal-rabbit.jpg',
  './packs/media/avatars/animal-penguin.jpg',
  './packs/media/avatars/animal-shark.jpg'
];
export const COLORS = ['#f5c451', '#ef4444', '#22c55e', '#ea580c', '#ec4899', '#a855f7', '#eab308', '#84cc16'];
export const SCORE_ZERO_VFX_DURATION_MS = 1620;
export const FRAME_STYLES = [
  { id: 'classic', label: 'Классика', icon: '◉' },
  { id: 'banknote', label: 'Купюры', icon: '₽' },
  { id: 'neon', label: 'Неон', icon: 'ϟ' },
  { id: 'gold', label: 'Золото', icon: '✦' },
  { id: 'fire', label: 'Огонь', icon: '🔥' },
  { id: 'ice', label: 'Лёд', icon: '❄' },
  { id: 'galaxy', label: 'Космос', icon: '✧' }
];

// Базовый шаг цены вопроса по уровням (Уровень 1 = от 100, Уровень 2 = от 500, Уровень 3 = от 1000)
export function getComebackBaseUnit(roundIndex) {
  if (roundIndex <= 0) return 100;
  if (roundIndex === 1) return 500;
  return 1000 * Math.pow(2, roundIndex - 2);
}

// Каталог весёлых пакостных модификаторов для игры с друзьями
export const MODIFIER_CATALOG = {
  nothing_personal: {
    id: 'nothing_personal',
    icon: '🕶️',
    badge: '🕶️ НИЧЕГО ЛИЧНОГО',
    shortName: 'Ничего личного (обнуление в 0)',
    title: 'Кому обнуляем все баллы в НОЛЬ?',
    desc: 'Выбирающий может превратить весь текущий счёт любого соперника в 0 ещё до показа вопроса!',
    cta: '💥 Обнулить в 0!',
    allowSelf: false,
    tone: 'crimson'
  },
  mute_player: {
    id: 'mute_player',
    icon: '🤐',
    badge: '🤐 КЛЯП НА РОТ',
    shortName: 'Кляп (блок кнопки сопернику)',
    title: 'Кому заклеим рот на этот вопрос?',
    desc: 'Выбранный соперник лишается кнопки ответа на весь текущий вопрос — главный знаток посидит в тишине!',
    cta: '🤐 Заблокировать кнопку!',
    allowSelf: false,
    tone: 'violet'
  },
  upside_down: {
    id: 'upside_down',
    icon: '🙃',
    badge: '🙃 ВВЕРХ ДНОМ',
    shortName: 'Вверх дном (переворот экрана на 180°)',
    title: 'Кому перевернём экран вверх тормашками?',
    desc: 'У выбранного игрока всё окно вопроса — и текст, и мем/кадр — перевернётся на 180° вверх ногами!',
    cta: '🙃 Перевернуть экран!',
    allowSelf: false,
    tone: 'amber'
  },
  mud_screen: {
    id: 'mud_screen',
    icon: '🧽',
    badge: '🧽 ГРЯЗЬ В ЭКРАН',
    shortName: 'Грязь в экран (нужно оттирать 8 раз)',
    title: 'Кому заляпаем экран грязью?',
    desc: 'Вопрос и картинка у жертвы замажутся густой кляксой — придётся 8 раз быстро тереть экран, теряя секунды!',
    cta: '🧽 Заляпать экран!',
    allowSelf: false,
    tone: 'emerald'
  },
  runaway_buzzer: {
    id: 'runaway_buzzer',
    icon: '🤡',
    badge: '🤡 УБЕГАЮЩАЯ КНОПКА',
    shortName: 'Убегающая кнопка (уворачивается 3 раза)',
    title: 'Чья кнопка ответа сойдёт с ума?',
    desc: 'У жертвы красная кнопка «ОТВЕТИТЬ» первые 3 нажатия будет с хохотом упрыгивать из-под пальца!',
    cta: '🤡 Подменить кнопку!',
    allowSelf: false,
    tone: 'pink'
  },
  score_steal: {
    id: 'score_steal',
    icon: '🧛',
    badge: '🧛 ГРАБЁЖ (ВАМПИР 25%)',
    shortName: 'Грабёж (кража 25% очков у соперника)',
    title: 'У кого откусим 25% баллов себе в карман?',
    desc: 'Выбирающий забирает себе четверть очков богатого соперника (или 200 баллов штрафа, если тот на нуле)!',
    cta: '🧛 Украсть очки!',
    allowSelf: false,
    tone: 'crimson'
  },
  cursed_mark: {
    id: 'cursed_mark',
    icon: '💣',
    badge: '💣 ЧЁРНАЯ МЕТКА (×2 / −2×)',
    shortName: 'Чёрная метка (×2 за ответ / −2× за ошибку)',
    title: 'Кому вручаем «Чёрную метку» двойных ставок?',
    desc: 'Для помеченного игрока этот вопрос приносит ДВОЙНЫЕ очки (+2×), но за ошибку бьёт ДВОЙНЫМ штрафом (−2×)! Можно повесить на врага или рискнуть самому!',
    cta: '💣 Повесить метку ×2!',
    allowSelf: true,
    tone: 'amber'
  }
};

export const MODIFIER_IDS = Object.keys(MODIFIER_CATALOG);

export class GameEngine {
  constructor({ roomCode, onChange, onSound }) {
    this.roomCode = roomCode;
    this.onChange = onChange || (() => {});
    this.onSound = onSound || (() => {});

    this.pack = null;
    // Увеличенные комфортные таймеры и шкала камбэка (100 -> 500 -> 1000) по умолчанию!
    this.settings = {
      buzzMode: 'immediate',        // 'immediate' | 'auto_delay' | 'host_manual'
      buzzTimeSec: 30,              // 30 секунд подумать и нажать кнопку
      answerTimeSec: 30,            // 30 секунд спокойно сформулировать ответ
      finalTimeSec: 60,             // 60 секунд в Финале
      wrongPenalty: 'full',         // 'full' | 'half' | 'none'
      priceScaleMode: 'comeback',   // 'comeback' (Ур.1 от 100, Ур.2 от 500, Ур.3 от 1000) | 'pack'
      nothingPersonalMode: 'party', // 'party' (микс всех 7 пакостей!) | 'chaos' | 'pack_only' | '0'
      hintsMode: 'standard',        // 'standard' (по 3 игроку + ведущий) | 'generous' (по 6) | 'host_only' | 'off'
      falseStartLockSec: 3
    };

    this.state = this._createInitialState();
    this.pendingZeroOutTimer = null;
    this._tickInterval = setInterval(() => this._onTick(), 200);
    this._lastTickSecondBeep = null;
  }

  _createInitialState() {
    return {
      roomCode: this.roomCode,
      // Фазы: lobby | category_select | board | nothing_personal | cat_select | auction | question | final_no_players | final_themes | final_bets | final_question | final_reveal | podium
      phase: 'lobby',
      roundIndex: 0,
      categorySelection: null,
      lastCategoryStarterId: null,
      selectedThemeIndexesByRound: [],
      playedCells: [],
      runtimeModifiers: [], // [roundIdx][themeIdx][qIdx] = null | 'nothing_personal'
      players: [],
      spectatorsCount: 0,
      chooserId: null,

      activeCell: null,    // { roundIndex, themeIndex, qIndex, themeName, nominalCost, question, modifier }
      modifierState: null, // { kind, actorId }
      activeCurse: null,   // { kind, targetId, targetName, actorId, actorName, wipesRequired, dodgesCount }
      catState: null,
      auctionState: null,
      questionRuntime: null,
      finalState: null,

      timer: {
        kind: null,
        durationMs: 0,
        remainingMs: 0,
        startedAt: 0,
        running: false
      },

      lastZeroedPlayerId: null,
      zeroOutEvent: null,
      pendingZeroOut: null,
      eventBanner: null,
      soundSeq: 0,
      lastSound: null
    };
  }

  destroy() {
    clearInterval(this._tickInterval);
    clearTimeout(this.pendingZeroOutTimer);
  }

  _schedulePendingZeroOut(seq, delayMs) {
    clearTimeout(this.pendingZeroOutTimer);
    this.pendingZeroOutTimer = setTimeout(() => {
      this.pendingZeroOutTimer = null;
      this._finishPendingZeroOut(seq);
    }, Math.max(0, delayMs));
  }

  resumePendingZeroOut() {
    const pending = this.state.pendingZeroOut;
    if (pending) this._schedulePendingZeroOut(pending.seq, Number(pending.finishAt) - Date.now());
  }

  _finishPendingZeroOut(seq) {
    const pending = this.state.pendingZeroOut;
    if (!pending || pending.seq !== seq) return;
    const victim = this.state.players.find((player) => player.id === pending.targetId);
    const actor = this.state.players.find((player) => player.id === pending.actorId);
    if (victim) {
      victim.score = 0;
      victim.stats.wasZeroed = (victim.stats.wasZeroed || 0) + 1;
      this.state.lastZeroedPlayerId = victim.id;
      if (actor) actor.stats.zeroedOthers = (actor.stats.zeroedOthers || 0) + 1;
    }
    this.state.pendingZeroOut = null;
    this.state.modifierState = null;
    this._banner(`🕶️ Ничего личного! ${pending.actorName} обнулил счёт ${pending.targetName} (было ${pending.oldScore} → 0)!`, 'red');
    this._sound('effectApplied');
    this._proceedToCellQuestion(true);
  }

  setPack(packData) {
    this.pack = this._normalizePack(packData);
    this._rebuildCellsAndModifiers();
    this._emit();
  }

  _getEffectiveCellCost(roundIndex, qIndex, rawCost) {
    if (this.settings.priceScaleMode === 'comeback') {
      return (qIndex + 1) * getComebackBaseUnit(roundIndex);
    }
    return Number(rawCost) || (qIndex + 1) * getComebackBaseUnit(roundIndex);
  }

  _rebuildCellsAndModifiers() {
    if (!this.pack) return;
    this.state.playedCells = this.pack.rounds.map((r) =>
      r.themes.map((t) => t.questions.map(() => false))
    );

    const mode = this.settings.nothingPersonalMode;
    const pool = ['nothing_personal', 'mute_player', 'upside_down', 'mud_screen', 'runaway_buzzer', 'score_steal', 'cursed_mark'];

    this.state.runtimeModifiers = this.pack.rounds.map((r) => {
      const grid = r.themes.map((t) =>
        t.questions.map((q) => (mode === '0' ? null : q.modifier || null))
      );

      if (mode === '0' || mode === 'pack_only') return grid;

      let existingCount = 0;
      const candidates = [];
      r.themes.forEach((t, tIdx) => {
        t.questions.forEach((q, qIdx) => {
          if (grid[tIdx][qIdx]) {
            existingCount += 1;
          } else if (q.type === 'normal') {
            candidates.push([tIdx, qIdx]);
          }
        });
      });

      let targetTotal = 5;
      if (mode === 'chaos') targetTotal = 9;
      else if (mode === '2') targetTotal = 2;
      else if (mode === '4') targetTotal = 4;
      else if (mode === 'auto' || mode === 'party') targetTotal = 5;

      const targetExtra = Math.max(0, targetTotal - existingCount);

      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      // Равномерно чередуем все 7 типов весёлых пакостей
      const offset = Math.floor(Math.random() * pool.length);
      for (let k = 0; k < Math.min(targetExtra, candidates.length); k++) {
        const [ti, qi] = candidates[k];
        grid[ti][qi] = pool[(offset + k) % pool.length];
      }

      return grid;
    });
  }

  _normalizePack(raw) {
    if (!raw || !Array.isArray(raw.rounds) || raw.rounds.length === 0) {
      throw new Error('В пакете должен быть хотя бы один раунд (поле rounds).');
    }
    const rounds = raw.rounds.map((r, rIdx) => ({
      name: r.name || `Раунд ${rIdx + 1}`,
      themes: (r.themes || []).map((t, tIdx) => ({
        name: t.name || `Тема ${tIdx + 1}`,
        questions: (t.questions || []).map((q, qIdx) => ({
          cost: Number(q.cost) || (qIdx + 1) * getComebackBaseUnit(rIdx),
          type: ['normal', 'cat', 'auction', 'noRisk'].includes(q.type) ? q.type : 'normal',
          modifier: MODIFIER_IDS.includes(q.modifier) ? q.modifier : null,
          catTheme: q.catTheme || '',
          catCost: q.catCost !== undefined ? q.catCost : null,
          text: String(q.text || ''),
          image: q.image || '',
          audio: q.audio || '',
          audioType: String(q.audioType || ''),
          audioStartSeconds: Number(q.audioStartSeconds) || 0,
          audioClipSeconds: Number(q.audioClipSeconds) || 0,
          audioCredit: String(q.audioCredit || ''),
          audioCreditUrl: q.audioCreditUrl || '',
          audioLicense: String(q.audioLicense || ''),
          video: q.video || '',
          videoEmbedUrl: q.videoEmbedUrl || '',
          videoSourceUrl: q.videoSourceUrl || '',
          videoCredit: String(q.videoCredit || ''),
          answerVideo: q.answerVideo || '',
          hint: String(q.hint || ''),
          answer: String(q.answer || ''),
          answerImage: q.answerImage || '',
          comment: q.comment || ''
        }))
      }))
    }));

    let final = null;
    const rawFinal = raw.final || raw.finalRound;
    if (rawFinal && Array.isArray(rawFinal.themes) && rawFinal.themes.length > 0) {
      final = {
        name: rawFinal.name || 'Финальный раунд',
        themes: rawFinal.themes.map((ft, idx) => ({
          name: ft.name || `Финальная тема ${idx + 1}`,
          text: String(ft.text || ''),
          image: ft.image || '',
          audio: ft.audio || '',
          video: ft.video || '',
          hint: String(ft.hint || ''),
          answer: String(ft.answer || ''),
          comment: ft.comment || ''
        }))
      };
    }

    return {
      id: raw.id || 'custom-pack',
      title: raw.title || 'Пользовательский пакет',
      author: raw.author || 'Автор не указан',
      difficulty: raw.difficulty || 'Средняя',
      description: raw.description || '',
      rounds,
      final
    };
  }

  _makeInitialHints() {
    const mode = this.settings.hintsMode;
    if (mode === 'generous') return { clue: 2, letters: 2, shield: 2 };
    if (mode === 'standard') return { clue: 1, letters: 1, shield: 1 };
    return { clue: 0, letters: 0, shield: 0 };
  }

  updateSettings(partial) {
    const prevNP = this.settings.nothingPersonalMode;
    const prevHints = this.settings.hintsMode;
    this.settings = { ...this.settings, ...partial };
    if (partial.nothingPersonalMode !== undefined && partial.nothingPersonalMode !== prevNP && this.state.phase === 'lobby') {
      this._rebuildCellsAndModifiers();
    }
    if (partial.hintsMode !== undefined && partial.hintsMode !== prevHints && this.state.phase === 'lobby') {
      for (const p of this.state.players) {
        p.hints = this._makeInitialHints();
      }
    }
    this._emit();
  }

  // --- Управление игроками ---

  handlePlayerJoin(playerId, { name, avatar, color, frame, isSpectator }) {
    if (isSpectator) {
      this._emit();
      return;
    }
    const cleanName = String(name || 'Игрок').trim().slice(0, 22) || 'Игрок';
    let existing = this.state.players.find((p) => p.id === playerId);
    if (existing) {
      existing.online = true;
      if (this.state.phase === 'lobby') {
        existing.name = cleanName;
        if (avatar) existing.avatar = avatar;
        if (color) existing.color = color;
        if (FRAME_STYLES.some((style) => style.id === frame)) existing.frame = frame;
      }
    } else {
      const idx = this.state.players.length;
      existing = {
        id: playerId,
        name: cleanName,
        avatar: avatar || AVATARS[idx % AVATARS.length],
        color: color || COLORS[idx % COLORS.length],
        frame: FRAME_STYLES.some((style) => style.id === frame) ? frame : 'classic',
        score: 0,
        online: true,
        hints: this._makeInitialHints(),
        stats: {
          correct: 0,
          wrong: 0,
          buzzWins: 0,
          fastestReactionMs: null,
          catsPlayed: 0,
          auctionsWon: 0,
          zeroedOthers: 0,
          sabotagedCount: 0,
          wasZeroed: 0,
          hintsUsed: 0
        }
      };
      this.state.players.push(existing);
    }

    if (!this.state.chooserId && this.state.players.length > 0) {
      this.state.chooserId = this.state.players[0].id;
    }
    // Include a real player who joins while category selection is already open.
    // Keep the current starter stable for this round; late joiners queue behind them.
    if (this.state.phase === 'category_select' && this.state.categorySelection) {
      const cs = this.state.categorySelection;
      cs.turnPlayerIds ||= ['__host__'];
      if (!cs.turnPlayerIds.includes(playerId)) {
        const hostIndex = cs.turnPlayerIds.indexOf('__host__');
        cs.turnPlayerIds.splice(hostIndex < 0 ? cs.turnPlayerIds.length : hostIndex, 0, playerId);
      }
    }
    this._emit();
  }

  setPlayerOnline(playerId, online) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (p && p.online !== online) {
      p.online = online;
      this._emit();
    }
  }

  removePlayer(playerId) {
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
    if (this.state.chooserId === playerId) {
      this.state.chooserId = this.state.players[0]?.id || null;
    }
    this._emit();
  }

  adjustScore(playerId, value, exact = false) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p) return;
    const num = Number(value) || 0;
    p.score = exact ? num : p.score + num;
    this._emit();
  }

  setChooser(playerId) {
    if (this.state.players.some((p) => p.id === playerId)) {
      this.state.chooserId = playerId;
      this._emit();
    }
  }

  // --- Старт и ход игры ---

  startGame() {
    if (!this.pack) return;
    this.state.roundIndex = 0;
    this.state.lastCategoryStarterId = null;
    this.state.selectedThemeIndexesByRound = [];
    this._rebuildCellsAndModifiers();

    for (const p of this.state.players) {
      p.score = 0;
      p.hints = this._makeInitialHints();
      p.stats = {
        correct: 0,
        wrong: 0,
        buzzWins: 0,
        fastestReactionMs: null,
        catsPlayed: 0,
        auctionsWon: 0,
        zeroedOthers: 0,
        sabotagedCount: 0,
        wasZeroed: 0,
        hintsUsed: 0
      };
    }
    if (!this.state.chooserId && this.state.players.length > 0) {
      this.state.chooserId = this.state.players[0].id;
    }
    this._beginCategorySelection(0);
    this.state.activeCell = null;
    this.state.modifierState = null;
    this.state.activeCurse = null;
    this.state.catState = null;
    this.state.auctionState = null;
    this.state.questionRuntime = null;
    this.state.finalState = null;
    this.state.lastZeroedPlayerId = null;
    this._stopTimer();
    this._banner(`${this.pack.rounds[0].name}: ведущий выбирает ${Math.min(6, this.pack.rounds[0].themes.length)} категорий`, 'gold');
    this._emit();
  }

  _beginCategorySelection(roundIndex) {
    const themes = this.pack?.rounds?.[roundIndex]?.themes || [];
    this.state.roundIndex = roundIndex;
    const turnPlayerIds = [...this.state.players.filter((p) => !p.isSpectator).map((p) => p.id), '__host__'];
    let starterPlayerId = null;
    if (this.state.lastCategoryStarterId && turnPlayerIds.length > 0) {
      const previousIndex = turnPlayerIds.indexOf(this.state.lastCategoryStarterId);
      starterPlayerId = turnPlayerIds[(previousIndex >= 0 ? previousIndex + 1 : roundIndex) % turnPlayerIds.length];
    }
    this.state.categorySelection = {
      roundIndex,
      selectedThemeIndexes: [],
      requiredCount: Math.min(6, themes.length),
      lastShotThemeIndex: null,
      shotSeq: 0,
      turnPlayerIds,
      starterPlayerId
    };
    this.state.phase = 'category_select';
  }

  setCategoryStarter(actorId, starterPlayerId) {
    const cs = this.state.categorySelection;
    if (actorId !== '__host__' || this.state.phase !== 'category_select' || !cs) return;
    if (cs.selectedThemeIndexes.length > 0 || !(cs.turnPlayerIds || []).includes(starterPlayerId)) return;
    cs.starterPlayerId = starterPlayerId;
    this._emit();
  }

  shootCategory(actorId, themeIndex) {
    const cs = this.state.categorySelection;
    if (this.state.phase !== 'category_select' || !cs) return;
    const turnIds = cs.turnPlayerIds || [];
    if (!turnIds.length || !cs.starterPlayerId) return;
    const starterIndex = turnIds.indexOf(cs.starterPlayerId);
    if (starterIndex < 0) return;
    const starter = starterIndex;
    const expectedId = turnIds[(starter + cs.selectedThemeIndexes.length) % turnIds.length];
    if (actorId !== expectedId) return;
    const themes = this.pack?.rounds?.[cs.roundIndex]?.themes || [];
    const target = Number(themeIndex);
    if (!Number.isInteger(target) || !themes[target]) return;
    if (cs.selectedThemeIndexes.includes(target) || cs.selectedThemeIndexes.length >= cs.requiredCount) return;
    cs.selectedThemeIndexes.push(target);
    cs.lastShotThemeIndex = target;
    cs.shotSeq += 1;
    this._sound('categoryShot');
    this._emit();
  }

  undoLastCategoryShot(actorId) {
    const cs = this.state.categorySelection;
    if (actorId !== '__host__' || this.state.phase !== 'category_select' || !cs || !cs.selectedThemeIndexes.length) return;
    cs.selectedThemeIndexes.pop();
    cs.lastShotThemeIndex = cs.selectedThemeIndexes.at(-1) ?? null;
    cs.shotSeq += 1;
    this._emit();
  }

  confirmCategorySelection(actorId) {
    const cs = this.state.categorySelection;
    if (actorId !== '__host__' || this.state.phase !== 'category_select' || !cs) return;
    if (cs.selectedThemeIndexes.length !== cs.requiredCount || !cs.starterPlayerId) return;
    this.state.selectedThemeIndexesByRound[cs.roundIndex] = [...cs.selectedThemeIndexes];
    this.state.lastCategoryStarterId = cs.starterPlayerId;
    const roundName = this.pack?.rounds?.[cs.roundIndex]?.name || `Раунд ${cs.roundIndex + 1}`;
    this.state.categorySelection = null;
    this.state.phase = 'board';
    this._banner(`${roundName} — выбрано ${cs.requiredCount} категорий, погнали!`, 'gold');
    this._sound('roundStart');
    this._emit();
  }

  resetToLobby() {
    this._stopTimer();
    this.state.phase = 'lobby';
    this.state.categorySelection = null;
    this.state.lastCategoryStarterId = null;
    this.state.selectedThemeIndexesByRound = [];
    this.state.activeCell = null;
    this.state.modifierState = null;
    this.state.activeCurse = null;
    this.state.catState = null;
    this.state.auctionState = null;
    this.state.questionRuntime = null;
    this.state.finalState = null;
    this._rebuildCellsAndModifiers();
    this._emit();
  }

  selectCell(actorId, themeIndex, qIndex) {
    if (this.state.phase !== 'board' || !this.pack) return;
    if (actorId !== '__host__' && actorId !== this.state.chooserId) return;

    const rIdx = this.state.roundIndex;
    const round = this.pack.rounds[rIdx];
    const theme = round?.themes[themeIndex];
    const question = theme?.questions[qIndex];
    if (!question) return;
    if (this.state.playedCells[rIdx]?.[themeIndex]?.[qIndex]) return;

    const cellModifier = this.state.runtimeModifiers[rIdx]?.[themeIndex]?.[qIndex] || null;
    const effectiveCellCost = this._getEffectiveCellCost(rIdx, qIndex, question.cost);

    this.state.playedCells[rIdx][themeIndex][qIndex] = true;
    this.state.lastZeroedPlayerId = null;
    this.state.activeCurse = null;
    this.state.activeCell = {
      roundIndex: rIdx,
      themeIndex,
      qIndex,
      themeName: theme.name,
      nominalCost: effectiveCellCost,
      question,
      modifier: cellModifier
    };

    // Если на вопросе висит любой пакостный модификатор — сначала разыгрываем выбор жертвы!
    if (cellModifier && MODIFIER_CATALOG[cellModifier]) {
      this._enterModifierPhase(cellModifier);
      return;
    }

    this._proceedToCellQuestion();
  }

  // --- Весёлые пакостные модификаторы («Ничего личного», «Кляп», «Грязь», «Перевёртыш» и др.) ---

  _enterModifierPhase(kind) {
    const meta = MODIFIER_CATALOG[kind] || MODIFIER_CATALOG.nothing_personal;
    this._stopTimer();
    this.state.phase = 'nothing_personal';
    this.state.modifierState = {
      kind: meta.id,
      actorId: this.state.chooserId || this.state.players[0]?.id || null
    };
    this._sound(meta.id === 'nothing_personal' ? 'nothingPersonal' : 'sabotage');
    this._banner(`${meta.badge}! ${meta.title}`, 'purple');
    this._emit();
  }

  resolveModifier(callerId, targetPlayerId) {
    this.resolveNothingPersonal(callerId, targetPlayerId);
  }

  resolveNothingPersonal(callerId, targetPlayerId) {
    if (this.state.phase !== 'nothing_personal' || !this.state.modifierState || this.state.pendingZeroOut) return;
    const { kind, actorId } = this.state.modifierState;
    const meta = MODIFIER_CATALOG[kind] || MODIFIER_CATALOG.nothing_personal;
    if (callerId !== '__host__' && callerId !== actorId) return;

    const actor = this.state.players.find((p) => p.id === actorId);
    const actorName = actor ? actor.name : 'Ведущий';

    if (targetPlayerId && targetPlayerId !== '__spare__') {
      const victim = this.state.players.find((p) => p.id === targetPlayerId);
      if (!victim) return;
      if (!meta.allowSelf && victim.id === actorId && callerId !== '__host__' && this.state.players.length >= 2) {
        return;
      }

      if (actor) actor.stats.sabotagesUsed = (actor.stats.sabotagesUsed || 0) + 1;
      victim.stats.sabotagedCount = (victim.stats.sabotagedCount || 0) + 1;

      if (kind === 'nothing_personal') {
        const oldScore = victim.score;
        const seq = (this.state.zeroOutEvent?.seq || 0) + 1;
        const startedAt = Date.now();
        const finishAt = startedAt + SCORE_ZERO_VFX_DURATION_MS;
        this.state.pendingZeroOut = {
          seq,
          targetId: victim.id,
          actorId: actorId || null,
          actorName,
          targetName: victim.name,
          oldScore,
          finishAt
        };
        this.state.modifierState = { ...this.state.modifierState, resolving: true, targetId: victim.id };
        this.state.zeroOutEvent = { seq, targetId: victim.id, actorId: actorId || null, ts: startedAt, finishAt };
        this._banner(`🕶️ Ничего личного! Снаряд летит к ${victim.name}…`, 'red');
        this._emit();
        this._schedulePendingZeroOut(seq, finishAt - Date.now());
        return;
      } else if (kind === 'score_steal') {
        const minSteal = Math.max(100, Math.round((this.state.activeCell?.nominalCost || 200) * 0.4 / 50) * 50);
        const amount = victim.score > 0
          ? Math.max(minSteal, Math.round((victim.score * 0.25) / 50) * 50)
          : minSteal;
        const actualTaken = victim.score > 0 ? Math.min(victim.score, amount) : amount;
        victim.score -= actualTaken;
        if (actor && actor.id !== victim.id) {
          actor.score += actualTaken;
        }
        this.state.lastZeroedPlayerId = victim.id;
        this._banner(`🧛 Грабёж! ${actorName} утащил ${actualTaken} очков у игрока ${victim.name}!`, 'red');
      } else if (kind === 'mute_player') {
        this.state.activeCurse = {
          kind: 'mute_player',
          targetId: victim.id,
          targetName: victim.name,
          actorId,
          actorName
        };
        this._banner(`🤐 Кляп! ${actorName} отключил кнопку игроку ${victim.name} на этот вопрос!`, 'purple');
      } else if (kind === 'upside_down') {
        this.state.activeCurse = {
          kind: 'upside_down',
          targetId: victim.id,
          targetName: victim.name,
          actorId,
          actorName
        };
        this._banner(`🙃 Вверх дном! У игрока ${victim.name} перевернулся экран на 180°!`, 'gold');
      } else if (kind === 'mud_screen') {
        this.state.activeCurse = {
          kind: 'mud_screen',
          targetId: victim.id,
          targetName: victim.name,
          actorId,
          actorName,
          wipesRequired: 8
        };
        this._banner(`🧽 Грязь в экран! Игроку ${victim.name} придётся оттирать экран 8 раз!`, 'emerald');
      } else if (kind === 'runaway_buzzer') {
        this.state.activeCurse = {
          kind: 'runaway_buzzer',
          targetId: victim.id,
          targetName: victim.name,
          actorId,
          actorName,
          dodgesCount: 3
        };
        this._banner(`🤡 Убегающая кнопка! У игрока ${victim.name} кнопка ответа пустилась в бега!`, 'purple');
      } else if (kind === 'cursed_mark') {
        this.state.activeCurse = {
          kind: 'cursed_mark',
          targetId: victim.id,
          targetName: victim.name,
          actorId,
          actorName
        };
        const whoText = victim.id === actorId ? `рискнул сам` : `повесил Чёрную метку на ${victim.name}`;
        this._banner(`💣 ${actorName} ${whoText}: +2× за верный ответ, −2× за ошибку!`, 'red');
      }

      this.state.modifierState = null;
      this._proceedToCellQuestion(true);
      // Play the user's reaction clip after the target and next question are synced.
      this._sound('effectApplied');
      this._emit();
      return;
    }

    // Пощада!
    this._banner(`😇 ${actorName} пощадил всех — играем вопрос без пакостей!`, 'emerald');
    this.state.modifierState = null;
    this._proceedToCellQuestion(true);
  }

  _proceedToCellQuestion(skipOpenSound = false) {
    if (!this.state.activeCell) return;
    const { question } = this.state.activeCell;
    if (question.type === 'cat') {
      this._enterCatInBag();
    } else if (question.type === 'auction') {
      this._enterAuction();
    } else if (question.type === 'noRisk') {
      this._enterNoRisk(skipOpenSound);
    } else {
      this._enterNormalQuestion(skipOpenSound);
    }
  }

  _enterNormalQuestion(skipOpenSound = false) {
    const { themeName, nominalCost } = this.state.activeCell;
    const mode = this.settings.buzzMode;

    this.state.phase = 'question';
    this.state.catState = null;
    this.state.auctionState = null;

    const initialLocked = [];
    if (this.state.activeCurse?.kind === 'mute_player' && this.state.activeCurse.targetId) {
      initialLocked.push(this.state.activeCurse.targetId);
    }

    const startImmediately = mode === 'immediate';
    this.state.questionRuntime = {
      substate: startImmediately ? 'buzzing' : 'reading',
      specialKind: null,
      effectiveCost: nominalCost,
      displayTheme: themeName,
      buzzOpenedAt: startImmediately ? Date.now() : null,
      pausedBuzzMs: null,
      judgeAvailableAt: 0,
      activeResponderId: null,
      submittedText: null,
      lockedPlayerIds: initialLocked,
      falseStartUntil: {},
      lateBuzzes: [],
      lastJudgment: null,
      publicHintRevealed: false,
      clueUsedBy: [],
      lettersUsedBy: [],
      shieldUsedBy: []
    };

    if (!skipOpenSound) this._sound('cellOpen');
    if (startImmediately) {
      this._startTimer('buzzing', this.settings.buzzTimeSec * 1000);
    } else if (mode === 'auto_delay') {
      const words = this.state.activeCell.question.text.split(/\s+/).length;
      const delayMs = Math.min(6500, Math.max(3000, words * 220));
      this._startTimer('reading', delayMs);
    } else {
      this._stopTimer();
    }
    this._emit();
  }

  unlockBuzzing() {
    if (this.state.phase !== 'question' || !this.state.questionRuntime) return;
    if (this.state.questionRuntime.substate !== 'reading') return;
    this.state.questionRuntime.substate = 'buzzing';
    this.state.questionRuntime.buzzOpenedAt = Date.now();
    this._sound('buzzReady');
    this._startTimer('buzzing', this.settings.buzzTimeSec * 1000);
    this._emit();
  }

  // --- Кот в мешке ---

  _enterCatInBag() {
    const { question, nominalCost, themeName, roundIndex } = this.state.activeCell;
    const round = this.pack.rounds[roundIndex];
    const allCosts = round.themes.flatMap((t) =>
      t.questions.map((q, qIdx) => this._getEffectiveCellCost(roundIndex, qIdx, q.cost))
    );
    const minCost = Math.min(...allCosts, nominalCost);
    const maxCost = Math.max(...allCosts, nominalCost);

    let costOptions = null;
    let fixedCost = nominalCost;
    if (question.catCost === 'choice') {
      costOptions = minCost === maxCost ? [minCost] : [minCost, maxCost];
      fixedCost = costOptions[0];
    } else if (Number(question.catCost) > 0) {
      fixedCost = this.settings.priceScaleMode === 'comeback'
        ? Math.max(minCost, nominalCost)
        : Number(question.catCost);
    }

    this.state.phase = 'cat_select';
    this.state.catState = {
      giverId: this.state.chooserId,
      targetId: null,
      costOptions,
      chosenCost: fixedCost,
      secretTheme: question.catTheme || themeName
    };

    this._stopTimer();
    this._sound('cat');
    this._banner('🐈 КОТ В МЕШКЕ! Выберите, кому подкинуть вопрос', 'purple');
    this._emit();
  }

  assignCatTarget(actorId, targetPlayerId, chosenCost = null) {
    if (this.state.phase !== 'cat_select' || !this.state.catState) return;
    const giverId = this.state.catState.giverId;
    if (actorId !== '__host__' && actorId !== giverId) return;

    const target = this.state.players.find((p) => p.id === targetPlayerId) || this.state.players[0];
    if (!target) {
      this._openSpecialQuestion('cat', null, chosenCost || this.state.catState.chosenCost, this.state.catState.secretTheme);
      return;
    }

    if (this.state.players.length >= 2 && target.id === giverId && actorId !== '__host__') {
      return;
    }

    let finalCost = this.state.catState.chosenCost;
    if (chosenCost && this.state.catState.costOptions?.includes(Number(chosenCost))) {
      finalCost = Number(chosenCost);
    }

    target.stats.catsPlayed += 1;
    this._openSpecialQuestion('cat', target.id, finalCost, this.state.catState.secretTheme);
  }

  // --- Вопрос-аукцион ---

  _enterAuction() {
    const { nominalCost } = this.state.activeCell;
    const eligible = this.state.players.filter((p) => p.score >= nominalCost).map((p) => p.id);

    this.state.phase = 'auction';
    this._stopTimer();
    this._sound('auction');
    this._banner('🔨 ВОПРОС-АУКЦИОН! Делайте ваши ставки', 'gold');

    const orderedIds = this._getOrderedPlayerIdsFrom(this.state.chooserId);
    const orderedEligible = orderedIds.filter((id) => eligible.includes(id));

    if (orderedEligible.length === 0) {
      const fallbackPlayerId = this.state.chooserId || this.state.players[0]?.id || null;
      this.state.auctionState = {
        mode: 'auto_nominal',
        nominalCost,
        currentBid: nominalCost,
        highBidderId: fallbackPlayerId,
        isAllIn: false,
        turnPlayerId: fallbackPlayerId,
        passedIds: [],
        eligibleIds: [],
        history: [{ text: `Ни у кого нет ${nominalCost} очков — играет выбирающий за номинал` }]
      };
    } else if (orderedEligible.length === 1) {
      const soleId = orderedEligible[0];
      this.state.auctionState = {
        mode: 'sole_bidder',
        nominalCost,
        currentBid: nominalCost,
        highBidderId: soleId,
        isAllIn: false,
        turnPlayerId: soleId,
        passedIds: [],
        eligibleIds: orderedEligible,
        history: [{ text: 'Только один игрок имеет достаточно очков — он выбирает ставку' }]
      };
    } else {
      this.state.auctionState = {
        mode: 'bidding',
        nominalCost,
        currentBid: 0,
        highBidderId: null,
        isAllIn: false,
        turnPlayerId: orderedEligible[0],
        passedIds: [],
        eligibleIds: orderedEligible,
        history: []
      };
    }
    this._emit();
  }

  _getOrderedPlayerIdsFrom(startPlayerId) {
    const ids = this.state.players.map((p) => p.id);
    const idx = ids.indexOf(startPlayerId);
    if (idx <= 0) return ids;
    return [...ids.slice(idx), ...ids.slice(0, idx)];
  }

  handleAuctionAction(actorId, { type, amount }) {
    if (this.state.phase !== 'auction' || !this.state.auctionState) return;
    const auc = this.state.auctionState;

    if (auc.mode === 'auto_nominal') {
      if (actorId === '__host__' || actorId === auc.highBidderId) {
        this._openSpecialQuestion('auction', auc.highBidderId, auc.nominalCost, this.state.activeCell.themeName);
      }
      return;
    }

    if (auc.mode === 'sole_bidder') {
      if (actorId !== '__host__' && actorId !== auc.turnPlayerId) return;
      const p = this.state.players.find((x) => x.id === auc.turnPlayerId);
      const maxScore = p ? p.score : auc.nominalCost;
      const stake = type === 'all_in'
        ? maxScore
        : Math.min(maxScore, Math.max(auc.nominalCost, Number(amount) || auc.nominalCost));
      if (p) p.stats.auctionsWon += 1;
      this._openSpecialQuestion('auction', auc.turnPlayerId, stake, this.state.activeCell.themeName);
      return;
    }

    const pid = actorId === '__host__' ? auc.turnPlayerId : actorId;
    if (pid !== auc.turnPlayerId) return;
    const player = this.state.players.find((x) => x.id === pid);
    if (!player) return;

    if (type === 'pass') {
      if (!auc.passedIds.includes(pid)) {
        auc.passedIds.push(pid);
      }
      auc.history.push({ text: `${player.name}: ПАС` });
    } else if (type === 'all_in') {
      if (player.score <= auc.currentBid) return;
      auc.currentBid = player.score;
      auc.highBidderId = pid;
      auc.isAllIn = true;
      auc.history.push({ text: `🔥 ${player.name}: ВА-БАНК (${player.score})!` });
      for (const eid of auc.eligibleIds) {
        if (eid === pid) continue;
        const ep = this.state.players.find((x) => x.id === eid);
        if (!ep || ep.score <= auc.currentBid) {
          if (!auc.passedIds.includes(eid)) auc.passedIds.push(eid);
        }
      }
    } else if (type === 'bid') {
      const minAllowed = auc.currentBid === 0 ? auc.nominalCost : auc.currentBid + 100;
      let bidVal = Number(amount) || minAllowed;
      if (bidVal >= player.score) {
        bidVal = player.score;
        auc.isAllIn = true;
        auc.history.push({ text: `🔥 ${player.name}: ВА-БАНК (${bidVal})!` });
      } else {
        if (bidVal < minAllowed || auc.isAllIn) return;
        auc.history.push({ text: `${player.name}: ${bidVal}` });
      }
      auc.currentBid = bidVal;
      auc.highBidderId = pid;

      for (const eid of auc.eligibleIds) {
        if (eid === pid) continue;
        const ep = this.state.players.find((x) => x.id === eid);
        if (!ep || ep.score <= auc.currentBid) {
          if (!auc.passedIds.includes(eid)) auc.passedIds.push(eid);
        }
      }
    }

    const activeContenders = auc.eligibleIds.filter((id) => !auc.passedIds.includes(id));

    if (activeContenders.length === 0) {
      const winnerId = auc.highBidderId || auc.eligibleIds[0];
      const finalStake = auc.currentBid > 0 ? auc.currentBid : auc.nominalCost;
      const winPlayer = this.state.players.find((x) => x.id === winnerId);
      if (winPlayer) winPlayer.stats.auctionsWon += 1;
      this._openSpecialQuestion('auction', winnerId, finalStake, this.state.activeCell.themeName);
      return;
    }

    if (activeContenders.length === 1 && auc.highBidderId === activeContenders[0]) {
      const winnerId = activeContenders[0];
      const winPlayer = this.state.players.find((x) => x.id === winnerId);
      if (winPlayer) winPlayer.stats.auctionsWon += 1;
      this._openSpecialQuestion('auction', winnerId, auc.currentBid, this.state.activeCell.themeName);
      return;
    }

    if (activeContenders.length === 1 && !auc.highBidderId) {
      const winnerId = activeContenders[0];
      const winPlayer = this.state.players.find((x) => x.id === winnerId);
      if (winPlayer) winPlayer.stats.auctionsWon += 1;
      this._openSpecialQuestion('auction', winnerId, auc.nominalCost, this.state.activeCell.themeName);
      return;
    }

    const curIdx = auc.eligibleIds.indexOf(pid);
    for (let offset = 1; offset <= auc.eligibleIds.length; offset++) {
      const candidate = auc.eligibleIds[(curIdx + offset) % auc.eligibleIds.length];
      if (!auc.passedIds.includes(candidate)) {
        auc.turnPlayerId = candidate;
        break;
      }
    }
    this._sound('tick');
    this._emit();
  }

  hostForceAuction(playerId, stake) {
    if (this.state.phase !== 'auction') return;
    const cleanStake = Math.max(100, Number(stake) || this.state.activeCell.nominalCost);
    const p = this.state.players.find((x) => x.id === playerId);
    if (p) p.stats.auctionsWon += 1;
    this._openSpecialQuestion('auction', playerId, cleanStake, this.state.activeCell.themeName);
  }

  // --- Вопрос без риска ---

  _enterNoRisk(skipOpenSound = false) {
    const { nominalCost, themeName } = this.state.activeCell;
    const targetId = this.state.chooserId || this.state.players[0]?.id || null;
    if (!skipOpenSound) this._banner('🛡️ ВОПРОС БЕЗ РИСКА! При ошибке очки не списываются', 'emerald');
    this._openSpecialQuestion('noRisk', targetId, nominalCost, themeName, skipOpenSound);
  }

  _openSpecialQuestion(specialKind, responderId, cost, displayTheme, skipOpenSound = false) {
    this.state.phase = 'question';
    this.state.catState = null;
    this.state.auctionState = null;
    this.state.questionRuntime = {
      substate: responderId ? 'special_answering' : 'revealed',
      specialKind,
      effectiveCost: cost,
      displayTheme,
      buzzOpenedAt: null,
      pausedBuzzMs: null,
      judgeAvailableAt: responderId ? Date.now() + 1500 : 0,
      activeResponderId: responderId,
      submittedText: null,
      lockedPlayerIds: [],
      falseStartUntil: {},
      lateBuzzes: [],
      lastJudgment: null,
      publicHintRevealed: false,
      clueUsedBy: [],
      lettersUsedBy: [],
      shieldUsedBy: []
    };
    if (!skipOpenSound) this._sound('cellOpen');
    if (responderId) {
      this._startTimer('answering', (this.settings.answerTimeSec + 10) * 1000);
    } else {
      this._stopTimer();
    }
    this._emit();
    if (responderId) this._scheduleJudgeAvailability(this.state.questionRuntime);
  }

  // --- Нажатие кнопки (Buzzer) и ответ ---

  handleBuzz(playerId) {
    if (this.state.phase !== 'question' || !this.state.questionRuntime) return;
    const rt = this.state.questionRuntime;
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    const now = Date.now();

    if (rt.substate === 'reading') {
      rt.falseStartUntil[playerId] = now + this.settings.falseStartLockSec * 1000;
      this._sound('falseStart');
      this._banner(`⚡ Фальстарт: ${player.name} (блокировка ${this.settings.falseStartLockSec} сек)`, 'red');
      this._emit();
      return;
    }

    if (rt.substate === 'answering' && rt.activeResponderId && rt.activeResponderId !== playerId) {
      if (!rt.lockedPlayerIds.includes(playerId) && !rt.lateBuzzes.some((b) => b.playerId === playerId)) {
        const deltaMs = Math.max(10, now - (rt._firstBuzzAt || now));
        if (deltaMs <= 2500) {
          rt.lateBuzzes.push({ playerId, name: player.name, deltaMs });
          this._emit();
        }
      }
      return;
    }

    if (rt.substate !== 'buzzing') return;
    if (rt.lockedPlayerIds.includes(playerId)) return;
    if (rt.falseStartUntil[playerId] && now < rt.falseStartUntil[playerId]) return;

    const reactionMs = rt.buzzOpenedAt ? Math.max(40, now - rt.buzzOpenedAt) : null;
    player.stats.buzzWins += 1;

    rt._firstBuzzAt = now;
    rt.pausedBuzzMs = this._getCurrentRemainingMs();
    rt.judgeAvailableAt = now + 1500;
    rt.substate = 'answering';
    rt.activeResponderId = playerId;
    rt.submittedText = null;
    rt.reactionMs = reactionMs;

    this._sound('buzz');
    this._startTimer('answering', this.settings.answerTimeSec * 1000);
    this._emit();
    this._scheduleJudgeAvailability(rt);
  }

  _scheduleJudgeAvailability(rt) {
    const wait = Math.max(0, (rt?.judgeAvailableAt || 0) - Date.now());
    if (!wait) return;
    setTimeout(() => {
      if (this.state.phase === 'question' && this.state.questionRuntime === rt && rt.judgeAvailableAt <= Date.now()) {
        this._emit();
      }
    }, wait + 20);
  }

  markPlayerAnswerDone(playerId) {
    if (this.state.phase !== 'question' || !this.state.questionRuntime) return;
    const rt = this.state.questionRuntime;
    if (rt.activeResponderId !== playerId || (rt.substate !== 'answering' && rt.substate !== 'special_answering')) return;
    rt.judgeAvailableAt = Date.now() + 1500;
    this._emit();
    this._scheduleJudgeAvailability(rt);
  }

  submitPlayerAnswerText(playerId, text) {
    if (this.state.phase === 'question' && this.state.questionRuntime) {
      const rt = this.state.questionRuntime;
      if (rt.activeResponderId === playerId && (rt.substate === 'answering' || rt.substate === 'special_answering')) {
        rt.submittedText = String(text || '').trim().slice(0, 180);
        if (rt.submittedText) {
          rt.judgeAvailableAt = Date.now() + 1500;
          this._scheduleJudgeAvailability(rt);
        }
        this._emit();
      }
      return;
    }

    if (this.state.phase === 'final_question' && this.state.finalState) {
      const fs = this.state.finalState;
      if (!fs.finalistIds.includes(playerId)) return;
      fs.answers[playerId] = {
        text: String(text || '').trim().slice(0, 180),
        locked: true
      };
      const allLocked = fs.finalistIds.every((id) => fs.answers[id]?.locked);
      if (allLocked) {
        this._enterFinalReveal();
      } else {
        this._emit();
      }
    }
  }

  updateFinalDraft(playerId, text) {
    if (this.state.phase !== 'final_question' || !this.state.finalState) return;
    const fs = this.state.finalState;
    if (!fs.finalistIds.includes(playerId)) return;
    if (fs.answers[playerId]?.locked) return;
    fs.answers[playerId] = {
      text: String(text || '').slice(0, 180),
      locked: false
    };
  }

  judgeCurrentAnswer(isCorrect) {
    if (this.state.phase !== 'question' || !this.state.questionRuntime) return;
    const rt = this.state.questionRuntime;
    if (rt.substate !== 'answering' && rt.substate !== 'special_answering') return;
    if ((rt.judgeAvailableAt || 0) > Date.now()) return;

    const responder = this.state.players.find((p) => p.id === rt.activeResponderId);
    const hasCursedMark = Boolean(
      responder &&
      this.state.activeCurse?.kind === 'cursed_mark' &&
      this.state.activeCurse.targetId === responder.id
    );
    const mult = hasCursedMark ? 2 : 1;
    const cost = rt.effectiveCost * mult;

    if (isCorrect) {
      if (responder) {
        responder.score += cost;
        responder.stats.correct += 1;
        if (rt.reactionMs !== null && rt.reactionMs !== undefined && (responder.stats.fastestReactionMs === null || rt.reactionMs < responder.stats.fastestReactionMs)) {
          responder.stats.fastestReactionMs = rt.reactionMs;
        }
        this.state.chooserId = responder.id;
      }
      rt.lastJudgment = {
        playerId: responder?.id || null,
        name: responder?.name || 'Игрок',
        correct: true,
        delta: cost
      };
      rt.substate = 'revealed';
      this._stopTimer();
      this._sound('correct');
      this._emit();
      return;
    }

    const hasShield = Boolean(responder && rt.shieldUsedBy?.includes(responder.id));
    let penalty = 0;
    if (hasShield) {
      penalty = 0;
    } else if (rt.specialKind === 'cat' || rt.specialKind === 'auction') {
      penalty = -cost;
    } else if (rt.specialKind === 'noRisk' && !hasCursedMark) {
      penalty = 0;
    } else {
      if (this.settings.wrongPenalty === 'full' || hasCursedMark) penalty = -cost;
      else if (this.settings.wrongPenalty === 'half') penalty = -Math.round(cost / 2);
      else penalty = 0;
    }

    if (responder) {
      responder.score += penalty;
      responder.stats.wrong += 1;
      if (!rt.lockedPlayerIds.includes(responder.id)) {
        rt.lockedPlayerIds.push(responder.id);
      }
      if (hasShield) {
        this._banner(`🛡️ Страховка спасла ${responder.name} от минуса!`, 'gold');
      }
    }

    rt.lastJudgment = {
      playerId: responder?.id || null,
      name: responder?.name || 'Игрок',
      correct: false,
      delta: penalty,
      shieldSaved: hasShield
    };

    this._sound('wrong');

    if (rt.specialKind) {
      rt.substate = 'revealed';
      this._stopTimer();
      this._emit();
      return;
    }

    const remainingPlayers = this.state.players.filter((p) => !rt.lockedPlayerIds.includes(p.id));
    if (remainingPlayers.length === 0) {
      rt.activeResponderId = null;
      rt.substate = 'revealed';
      this._stopTimer();
      this._emit();
      return;
    }

    rt.activeResponderId = null;
    rt.submittedText = null;
    rt.lateBuzzes = [];
    rt.substate = 'buzzing';
    rt.buzzOpenedAt = Date.now();
    const resumeMs = Math.max(8000, rt.pausedBuzzMs || this.settings.buzzTimeSec * 1000);
    this._startTimer('buzzing', resumeMs);
    this._emit();
  }

  skipOrRevealQuestion() {
    if (this.state.phase !== 'question' || !this.state.questionRuntime) return;
    this.state.questionRuntime.substate = 'revealed';
    this.state.questionRuntime.activeResponderId = null;
    this._stopTimer();
    this._sound('timeUp');
    this._emit();
  }

  // --- Система подсказок (💡 Наводка, 🔤 Первые буквы, 🛡️ Страховка, Общая подсказка ведущего) ---

  _resolveHintText(q, themeName = '') {
    if (!q) return '';
    if (q.hint && String(q.hint).trim()) {
      return String(q.hint).trim();
    }
    const rawAns = String(q.answer || '').split(' / ')[0].replace(/\([^)]*\)/g, '').trim();
    if (q.comment && String(q.comment).trim()) {
      let masked = String(q.comment).trim();
      const ansWords = rawAns
        .split(/[\s,—–\-«»"'.!?()]+/)
        .filter((w) => w.length >= 3);
      for (const w of ansWords) {
        const stem = w.length >= 5 ? w.slice(0, Math.ceil(w.length * 0.72)) : w;
        const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        masked = masked.replace(new RegExp(escaped + '[а-яёa-z0-9]*', 'gi'), '•••');
      }
      if (masked && masked.replace(/[•\s.,!?:;—–\-]/g, '').length >= 10) {
        return masked;
      }
    }
    const words = rawAns.split(/\s+/).filter(Boolean);
    const firstChar = rawAns.charAt(0).toUpperCase() || '?';
    return `Ориентир: в ответе ${words.length} сл., начинается с «${firstChar}» (${themeName || 'общая эрудиция'}).`;
  }

  _buildAnswerMask(q, themeName = '') {
    if (!q) return '';
    const primary = String(q.answer || '')
      .split(' / ')[0]
      .replace(/\([^)]*\)/g, '')
      .trim() || String(q.answer || '').trim();

    const isBinaryCake =
      /торт\s+ли\s+это/i.test(themeName || '') ||
      /^((это\s+)?торт|не\s+торт|настоящ|да\b|нет\b|#\d|пьедестал)/i.test(primary);

    if (isBinaryCake) {
      const wordsCount = primary.split(/\s+/).filter(Boolean).length;
      return `Вопрос на выбор варианта — первая буква сразу выдаст ответ! В полной расшифровке ${wordsCount} сл.: проверь стык у подложки, текстуру пор и неестественный глянец.`;
    }

    const tokens = primary.split(/\s+/).filter(Boolean);
    let letterCount = 0;
    const maskedTokens = tokens.map((tok) => {
      let revealNext = true;
      const chars = Array.from(tok).map((ch) => {
        const isAlphaNum = /[a-zа-яё0-9]/i.test(ch);
        if (!isAlphaNum) {
          if (ch === '-' || ch === '/') revealNext = true;
          return ch;
        }
        letterCount += 1;
        if (revealNext) {
          revealNext = false;
          return ch.toUpperCase();
        }
        return '_';
      });
      return chars.join(' ');
    });

    return `${maskedTokens.join('   ')}  (${tokens.length} сл., ${letterCount} знаков)`;
  }

  useHint(playerId, hintKind) {
    if (this.settings.hintsMode === 'off' || this.settings.hintsMode === 'host_only') return;
    if (this.state.phase !== 'question' || !this.state.questionRuntime || !this.state.activeCell) return;
    const rt = this.state.questionRuntime;
    if (rt.substate === 'revealed') return;
    if (rt.lockedPlayerIds.includes(playerId)) return;

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !player.hints) return;

    if (!['clue', 'letters', 'shield'].includes(hintKind)) return;
    if ((player.hints[hintKind] || 0) <= 0) return;

    if (hintKind === 'clue') {
      if (rt.publicHintRevealed || rt.clueUsedBy.includes(playerId)) return;
      rt.clueUsedBy.push(playerId);
      player.hints.clue -= 1;
      player.stats.hintsUsed = (player.stats.hintsUsed || 0) + 1;
      this._sound('hint');
      this._banner(`💡 ${player.name} взял(а) личную наводку!`, 'gold');
      this._emit();
      return;
    }

    if (hintKind === 'letters') {
      if (rt.lettersUsedBy.includes(playerId)) return;
      rt.lettersUsedBy.push(playerId);
      player.hints.letters -= 1;
      player.stats.hintsUsed = (player.stats.hintsUsed || 0) + 1;
      this._sound('hint');
      this._banner(`🔤 ${player.name} открыл(а) маску первых букв!`, 'gold');
      this._emit();
      return;
    }

    if (hintKind === 'shield') {
      if (rt.shieldUsedBy.includes(playerId)) return;
      if (rt.specialKind === 'noRisk' && !(this.state.activeCurse?.kind === 'cursed_mark' && this.state.activeCurse.targetId === playerId)) {
        return; // На вопросе без риска штраф уже 0 — бережём подсказку игрока!
      }
      rt.shieldUsedBy.push(playerId);
      player.hints.shield -= 1;
      player.stats.hintsUsed = (player.stats.hintsUsed || 0) + 1;
      this._sound('hint');
      this._banner(`🛡️ ${player.name} включил(а) страховку от минуса!`, 'gold');
      this._emit();
    }
  }

  revealPublicHint() {
    if (this.state.phase === 'question' && this.state.questionRuntime && this.state.activeCell) {
      const rt = this.state.questionRuntime;
      if (rt.publicHintRevealed || rt.substate === 'revealed') return;
      rt.publicHintRevealed = true;
      this._sound('hint');
      this._banner('💡 Ведущий открыл подсказку для всех игроков!', 'gold');
      this._emit();
      return;
    }
    if (this.state.phase === 'final_question' && this.state.finalState) {
      if (this.state.finalState.publicHintRevealed) return;
      this.state.finalState.publicHintRevealed = true;
      this._sound('hint');
      this._banner('💡 Ведущий открыл финальную наводку для всех!', 'gold');
      this._emit();
    }
  }

  returnToBoard() {
    this._stopTimer();
    this.state.activeCell = null;
    this.state.modifierState = null;
    this.state.activeCurse = null;
    this.state.catState = null;
    this.state.auctionState = null;
    this.state.questionRuntime = null;
    this.state.lastZeroedPlayerId = null;

    const rIdx = this.state.roundIndex;
    const roundGrid = this.state.playedCells[rIdx] || [];
    const selectedThemes = this.state.selectedThemeIndexesByRound[rIdx] || roundGrid.map((_, index) => index);
    const hasUnplayed = selectedThemes.some((themeIndex) => roundGrid[themeIndex]?.some((played) => !played));

    if (hasUnplayed) {
      this.state.phase = 'board';
      this._emit();
      return;
    }

    this.advanceRoundOrFinal();
  }

  advanceRoundOrFinal() {
    this._stopTimer();
    this.state.activeCell = null;
    this.state.modifierState = null;
    this.state.activeCurse = null;
    this.state.catState = null;
    this.state.auctionState = null;
    this.state.questionRuntime = null;

    if (!this.pack) return;

    if (this.state.roundIndex + 1 < this.pack.rounds.length) {
      const nextRoundIndex = this.state.roundIndex + 1;
      if (this.state.players.length > 0) {
        const lowest = [...this.state.players].sort((a, b) => a.score - b.score)[0];
        this.state.chooserId = lowest.id;
      }
      this._beginCategorySelection(nextRoundIndex);
      const nextRoundName = this.pack.rounds[nextRoundIndex].name;
      this._banner(`${nextRoundName}: ведущий выбирает ${Math.min(6, this.pack.rounds[nextRoundIndex].themes.length)} категорий`, 'gold');
      this._emit();
      return;
    }

    if (this.pack.final && this.pack.final.themes.length > 0) {
      this._initFinalRound();
    } else {
      this._enterPodium();
    }
  }

  // --- Финальный раунд ---

  _initFinalRound(grantBonusIfAllZero = false) {
    if (grantBonusIfAllZero) {
      for (const p of this.state.players) {
        if (p.score <= 0) p.score = 500;
      }
    }

    const finalists = [...this.state.players]
      .filter((p) => p.score > 0)
      .sort((a, b) => a.score - b.score);

    if (finalists.length === 0 && this.state.players.length > 0) {
      this.state.phase = 'final_no_players';
      this._banner('Ни у одного игрока нет плюсового счёта для Финала!', 'red');
      this._emit();
      return;
    }

    const finalistIds = finalists.map((p) => p.id);
    const themes = this.pack.final.themes.map((t, idx) => ({
      index: idx,
      name: t.name,
      eliminated: false,
      eliminatedBy: null
    }));

    this.state.finalState = {
      finalistIds,
      themes,
      turnIndex: 0,
      chosenThemeIndex: themes.length === 1 ? 0 : null,
      bets: {},
      answers: {},
      revealOrder: finalistIds,
      revealCursor: 0,
      revealStep: 'answer',
      judgments: {}
    };

    this._sound('roundStart');
    if (themes.length === 1) {
      this._enterFinalBets();
    } else {
      this.state.phase = 'final_themes';
      this._banner('ФИНАЛ! По очереди убираем нежелательные темы', 'gold');
      this._emit();
    }
  }

  grantFinalRescueBonus() {
    if (this.state.phase !== 'final_no_players') return;
    this._initFinalRound(true);
  }

  finishWithoutFinal() {
    this._enterPodium();
  }

  eliminateFinalTheme(actorId, themeIndex) {
    if (this.state.phase !== 'final_themes' || !this.state.finalState) return;
    const fs = this.state.finalState;
    const currentTurnPlayerId = fs.finalistIds[fs.turnIndex % Math.max(1, fs.finalistIds.length)] || null;

    if (actorId !== '__host__' && actorId !== currentTurnPlayerId) return;

    const themeObj = fs.themes[themeIndex];
    if (!themeObj || themeObj.eliminated) return;

    const putter = this.state.players.find((p) => p.id === currentTurnPlayerId);
    themeObj.eliminated = true;
    themeObj.eliminatedBy = putter ? putter.name : 'Ведущий';
    fs.turnIndex += 1;
    this._sound('strikeTheme');

    const remaining = fs.themes.filter((t) => !t.eliminated);
    if (remaining.length <= 1) {
      fs.chosenThemeIndex = remaining[0]?.index ?? 0;
      this._enterFinalBets();
    } else {
      this._emit();
    }
  }

  _enterFinalBets() {
    const fs = this.state.finalState;
    if (!fs) return;
    this.state.phase = 'final_bets';
    const chosenName = this.pack.final.themes[fs.chosenThemeIndex]?.name || 'Финал';
    this._banner(`Тема финала: «${chosenName}» — делайте секретные ставки!`, 'gold');

    if (fs.finalistIds.length === 0) {
      this._enterFinalQuestion();
      return;
    }
    this._emit();
  }

  submitFinalBet(playerId, amount) {
    if (this.state.phase !== 'final_bets' || !this.state.finalState) return;
    const fs = this.state.finalState;
    if (!fs.finalistIds.includes(playerId)) return;
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    const cleanBet = Math.min(player.score, Math.max(1, Math.floor(Number(amount) || 1)));
    fs.bets[playerId] = cleanBet;

    const allBet = fs.finalistIds.every((id) => typeof fs.bets[id] === 'number');
    if (allBet) {
      this._enterFinalQuestion();
    } else {
      this._emit();
    }
  }

  hostForceStartFinalQuestion() {
    if (this.state.phase !== 'final_bets' || !this.state.finalState) return;
    const fs = this.state.finalState;
    for (const id of fs.finalistIds) {
      if (typeof fs.bets[id] !== 'number') {
        fs.bets[id] = 1;
      }
    }
    this._enterFinalQuestion();
  }

  _enterFinalQuestion() {
    if (!this.state.finalState) return;
    this.state.phase = 'final_question';
    this._sound('cellOpen');
    this._startTimer('final_think', this.settings.finalTimeSec * 1000);
    this._emit();
  }

  hostForceFinalReveal() {
    if (this.state.phase !== 'final_question') return;
    this._enterFinalReveal();
  }

  _enterFinalReveal() {
    this._stopTimer();
    const fs = this.state.finalState;
    if (!fs) return;
    for (const id of fs.finalistIds) {
      const cur = fs.answers[id];
      fs.answers[id] = {
        text: cur?.text ? cur.text.trim() : '— (нет ответа)',
        locked: true
      };
    }
    this.state.phase = 'final_reveal';
    fs.revealCursor = 0;
    fs.revealStep = fs.revealOrder.length === 0 ? 'done' : 'hidden';
    this._sound('buzzReady');
    this._emit();
  }

  revealNextFinalistAnswer() {
    if (this.state.phase !== 'final_reveal' || !this.state.finalState) return;
    const fs = this.state.finalState;
    const pid = fs.revealOrder[fs.revealCursor];
    if (!pid) return;
    fs.judgments[pid] = { ...(fs.judgments[pid] || {}), answerOpened: true };
    fs.revealStep = 'answer_shown';
    this._sound('cellOpen');
    this._emit();
  }

  judgeFinalist(isCorrect) {
    if (this.state.phase !== 'final_reveal' || !this.state.finalState) return;
    const fs = this.state.finalState;
    const pid = fs.revealOrder[fs.revealCursor];
    const player = this.state.players.find((p) => p.id === pid);
    if (!player) return;

    const bet = fs.bets[pid] || 1;
    const delta = isCorrect ? bet : -bet;
    player.score += delta;
    if (isCorrect) player.stats.correct += 1;
    else player.stats.wrong += 1;

    fs.judgments[pid] = {
      answerOpened: true,
      judged: true,
      correct: isCorrect,
      bet,
      delta
    };

    this._sound(isCorrect ? 'correct' : 'wrong');

    if (fs.revealCursor + 1 < fs.revealOrder.length) {
      fs.revealCursor += 1;
      fs.revealStep = 'hidden';
    } else {
      fs.revealStep = 'done';
    }
    this._emit();
  }

  finishGameToPodium() {
    this._enterPodium();
  }

  _enterPodium() {
    this._stopTimer();
    this.state.phase = 'podium';
    this._sound('victory');
    this._emit();
  }

  // --- Таймеры ---

  _startTimer(kind, durationMs) {
    this._lastTickSecondBeep = null;
    this.state.timer = {
      kind,
      durationMs,
      remainingMs: durationMs,
      startedAt: Date.now(),
      running: true
    };
  }

  _stopTimer() {
    this._lastTickSecondBeep = null;
    this.state.timer = {
      kind: null,
      durationMs: 0,
      remainingMs: 0,
      startedAt: 0,
      running: false
    };
  }

  togglePauseTimer() {
    const t = this.state.timer;
    if (!t.kind) return;
    if (t.running) {
      t.remainingMs = this._getCurrentRemainingMs();
      t.running = false;
    } else if (t.remainingMs > 0) {
      t.startedAt = Date.now();
      t.running = true;
    }
    this._emit();
  }

  _getCurrentRemainingMs() {
    const t = this.state.timer;
    if (!t.kind) return 0;
    if (!t.running) return t.remainingMs;
    return Math.max(0, t.remainingMs - (Date.now() - t.startedAt));
  }

  _onTick() {
    const t = this.state.timer;
    if (!t.running || !t.kind) return;
    const rem = this._getCurrentRemainingMs();

    if (t.kind !== 'reading' && rem > 0 && rem <= 3200) {
      const sec = Math.ceil(rem / 1000);
      if (this._lastTickSecondBeep !== sec) {
        this._lastTickSecondBeep = sec;
        this.onSound('tick');
      }
    }

    if (rem <= 0) {
      this._handleTimerExpired(t.kind);
    }
  }

  _handleTimerExpired(kind) {
    if (kind === 'reading') {
      this.unlockBuzzing();
      return;
    }
    if (kind === 'buzzing') {
      if (this.state.phase === 'question' && this.state.questionRuntime) {
        this.state.questionRuntime.substate = 'revealed';
        this.state.questionRuntime.activeResponderId = null;
        this._stopTimer();
        this._sound('timeUp');
        this._banner('⏰ Время вышло! Никто не нажал кнопку', 'gold');
        this._emit();
      }
      return;
    }
    if (kind === 'answering') {
      this._banner('⏰ Время на ответ истекло!', 'red');
      this.judgeCurrentAnswer(false);
      return;
    }
    if (kind === 'final_think') {
      this._enterFinalReveal();
    }
  }

  // --- События и анти-спойлер проекция состояния для игроков ---

  _banner(text, tone = 'gold') {
    this.state.eventBanner = { text, tone, ts: Date.now() };
  }

  _sound(name) {
    this.state.soundSeq += 1;
    this.state.lastSound = { name, seq: this.state.soundSeq };
    this.onSound(name);
  }

  _emit() {
    this.onChange(this.state);
  }

  buildViewFor(viewerId) {
    const isHost = viewerId === '__host__';
    const s = this.state;
    const currentRem = this._getCurrentRemainingMs();

    let currentRoundBoard = null;
    if (this.pack && this.pack.rounds[s.roundIndex]) {
      const r = this.pack.rounds[s.roundIndex];
      const pickedIndexes = s.selectedThemeIndexesByRound[s.roundIndex];
      const boardThemeIndexes = Array.isArray(pickedIndexes) && pickedIndexes.length
        ? pickedIndexes
        : r.themes.map((_, index) => index);
      currentRoundBoard = {
        roundIndex: s.roundIndex,
        totalRounds: this.pack.rounds.length,
        name: r.name,
        themes: boardThemeIndexes.map((tIdx) => {
          const t = r.themes[tIdx];
          return {
            themeIndex: tIdx,
            name: t.name,
            cells: t.questions.map((q, qIdx) => {
              const mod = s.runtimeModifiers[s.roundIndex]?.[tIdx]?.[qIdx] || null;
              return {
                cost: this._getEffectiveCellCost(s.roundIndex, qIdx, q.cost),
                played: Boolean(s.playedCells[s.roundIndex]?.[tIdx]?.[qIdx]),
                hostHintType: isHost ? q.type : undefined,
                hostHintModifier: isHost ? mod : undefined
              };
            })
          };
        })
      };
    }

    let questionView = null;
    if (s.activeCell && (s.phase === 'question' || s.phase === 'cat_select' || s.phase === 'auction' || s.phase === 'nothing_personal')) {
      const q = s.activeCell.question;
      const rt = s.questionRuntime;
      const isRevealed = rt?.substate === 'revealed';
      const showQuestionBody = s.phase === 'question';

      const effectiveThemeName = rt?.displayTheme || s.activeCell.themeName;
      const resolvedHintText = this._resolveHintText(q, effectiveThemeName);
      const resolvedMaskText = this._buildAnswerMask(q, effectiveThemeName);

      questionView = {
        themeName: effectiveThemeName,
        questionKey: `${s.roomCode || ''}:${s.activeCell.roundIndex}:${s.activeCell.themeIndex}:${s.activeCell.qIndex}`,
        nominalCost: s.activeCell.nominalCost,
        effectiveCost: rt?.effectiveCost ?? s.activeCell.nominalCost,
        type: q.type,
        modifier: s.activeCell.modifier,
        text: showQuestionBody ? q.text : '',
        image: showQuestionBody ? q.image : '',
        audio: showQuestionBody ? q.audio : '',
        audioType: showQuestionBody ? (q.audioType || '') : '',
        audioStartSeconds: showQuestionBody ? (q.audioStartSeconds || 0) : 0,
        audioClipSeconds: showQuestionBody ? (q.audioClipSeconds || 0) : 0,
        audioCredit: showQuestionBody ? (q.audioCredit || '') : '',
        audioCreditUrl: showQuestionBody ? (q.audioCreditUrl || '') : '',
        audioLicense: showQuestionBody ? (q.audioLicense || '') : '',
        video: showQuestionBody ? q.video : '',
        videoEmbedUrl: showQuestionBody ? (q.videoEmbedUrl || '') : '',
        videoSourceUrl: showQuestionBody ? (q.videoSourceUrl || '') : '',
        videoCredit: showQuestionBody ? (q.videoCredit || '') : '',
        answerVideo: isRevealed ? (q.answerVideo || '') : '',
        answer: (isHost || isRevealed) ? q.answer : null,
        answerImage: (isHost || isRevealed) ? q.answerImage : null,
        comment: (isHost || isRevealed) ? q.comment : null,
        hints: showQuestionBody && rt ? {
          enabled: this.settings.hintsMode !== 'off',
          playerHintsEnabled: this.settings.hintsMode === 'standard' || this.settings.hintsMode === 'generous',
          publicHintRevealed: Boolean(rt.publicHintRevealed),
          publicHintText: rt.publicHintRevealed ? resolvedHintText : null,
          hostHintPreview: isHost ? resolvedHintText : null,
          hostMaskPreview: isHost ? resolvedMaskText : null,
          myClueText: (!isHost && rt.clueUsedBy?.includes(viewerId)) ? resolvedHintText : null,
          myLettersMask: (!isHost && rt.lettersUsedBy?.includes(viewerId)) ? resolvedMaskText : null,
          myShieldActive: Boolean(!isHost && rt.shieldUsedBy?.includes(viewerId)),
          shieldUsedBy: rt.shieldUsedBy || [],
          clueUsedBy: isHost ? (rt.clueUsedBy || []) : undefined,
          lettersUsedBy: isHost ? (rt.lettersUsedBy || []) : undefined
        } : null,
        runtime: rt ? {
          substate: rt.substate,
          specialKind: rt.specialKind,
          activeResponderId: rt.activeResponderId,
          submittedText: rt.submittedText,
          lockedPlayerIds: rt.lockedPlayerIds,
          falseStartUntil: rt.falseStartUntil,
          lateBuzzes: rt.lateBuzzes,
          reactionMs: rt.reactionMs,
          judgeAvailableAt: rt.judgeAvailableAt || 0,
          lastJudgment: rt.lastJudgment
        } : null
      };
    }

    let finalView = null;
    if (s.finalState && this.pack?.final) {
      const fs = s.finalState;
      const chosenTheme = fs.chosenThemeIndex !== null ? this.pack.final.themes[fs.chosenThemeIndex] : null;
      const showFinalQ = s.phase === 'final_question' || s.phase === 'final_reveal' || s.phase === 'podium';
      const allJudged = fs.revealStep === 'done';
      const finalHintText = chosenTheme ? this._resolveHintText(chosenTheme, chosenTheme.name) : null;

      finalView = {
        finalistIds: fs.finalistIds,
        themes: fs.themes,
        currentEliminatorId: fs.finalistIds[fs.turnIndex % Math.max(1, fs.finalistIds.length)] || null,
        chosenThemeName: chosenTheme?.name || null,
        questionText: showFinalQ && chosenTheme ? chosenTheme.text : null,
        questionImage: showFinalQ && chosenTheme ? chosenTheme.image : null,
        publicHintRevealed: Boolean(fs.publicHintRevealed),
        publicHintText: (showFinalQ && fs.publicHintRevealed) ? finalHintText : null,
        hostHintPreview: (isHost && chosenTheme) ? finalHintText : null,
        correctAnswer: (isHost || allJudged) && chosenTheme ? chosenTheme.answer : null,
        comment: (isHost || allJudged) && chosenTheme ? chosenTheme.comment : null,
        myBet: fs.bets[viewerId] ?? null,
        myAnswer: fs.answers[viewerId] ?? null,
        betStatusByPlayer: Object.fromEntries(
          fs.finalistIds.map((id) => [id, typeof fs.bets[id] === 'number'])
        ),
        answerStatusByPlayer: Object.fromEntries(
          fs.finalistIds.map((id) => [id, Boolean(fs.answers[id]?.locked)])
        ),
        revealOrder: fs.revealOrder,
        revealCursor: fs.revealCursor,
        revealStep: fs.revealStep,
        revealedData: Object.fromEntries(
          fs.revealOrder.map((id) => {
            const j = fs.judgments[id] || {};
            return [
              id,
              {
                answerOpened: Boolean(j.answerOpened),
                answerText: (isHost || j.answerOpened) ? (fs.answers[id]?.text || '—') : null,
                judged: Boolean(j.judged),
                correct: j.correct ?? null,
                bet: (isHost || j.judged) ? (fs.bets[id] ?? 1) : null,
                delta: j.delta ?? null
              }
            ];
          })
        )
      };
    }

    return {
      type: 'STATE_SYNC',
      serverNow: Date.now(),
      roomCode: s.roomCode,
      phase: s.phase,
      settings: this.settings,
      categorySelection: s.categorySelection ? {
        roundIndex: s.categorySelection.roundIndex,
        roundName: this.pack?.rounds?.[s.categorySelection.roundIndex]?.name || `Раунд ${s.categorySelection.roundIndex + 1}`,
        requiredCount: s.categorySelection.requiredCount,
        selectedThemeIndexes: [...s.categorySelection.selectedThemeIndexes],
        lastShotThemeIndex: s.categorySelection.lastShotThemeIndex,
        shotSeq: s.categorySelection.shotSeq,
        turnPlayerIds: [...(s.categorySelection.turnPlayerIds || [])],
        starterPlayerId: s.categorySelection.starterPlayerId || null,
        currentTurnPlayerId: (() => {
          const ids = s.categorySelection.turnPlayerIds || [];
          if (!ids.length || !s.categorySelection.starterPlayerId) return null;
          const starterIndex = ids.indexOf(s.categorySelection.starterPlayerId);
          if (starterIndex < 0) return null;
          return ids[(starterIndex + s.categorySelection.selectedThemeIndexes.length) % ids.length] || null;
        })(),
        themes: (this.pack?.rounds?.[s.categorySelection.roundIndex]?.themes || []).map((theme, themeIndex) => ({
          themeIndex,
          name: theme.name,
          selected: s.categorySelection.selectedThemeIndexes.includes(themeIndex)
        }))
      } : null,
      packMeta: this.pack ? {
        id: this.pack.id,
        title: this.pack.title,
        author: this.pack.author,
        difficulty: this.pack.difficulty,
        roundsCount: this.pack.rounds.length,
        hasFinal: Boolean(this.pack.final)
      } : null,
      players: s.players,
      chooserId: s.chooserId,
      lastZeroedPlayerId: s.lastZeroedPlayerId,
      zeroOutEvent: s.zeroOutEvent,
      board: currentRoundBoard,
      modifierState: s.modifierState,
      activeCurse: s.activeCurse,
      catState: s.catState,
      auctionState: s.auctionState,
      questionView,
      finalView,
      timer: {
        kind: s.timer.kind,
        durationMs: s.timer.durationMs,
        remainingMs: currentRem,
        running: s.timer.running
      },
      eventBanner: s.eventBanner,
      lastSound: s.lastSound
    };
  }
}
