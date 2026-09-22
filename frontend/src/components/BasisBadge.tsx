import { ShieldCheck } from 'lucide-react';

interface BasisBadgeProps {
  basis?: { label: string; anchored: boolean } | null;
}

/** Honest basis line. Anchored styling is only for a corroborated named program. */
export default function BasisBadge({ basis }: BasisBadgeProps) {
  if (!basis?.label) return null;

  if (basis.anchored) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/40 text-[#07CB6C] font-medium">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>{basis.label}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#111a17] border border-[#3a4a44] text-neutral-300 font-medium">
      {basis.label}
    </span>
  );
}
