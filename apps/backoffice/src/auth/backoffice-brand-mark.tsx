import { Building2 } from 'lucide-react';

/** Runtime-branded mark shared by the Backoffice splash and sign-in surfaces. */
export function BackofficeBrandMark({
  logoUrl,
  size = 'md',
}: {
  logoUrl?: string | undefined;
  size?: 'sm' | 'md';
}) {
  if (logoUrl) {
    return (
      <span
        className={`grid place-items-center overflow-hidden rounded-[var(--radius-control)] bg-white p-1 ${
          size === 'sm' ? 'size-7' : 'size-9'
        }`}
      >
        <img src={logoUrl} alt="" className="size-full object-contain" />
      </span>
    );
  }

  return (
    <Building2
      className={size === 'sm' ? 'size-5' : 'size-6'}
      strokeWidth={2.1}
      aria-hidden="true"
    />
  );
}
