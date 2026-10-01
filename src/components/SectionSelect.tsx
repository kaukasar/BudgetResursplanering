import { sortByName } from '../domain/sorting';
import type { Section } from '../domain/types';

interface Props {
  sections: Section[];
  value: string;
  onChange: (sectionId: string) => void;
  /** Tillgängligt namn när listan saknar synlig etikett. */
  label?: string;
  disabled?: boolean;
}

export function SectionSelect({ sections, value, onChange, label, disabled }: Props) {
  return (
    <select
      className="select"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        Välj sektion…
      </option>
      {sortByName(sections).map((section) => (
        <option key={section.id} value={section.id}>
          {section.name}
        </option>
      ))}
    </select>
  );
}
