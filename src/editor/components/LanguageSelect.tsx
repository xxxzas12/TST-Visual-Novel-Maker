import { LANGUAGES, t as tr, type Lang } from '../../shared/i18n';
import { api } from '../api';
import { applyLanguage, useUi } from '../store/ui';

/** Editor language switch (saved in the app settings). */
export function LanguageSelect({ compact }: { compact?: boolean }) {
  const language = useUi((s) => s.language);
  return (
    <label className="row small" title={tr('Language')} style={{ gap: '0.4rem' }}>
      {!compact && <span className="muted">🌐 {tr('Language')}</span>}
      {compact && <span aria-hidden>🌐</span>}
      <select
        className="select"
        style={{ width: 'auto' }}
        value={language}
        aria-label={tr('Language')}
        data-testid="language-select"
        onChange={(e) => {
          const lang = e.target.value as Lang;
          void api.app.setSettings({ language: lang });
          applyLanguage(lang);
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
