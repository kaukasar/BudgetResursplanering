import { useState } from 'react';
import { toAnalysisCsv } from '../../domain/csv';
import { useDataStore } from '../../store/store';
import { downloadFile, todayIsoDate } from './downloadFile';

/** Export till Excel. Exporten läser bara data och fungerar även när redigering är avstängd. */
export function ExportAdmin() {
  const data = useDataStore((state) => state.data);
  const [exported, setExported] = useState(false);

  const exportCsv = () => {
    downloadFile(toAnalysisCsv(data), `budget-analys-${todayIsoDate()}.csv`, 'text/csv;charset=utf-8');
    setExported(true);
  };

  return (
    <div className="stack">
      {exported && (
        <div className="notice success" role="status">
          Analysfil för Excel exporterad.
        </div>
      )}
      <div className="data-actions">
        <section className="card card-body">
          <h3>Exportera för Excel</h3>
          <p>
            CSV-fil för analys, t.ex. pivottabeller: en rad per initiativ, person och månad med timmar, kostnad och
            överallokering.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={exportCsv}
            disabled={data.initiatives.length === 0}
          >
            Exportera CSV
          </button>
        </section>
      </div>
    </div>
  );
}
