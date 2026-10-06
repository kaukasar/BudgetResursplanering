import type { ReactNode } from 'react';

/** Felmeddelande som skärmläsare läser upp direkt när det visas. */
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div className="notice error" role="alert">
      {children}
    </div>
  );
}
