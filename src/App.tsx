import { useUiStore } from './store/ui';
import { AdminView } from './views/admin/AdminView';
import { WorkView } from './views/work/WorkView';

export function App() {
  const { mode, setMode } = useUiStore();

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--primary)" />
            <rect x="7" y="17" width="4" height="8" rx="1" fill="#fff" />
            <rect x="14" y="11" width="4" height="14" rx="1" fill="#fff" />
            <rect x="21" y="7" width="4" height="18" rx="1" fill="#fff" />
          </svg>
          <h1 className="brand-name">Budget &amp; Resursplanering</h1>
        </div>
        <span className="spacer" />
        <nav className="segmented" aria-label="Läge">
          <button type="button" aria-pressed={mode === 'work'} onClick={() => setMode('work')}>
            Arbetsläge
          </button>
          <button type="button" aria-pressed={mode === 'admin'} onClick={() => setMode('admin')}>
            Adminläge
          </button>
        </nav>
      </header>
      <main className="main">{mode === 'work' ? <WorkView /> : <AdminView />}</main>
    </>
  );
}
