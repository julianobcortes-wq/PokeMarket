"use client";

import { setLocaleAction } from "@/server/actions";

export function LocaleSwitch({ locale, locales }: { locale: string; locales: readonly string[] }) {
  return (
    <form action={setLocaleAction}>
      <select
        name="locale"
        defaultValue={locale}
        className="bg-transparent"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </form>
  );
}
