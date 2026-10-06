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

/** Med en enda sektion förväljs den; annars måste användaren välja. */
export const preselectedSectionId = (sections: readonly Section[]) => (sections.length === 1 ? sections[0]!.id : '');

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
