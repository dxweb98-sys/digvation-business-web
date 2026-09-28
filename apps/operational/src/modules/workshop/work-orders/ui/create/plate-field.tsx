import { useId } from 'react';

import { sanitizePlatePart, type PlateParts } from '../../model/workshop-plate';

/** One labelled group of three plate segments: region prefix, number, suffix. */
export function PlateField({
  label,
  parts,
  onChange,
}: {
  label: string;
  parts: PlateParts;
  onChange: (parts: PlateParts) => void;
}) {
  const labelId = useId();
  const segment = (part: keyof PlateParts, placeholder: string, inputMode: 'text' | 'numeric') => (
    <input
      aria-label={`${label} — ${placeholder}`}
      inputMode={inputMode}
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      value={parts[part]}
      placeholder={placeholder}
      onChange={(event) =>
        onChange({ ...parts, [part]: sanitizePlatePart(part, event.target.value) })
      }
      className="h-10 w-full min-w-0 rounded-(--radius-control) border border-(--color-border) bg-(--color-surface) px-2 text-center text-base font-semibold uppercase tracking-widest text-(--color-text) transition-colors duration-150 placeholder:font-normal placeholder:text-(--color-text-muted)/50 focus:border-(--color-brand) focus:outline-none focus:ring-2 focus:ring-(--color-brand)/20"
    />
  );

  return (
    <div role="group" aria-labelledby={labelId}>
      <span id={labelId} className="mb-1.5 block text-sm font-medium text-(--color-text)">
        {label}
      </span>
      <div className="grid grid-cols-[1fr_2fr_2fr] gap-2 sm:max-w-[320px]">
        {segment('prefix', 'B', 'text')}
        {segment('number', '1234', 'numeric')}
        {segment('suffix', 'ABC', 'text')}
      </div>
    </div>
  );
}
