import { KeyFigure } from '../../components/KeyFigure';
import { budgetStatuses } from '../../domain/budget';
import {
  costByPart,
  hasExternalStaff,
  initiativeSectionId,
  summarizeInitiative,
  type CostByPart,
} from '../../domain/calc';
import { compareInitiative, type InitiativeComparison } from '../../domain/comparison';
import { formatSek, formatSignedHours } from '../../domain/format';
import type { AppData, Initiative } from '../../domain/types';
import type { WorkView } from '../../store/ui';
import { ownerName, sectionName } from '../labels';
import { BudgetSummary } from './BudgetSummary';
import { CompareGrid } from './CompareGrid';
import { EditGrid } from './EditGrid';
import { VIEW_LABEL, VIEW_MEASURE } from './workViews';

interface Props {
  data: AppData;
  initiative: Initiative;
  year: number;
  view: WorkView;
}

/** Ett initiativ i arbetsläget: huvud med nyckeltal och budget, och en tabell för vald vy. */
export function InitiativeTable({ data, initiative, year, view }: Props) {
  const sectionId = initiativeSectionId(data, initiative);
  const budgets = budgetStatuses(data, initiative);
  const comparison = view === 'compare' ? compareInitiative(data, initiative, year) : undefined;
  const hasPeople = initiative.personIds.length > 0;

  return (
    <section className={`card initiative view-${view}`} aria-label={`Initiativ ${initiative.name}`}>
      <header className="card-head initiative-head">
        <div>
          <h3>
            {initiative.name} <span className="view-tag">{VIEW_LABEL[view]}</span>
          </h3>
          <div className="owner">
            Sektion: {sectionName(data, sectionId)} · Produktägare: {ownerName(data, initiative.productOwnerId)}
            {initiative.tajmaClass && ` · Tajmaklass: ${initiative.tajmaClass}`}
          </div>
        </div>
        <div className="totals">
          {view !== 'compare' && (
            <CostByPartFigures
              initiative={initiative}
              cost={costByPart(summarizeInitiative(data, initiative, year, VIEW_MEASURE[view]))}
              label={view === 'estimate' ? 'Prognos' : 'Utfall'}
              year={year}
            />
          )}
          {comparison && <CompareKeyFigures data={data} initiative={initiative} year={year} comparison={comparison} />}
          {budgets.map((budget) => (
            <BudgetSummary key={budget.part} budget={budget} initiative={initiative} year={year} view={view} />
          ))}
        </div>
      </header>

      {!hasPeople ? (
        <div className="empty small">Ingen personal är kopplad till initiativet. Lägg till personal i adminläget.</div>
      ) : comparison ? (
        <CompareGrid year={year} comparison={comparison} />
      ) : (
        <EditGrid data={data} initiative={initiative} year={year} measure={view === 'actual' ? 'actual' : 'estimate'} />
      )}
    </section>
  );
}

interface KeyFiguresProps {
  data: AppData;
  initiative: Initiative;
  year: number;
}

/**
 * Årets kostnad uppdelad på intern personal och Extern personal, i estimat- och utfallsvyn. Timmar
 * och total kostnad visas inte här utan i tabellens totalkolumn och summeringsrad. Den externa
 * kostnaden visas bara när Extern personal är kopplad till initiativet.
 */
function CostByPartFigures({
  initiative,
  cost,
  label,
  year,
}: {
  initiative: Initiative;
  cost: CostByPart;
  label: 'Prognos' | 'Utfall';
  year: number;
}) {
  const what = label === 'Prognos' ? 'Estimerad kostnad' : 'Utfallskostnad';
  return (
    <>
      <KeyFigure
        label={`${label} intern ${year}`}
        value={formatSek(cost.internal)}
        title={`${what} för personal i sektionen`}
      />
      {hasExternalStaff(initiative) && (
        <KeyFigure
          label={`${label} extern ${year}`}
          value={formatSek(cost.external)}
          title={`${what} för Extern personal`}
        />
      )}
    </>
  );
}

function CompareKeyFigures({
  data,
  initiative,
  year,
  comparison,
}: KeyFiguresProps & { comparison: InitiativeComparison }) {
  const actual = summarizeInitiative(data, initiative, year, 'actual');
  const estimate = summarizeInitiative(data, initiative, year, 'estimate');
  return (
    <>
      <KeyFigure
        label={`Avvikelse ${year}`}
        value={`${formatSignedHours(comparison.deviation.diff)} h`}
        title="Utfall minus estimat, för månader med rapporterat utfall"
      />
      <KeyFigure
        label={`Utfallskostnad ${year}`}
        value={formatSek(actual.totalCost)}
        title="Rapporterade timmar × respektive persons timkostnad, för alla som rapporterat tid på initiativet"
      />
      <KeyFigure label={`Prognos ${year}`} value={formatSek(estimate.totalCost)} title="Estimerad kostnad" />
    </>
  );
}
