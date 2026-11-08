export function SearchBox({ placeholder, label, id = "q" }: { placeholder: string; label: string; id?: string }) {
  return (
    <form action="/cartas" className="flex border border-ink bg-panel">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input id={id} name="q" placeholder={placeholder} className="w-full min-w-0 px-3 py-3 outline-none" />
      <button className="bg-ink px-4 text-sm text-paper">{label}</button>
    </form>
  );
}
