"use client";

type Props = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  unitLabel?: string;
};

export function QuantityStepper({
  value,
  onChange,
  step = 0.5,
  min = step,
  unitLabel = "kg",
}: Props) {
  const dec = () => onChange(Math.max(min, Math.round((value - step) * 1000) / 1000));
  const inc = () => onChange(Math.round((value + step) * 1000) / 1000);

  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-line bg-white p-2">
      <button
        type="button"
        className="btn btn-secondary !min-h-12 !min-w-12 !rounded-full !px-0 text-2xl"
        onClick={dec}
        aria-label="Decrease"
      >
        −
      </button>
      <div className="text-center">
        <div className="font-display text-3xl font-bold tracking-tight">{value}</div>
        <div className="text-sm font-semibold text-ink-soft">{unitLabel}</div>
      </div>
      <button
        type="button"
        className="btn btn-secondary !min-h-12 !min-w-12 !rounded-full !px-0 text-2xl"
        onClick={inc}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
