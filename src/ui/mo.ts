// Mo с ртом, который открывается под голос (как в рекламном ролике, см. assets/mo/README.md).
import moTalk from '../../assets/mo/mo_talk.svg?raw';
import type { AudioEngine } from '../audio/engine.ts';
import { h, playClass } from './dom.ts';

let seq = 0;
export type Mood = 'idle' | 'happy' | 'sad';

const SMILE = 'M75 126 Q82 132 89 126';
const FROWN = 'M75 131 Q82 125 89 131';

export class Mo {
  readonly el: HTMLDivElement;
  private mC: SVGPathElement;
  private mO: SVGGElement;
  private mOe: SVGPathElement;
  private mOc: SVGPathElement;
  private mOt: SVGEllipseElement;
  private o = 0;
  private timer = 0;
  private mood: Mood = 'idle';

  constructor(private audio: AudioEngine, cls = '') {
    const id = `mClip${++seq}`;
    const markup = moTalk.replace(/id="mClip"/, `id="${id}"`).replace(/url\(#mClip\)/, `url(#${id})`);
    this.el = h('div', { class: `mo ${cls}`, html: markup });
    const q = <T extends Element>(sel: string) => this.el.querySelector(sel) as T;
    this.mC = q('#mC');
    this.mO = q('#mO');
    this.mOe = q('#mOe');
    this.mOc = q('#mOc');
    this.mOt = q('#mOt');
    for (const n of [this.mC, this.mO, this.mOe, this.mOc, this.mOt]) n.removeAttribute('id');
    this.start();
  }

  /** Каждые ~33 мс: громкость → o (быстро открывается, мягче закрывается) → форма рта. */
  private start() {
    const tick = () => {
      const lvl = this.audio.level();
      this.o += (lvl - this.o) * (lvl > this.o ? 0.6 : 0.22);
      this.drawMouth();
    };
    this.timer = window.setInterval(tick, 33);
  }

  private drawMouth() {
    const o = this.o;
    if (o < 0.08) {
      this.mO.setAttribute('opacity', '0');
      this.mC.style.opacity = '1';
      return;
    }
    const hgt = 3.4 + o * 9, w = 6.4 + o * 1.8, y0 = 125.2, x0 = 82 - w, x1 = 82 + w;
    const d = `M${x0} ${y0} Q82 ${y0 + 2.2} ${x1} ${y0} C${x1} ${y0 + hgt * 0.7} ${82 + w * 0.55} ${y0 + hgt} 82 ${y0 + hgt} C${82 - w * 0.55} ${y0 + hgt} ${x0} ${y0 + hgt * 0.7} ${x0} ${y0}Z`;
    this.mOe.setAttribute('d', d);
    this.mOc.setAttribute('d', d);
    this.mOt.setAttribute('rx', String(w * 0.62));
    this.mOt.setAttribute('ry', String(hgt * 0.32));
    this.mOt.setAttribute('cy', String(y0 + hgt * 0.92));
    this.mO.setAttribute('opacity', '1');
    this.mC.style.opacity = '0';
  }

  setMood(m: Mood) {
    this.mood = m;
    this.el.classList.toggle('sad', m === 'sad');
    this.mC.setAttribute('d', m === 'sad' ? FROWN : SMILE);
    if (m === 'happy') void playClass(this.el, 'jump', 700);
  }

  get currentMood() {
    return this.mood;
  }

  /** Точка «у руки Mo» в координатах экрана (куда летят предметы): слева от него, лицо не закрываем. */
  handsPoint(): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: r.left + r.width * 0.06, y: r.top + r.height * 0.66 };
  }

  destroy() {
    clearInterval(this.timer);
  }
}
