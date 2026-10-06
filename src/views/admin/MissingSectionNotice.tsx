import { useUiStore } from '../../store/ui';

/** Visas när det saknas sektioner – sektionen måste skapas först av allt. */
export function MissingSectionNotice() {
  const setAdminTab = useUiStore((state) => state.setAdminTab);
  return (
    <div className="card-body">
      <div className="notice">
        Skapa först en sektion. Sektionen ligger högst upp i hierarkin och behövs innan personal, produktägare och
        initiativ kan läggas upp.{' '}
        <button type="button" className="link-btn" onClick={() => setAdminTab('sections')}>
          Gå till Sektioner
        </button>
      </div>
    </div>
  );
}
