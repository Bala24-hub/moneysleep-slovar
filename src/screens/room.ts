// Комната: три этапа (Слова → Проверка → Фразы), порядок строгий.
import type { App, Screen } from '../app.ts';
import type { Said } from '../content/speech.ts';
import type { RoomDef, WordDef } from '../content/types.ts';
import { checkPool, maxLevel, wordsInScene } from '../progress/levels.ts';
import {
  STAGES, firstOpenStage, phraseWords, pickCheckTarget, pickPhraseTarget, shuffle,
  type StageId, type StageState,
} from '../progress/stages.ts';
import { h, onTap, playClass, s, sleep } from '../ui/dom.ts';
import { coinTo, face, flyClone, stars } from '../ui/fx.ts';
import { COIN, FACE_HAPPY, ICON } from '../ui/icons.ts';
import { Mo } from '../ui/mo.ts';
import { SceneView } from '../ui/scene.ts';
import { HomeScreen } from './home.ts';

const STAGE_ICON: Record<StageId, string> = { words: ICON.listen, check: ICON.check, phrases: ICON.phrase };
/** Сколько верных ответов в одном круге «Проверки» и «Фраз». */
const ROUND = 5;
/** Режим «из двух» после ошибки держится столько верных ответов подряд. */
const EASY_AFTER_MISTAKE = 3;

export class RoomScreen implements Screen {
  /** Только для разработки/скриншотов: какой предмет спросить следующим. */
  static devNextTarget: string | null = null;
  el: HTMLElement;
  private area: HTMLDivElement;
  private card: HTMLDivElement;
  private viewport: HTMLDivElement;
  private backBtn: HTMLButtonElement;
  private bubble: HTMLButtonElement;
  private bubbleText: HTMLSpanElement;
  private coinsEl: HTMLDivElement;
  private coinsNum: HTMLElement;
  private stageBtns = {} as Record<StageId, HTMLButtonElement>;
  private mo: Mo;
  private views = new Map<string, SceneView>();
  private current: SceneView | null = null;
  private stage: StageId = 'words';
  private states: Record<StageId, StageState>;
  private gen = 0;
  private busy = true;
  private easy = 0;
  private recent: string[] = [];
  private roundN = 0;
  private target: string | null = null;
  private question: Said | null = null;
  private cardW = 0;

  constructor(private app: App, private room: RoomDef, stage?: StageId) {
    this.states = app.progress.stages(room);
    this.mo = new Mo(app.audio, 'mo-room');

    const home = h('button', { class: 'round home-btn', 'aria-label': 'home', html: ICON.home });
    onTap(home, () => this.goHome());
    const stagesEl = h('div', { class: 'stages' });
    STAGES.forEach((id, i) => {
      if (i > 0) stagesEl.append(h('span', { class: 'stage-dots' }));
      const b = h('button', { class: 'stage', 'data-stage': id, 'aria-label': id },
        ringSvg(), h('span', { class: 'stage-icon', html: STAGE_ICON[id] }), h('span', { class: 'stage-lock', html: ICON.lock }), h('span', { class: 'badge' }, String(i + 1)));
      onTap(b, () => this.goStage(id, true));
      this.stageBtns[id] = b;
      stagesEl.append(b);
    });
    this.coinsNum = h('b', {}, String(app.progress.coins));
    this.coinsEl = h('div', { class: 'coins' }, h('span', { class: 'coin', html: COIN }), this.coinsNum);
    const top = h('div', { class: 'topbar' }, home, stagesEl, this.coinsEl);

    this.viewport = h('div', { class: 'viewport' });
    this.backBtn = h('button', { class: 'round back-btn hidden', 'aria-label': 'back', html: ICON.back });
    onTap(this.backBtn, () => this.zoomOutToStart());
    this.bubbleText = h('span', { class: 'bubble-text' });
    this.bubble = h('button', { class: 'bubble hidden', 'aria-label': 'repeat' }, h('span', { class: 'bubble-ic', html: ICON.speaker }), this.bubbleText);
    onTap(this.bubble, () => this.repeatQuestion());
    onTap(this.mo.el, () => this.repeatQuestion());
    this.card = h('div', { class: 'card' }, this.viewport, this.backBtn, this.bubble);
    this.area = h('div', { class: 'stage-area' }, this.card, this.mo.el);
    this.el = h('div', { class: 'screen room' }, h('div', { class: 'sky' }), top, this.area);

    app.audio.preload(app.speech.urlsFor(room));
    this.refreshStages();
    queueMicrotask(() => this.goStage(stage ?? firstOpenStage(this.states)));
  }

