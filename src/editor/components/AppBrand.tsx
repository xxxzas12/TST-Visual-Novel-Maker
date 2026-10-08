import { useUi } from '../store/ui';

/** TSTVN's name with the custom application logo (Application Settings → Application logo), if any. */
export function AppBrand({ size = 1.15, testId }: { size?: number; testId?: string }) {
  const logo = useUi((s) => s.appLogo);
  return (
    <span className="app-brand" style={{ fontSize: `${size}rem` }} data-testid={testId}>
      {logo && <img src={logo} alt="" className="app-logo" data-testid="app-logo-img" />}
      <span className="brand" style={{ fontSize: 'inherit' }}>
        TSTVN
      </span>
    </span>
  );
}
