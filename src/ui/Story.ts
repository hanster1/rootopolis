import { NAMES, type Line } from '../game/story';
import type { Audio } from '../audio/Audio';

const PORTRAIT: Record<string, string | null> = {
  tink: 'art/tink.webp',
  bolt: 'art/bolt.webp',
  mayor: 'art/mayor.webp',
  crow: 'art/crow.webp',
  narrator: null,
};

/**
 * Illustrated, animated dialogue scenes: chapter art with a slow Ken Burns move,
 * speaker portraits that slide and bob, typewriter text, tap to continue, Skip.
 */
export class StoryPlayer {
  private root: HTMLElement;
  private bg: HTMLElement;
  private portrait: HTMLImageElement;
  private name: HTMLElement;
  private text: HTMLElement;
  private beep: HTMLElement;
  private title: HTMLElement;
  private lines: Line[] = [];
  private i = 0;
  private typing = 0;
  private full = '';
  private done: (() => void) | null = null;
  active = false;

  constructor(private audio: Audio) {
    this.root = document.querySelector('#story')!;
    this.bg = this.root.querySelector('.story-bg')!;
    this.portrait = this.root.querySelector('.story-portrait')!;
    this.name = this.root.querySelector('.story-name')!;
    this.text = this.root.querySelector('.story-text')!;
    this.beep = this.root.querySelector('.story-beep')!;
    this.title = this.root.querySelector('.story-title')!;
    this.root.querySelector('.story-skip')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });
    this.root.addEventListener('click', () => this.advance());
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.key === 'Escape') this.finish();
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.advance();
      }
    });
  }

  play(art: string, heading: string, lines: Line[], done: () => void): void {
    this.lines = lines;
    this.i = 0;
    this.done = done;
    this.active = true;
    this.bg.style.backgroundImage = `url(${art})`;
    this.bg.classList.remove('kb');
    void this.bg.offsetWidth;
    this.bg.classList.add('kb');
    this.title.textContent = heading;
    this.title.classList.remove('show');
    void this.title.offsetWidth;
    this.title.classList.add('show');
    this.root.hidden = false;
    this.show();
  }

  get index(): number {
    return this.i;
  }

  private show(): void {
    const l = this.lines[this.i];
    const src = PORTRAIT[l.who];
    this.root.dataset.who = l.who;
    if (src) {
      this.portrait.src = src;
      this.portrait.hidden = false;
      this.portrait.classList.remove('in');
      void this.portrait.offsetWidth;
      this.portrait.classList.add('in');
    } else this.portrait.hidden = true;
    this.name.textContent = NAMES[l.who];
    this.name.hidden = !NAMES[l.who];
    this.beep.textContent = l.beep ?? '';
    this.beep.hidden = !l.beep;
    if (l.who === 'bolt') this.audio.bolt();
    else this.audio.uiTap();
    this.full = l.text;
    this.text.textContent = '';
    let n = 0;
    window.clearInterval(this.typing);
    this.typing = window.setInterval(() => {
      n += 2;
      this.text.textContent = this.full.slice(0, n);
      if (n >= this.full.length) window.clearInterval(this.typing);
    }, 22);
  }

  advance(): void {
    if (!this.active) return;
    if (this.text.textContent !== this.full) {
      window.clearInterval(this.typing);
      this.text.textContent = this.full;
      return;
    }
    this.i++;
    if (this.i >= this.lines.length) this.finish();
    else this.show();
  }

  finish(): void {
    if (!this.active) return;
    window.clearInterval(this.typing);
    this.active = false;
    this.root.hidden = true;
    const d = this.done;
    this.done = null;
    d?.();
  }
}
