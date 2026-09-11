interface Props {
  label: string;
  className?: string;
}

export default function StatusBadge({ label, className }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}
