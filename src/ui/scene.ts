// Сцена комнаты: картинка + зоны нажатия (полигоны из content/rooms/*.json) + эффекты.
// Всё в координатах картинки через viewBox, поэтому одинаково на iPad и iPhone.
import type { Poly, RoomDef, SceneDef } from '../content/types.ts';
import { h, s, sleep } from './dom.ts';

let seq = 0;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

const bbox = (p: Poly): Box => {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, hh = Math.max(...ys) - y;
  return { x, y, w, h: hh, cx: x + w / 2, cy: y + hh / 2 };
};
const area = (p: Poly) => Math.abs(p.reduce((a, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return a + x * y2 - x2 * y; }, 0)) / 2;
const pts = (p: Poly) => p.map(([x, y]) => `${x},${y}`).join(' ');

export interface SceneOptions {
  /** Показывать кадр без предметов (для «Фраз») и класть предметы слоями. */
  empty?: boolean;
  onTap: (wordId: string | null, ev: PointerEvent) => void;
}

export class SceneView {
  readonly el: HTMLDivElement;
  readonly svg: SVGSVGElement;
  readonly def: SceneDef;
  private uid = ++seq;
  private zonesG: SVGGElement;
  private fxG: SVGGElement;
  private dimG: SVGGElement;
  private spritesG: SVGGElement;
  private polys = new Map<string, Poly>();
  private zoneEls = new Map<string, SVGPolygonElement>();
  readonly sprites = new Map<string, SVGImageElement>();
  private captionEl: HTMLDivElement | null = null;
  private active: Set<string> | null = null;

