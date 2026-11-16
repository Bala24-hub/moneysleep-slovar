// Стартовый экран: Mo и большая кнопка «играть». Нажатие включает звук (требование iPad Safari).
import type { App, Screen } from '../app.ts';
import { h, onTap } from '../ui/dom.ts';
import { ICON } from '../ui/icons.ts';
import { Mo } from '../ui/mo.ts';
import { HomeScreen } from './home.ts';

export class StartScreen implements Screen {
  el: HTMLElement;
  private mo: Mo;

  constructor(app: App) {
    this.mo = new Mo(app.audio, 'mo-start');
    const play = h('button', { class: 'big-play', 'aria-label': 'play', html: ICON.play });
    this.el = h('div', { class: 'screen start' }, h('div', { class: 'sky' }), this.mo.el, play);
    let started = false;
    const go = async () => {
      if (started) return;
      started = true;
      app.audio.unlock();
      app.touched();
      play.classList.add('pressed');
      this.mo.setMood('happy');
      await app.audio.play([app.speech.mo('mo.learn_english_with_me')]);
      app.show(new HomeScreen(app));
    };
    onTap(play, go);
    onTap(this.mo.el, go);
  }

  destroy() {
    this.mo.destroy();
  }
}
