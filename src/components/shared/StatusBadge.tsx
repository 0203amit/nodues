export default function StatusBadge({ active }: { active: boolean }) {
  const label = active ? 'Active' : 'Inactive';
  const classes = active
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-slate-100 text-slate-600';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes}`}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
