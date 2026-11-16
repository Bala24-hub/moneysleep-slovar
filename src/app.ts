// Состояние приложения и смена экранов.
import type { AudioEngine } from './audio/engine.ts';
import type { Content } from './content/loader.ts';
import type { Speech } from './content/speech.ts';
import type { LevelMode } from './progress/levels.ts';
import type { Progress } from './progress/store.ts';

export interface Screen {
  el: HTMLElement;
  destroy(): void;
  /** Вызывается после вставки в DOM и при изменении размера окна. */
  layout?(): void;
}

export interface App {
  root: HTMLElement;
  audio: AudioEngine;
  content: Content;
  speech: Speech;
  progress: Progress;
  /** Подписи на картинках (отключаются в родительской части). */
  captions: boolean;
  /** Переключатель родителей «малыш / постарше»; auto — уровень 2 по успехам. */
  levelMode: LevelMode;
  show(screen: Screen): void;
  /** Последнее касание — для подсчёта минут в день. */
  touched(): void;
}

export function createShow(root: HTMLElement) {
  let cur: Screen | null = null;
  const onResize = () => cur?.layout?.();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 300));
  return (next: Screen) => {
    const prev = cur;
    cur = next;
    next.el.classList.add('screen-in');
    root.append(next.el);
    next.layout?.();
    if (prev) {
      prev.el.classList.add('screen-out');
      setTimeout(() => {
        prev.destroy();
        prev.el.remove();
      }, 320);
    }
  };
}
