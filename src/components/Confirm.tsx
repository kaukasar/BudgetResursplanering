import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from './confirm-context';
import { Modal } from './Modal';

/** Tillhandahåller `useConfirm()` (se confirm-context.ts) och renderar bekräftelsedialogen. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => new Promise((resolve) => setPending({ options, resolve })), []);

  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {pending && (
        <Modal
          title={pending.options.title}
          onClose={() => finish(false)}
          footer={
            <>
              {/* Vid destruktiva åtgärder får "Avbryt" fokus så att Enter inte raderar av misstag. */}
              <button
                type="button"
                className="btn"
                onClick={() => finish(false)}
                data-autofocus={pending.options.danger ? '' : undefined}
              >
                Avbryt
              </button>
              <button
                type="button"
                className={pending.options.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => finish(true)}
                data-autofocus={pending.options.danger ? undefined : ''}
              >
                {pending.options.confirmLabel ?? 'OK'}
              </button>
            </>
          }
        >
          {pending.options.message}
        </Modal>
      )}
    </ConfirmContext>
  );
}
