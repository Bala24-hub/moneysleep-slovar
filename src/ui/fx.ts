// Эффекты поверх экрана: мордашки, звёздочки, полёт предмета к Mo, монетка.
import { COIN, FACE_HAPPY, FACE_SAD, STAR } from './icons.ts';
import { h, sleep } from './dom.ts';

let layer: HTMLDivElement | null = null;
export function fxLayer(): HTMLDivElement {
  if (!layer || !layer.isConnected) {
    layer = h('div', { class: 'fx-layer' });
    document.body.append(layer);
  }
  return layer;
}

export interface Pt {
  x: number;
  y: number;
}

/** Большая мордашка: улыбка или грусть. */
export async function face(kind: 'happy' | 'sad', at: Pt, size: number, ms = 1400) {
  const el = h('div', { class: `face face-${kind}`, html: kind === 'happy' ? FACE_HAPPY : FACE_SAD, style: `left:${at.x}px;top:${at.y}px;width:${size}px;height:${size}px` });
  fxLayer().append(el);
  await sleep(ms);
  el.classList.add('out');
  await sleep(350);
  el.remove();
}

/** Звёздочки разлетаются из точки. */
export function stars(at: Pt, n = 10, radius = 140, size = 34) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const r = radius * (0.7 + Math.random() * 0.5);
    const el = h('div', { class: 'star', html: STAR, style: `left:${at.x}px;top:${at.y}px;width:${size}px;height:${size}px;--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px;--rot:${(Math.random() - 0.5) * 300}deg;animation-delay:${i * 18}ms` });
    fxLayer().append(el);
    window.setTimeout(() => el.remove(), 1300 + i * 18);
  }
}

/** Полёт элемента по дуге из прямоугольника from в точку to (Web Animations). */
export async function flyClone(src: Element, from: DOMRect, to: Pt, opts: { endScale?: number; ms?: number; href?: string } = {}) {
  const { endScale = 0.35, ms = 900 } = opts;
  const el = opts.href
    ? h('img', { src: opts.href, class: 'flyer', alt: '' })
    : (src.cloneNode(true) as HTMLElement);
  el.classList.add('flyer');
  Object.assign(el.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  fxLayer().append(el);
  const dx = to.x - (from.left + from.width / 2);
  const dy = to.y - (from.top + from.height / 2);
  const lift = Math.min(-80, -Math.abs(dx) * 0.35);
  const anim = el.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 0 },
      { transform: 'translate(0,-18px) scale(1.12) rotate(-6deg)', offset: 0.15 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(${(1 + endScale) / 2}) rotate(8deg)`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${endScale}) rotate(0deg)`, offset: 1 },
    ],
    { duration: ms, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' },
  );
  await anim.finished.catch(() => {});
  return el;
}

/** Монетка +1: выскакивает у Mo и летит в счётчик. */
export async function coinTo(from: Pt, to: Pt, size = 56) {
  const el = h('div', { class: 'coin-fly', html: COIN, style: `left:${from.x - size / 2}px;top:${from.y - size / 2}px;width:${size}px;height:${size}px` });
  const plus = h('div', { class: 'plus-one', style: `left:${from.x + size * 0.45}px;top:${from.y - size * 0.9}px` }, '+1');
  fxLayer().append(el, plus);
  await el.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' }).finished;
  await sleep(250);
  const dx = to.x - from.x, dy = to.y - from.y;
  await el.animate(
    [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 90}px) scale(1.1)` },
      { transform: `translate(${dx}px, ${dy}px) scale(.55)` },
    ],
    { duration: 750, easing: 'cubic-bezier(.5,0,.4,1)', fill: 'forwards' },
  ).finished;
  el.remove();
  window.setTimeout(() => plus.remove(), 400);
}
