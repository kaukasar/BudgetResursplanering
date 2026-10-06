import {
  ALL_OWNERS,
  ALL_SECTIONS,
  ALL_TAJMA_CLASSES,
  NO_TAJMA_CLASS,
  type InitiativeFilter,
  type TajmaClassFilter,
} from '../../domain/filter';
import { TAJMA_CLASSES, type ProductOwner, type Section } from '../../domain/types';
import { useUiStore, type WorkView } from '../../store/ui';
import { VIEW_LABEL } from './workViews';

interface Props {
  years: number[];
  sections: Section[];
  /** Produktägare i vald sektion. */
  owners: ProductOwner[];
  /** Valt filter efter kontroll att valen finns kvar (annars "alla"). */
  filter: InitiativeFilter;
}

/** Filter för år, sektion, produktägare och tajmaklass samt val av vy (estimat, utfall, jämförelse). */
export function WorkToolbar({ years, sections, owners, filter }: Props) {
  const { year, sectionId, ownerId, tajmaClass } = filter;
  const { setYear, setSectionId, setOwnerId, setTajmaClass, view, setView } = useUiStore();
  const selectedSection = sections.find((section) => section.id === sectionId);

  return (
    <div className="toolbar">
      <div className="field">
        <span>År</span>
        <div className="year-picker">
          <button type="button" className="btn" aria-label="Föregående år" onClick={() => setYear(year - 1)}>
            ‹
          </button>
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="År">
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button type="button" className="btn" aria-label="Nästa år" onClick={() => setYear(year + 1)}>
            ›
          </button>
        </div>
      </div>
      <label className="field">
        <span>Sektion</span>
        <select
          className="select filter-select"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          aria-label="Sektion"
        >
          <option value={ALL_SECTIONS}>Alla sektioner</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Produktägare</span>
        <select
          className="select filter-select"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          aria-label="Produktägare"
        >
          <option value={ALL_OWNERS}>{selectedSection ? `Alla i ${selectedSection.name}` : 'Alla produktägare'}</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Tajmaklass</span>
        <select
          className="select filter-select"
          value={tajmaClass}
          onChange={(e) => setTajmaClass(e.target.value as TajmaClassFilter)}
          aria-label="Tajmaklass"
        >
          <option value={ALL_TAJMA_CLASSES}>Alla tajmaklasser</option>
          {TAJMA_CLASSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={NO_TAJMA_CLASS}>Ingen tajmaklass</option>
        </select>
      </label>
      <div className="field view-switch">
        <span id="view-switch-label">Visa</span>
        <div className="segmented" role="group" aria-labelledby="view-switch-label">
          {(Object.keys(VIEW_LABEL) as WorkView[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`view-${option}`}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {VIEW_LABEL[option]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
