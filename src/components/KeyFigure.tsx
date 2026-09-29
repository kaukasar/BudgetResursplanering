interface Props {
  label: string;
  value: string;
  /** Förklaring som visas när muspekaren hålls över nyckeltalet. */
  title?: string;
  /** Extra klasser, t.ex. `card stat` för ett fristående kort. */
  className?: string;
  valueClassName?: string;
}

/** Ett nyckeltal: en liten rubrik med ett värde under. */
export function KeyFigure({ label, value, title, className, valueClassName }: Props) {
  return (
    <div className={className} title={title}>
      <div className="label">{label}</div>
      <div className={valueClassName ? `value ${valueClassName}` : 'value'}>{value}</div>
    </div>
  );
}
