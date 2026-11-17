// Комнаты. Кухня открыта бесплатно; остальные появятся с обновлениями (пока замки).
import type { App, Screen } from '../app.ts';
import { hasAccess } from '../content/entitlements.ts';
import { url } from '../content/loader.ts';
import { STAGES } from '../progress/stages.ts';
import { h, onTap, playClass } from '../ui/dom.ts';
import { COIN, ICON } from '../ui/icons.ts';
import { Mo } from '../ui/mo.ts';
import { RoomScreen } from './room.ts';

const STAGE_ICON = { words: ICON.listen, check: ICON.check, phrases: ICON.phrase };
const PLANNED_ROOMS = 10;

export class HomeScreen implements Screen {
  el: HTMLElement;
  private mo: Mo;

  constructor(app: App) {
    this.mo = new Mo(app.audio, 'mo-home');
    const grid = h('div', { class: 'rooms' });
    const { catalog, rooms, pack } = app.content;
    // комната без картинок (черновик: слова и озвучка уже есть) показывается как «скоро»
    const ready = rooms.filter((r) => !!r.scenes[r.start]);
    for (const room of ready) {
      const open = hasAccess(catalog.free, [], pack.lang, room.id);
      const st = app.progress.stages(room);
      const dots = h('div', { class: 'room-stages' }, ...STAGES.map((s) =>
        h('span', { class: `rs ${st[s].done ? 'done' : st[s].unlocked ? 'open' : 'locked'}`, html: st[s].unlocked ? STAGE_ICON[s] : ICON.lock })));
      const card = h('button', { class: `room-card${open ? '' : ' locked'}`, 'aria-label': room.id },
        h('img', { src: url(room.scenes[room.start].image), alt: '', draggable: 'false' }), dots);
      onTap(card, () => {
        app.touched();
        if (!open) return void playClass(card, 'nope', 500);
        app.show(new RoomScreen(app, room));
      });
      grid.append(card);
    }
    for (let i = ready.length; i < PLANNED_ROOMS; i++)
      grid.append(h('div', { class: 'room-card soon', html: ICON.lock }));
    const coins = h('div', { class: 'coins' }, h('span', { class: 'coin', html: COIN }), h('b', {}, String(app.progress.coins)));
    this.el = h('div', { class: 'screen home' }, h('div', { class: 'sky' }), h('div', { class: 'home-top' }, this.mo.el, coins), grid);
  }

  destroy() {
    this.mo.destroy();
  }
}
