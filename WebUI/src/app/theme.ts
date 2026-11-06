/**
 * ABDAxionikVS — app/theme.ts
 * Theme + zoom fan-out: ThemeManager first, navbar mirror second.
 */
import type { AppCtx } from './context.js';

export function applyTheme(ctx: AppCtx, theme: string): void {
  ctx.themeManager.setTheme(theme);
  ctx.navbar?.setTheme(theme);
}

export function applyZoom(ctx: AppCtx, zoom: number): void {
  ctx.state.currentZoom = zoom;
  document.body.style.zoom = String(zoom);
  ctx.navbar?.setZoom(zoom);
}
