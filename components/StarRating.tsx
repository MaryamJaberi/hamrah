'use client';
export default function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1 text-2xl" role={onChange ? 'radiogroup' : undefined} aria-label="امتیاز">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} role="radio" aria-checked={n === value} aria-label={`${n} ستاره`}
          onClick={() => onChange?.(n)} className={n <= value ? 'text-amber-500' : 'text-gray-300'}>★</button>
      ))}
    </div>
  );
}