  // ------------------------------------------------------------------ раскладка
  layout() {
    const r = this.area.getBoundingClientRect();
    if (!r.width) return;
    const sc = this.room.scenes[this.room.start];
    const ar = sc.width / sc.height;
    const pad = Math.max(10, Math.min(24, r.width * 0.02));
    const moH = Math.max(92, Math.min(230, r.height * 0.3));
    const moW = (moH * 182) / 194;
    const besideW = r.width - 2 * pad - moW * 0.95;
    let cw = Math.min(besideW, (r.height - pad) * ar);
    let left = (r.width - cw - moW * 0.95) / 2;
    if (cw >= (r.height - pad) * ar - 1) {
      // по высоте упираемся: Mo стоит сбоку
    } else {
      // по ширине упираемся (iPad): Mo заходит на угол картинки
      cw = Math.min(r.width - 2 * pad - moW * 0.5, (r.height - pad) * ar);
      left = (r.width - cw - moW * 0.5) / 2;
    }
    const ch = cw / ar;
    const top = Math.max(0, (r.height - pad - ch) / 2);
    Object.assign(this.card.style, { left: `${left}px`, top: `${top}px`, width: `${cw}px`, height: `${ch}px` });
    const moLeft = Math.min(r.width - moW - pad * 0.3, left + cw - moW * 0.42);
    Object.assign(this.mo.el.style, { left: `${moLeft}px`, top: `${top + ch - moH * 0.86}px`, width: `${moW}px`, height: `${moH}px` });
    this.cardW = cw;
    this.el.style.setProperty('--card-w', `${cw}px`);
  }

  // ------------------------------------------------------------------ этапы
  private refreshStages(prev?: Record<StageId, StageState>) {
    this.states = this.app.progress.stages(this.room);
    for (const id of STAGES) {
      const st = this.states[id];
      const b = this.stageBtns[id];
      b.classList.toggle('locked', !st.unlocked);
      b.classList.toggle('active', id === this.stage);
      b.classList.toggle('done', st.done);
      const arc = b.querySelector('.ring-val') as SVGCircleElement;
      arc.style.strokeDashoffset = String(1 - (st.total ? st.n / st.total : 0));
      if (prev && !prev[id].unlocked && st.unlocked) void this.celebrateUnlock(id);
    }
  }

