/**
 * ABDAxionikVS — Theme Manager
 * Centralized theme cycling and application logic
 */

export const THEMES = ['ms2000', 'audiolab', 'audiolab-light', 'advanced', 'cz101'] as const;
export type Theme = typeof THEMES[number];

export class ThemeManager {
  private currentIndex = 0;

  applyTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.body.className = `theme-${theme} skin-${theme}`;
  }

  setTheme(theme: Theme | string): void {
    const idx = THEMES.indexOf(theme as Theme);
    if (idx >= 0) {
      this.currentIndex = idx;
      this.applyTheme(theme);
    }
  }

  getCurrentTheme(): Theme {
    return THEMES[this.currentIndex];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  cycleTheme(): Theme {
    this.currentIndex = (this.currentIndex + 1) % THEMES.length;
    const theme = THEMES[this.currentIndex];
    this.applyTheme(theme);
    return theme;
  }

  setIndex(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentIndex = index;
      this.applyTheme(THEMES[this.currentIndex]);
    }
  }
}

export const themeManager = new ThemeManager();
