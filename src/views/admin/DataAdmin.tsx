import { useRef, useState } from 'react';
import { useConfirm } from '../../components/confirm-context';
import { activePeople } from '../../domain/calc';
import { toAnalysisCsv } from '../../domain/csv';
import { plural } from '../../domain/format';
import { parseAppData, toExportFile } from '../../domain/serialization';
import { emptyData, type AppData } from '../../domain/types';
import { useCanEdit } from '../../store/editLock';
import { useDataStore } from '../../store/store';
import { useLoadSample } from '../useLoadSample';

type Status = { kind: 'success' | 'error'; text: string } | null;

/** "2 sektioner, 5 personer, 2 produktägare och 3 initiativ" */
function describeContents(data: AppData): string {
  return [
    plural(data.sections.length, 'sektion', 'sektioner'),
    plural(activePeople(data).length, 'person', 'personer'),
    `${data.productOwners.length} produktägare och ${data.initiatives.length} initiativ`,
  ].join(', ');
}

const today = () => new Date().toISOString().slice(0, 10);

function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Frigör URL:en först efter att nedladdningen hunnit starta.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataAdmin() {
  const data = useDataStore((state) => state.data);
  const replaceData = useDataStore((state) => state.replaceData);
  // Export är bara läsning; import, exempeldata och radering ändrar data och kräver påslagen redigering.
  const canEdit = useCanEdit();
  const confirm = useConfirm();
  const loadSample = useLoadSample();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const currentContents = describeContents(data);

  const exportJson = () => {
    downloadFile(JSON.stringify(toExportFile(data), null, 2), `budget-${today()}.json`, 'application/json');
    setStatus({ kind: 'success', text: 'Data exporterad.' });
  };

  const exportCsv = () => {
    downloadFile(toAnalysisCsv(data), `budget-analys-${today()}.csv`, 'text/csv;charset=utf-8');
    setStatus({ kind: 'success', text: 'Analysfil för Excel exporterad.' });
  };

  const importFile = async (file: File) => {
    try {
      const imported = parseAppData(JSON.parse(await file.text()));
      const confirmed = await confirm({
        title: 'Importera data',
        danger: true,
        confirmLabel: 'Ersätt all data',
        message: (
          <>
            <p>Filen innehåller {describeContents(imported)}.</p>
            <p>
              <strong>All nuvarande data ({currentContents}) ersätts.</strong> Exportera först om du vill behålla den.
            </p>
          </>
        ),
      });
      if (!confirmed) return;
      replaceData(imported);
      setStatus({ kind: 'success', text: `Importerade ${file.name}.` });
    } catch (error) {
      const text = error instanceof SyntaxError ? 'Filen är inte giltig JSON.' : (error as Error).message;
      setStatus({ kind: 'error', text });
    }
  };

  const loadSampleData = async () => {
    if (await loadSample()) setStatus({ kind: 'success', text: 'Exempeldata laddad.' });
  };

  const deleteAll = async () => {
    const confirmed = await confirm({
      title: 'Radera all data',
      danger: true,
      confirmLabel: 'Radera allt',
      message: <p>All data ({currentContents}) och alla inställningar raderas permanent. Detta går inte att ångra.</p>,
    });
    if (!confirmed) return;
    replaceData(emptyData());
    setStatus({ kind: 'success', text: 'All data raderad.' });
  };

  return (
    <div className="stack">
      <div className="notice">
        Data sparas automatiskt i den här webbläsaren (localStorage) och delas inte med andra användare eller enheter.
        Använd export/import för säkerhetskopior eller för att flytta data. Just nu: {currentContents}.
      </div>
      {status && (
        <div className={`notice ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.text}
        </div>
      )}
      <div className="data-actions">
        <section className="card card-body">
          <h3>Exportera</h3>
          <p>Ladda ner all data och alla inställningar som en JSON-fil.</p>
          <button type="button" className="btn btn-primary" onClick={exportJson}>
            Exportera JSON
          </button>
        </section>
        <section className="card card-body">
          <h3>Exportera för Excel</h3>
          <p>
            CSV-fil för analys, t.ex. pivottabeller: en rad per initiativ, person och månad med timmar, kostnad och
            överallokering.
          </p>
          <button type="button" className="btn" onClick={exportCsv} disabled={data.initiatives.length === 0}>
            Exportera CSV
          </button>
        </section>
        <section className="card card-body">
          <h3>Importera</h3>
          <p>Ersätt all data med innehållet i en tidigare exporterad fil.</p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importFile(file);
            }}
          />
          <button type="button" className="btn" disabled={!canEdit} onClick={() => fileInput.current?.click()}>
            Välj fil…
          </button>
        </section>
        <section className="card card-body">
          <h3>Exempeldata</h3>
          <p>Ersätt all data med ett litet exempel för att prova applikationen.</p>
          <button type="button" className="btn" disabled={!canEdit} onClick={() => void loadSampleData()}>
            Ladda exempeldata
          </button>
        </section>
        <section className="card card-body">
          <h3>Radera allt</h3>
          <p>Töm applikationen och återställ standardinställningarna.</p>
          <button type="button" className="btn btn-danger" disabled={!canEdit} onClick={() => void deleteAll()}>
            Radera all data
          </button>
        </section>
      </div>
    </div>
  );
}