  constructor(readonly room: RoomDef, readonly sceneId: string, private opts: SceneOptions) {
    this.def = room.scenes[sceneId];
    const { width: W, height: H } = this.def;
    const u = this.uid;
    const defs = s('defs', {});
    defs.innerHTML = `
      <filter id="glow${u}" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="d"/>
        <feGaussianBlur in="d" stdDeviation="9" result="b"/>
        <feFlood flood-color="#FFF6CF" flood-opacity="1"/>
        <feComposite in2="b" operator="in" result="g"/>
        <feComponentTransfer in="SourceGraphic" result="br"><feFuncR type="linear" slope="1.12"/><feFuncG type="linear" slope="1.12"/><feFuncB type="linear" slope="1.12"/></feComponentTransfer>
        <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="br"/></feMerge>
      </filter>
      <filter id="ringglow${u}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="shadow${u}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="3" dy="10" stdDeviation="8" flood-color="#5a3510" flood-opacity=".32"/></filter>`;
    const href = opts.empty && this.def.empty ? this.def.empty : this.def.image;
    this.svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene-svg', preserveAspectRatio: 'xMidYMid slice' },
      defs,
      s('image', { href, x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none' }),
    );
    this.spritesG = s('g', { class: 'sprites' });
    this.dimG = s('g', { class: 'dim' });
    this.fxG = s('g', { class: 'fx' });
    this.zonesG = s('g', { class: 'zones' });
    this.svg.append(this.spritesG, this.dimG, this.fxG, this.zonesG);
    this.el = h('div', { class: 'scene' }, this.svg);

    // зоны: крупные снизу, мелкие сверху; невидимая обводка расширяет зону для детского пальца
    const words = room.words.filter((w) => w.zones[sceneId]).map((w) => ({ id: w.id, p: w.zones[sceneId] }));
    words.sort((a, b) => area(b.p) - area(a.p));
    for (const { id, p } of words) {
      this.polys.set(id, p);
      const el = s('polygon', { points: pts(p), class: 'zone', 'data-word': id });
      this.zoneEls.set(id, el);
      this.zonesG.append(el);
    }
    this.svg.addEventListener('pointerdown', (ev) => {
      if (!ev.isPrimary) return;
      ev.preventDefault();
      const t = (ev.target as Element).closest?.('[data-word]');
      const id = t?.getAttribute('data-word') ?? null;
      if (id && this.active && !this.active.has(id)) return this.opts.onTap(null, ev);
      this.opts.onTap(id, ev);
    });
  }

  /** Какие слова можно нажимать (null — все). */
  setActive(ids: string[] | null) {
    this.active = ids ? new Set(ids) : null;
    for (const [id, el] of this.zoneEls) el.style.display = !this.active || this.active.has(id) ? '' : 'none';
  }

  has(id: string) {
    return this.polys.has(id);
  }

  wordsHere(): string[] {
    return [...this.polys.keys()];
  }

  private box(id: string): Box {
    const sp = this.sprites.get(id);
    if (sp) {
      const x = +sp.getAttribute('x')!, y = +sp.getAttribute('y')!, w = +sp.getAttribute('width')!, hh = +sp.getAttribute('height')!;
      return { x, y, w, h: hh, cx: x + w / 2, cy: y + hh / 2 };
    }
    return bbox(this.polys.get(id)!);
  }

  /** Прямоугольник предмета на экране. */
  screenRect(id: string): DOMRect {
    const b = this.box(id);
    const r = this.svg.getBoundingClientRect();
    const k = r.width / this.def.width;
    return new DOMRect(r.left + b.x * k, r.top + b.y * k, b.w * k, b.h * k);
  }

  /** Подсветка предмета (этап «Слова»): светится и чуть «выпрыгивает». */
  async highlight(id: string, ms = 1700) {
    this.clearFx('hl');
    const b = this.box(id);
    const g = s('g', { class: 'hl', filter: `url(#glow${this.uid})` });
    g.style.transformOrigin = `${b.cx}px ${b.cy}px`;
    const sp = this.sprites.get(id);
    if (sp) {
      g.append(sp.cloneNode() as SVGImageElement);
    } else {
      const cid = `clip${this.uid}_${Math.random().toString(36).slice(2, 7)}`;
      const clip = s('clipPath', { id: cid }, s('polygon', { points: pts(this.polys.get(id)!) }));
      g.append(clip, s('image', { href: (this.svg.querySelector('image') as SVGImageElement).getAttribute('href')!, x: 0, y: 0, width: this.def.width, height: this.def.height, preserveAspectRatio: 'none', 'clip-path': `url(#${cid})` }));
    }
    this.fxG.append(g);
    await sleep(ms);
    g.classList.add('out');
    await sleep(300);
    g.remove();
  }

  /** Жёлтое кольцо вокруг предмета (верный ответ). */
  ring(id: string): SVGEllipseElement {
    const b = this.box(id);
    const pad = Math.max(12, Math.min(26, Math.min(b.w, b.h) * 0.08));
    const e = s('ellipse', {
      cx: b.cx, cy: b.cy, rx: b.w / 2 + pad, ry: b.h / 2 + pad, class: 'ring', pathLength: 1,
      filter: `url(#ringglow${this.uid})`,
    });
    this.fxG.append(e);
    return e;
  }

  /** «Из двух»: всё приглушено, кроме выбранных предметов. */
  spotlight(ids: string[] | null) {
    this.dimG.replaceChildren();
    if (!ids) return;
    const { width: W, height: H } = this.def;
    const mid = `mask${this.uid}`;
    const mask = s('mask', { id: mid }, s('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }));
    for (const id of ids) {
      const sp = this.sprites.get(id);
      if (sp) {
        const b = this.box(id);
        mask.append(s('ellipse', { cx: b.cx, cy: b.cy, rx: b.w / 2 + 14, ry: b.h / 2 + 14, fill: '#000' }));
      } else {
        mask.append(s('polygon', { points: pts(this.polys.get(id)!), fill: '#000', stroke: '#000', 'stroke-width': 16, 'stroke-linejoin': 'round' }));
      }
    }
    this.dimG.append(mask, s('rect', { x: 0, y: 0, width: W, height: H, class: 'dim-rect', mask: `url(#${mid})` }));
    for (const id of ids) {
      if (this.sprites.get(id)) continue;
      this.dimG.append(s('polygon', { points: pts(this.polys.get(id)!), class: 'halo' }));
    }
  }

  /** Лёгкое «нет-нет» для нажатого предмета. */
  async wiggle(id: string) {
    const b = this.box(id);
    const sp = this.sprites.get(id);
    if (sp) {
      sp.style.transformOrigin = `${b.cx}px ${b.cy}px`;
      sp.classList.remove('wiggle');
      void sp.getBoundingClientRect();
      sp.classList.add('wiggle');
      await sleep(600);
      sp.classList.remove('wiggle');
    }
  }

  clearFx(cls?: string) {
    for (const el of [...this.fxG.children]) if (!cls || el.classList.contains(cls)) el.remove();
  }

  // ---------------------------------------------------------------- слои предметов (этап «Фразы»)
  showSprites(ids: string[]) {
    this.spritesG.replaceChildren();
    this.sprites.clear();
    for (const id of ids) {
      const sp = this.room.words.find((w) => w.id === id)?.sprite;
      if (!sp || sp.scene !== this.sceneId) continue;
      const img = s('image', { href: sp.image, x: sp.x, y: sp.y, width: sp.w, height: sp.h, class: 'sprite', 'data-word': id, filter: `url(#shadow${this.uid})` });
      this.sprites.set(id, img);
      this.spritesG.append(img);
    }
    // на пустом столе нажимаются сами слои, полигоны оригинала не нужны
    this.zonesG.style.display = 'none';
  }

  // ---------------------------------------------------------------- подпись
  caption(id: string, text: string, ms = 2600) {
    this.captionEl?.remove();
    if (!text) return;
    const b = this.box(id);
    const { width: W, height: H } = this.def;
    const above = b.y > H * 0.14;
    const x = Math.min(Math.max(b.cx / W, 0.1), 0.9);
    const y = above ? b.y / H : (b.y + b.h) / H;
    const el = h('div', { class: `caption ${above ? 'above' : 'below'}`, style: `left:${x * 100}%;top:${y * 100}%` }, text);
    this.el.append(el);
    this.captionEl = el;
    window.setTimeout(() => {
      if (this.captionEl === el) {
        el.classList.add('out');
        window.setTimeout(() => el.remove(), 300);
      }
    }, ms);
  }

  clearCaption() {
    this.captionEl?.remove();
    this.captionEl = null;
  }
}
