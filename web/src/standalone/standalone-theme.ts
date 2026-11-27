export type StandaloneTheme = 'light' | 'dark' | 'glass' | 'high-contrast';

/** Class on `<html>` for standalone “glass” (frosted) appearance; not from PatternFly 6.4 yet. */
const standaloneGlassThemeClass = 'netobserv-standalone-theme-glass';

export function applyStandaloneDocumentTheme(theme: StandaloneTheme): void {
  const html = document.documentElement;
  html.classList.toggle('pf-v6-theme-dark', theme === 'dark');
  html.classList.toggle(standaloneGlassThemeClass, theme === 'glass');
  // Light high contrast only; PF also supports dark + HC via both pf-v6-theme-dark and pf-v6-theme-high-contrast.
  html.classList.toggle('pf-v6-theme-high-contrast', theme === 'high-contrast');
}
