import { useLayoutEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { useLanguage } from '../i18n';

const STORAGE_KEY = 'knihovnik_preferred_theme';
const THEMES = [
  { id: 'forest', label: 'themeForest' },
  { id: 'night', label: 'themeNight' },
  { id: 'summer', label: 'themeSummer' },
  { id: 'blueprint', label: 'themeBlueprint' },
  { id: 'mono-light', label: 'themeMonoLight' },
  { id: 'mono-dark', label: 'themeMonoDark' },
] as const;
type Theme = (typeof THEMES)[number]['id'];

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.find(({ id }) => id === saved)?.id ?? 'forest';
  } catch {
    return 'forest';
  }
}

export function ThemeSelect() {
  const { t } = useLanguage();
  const [theme, setTheme] = useState(readTheme);
  const selected = THEMES.find(({ id }) => id === theme) ?? THEMES[0];

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <label
      className="relative inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 sm:px-2 rounded-lg border border-chrome-line bg-chrome-panel text-chrome-text hover:bg-chrome-hover focus-within:ring-2 focus-within:ring-chrome-muted"
      title={`${t('themeSelect')} · ${t(selected.label)}`}
    >
      <Palette className="size-4 pointer-events-none" aria-hidden="true" />
      <span className="hidden whitespace-nowrap text-xs font-medium sm:inline" aria-hidden="true">
        {t(selected.label)}
      </span>
      <select
        value={theme}
        aria-label={t('themeSelect')}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
        onChange={(event) => {
          const next = THEMES.find(({ id }) => id === event.target.value);
          if (!next) return;
          setTheme(next.id);
          try {
            localStorage.setItem(STORAGE_KEY, next.id);
          } catch {
            // Theme switching still works when storage is unavailable.
          }
        }}
      >
        {THEMES.map(({ id, label }) => <option key={id} value={id}>{t(label)}</option>)}
      </select>
    </label>
  );
}
