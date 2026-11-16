// Мини-помощники для DOM без фреймворка.
type Attrs = Record<string, string | number | boolean | undefined | null | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c != null && c !== false) el.append(c);
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number | undefined> = {}, ...kids: Node[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Проиграть CSS-анимацию класса и дождаться конца. */
export function playClass(el: Element, cls: string, ms: number): Promise<void> {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  return sleep(ms).then(() => el.classList.remove(cls));
}

/** Нажатие без задержек: pointerdown, одно касание, без двойных срабатываний. */
export function onTap(el: Element, fn: (ev: PointerEvent) => void): void {
  el.addEventListener('pointerdown', (ev) => {
    const e = ev as PointerEvent;
    if (!e.isPrimary || e.button > 0) return;
    e.preventDefault();
    fn(e);
  });
}
