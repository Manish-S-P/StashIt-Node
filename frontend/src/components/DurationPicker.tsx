import { useId } from 'react';
import { MAX_EXPIRY_MINUTES, MIN_EXPIRY_MINUTES } from '../lib/api';

export type DurationUnit = 'minutes' | 'hours' | 'days';

export interface Duration {
  /** What the user typed, kept as text so the box can be empty while they type. */
  amount: string;
  unit: DurationUnit;
}

const UNITS: { value: DurationUnit; label: string; minutes: number }[] = [
  { value: 'minutes', label: 'Minutes', minutes: 1 },
  { value: 'hours', label: 'Hours', minutes: 60 },
  { value: 'days', label: 'Days', minutes: 24 * 60 },
];

export const DEFAULT_DURATION: Duration = { amount: '24', unit: 'hours' };
export const DURATION_HINT = 'Any time from 1 minute to 7 days.';
export const DURATION_ERROR = 'Pick a time from 1 minute to 7 days.';

/** The duration in minutes, or null if it isn't a whole number between 1 minute and 7 days. */
export function durationMinutes({ amount, unit }: Duration): number | null {
  if (!/^\d+$/.test(amount.trim())) return null;
  const minutes = Number(amount) * UNITS.find((u) => u.value === unit)!.minutes;
  return minutes >= MIN_EXPIRY_MINUTES && minutes <= MAX_EXPIRY_MINUTES ? minutes : null;
}

interface Props {
  legend: string;
  value: Duration;
  onChange: (next: Duration) => void;
}

/** A number box plus a Minutes / Hours / Days switch. */
export function DurationPicker({ legend, value, onChange }: Props) {
  const id = useId();
  const invalid = value.amount.trim() !== '' && durationMinutes(value) === null;

  return (
    <fieldset>
      <legend className="mb-2 text-[13px] text-ink-2">{legend}</legend>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: e.target.value })}
          aria-label={`${legend}: amount`}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          className="field tabular h-14 w-[88px] shrink-0 px-2 text-center sm:w-[96px]"
        />
        <div className="segmented min-w-0 flex-1">
          {UNITS.map((unit) => (
            <label key={unit.value} className="segment h-[46px] text-sm sm:text-[15px]">
              <input
                type="radio"
                name={`${id}-unit`}
                value={unit.value}
                checked={value.unit === unit.value}
                onChange={() => onChange({ ...value, unit: unit.value })}
                className="sr-only"
              />
              {unit.label}
            </label>
          ))}
        </div>
      </div>
      <p id={`${id}-hint`} className={`mt-2 text-[13px] ${invalid ? 'text-error' : 'text-muted'}`}>
        {invalid ? DURATION_ERROR : DURATION_HINT}
      </p>
    </fieldset>
  );
}
