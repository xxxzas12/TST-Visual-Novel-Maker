import { t as tr } from '../../shared/i18n';
import { useEffect, useState } from 'react';
import { useProject } from '../store/project';
import { useUi, type View } from '../store/ui';
import { api } from '../api';
import { playFromStart } from './Shell';

/** "Create Your First Visual Novel" checklist. Steps tick themselves as the user works. Skippable. */
export function Onboarding() {
  const project = useProject((s) => s.project)!;
  const previewOpened = useUi((s) => s.previewOpened);
  const exported = useUi((s) => s.exported);
  const [hidden, setHidden] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    void api.app.getSettings().then((s) => setHidden(s.onboardingDone));
  }, []);

  if (hidden) return null;
  const actions = project.scenes.flatMap((s) => s.actions);
  const has = (t: string) => actions.some((a) => a.type === t);
  const steps: { label: string; done: boolean; go: () => void }[] = [
    { label: 'Import Assets', done: project.assets.length > 0, go: () => nav('assets') },
    { label: 'Create Scene', done: project.scenes.some((s) => s.actions.length > 0) || project.scenes.length > 1, go: () => nav('scenes') },
    { label: 'Add Background', done: has('changeBackground'), go: () => nav('scenes') },
    { label: 'Add Character', done: has('addCharacter'), go: () => nav('scenes') },
    { label: 'Add Dialogue', done: has('dialogue'), go: () => nav('scenes') },
    { label: 'Add Choice', done: has('choice'), go: () => nav('scenes') },
    { label: 'Preview', done: previewOpened, go: playFromStart },
    { label: 'Export', done: exported, go: () => nav('export') },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const skip = () => {
    setHidden(true);
    void api.app.setSettings({ onboardingDone: true });
  };

  return (
    <div className="onboarding" data-testid="onboarding">
      <div className="onboarding-head">
        <b className="grow">{tr("🎓 Create Your First Visual Novel")}</b>
        <span className="badge">
          {doneCount}/{steps.length}
        </span>
        <button className="btn ghost sm icon" onClick={() => setCollapsed(!collapsed)} title={collapsed ? tr("Expand") : tr("Collapse")}>
          {collapsed ? '▴' : '▾'}
        </button>
      </div>
      {!collapsed && (
        <>
          <ol>
            {steps.map((s, i) => (
              <li key={s.label} className={s.done ? 'done' : ''}>
                <button onClick={s.go}>
                  <span className="step-dot">{s.done ? '✓' : i + 1}</span>
                  <span className="t">{tr(s.label)}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="row" style={{ padding: '0 0.8rem 0.7rem' }}>
            <span className="small faint grow">{doneCount === steps.length ? tr("🎉 You made a visual novel!") : tr("Click a step to jump there.")}</span>
            <button className="btn sm" onClick={skip} data-testid="onboarding-skip">
              {doneCount === steps.length ? tr("Finish") : tr("Skip")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function nav(v: View) {
  useUi.getState().setView(v);
}
