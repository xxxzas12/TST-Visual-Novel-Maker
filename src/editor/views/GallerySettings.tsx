// Project Settings → Game Gallery: the in-game Extras screen (CG, Characters, Music, Endings).
import { useMemo } from 'react';
import { t as tr } from '../../shared/i18n';
import type { GalleryUnlock, ProjectGallery } from '../../shared/types';
import { GALLERY_SECTIONS, defaultGallery, galleryItems, unlockRule, type GallerySection } from '../../shared/gallery';
import { useProject } from '../store/project';

export function GallerySettings() {
  const project = useProject((s) => s.project)!;
  const g = project.settings.gallery ?? defaultGallery();
  const items = useMemo(() => galleryItems(project), [project]);
  const label: Record<GallerySection, string> = { cg: tr('CG Gallery'), characters: tr('Character Gallery'), music: tr('Music Gallery'), endings: tr('Ending Gallery') };

  const edit = (fn: (g: ProjectGallery) => void, key?: string) =>
    useProject.getState().update((p) => {
      p.settings.gallery ??= defaultGallery();
      fn(p.settings.gallery);
    }, key);

  return (
    <div className="sub-card" data-testid="gallery-settings">
      <div className="section-title">{tr('Game Gallery')}</div>
      <label className="check">
        <input type="checkbox" checked={g.enabled} onChange={(e) => edit((x) => void (x.enabled = e.target.checked))} data-testid="gallery-enabled" />
        {tr('Add a Gallery button to the title screen')}
      </label>
      <div className="small faint">{tr('Players unlock items by seeing them in the story (CGs shown, characters met, music played, endings reached). Unlocks are kept across new games.')}</div>
      {g.enabled && (
        <>
          <div className="row wrap" style={{ margin: '0.5rem 0' }}>
            {GALLERY_SECTIONS.map((s) => (
              <label key={s} className="check">
                <input type="checkbox" checked={g.sections[s]} onChange={(e) => edit((x) => void (x.sections[s] = e.target.checked))} data-testid={`gallery-section-${s}`} />
                {label[s]} ({items.filter((i) => i.section === s).length})
              </label>
            ))}
          </div>
          {items.length === 0 && <div className="small muted">{tr('Nothing to show yet: add Show CG, Add Character, Play BGM or End Game actions to your scenes.')}</div>}
          {GALLERY_SECTIONS.filter((s) => g.sections[s] && items.some((i) => i.section === s)).map((s) => (
            <div key={s} style={{ marginTop: '0.4rem' }}>
              <div className="field-label">{label[s]}</div>
              {items
                .filter((i) => i.section === s)
                .map((it) => (
                  <div key={it.key} className="row" style={{ gap: '0.5rem' }}>
                    <span className="grow ellipsis" title={it.sceneName ? `${it.label} — ${it.sceneName}` : it.label}>
                      {it.label}
                      {it.sceneName && <span className="faint small"> · {it.sceneName}</span>}
                    </span>
                    <select
                      className="select"
                      style={{ width: 'auto' }}
                      value={unlockRule(g, it.key).mode}
                      onChange={(e) => edit((x) => void (x.unlock[it.key] = { mode: e.target.value } as GalleryUnlock))}
                      aria-label={tr('When it unlocks')}
                      data-testid={`gallery-unlock-${it.key}`}
                    >
                      <option value="seen">{tr('Unlocks when seen')}</option>
                      <option value="always">{tr('Always unlocked')}</option>
                    </select>
                  </div>
                ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
