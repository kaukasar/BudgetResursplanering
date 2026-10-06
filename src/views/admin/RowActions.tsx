interface Props {
  /** Knapparna är avstängda när redigering i adminläget är avstängd. */
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
}

/** Sista kolumnen i adminlägets listor: redigera och radera raden. */
export function RowActions({ disabled, onEdit, onDelete, editLabel = 'Redigera' }: Props) {
  return (
    <td className="actions">
      <button type="button" className="link-btn" disabled={disabled} onClick={onEdit}>
        {editLabel}
      </button>
      <button type="button" className="link-btn danger" disabled={disabled} onClick={onDelete}>
        Radera
      </button>
    </td>
  );
}

/** Rubriken för kolumnen med `RowActions`; syns bara för skärmläsare. */
export function RowActionsHeader() {
  return (
    <th>
      <span className="sr-only">Åtgärder</span>
    </th>
  );
}
