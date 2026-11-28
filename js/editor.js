// Встроенный визуальный конструктор JSON-паков для репозитория GitHub
import { MODIFIER_CATALOG, MODIFIER_IDS, getComebackBaseUnit } from './state.js?v=profile-color-only-20261128';

function makeEmptyTheme(name, rIdx) {
  const base = getComebackBaseUnit(rIdx);
  return {
    name,
    questions: [1, 2, 3, 4, 5].map((i) => ({
      cost: i * base,
      type: 'normal',
      modifier: '',
      catTheme: '',
      catCost: i * base,
      text: '',
      image: '',
      answerImage: '',
      audio: '',
      answer: '',
      comment: ''
    }))
  };
}

function createDefaultDraftPack() {
  return {
    id: 'my-pack-' + Math.floor(100 + Math.random() * 900),
    title: 'Мой авторский пак',
    author: 'Компания друзей',
    difficulty: 'Лёгкая / Для компании',
    description: 'Собственный пакет на 3 уровня (от 100, от 500 и камбэк от 1000 очков).',
    rounds: [
      {
        name: 'Уровень 1 (от 100)',
        themes: [makeEmptyTheme('Тема 1', 0), makeEmptyTheme('Тема 2', 0)]
      },
      {
        name: 'Уровень 2 (от 500)',
        themes: [makeEmptyTheme('Тема 1', 1), makeEmptyTheme('Тема 2', 1)]
      },
      {
        name: 'Уровень 3. Камбэк (от 1000)',
        themes: [makeEmptyTheme('Тема 1', 2), makeEmptyTheme('Тема 2', 2)]
      }
    ],
    final: {
      name: 'Финальный раунд',
      themes: [
        { name: 'Финальная тема 1', text: '', image: '', answer: '', comment: '' },
        { name: 'Финальная тема 2', text: '', image: '', answer: '', comment: '' },
        { name: 'Финальная тема 3', text: '', image: '', answer: '', comment: '' }
      ]
    }
  };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class PackBuilderModal {
  constructor({ onUsePack }) {
    this.onUsePack = onUsePack;
    this.draft = createDefaultDraftPack();
    this.activeRoundIdx = 0; // или 'final'
    this.activeThemeIdx = 0;
    this.editingQuestion = null; // { rIdx, tIdx, qIdx }
    this.modalEl = null;

    // Поиск треков из открытого музыкального каталога (iTunes Public API)
    this.musicQuery = '';
    this.musicResults = [];
    this.musicLoading = false;
    this.musicError = '';
    this.previewAudio = new Audio();
    this.previewAudioUrl = '';
  }

  open(initialPack = null) {
    if (initialPack) {
      this.draft = JSON.parse(JSON.stringify(initialPack));
    }
    if (!this.modalEl) {
      this.modalEl = document.createElement('div');
      this.modalEl.className = 'modal-backdrop';
      document.body.appendChild(this.modalEl);
    }
    this.modalEl.classList.remove('hidden');
    this.render();
  }

  close() {
    this.previewAudio.pause();
    this.previewAudioUrl = '';
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  _cleanExportObject() {
    const out = {
      id: (this.draft.id || 'custom-pack').trim(),
      title: (this.draft.title || 'Без названия').trim(),
      author: (this.draft.author || 'Автор').trim(),
      difficulty: (this.draft.difficulty || 'Средняя').trim(),
      description: (this.draft.description || '').trim(),
      rounds: this.draft.rounds.map((r) => ({
        name: r.name,
        themes: r.themes.map((t) => ({
          name: t.name,
          questions: t.questions.map((q) => {
            const item = {
              cost: Number(q.cost) || 100,
              text: q.text || 'Вопрос не заполнен',
              answer: q.answer || 'Ответ не заполнен'
            };
            if (q.type && q.type !== 'normal') item.type = q.type;
            if (q.modifier && MODIFIER_IDS.includes(q.modifier)) item.modifier = q.modifier;
            if (q.type === 'cat') {
              if (q.catTheme) item.catTheme = q.catTheme;
              if (q.catCost) item.catCost = q.catCost === 'choice' ? 'choice' : Number(q.catCost) || item.cost;
            }
            if (q.image) item.image = q.image;
            if (q.answerImage) item.answerImage = q.answerImage;
            if (q.audio) item.audio = q.audio;
            if (q.hint) item.hint = q.hint;
            if (q.comment) item.comment = q.comment;
            return item;
          })
        }))
      }))
    };

    if (this.draft.final && this.draft.final.themes.length > 0) {
      out.final = {
        name: this.draft.final.name || 'Финальный раунд',
        themes: this.draft.final.themes.map((ft) => {
          const item = {
            name: ft.name || 'Тема финала',
            text: ft.text || 'Финальный вопрос не заполнен',
            answer: ft.answer || 'Ответ не заполнен'
          };
          if (ft.image) item.image = ft.image;
          if (ft.hint) item.hint = ft.hint;
          if (ft.comment) item.comment = ft.comment;
          return item;
        })
      };
    }
    return out;
  }

  render() {
    if (!this.modalEl) return;
    const d = this.draft;
    const isFinalTab = this.activeRoundIdx === 'final';
    const currentRound = !isFinalTab ? d.rounds[this.activeRoundIdx] : null;

    const indexSnippet = JSON.stringify({
      id: d.id || 'my-pack',
      file: `./packs/${d.id || 'my-pack'}.json`,
      title: d.title || 'Мой пак',
      author: d.author || 'Друзья',
      difficulty: d.difficulty || 'Средняя',
      duration: '30 мин',
      roundsCount: d.rounds.length,
      questionsCount: d.rounds.reduce((acc, r) => acc + r.themes.reduce((a, t) => a + t.questions.length, 0), 0) + (d.final?.themes?.length || 0),
      tags: ['Свой пак'],
      description: d.description || ''
    }, null, 2);

    this.modalEl.innerHTML = `
      <div class="modal-card modal-xl">
        <div class="modal-header">
          <div>
            <h3>🛠️ Конструктор JSON-пака для GitHub</h3>
            <p class="muted-sm">Соберите вопросы визуально, скачайте <code>.json</code> и положите в папку <code>packs/</code> вашего репозитория</p>
          </div>
          <button class="btn-icon" data-act="close" title="Закрыть">✕</button>
        </div>

        <div class="editor-meta-grid">
          <label>
            <span>ID файла (латиницей)</span>
            <input type="text" data-meta="id" value="${escapeHtml(d.id)}" placeholder="my-pack-1">
          </label>
          <label>
            <span>Название пака</span>
            <input type="text" data-meta="title" value="${escapeHtml(d.title)}" placeholder="Вечер пятницы №1">
          </label>
          <label>
            <span>Автор</span>
            <input type="text" data-meta="author" value="${escapeHtml(d.author)}">
          </label>
          <label>
            <span>Сложность</span>
            <input type="text" data-meta="difficulty" value="${escapeHtml(d.difficulty)}">
          </label>
        </div>

        <div class="editor-tabs">
          ${d.rounds.map((r, idx) => `
            <button class="tab-chip ${this.activeRoundIdx === idx ? 'active' : ''}" data-round-tab="${idx}">
              ${escapeHtml(r.name)}
            </button>
          `).join('')}
          <button class="tab-chip" data-act="add-round">+ Раунд</button>
          <button class="tab-chip ${isFinalTab ? 'active' : ''}" data-round-tab="final">🏆 Финал (${d.final?.themes?.length || 0})</button>
        </div>

        <div class="editor-body">
          ${isFinalTab ? this._renderFinalEditor() : this._renderRoundEditor(currentRound, this.activeRoundIdx)}
        </div>

        <details class="repo-snippet-box">
          <summary>📋 Показать готовую запись для <code>packs/index.json</code> на GitHub</summary>
          <pre>${escapeHtml(indexSnippet)}</pre>
        </details>

        <div class="modal-footer">
          <button class="btn btn-ghost" data-act="import-file">📂 Открыть существующий .json</button>
          <div class="footer-right">
            ${this.onUsePack ? `<button class="btn btn-secondary" data-act="use-now">▶️ Играть этот пак сейчас</button>` : ''}
            <button class="btn btn-gold" data-act="download-json">💾 Скачать ${escapeHtml(d.id || 'pack')}.json</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderRoundEditor(round, rIdx) {
    if (!round) return '';
    return `
      <div class="round-toolbar">
        <label class="inline-field">
          <span>Название раунда:</span>
          <input type="text" data-round-name="${rIdx}" value="${escapeHtml(round.name)}">
        </label>
        <div class="btn-row">
          <button class="btn btn-sm btn-secondary" data-act="add-theme">+ Добавить тему</button>
          ${this.draft.rounds.length > 1 ? `<button class="btn btn-sm btn-danger-ghost" data-act="del-round">Удалить раунд</button>` : ''}
        </div>
      </div>

      <div class="editor-themes-list">
        ${round.themes.map((t, tIdx) => `
          <div class="editor-theme-row">
            <div class="editor-theme-head">
              <input type="text" data-theme-name="${tIdx}" value="${escapeHtml(t.name)}" placeholder="Название темы">
              <button class="btn-tiny" data-add-q="${tIdx}" title="Добавить вопрос">+ Вопрос</button>
              ${round.themes.length > 1 ? `<button class="btn-tiny danger" data-del-theme="${tIdx}" title="Удалить тему">✕</button>` : ''}
            </div>
            <div class="editor-q-pills">
              ${t.questions.map((q, qIdx) => {
                const filled = Boolean(q.text && q.answer);
                const typeBadge = q.type === 'cat' ? '🐈' : q.type === 'auction' ? '🔨' : q.type === 'noRisk' ? '🛡️' : '';
                const modBadge = q.modifier && MODIFIER_CATALOG[q.modifier] ? MODIFIER_CATALOG[q.modifier].icon : '';
                const badge = `${modBadge}${typeBadge}`;
                const isSelected = this.editingQuestion &&
                  this.editingQuestion.rIdx === rIdx &&
                  this.editingQuestion.tIdx === tIdx &&
                  this.editingQuestion.qIdx === qIdx;
                return `
                  <button class="q-pill ${filled ? 'filled' : 'empty'} ${isSelected ? 'selected' : ''}"
                    data-edit-q="${tIdx}:${qIdx}">
                    ${badge} ${q.cost}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      ${this._renderQuestionDetailForm(rIdx)}
    `;
  }

  _renderQuestionDetailForm(rIdx) {
    const eq = this.editingQuestion;
    if (!eq || eq.rIdx !== rIdx) {
      return `<div class="editor-hint-card">👆 Нажмите на любую кнопку со стоимостью выше (например, <b>100</b> или <b>200</b>), чтобы заполнить текст вопроса, ответ, картинку или сделать его «Котом в мешке» / «Аукционом».</div>`;
    }
    const q = this.draft.rounds[eq.rIdx]?.themes[eq.tIdx]?.questions[eq.qIdx];
    if (!q) return '';
    const themeName = this.draft.rounds[eq.rIdx].themes[eq.tIdx].name;

    return `
      <div class="q-detail-panel">
        <div class="q-detail-head">
          <strong>Редактирование: «${escapeHtml(themeName)}» за ${q.cost}</strong>
          ${this.draft.rounds[eq.rIdx].themes[eq.tIdx].questions.length > 1
            ? `<button class="btn-tiny danger" data-act="del-q">Удалить ячейку</button>` : ''}
        </div>
        <div class="q-form-grid">
          <label>
            <span>Стоимость (очки)</span>
            <input type="number" step="100" data-q-field="cost" value="${q.cost}">
          </label>
          <label>
            <span>Тип вопроса</span>
            <select data-q-field="type">
              <option value="normal" ${q.type === 'normal' ? 'selected' : ''}>Обычный вопрос</option>
              <option value="cat" ${q.type === 'cat' ? 'selected' : ''}>🐈 Кот в мешке</option>
              <option value="auction" ${q.type === 'auction' ? 'selected' : ''}>🔨 Вопрос-аукцион</option>
              <option value="noRisk" ${q.type === 'noRisk' ? 'selected' : ''}>🛡️ Вопрос без риска</option>
            </select>
          </label>
          <label class="full-span">
            <span>Пакостный модификатор на вопрос</span>
            <select data-q-field="modifier">
              <option value="" ${!q.modifier ? 'selected' : ''}>Без модификатора</option>
              ${Object.values(MODIFIER_CATALOG).map((m) => `
                <option value="${m.id}" ${q.modifier === m.id ? 'selected' : ''}>
                  ${escapeHtml(m.icon)} ${escapeHtml(m.shortName)}
                </option>
              `).join('')}
            </select>
          </label>
          ${q.type === 'cat' ? `
            <label>
              <span>Секретная тема Кота</span>
              <input type="text" data-q-field="catTheme" value="${escapeHtml(q.catTheme)}" placeholder="Например: Сладкая жизнь">
            </label>
            <label>
              <span>Цена Кота (число)</span>
              <input type="number" step="100" data-q-field="catCost" value="${Number(q.catCost) || q.cost}">
            </label>
          ` : ''}
          <label class="full-span">
            <span>Текст вопроса</span>
            <textarea rows="3" data-q-field="text" placeholder="Введите текст вопроса...">${escapeHtml(q.text)}</textarea>
          </label>
          <label>
            <span>Правильный ответ</span>
            <input type="text" data-q-field="answer" value="${escapeHtml(q.answer)}" placeholder="Точный ответ для ведущего">
          </label>
          <label>
            <span>💡 Подсказка / наводка для игроков (необязательно)</span>
            <input type="text" data-q-field="hint" value="${escapeHtml(q.hint || '')}" placeholder="Мягкий намёк без прямого спойлера">
          </label>
          <label class="full-span">
            <span>Комментарий / факт после ответа (необязательно)</span>
            <input type="text" data-q-field="comment" value="${escapeHtml(q.comment)}" placeholder="Интересная деталь">
          </label>
          <label>
            <span>Ссылка на картинку / мем (URL или ./packs/media/...)</span>
            <input type="text" data-q-field="image" value="${escapeHtml(q.image)}" placeholder="https://... или ./packs/media/images/...">
          </label>
          <label>
            <span>Картинка в ответе (напр. разрез для «Торт ли это?»)</span>
            <input type="text" data-q-field="answerImage" value="${escapeHtml(q.answerImage || '')}" placeholder="Необязательно: ./packs/media/images/...">
          </label>
          <label class="full-span">
            <span>Ссылка на аудио .m4a/.mp3/.ogg (или выберите трек ниже)</span>
            <input type="text" data-q-field="audio" value="${escapeHtml(q.audio)}" placeholder="./packs/media/audio/tracks/... или https://...">
          </label>

          <div class="full-span open-music-finder">
            <div class="omf-head">
              <strong>🎵 Быстрый поиск треков из открытого каталога (Рок, Рэп, Молодёжные хиты)</strong>
              <span class="muted-sm">Бесплатные официальные 30-сек отрывки (iTunes Open API)</span>
            </div>
            <div class="omf-search-row">
              <input type="text" id="inp-omf-query" value="${escapeHtml(this.musicQuery)}" placeholder="Например: Король и Шут, Три дня дождя, Nirvana, Big Baby Tape, Eminem...">
              <button type="button" class="btn btn-sm btn-gold" id="btn-omf-search" ${this.musicLoading ? 'disabled' : ''}>
                ${this.musicLoading ? '⏳ Ищем...' : '🔍 Найти трек'}
              </button>
            </div>
            ${this.musicError ? `<div class="omf-error">${escapeHtml(this.musicError)}</div>` : ''}
            ${this.musicResults.length > 0 ? `
              <div class="omf-results-list">
                ${this.musicResults.map((tr, idx) => `
                  <div class="omf-track-item">
                    ${tr.artwork ? `<img src="${escapeHtml(tr.artwork)}" alt="" class="omf-cover">` : ''}
                    <div class="omf-meta">
                      <strong>${escapeHtml(tr.artist)}</strong>
                      <span>${escapeHtml(tr.track)}</span>
                    </div>
                    <div class="omf-actions">
                      <button type="button" class="btn-tiny" data-omf-preview="${idx}">
                        ${this.previewAudioUrl === tr.previewUrl && !this.previewAudio.paused ? '⏹️ Стоп' : '▶️ Слушать'}
                      </button>
                      <button type="button" class="btn-tiny gold-btn-tiny" data-omf-pick="${idx}">
                        ➕ В вопрос
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  _renderFinalEditor() {
    const f = this.draft.final || { name: 'Финальный раунд', themes: [] };
    return `
      <div class="round-toolbar">
        <strong>Темы Финального раунда (игроки будут зачёркивать их по очереди до одной)</strong>
        <button class="btn btn-sm btn-secondary" data-act="add-final-theme">+ Добавить тему финала</button>
      </div>
      <div class="final-editor-list">
        ${f.themes.map((ft, idx) => `
          <div class="final-editor-item">
            <div class="final-item-top">
              <input type="text" data-ft-name="${idx}" value="${escapeHtml(ft.name)}" placeholder="Название финальной темы">
              ${f.themes.length > 1 ? `<button class="btn-tiny danger" data-del-ft="${idx}">✕</button>` : ''}
            </div>
            <textarea rows="2" data-ft-text="${idx}" placeholder="Текст финального вопроса...">${escapeHtml(ft.text)}</textarea>
            <div class="final-item-bottom">
              <input type="text" data-ft-ans="${idx}" value="${escapeHtml(ft.answer)}" placeholder="Правильный ответ">
              <input type="text" data-ft-comment="${idx}" value="${escapeHtml(ft.comment || '')}" placeholder="Комментарий (необязательно)">
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  _bindEvents() {
    const root = this.modalEl;
    root.onclick = (e) => {
      if (e.target === root) this.close();
    };

    root.querySelector('[data-act="close"]')?.addEventListener('click', () => this.close());

    root.querySelectorAll('[data-meta]').forEach((inp) => {
      inp.addEventListener('input', () => {
        this.draft[inp.dataset.meta] = inp.value;
      });
    });

    root.querySelectorAll('[data-round-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.roundTab;
        this.activeRoundIdx = val === 'final' ? 'final' : Number(val);
        this.editingQuestion = null;
        this.render();
      });
    });

    root.querySelector('[data-act="add-round"]')?.addEventListener('click', () => {
      const mult = this.draft.rounds.length + 1;
      this.draft.rounds.push({
        name: `Раунд ${mult}`,
        themes: [{
          name: 'Новая тема',
          questions: [1, 2, 3, 4, 5].map((i) => ({
            cost: i * 100 * mult,
            type: 'normal',
            catTheme: '',
            catCost: i * 100 * mult,
            text: '',
            image: '',
            audio: '',
            answer: '',
            comment: ''
          }))
        }]
      });
      this.activeRoundIdx = this.draft.rounds.length - 1;
      this.render();
    });

    root.querySelector('[data-act="del-round"]')?.addEventListener('click', () => {
      if (typeof this.activeRoundIdx === 'number' && this.draft.rounds.length > 1) {
        this.draft.rounds.splice(this.activeRoundIdx, 1);
        this.activeRoundIdx = 0;
        this.editingQuestion = null;
        this.render();
      }
    });

    root.querySelectorAll('[data-round-name]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.dataset.roundName);
        if (this.draft.rounds[idx]) this.draft.rounds[idx].name = inp.value;
      });
    });

    root.querySelector('[data-act="add-theme"]')?.addEventListener('click', () => {
      const r = this.draft.rounds[this.activeRoundIdx];
      if (!r) return;
      r.themes.push(makeEmptyTheme(`Тема ${r.themes.length + 1}`, this.activeRoundIdx));
      this.render();
    });

    root.querySelectorAll('[data-theme-name]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const tIdx = Number(inp.dataset.themeName);
        this.draft.rounds[this.activeRoundIdx].themes[tIdx].name = inp.value;
      });
    });

    root.querySelectorAll('[data-del-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tIdx = Number(btn.dataset.delTheme);
        this.draft.rounds[this.activeRoundIdx].themes.splice(tIdx, 1);
        this.editingQuestion = null;
        this.render();
      });
    });

    root.querySelectorAll('[data-add-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tIdx = Number(btn.dataset.addQ);
        const qs = this.draft.rounds[this.activeRoundIdx].themes[tIdx].questions;
        const nextCost = (qs[qs.length - 1]?.cost || 0) + 100 * (this.activeRoundIdx + 1);
        qs.push({
          cost: nextCost,
          type: 'normal',
          catTheme: '',
          catCost: nextCost,
          text: '',
          image: '',
          audio: '',
          answer: '',
          comment: ''
        });
        this.editingQuestion = { rIdx: this.activeRoundIdx, tIdx, qIdx: qs.length - 1 };
        this.render();
      });
    });

    root.querySelectorAll('[data-edit-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tIdx, qIdx] = btn.dataset.editQ.split(':').map(Number);
        this.editingQuestion = { rIdx: this.activeRoundIdx, tIdx, qIdx };
        this.render();
      });
    });

    root.querySelector('[data-act="del-q"]')?.addEventListener('click', () => {
      const eq = this.editingQuestion;
      if (!eq) return;
      this.draft.rounds[eq.rIdx].themes[eq.tIdx].questions.splice(eq.qIdx, 1);
      this.editingQuestion = null;
      this.render();
    });

    root.querySelectorAll('[data-q-field]').forEach((el) => {
      const evName = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evName, () => {
        const eq = this.editingQuestion;
        if (!eq) return;
        const q = this.draft.rounds[eq.rIdx].themes[eq.tIdx].questions[eq.qIdx];
        const field = el.dataset.qField;
        q[field] = field === 'cost' || field === 'catCost' ? Number(el.value) || 100 : el.value;
        if (field === 'type' || field === 'cost' || field === 'modifier') {
          this.render();
        }
      });
    });

    // Открытый поиск музыки (Рок, Рэп, Молодёжные хиты)
    const omfInp = root.querySelector('#inp-omf-query');
    omfInp?.addEventListener('input', () => {
      this.musicQuery = omfInp.value;
    });
    omfInp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._searchOpenTracks();
      }
    });
    root.querySelector('#btn-omf-search')?.addEventListener('click', () => this._searchOpenTracks());

    root.querySelectorAll('[data-omf-preview]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = this.musicResults[Number(btn.dataset.omfPreview)];
        if (!tr) return;
        if (this.previewAudioUrl === tr.previewUrl && !this.previewAudio.paused) {
          this.previewAudio.pause();
          this.previewAudioUrl = '';
        } else {
          this.previewAudio.src = tr.previewUrl;
          this.previewAudioUrl = tr.previewUrl;
          this.previewAudio.play().catch(() => {});
        }
        this.render();
      });
    });

    root.querySelectorAll('[data-omf-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = this.musicResults[Number(btn.dataset.omfPick)];
        const eq = this.editingQuestion;
        if (!tr || !eq) return;
        const q = this.draft.rounds[eq.rIdx]?.themes[eq.tIdx]?.questions[eq.qIdx];
        if (!q) return;
        q.audio = tr.previewUrl;
        if (!q.text.trim()) {
          q.text = 'Угадайте исполнителя и название этого трека!';
        }
        if (!q.answer.trim()) {
          q.answer = `${tr.artist} — «${tr.track}»`;
        }
        this.previewAudio.pause();
        this.previewAudioUrl = '';
        this.render();
      });
    });

    // Финал
    root.querySelector('[data-act="add-final-theme"]')?.addEventListener('click', () => {
      if (!this.draft.final) this.draft.final = { name: 'Финальный раунд', themes: [] };
      this.draft.final.themes.push({
        name: `Тема финала ${this.draft.final.themes.length + 1}`,
        text: '',
        answer: '',
        comment: ''
      });
      this.render();
    });

    root.querySelectorAll('[data-del-ft]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.delFt);
        this.draft.final.themes.splice(idx, 1);
        this.render();
      });
    });

    root.querySelectorAll('[data-ft-name]').forEach((inp) => {
      inp.addEventListener('input', () => {
        this.draft.final.themes[Number(inp.dataset.ftName)].name = inp.value;
      });
    });
    root.querySelectorAll('[data-ft-text]').forEach((inp) => {
      inp.addEventListener('input', () => {
        this.draft.final.themes[Number(inp.dataset.ftText)].text = inp.value;
      });
    });
    root.querySelectorAll('[data-ft-ans]').forEach((inp) => {
      inp.addEventListener('input', () => {
        this.draft.final.themes[Number(inp.dataset.ftAns)].answer = inp.value;
      });
    });
    root.querySelectorAll('[data-ft-comment]').forEach((inp) => {
      inp.addEventListener('input', () => {
        this.draft.final.themes[Number(inp.dataset.ftComment)].comment = inp.value;
      });
    });

    // Импорт / экспорт
    root.querySelector('[data-act="import-file"]')?.addEventListener('click', () => {
      const fileInp = document.createElement('input');
      fileInp.type = 'file';
      fileInp.accept = '.json,application/json';
      fileInp.onchange = async () => {
        const file = fileInp.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          this.draft = parsed;
          this.activeRoundIdx = 0;
          this.editingQuestion = null;
          this.render();
        } catch (err) {
          alert('Ошибка чтения JSON: ' + err.message);
        }
      };
      fileInp.click();
    });

    root.querySelector('[data-act="download-json"]')?.addEventListener('click', () => {
      const clean = this._cleanExportObject();
      const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clean.id || 'svoya-igra-pack'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    root.querySelector('[data-act="use-now"]')?.addEventListener('click', () => {
      const clean = this._cleanExportObject();
      if (this.onUsePack) {
        this.onUsePack(clean);
      }
      this.close();
    });
  }

  async _searchOpenTracks() {
    const q = (this.musicQuery || '').trim();
    if (!q || this.musicLoading) return;
    this.musicLoading = true;
    this.musicError = '';
    this.render();

    try {
      // Ищем сначала в RU-витрине для русских исполнителей, затем дополняем мировой US-витриной
      const hasCyrillic = /[а-яё]/i.test(q);
      const countries = hasCyrillic ? ['RU', 'US'] : ['US', 'RU'];
      let combined = [];

      for (const country of countries) {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&country=${country}&limit=8`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const items = (data.results || []).filter((r) => r.previewUrl);
        combined = combined.concat(items);
        if (combined.length >= 6) break;
      }

      const seen = new Set();
      this.musicResults = [];
      for (const r of combined) {
        const key = `${r.artistName}::${r.trackName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        this.musicResults.push({
          artist: r.artistName || 'Исполнитель',
          track: r.trackName || 'Трек',
          previewUrl: r.previewUrl,
          artwork: r.artworkUrl60 || ''
        });
        if (this.musicResults.length >= 6) break;
      }

      if (this.musicResults.length === 0) {
        this.musicError = 'Ничего не найдено — попробуйте уточнить название группы или трека.';
      }
    } catch (err) {
      this.musicError = 'Не удалось подключиться к открытому каталогу: ' + err.message;
    } finally {
      this.musicLoading = false;
      this.render();
    }
  }
}
