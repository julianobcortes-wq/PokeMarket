export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="1.5" y="1.5" width="29" height="29" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 10.5H11V1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 23.5l4.2-6.2 3.1 3.2 6.2-9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