  private async celebrateUnlock(id: StageId) {
    await sleep(900);
    const b = this.stageBtns[id];
    const r = b.getBoundingClientRect();
    stars({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 12, 90, 26);
    b.classList.add('pulse');
  }

  private goStage(id: StageId, byTap = false) {
    if (!this.states[id].unlocked) {
      void playClass(this.stageBtns[id], 'nope', 500);
      return;
    }
    if (byTap && id === this.stage && this.current) return;
    this.app.touched();
    this.gen++;
    this.app.audio.stop();
    this.stage = id;
    this.stageBtns[id].classList.remove('pulse');
    this.refreshStages();
    this.closeOverlay();
    this.hideBubble();
    this.mo.setMood('idle');
    this.easy = 0;
    this.roundN = 0;
    this.recent = [];
    this.backBtn.classList.add('hidden');
    for (const v of this.views.values()) {
      v.spotlight(null);
      v.clearFx();
      v.clearCaption();
      v.setActive(this.tappable(v));
    }
    if (id === 'words') void this.startWords();
    else if (id === 'check') void this.nextQuestion();
    else void this.startPhrases();
  }

  // ------------------------------------------------------------------ сцены и наезд камеры
  private view(sceneId: string, empty = false): SceneView {
    const key = `${sceneId}|${empty}`;
    let v = this.views.get(key);
    if (!v) {
      v = new SceneView(this.room, sceneId, { empty, onTap: (id, ev) => this.onSceneTap(id, ev) });
      v.setActive(this.tappable(v));
      this.views.set(key, v);
    }
    return v;
  }

  private async showScene(sceneId: string, empty = false): Promise<SceneView> {
    const next = this.view(sceneId, empty);
    const cur = this.current;
    if (cur === next) return next;
    this.current = next;
    next.el.style.transform = '';
    next.el.style.transition = '';
    if (!cur) {
      next.el.style.opacity = '1';
      this.viewport.append(next.el);
      return next;
    }
    const zf = next.def.zoomFrom;
    if (zf && next.def.parent === cur.sceneId) {
      // наезд: комната → крупный план
      zoomTransform(cur, zf, true);
      await sleep(430);
      next.el.style.opacity = '0';
      this.viewport.append(next.el);
      await nextFrameP();
      next.el.style.transition = 'opacity .28s ease';
      next.el.style.opacity = '1';
      await sleep(300);
      cur.el.remove();
      cur.el.style.transition = 'none';
      cur.el.style.transform = '';
    } else if (cur.def.zoomFrom && cur.def.parent === sceneId) {
      // отъезд: крупный план → комната
      next.el.style.transition = 'none';
      zoomTransform(next, cur.def.zoomFrom, false);
      next.el.style.opacity = '1';
      this.viewport.prepend(next.el);
      await nextFrameP();
      cur.el.style.transition = 'opacity .25s ease';
      cur.el.style.opacity = '0';
      await sleep(240);
      cur.el.remove();
      cur.el.style.opacity = '1';
      next.el.style.transition = 'transform .5s cubic-bezier(.5,0,.25,1)';
      next.el.style.transform = '';
      await sleep(500);
    } else {
      next.el.style.opacity = '0';
      this.viewport.append(next.el);
      await nextFrameP();
      next.el.style.transition = 'opacity .3s ease';
      next.el.style.opacity = '1';
      await sleep(320);
      cur.el.remove();
    }
    return next;
  }

  private async zoomOutToStart() {
    if (!this.current || this.current.sceneId === this.room.start) return;
    this.app.touched();
    this.app.audio.stop();
    this.backBtn.classList.add('hidden');
    await this.showScene(this.room.start);
  }

  /** Уровень, открытый в комнате сейчас (1 — предметы, 2 — детали). */
  private get level() {
    return maxLevel(this.room, this.app.progress.pm, this.app.levelMode);
  }

  /** Что можно нажимать в сцене без подсказки «из двух»: слова открытого уровня. */
  private tappable(v: SceneView): string[] {
    return wordsInScene(this.room, v.sceneId, this.level);
  }

  private word(id: string): WordDef {
    return this.room.words.find((w) => w.id === id)!;
  }

  private onSceneTap(id: string | null, _ev: PointerEvent) {
    this.app.touched();
    if (!id) return;
    if (this.stage === 'words') void this.wordsTap(id);
    else if (this.stage === 'check') void this.checkTap(id);
    else void this.phraseTap(id);
  }

  // ------------------------------------------------------------------ 1. Слова
  private async startWords() {
    const g = this.gen;
    await this.showScene(this.room.start);
    if (g !== this.gen) return;
    this.busy = false;
  }

  private async wordsTap(id: string) {
    const g = this.gen;
    let v = this.current!;
    const w = this.word(id);
    if (w.scene !== v.sceneId && this.room.scenes[w.scene]?.parent === v.sceneId) {
      // мелкий предмет — через крупный план
      this.app.audio.stop();
      v = await this.showScene(w.scene);
      if (g !== this.gen) return;
      this.backBtn.classList.remove('hidden');
    }
    const said = this.app.speech.word(id);
    void v.highlight(id);
    if (this.app.captions) v.caption(id, said.text);
    const prev = this.states;
    await this.app.progress.heard(this.room, id);
    this.refreshStages(prev);
    await this.app.audio.play([said]);
  }

  // ------------------------------------------------------------------ 2. Проверка
  private async nextQuestion() {
    const g = this.gen;
    this.busy = true;
    if (this.roundN >= ROUND) return this.roundDone();
    const ids = checkPool(this.room, this.app.progress.pm, this.level);
    const target = takeDev() ?? pickCheckTarget(ids, this.app.progress.pm, this.app.progress.today, this.recent.slice(-2));
    this.target = target;
    this.recent.push(target);
    const v = await this.showScene(this.word(target).scene);
    if (g !== this.gen) return;
    let choices: string[] | null = null;
    if (this.easy > 0) {
      const others = this.tappable(v).filter((x) => x !== target);
      choices = shuffle([target, others[Math.floor(Math.random() * others.length)]]);
    }
    v.spotlight(choices);
    v.setActive(choices ?? this.tappable(v));
    await this.app.progress.asked(this.room, target);
    this.question = this.app.speech.checkQuestion(this.room, target);
    this.busy = false;
    await this.ask(g);
  }

  private async ask(g: number) {
    if (!this.question || g !== this.gen) return;
    this.showBubble(this.question.text);
    await this.app.audio.play([this.question]);
  }

  private repeatQuestion() {
    if (this.stage === 'words' || this.busy || !this.question) return;
    this.app.touched();
    void playClass(this.bubble, 'tap', 300);
    void this.ask(this.gen);
  }

  private async checkTap(id: string) {
    if (this.busy || !this.target) return;
    this.busy = true;
    const g = this.gen;
    const v = this.current!;
    const target = this.target;
    this.app.audio.stop();
    const prev = this.states;
    if (id === target) {
      await this.app.progress.answer(this.room, target, true);
      this.roundN++;
      this.easy = Math.max(0, this.easy - 1);
      v.spotlight(null);
      v.ring(id);
      const r = v.screenRect(id);
      stars({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 12, Math.max(110, r.width * 0.8), this.cardW * 0.035);
      void face('happy', this.faceAt(), this.cardW * 0.15, 1300);
      this.mo.setMood('happy');
      this.hideBubble();
      await this.app.audio.play([this.app.speech.word(id)]);
      await sleep(600);
      if (g !== this.gen) return;
      v.clearFx();
      this.mo.setMood('idle');
      this.refreshStages(prev);
      void this.nextQuestion();
    } else {
      await this.app.progress.answer(this.room, target, false);
      this.easy = EASY_AFTER_MISTAKE;
      void face('sad', this.faceAt(), this.cardW * 0.15, 1300);
      this.mo.setMood('sad');
      const wr = this.app.speech.wrong(target, id);
      this.showBubble(wr.text);
      await this.app.audio.play(wr.segs, (i) => {
        if (i === wr.tappedAt) void v.highlight(id, 1300);
      });
      if (g !== this.gen) return;
      this.mo.setMood('idle');
      // «из двух»: нужный предмет и тот, что нажали
      const two = shuffle([target, id]);
      v.spotlight(two);
      v.setActive(two);
      this.busy = false;
      await this.ask(g);
    }
  }

  private faceAt() {
    const r = this.card.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.3 };
  }

  // ------------------------------------------------------------------ 3. Фразы
  private async startPhrases() {
    const g = this.gen;
    await this.showScene(this.room.stages.phrases.scene, true);
    if (g !== this.gen) return;
    await this.nextPhrase();
  }

  private async nextPhrase() {
    const g = this.gen;
    this.busy = true;
    if (this.roundN >= ROUND) return this.roundDone();
    const ids = phraseWords(this.room).map((w) => w.id);
    const target = takeDev() ?? pickPhraseTarget(ids, this.app.progress.pm, this.recent.slice(-1));
    this.target = target;
    this.recent.push(target);
    const others = shuffle(ids.filter((x) => x !== target)).slice(0, this.room.stages.phrases.choices - 1);
    const v = this.current!;
    v.showSprites([target, ...others]);
    for (const el of v.sprites.values()) void playClass(el, 'pop-in', 500);
    await sleep(450);
    if (g !== this.gen) return;
    const type = this.word(target).phrases![0];
    this.question = this.app.speech.phrase(type, target);
    this.busy = false;
    await this.ask(g);
  }

  private async phraseTap(id: string) {
    if (this.busy || !this.target) return;
    this.busy = true;
    const g = this.gen;
    const v = this.current!;
    const target = this.target;
    this.app.audio.stop();
    if (id === target) {
      this.hideBubble();
      const sp = v.sprites.get(id)!;
      const rect = v.screenRect(id);
      sp.style.opacity = '0';
      const to = this.mo.handsPoint();
      const flyer = await flyClone(sp, rect, to, { href: sp.getAttribute('href')!, endScale: Math.min(0.5, (this.mo.el.offsetWidth * 0.42) / Math.max(rect.width, rect.height)) });
      this.mo.setMood('happy');
      stars(to, 8, 80, this.cardW * 0.03);
      await this.app.progress.phraseDone(this.room, id);
      this.roundN++;
      const thanks = this.app.audio.play([this.app.speech.mo('mo.thank_you')]);
      const cr = this.coinsEl.querySelector('.coin')!.getBoundingClientRect();
      await coinTo({ x: to.x, y: to.y - this.mo.el.offsetHeight * 0.55 }, { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 }, this.cardW * 0.06);
      await this.app.progress.addCoin();
      this.coinsNum.textContent = String(this.app.progress.coins);
      void playClass(this.coinsEl, 'bump', 400);
      await thanks;
      flyer.animate([{ opacity: 1 }, { opacity: 0, transform: getComputedStyle(flyer).transform + ' scale(.6)' }], { duration: 250, fill: 'forwards' });
      await sleep(260);
      flyer.remove();
      if (g !== this.gen) return;
      this.mo.setMood('idle');
      void this.nextPhrase();
    } else {
      void face('sad', this.faceAt(), this.cardW * 0.15, 1300);
      this.mo.setMood('sad');
      void v.wiggle(id);
      const wr = this.app.speech.wrong(target, id);
      this.showBubble(wr.text);
      await this.app.audio.play(wr.segs, (i) => {
        if (i === wr.tappedAt) void v.highlight(id, 1300);
      });
      if (g !== this.gen) return;
      this.mo.setMood('idle');
      this.busy = false;
      await this.ask(g);
    }
  }

  // ------------------------------------------------------------------ конец круга
  private overlay: HTMLElement | null = null;

  private async roundDone() {
    const g = this.gen;
    this.hideBubble();
    this.mo.setMood('happy');
    const next: StageId | null = this.stage === 'check' && this.states.phrases.unlocked ? 'phrases' : null;
    const replay = h('button', { class: 'round-big', 'aria-label': 'again', html: ICON.replay });
    const homeB = h('button', { class: 'round-big ghost', 'aria-label': 'home', html: ICON.home });
    const buttons = h('div', { class: 'done-buttons' }, homeB, replay);
    if (next) {
      const nb = h('button', { class: 'round-big next', 'aria-label': 'next', html: STAGE_ICON[next] });
      onTap(nb, () => this.goStage(next));
      buttons.append(nb);
    }
    onTap(replay, () => this.goStage(this.stage));
    onTap(homeB, () => this.goHome());
    const ov = h('div', { class: 'overlay' }, h('div', { class: 'done-face', html: FACE_HAPPY }), buttons);
    this.overlay = ov;
    this.card.append(ov);
    await sleep(80);
    if (g !== this.gen) return;
    const r = (ov.querySelector('.done-face') as HTMLElement).getBoundingClientRect();
    stars({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 16, r.width * 1.1, this.cardW * 0.04);
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  // ------------------------------------------------------------------ пузырь с фразой
  private showBubble(text: string) {
    this.bubbleText.textContent = this.app.captions ? text : '';
    this.bubble.classList.toggle('icon-only', !this.app.captions || !text);
    this.bubble.classList.remove('hidden');
    void playClass(this.bubble, 'pop', 300);
  }

  private hideBubble() {
    this.bubble.classList.add('hidden');
  }

  private goHome() {
    this.gen++;
    this.app.audio.stop();
    this.app.show(new HomeScreen(this.app));
  }

  get devState() {
    return { target: this.target, busy: this.busy, stage: this.stage, round: this.roundN };
  }

  /** Для скриншотов: где на экране предмет. */
  devRect(id: string): DOMRect | null {
    return this.current?.has(id) || this.current?.sprites.has(id) ? this.current.screenRect(id) : null;
  }

  destroy() {
    this.gen++;
    this.mo.destroy();
    this.closeOverlay();
  }
}

function takeDev(): string | null {
  const t = RoomScreen.devNextTarget;
  RoomScreen.devNextTarget = null;
  return t;
}

function ringSvg(): SVGSVGElement {
  return s('svg', { class: 'stage-ring', viewBox: '0 0 100 100' },
    s('circle', { cx: 50, cy: 50, r: 46, class: 'ring-track' }),
    s('circle', { cx: 50, cy: 50, r: 46, class: 'ring-val', pathLength: 1, transform: 'rotate(-90 50 50)' }));
}

/** Наезд на прямоугольник zf (в пикселях сцены) — проценты, чтобы не зависеть от размера. */
function zoomTransform(v: SceneView, zf: [number, number, number, number], animate: boolean) {
  const { width: W, height: H } = v.def;
  const k = W / zf[2];
  v.el.style.transformOrigin = '0 0';
  if (animate) v.el.style.transition = 'transform .5s cubic-bezier(.55,0,.3,1)';
  v.el.style.transform = `translate(${(-k * zf[0] * 100) / W}%, ${(-k * zf[1] * 100) / H}%) scale(${k})`;
}

const nextFrameP = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
