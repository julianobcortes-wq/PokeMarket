"use client";

import { useState } from "react";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (data: FormData) => Promise<{ error?: string } | void>;
  children: React.ReactNode;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={className}
      action={async (data) => {
        const result = await action(data);
        setError(result && "error" in result ? result.error ?? null : null);
      }}
    >
      {error ? <p className="mb-3 text-sm text-down">{error}</p> : null}
      {children}
    </form>
  );
}
