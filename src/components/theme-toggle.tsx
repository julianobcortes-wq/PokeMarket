"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  return (
    <button
      type="button"
      className="border border-line px-2 py-1 font-mono text-[11px] uppercase tracking-wide"
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("theme", next ? "dark" : "light");
        setDark(next);
      }}
    >
      {dark ? "Claro" : "Escuro"}
    </button>
  );
}
