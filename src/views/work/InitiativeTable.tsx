import { KeyFigure } from '../../components/KeyFigure';
import { budgetStatuses } from '../../domain/budget';
import { costByPart, hasExternalStaff, initiativeSectionId, summarizeInitiative } from '../../domain/calc';
import { compareInitiative } from '../../domain/comparison';
import { formatSek } from '../../domain/format';
import type { AppData, Initiative, Measure } from '../../domain/types';
import type { WorkView } from '../../store/ui';
import { ownerName, sectionName } from '../labels';
import { BudgetSummary } from './BudgetSummary';
import { CompareGrid } from './CompareGrid';
import { EditGrid } from './EditGrid';
import { VIEW_LABEL } from './workViews';

interface Props {
  data: AppData;
  initiative: Initiative;
  year: number;
  view: WorkView;
}

/** Ett initiativ i arbetsläget: huvud med kostnader och budget, och en tabell för vald vy. */
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
          {/* Utfallsvyn visar utfallet, estimatvyn prognosen och jämförelsevyn båda. */}
          {view !== 'estimate' && (
            <CostByPartFigures data={data} initiative={initiative} year={year} measure="actual" />
          )}
          {view !== 'actual' && (
            <CostByPartFigures data={data} initiative={initiative} year={year} measure="estimate" />
          )}
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

const COST_LABEL: Record<Measure, { label: string; explanation: string }> = {
  estimate: { label: 'Prognos', explanation: 'Estimerad kostnad' },
  actual: { label: 'Utfall', explanation: 'Utfallskostnad' },
};

/**
 * Årets prognos eller utfallskostnad uppdelad på intern personal och Extern personal. Timmar, total
 * kostnad och avvikelse visas inte här utan i tabellens totalkolumner och summeringsrad. Den externa
 * kostnaden visas bara när Extern personal är kopplad till initiativet.
 */
function CostByPartFigures({
  data,
  initiative,
  year,
  measure,
}: {
  data: AppData;
  initiative: Initiative;
  year: number;
  measure: Measure;
}) {
  const cost = costByPart(summarizeInitiative(data, initiative, year, measure));
  const { label, explanation } = COST_LABEL[measure];
  return (
    <>
      <KeyFigure
        label={`${label} intern ${year}`}
        value={formatSek(cost.internal)}
        title={`${explanation} för personal i sektionen`}
      />
      {hasExternalStaff(initiative) && (
        <KeyFigure
          label={`${label} extern ${year}`}
          value={formatSek(cost.external)}
          title={`${explanation} för Extern personal`}
        />
      )}
    </>
  );
}
