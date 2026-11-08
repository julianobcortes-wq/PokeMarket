import Link from "next/link";
import { brand } from "@/domain/brand";
import { t, type Locale } from "@/i18n";
import { LocaleSwitch } from "./locale-switch";
import { Mark } from "./mark";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";

export function Shell({
  locale,
  children,
  user,
}: {
  locale: Locale;
  children: React.ReactNode;
  user: { name: string; role: string; sellerStatus?: string | null } | null;
}) {
  const links = [
    ["/cartas", t(locale, "nav.cards")],
    ["/lacrados", t(locale, "nav.sealed")],
    ["/expansoes", t(locale, "nav.sets")],
    ["/mercado", t(locale, "nav.market")],
    ["/indices", t(locale, "nav.indices")],
    ["/colecao", t(locale, "nav.collection")],
    ["/vender", t(locale, "nav.sell")],
    ["/planos", t(locale, "nav.plans")],
  ] as const;
  return (
    <div className="min-h-screen">
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-muted">
          <p>Inteligência global ativa · Checkout no Brasil</p>
          <div className="flex items-center gap-3">
            <LocaleSwitch locale={locale} locales={["pt-BR", "en", "es", "ja", "fr", "de"]} />
            <ThemeToggle />
          </div>
        </div>
      </div>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Mark />
            <span className="font-serif text-2xl tracking-tight">{brand.name}</span>
          </Link>
          <div className="hidden min-w-0 flex-1 md:block">
            <SearchBox placeholder={t(locale, "home.search")} label={t(locale, "nav.search")} />
          </div>
          <nav className="ml-auto flex shrink-0 gap-3 text-sm">
            <Link href="/carrinho">{t(locale, "nav.cart")}</Link>
            {user ? <Link href="/conta">{user.name.split(" ")[0]}</Link> : <Link href="/entrar">{t(locale, "nav.login")}</Link>}
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
          <SearchBox id="q-mobile" placeholder={t(locale, "home.search")} label={t(locale, "nav.search")} />
        </div>
        <nav className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap text-muted hover:text-ink">
              {label}
            </Link>
          ))}
          {user?.sellerStatus === "APPROVED" ? <Link href="/vendedor">{t(locale, "nav.seller")}</Link> : null}
          {user?.role === "ADMIN" ? <Link href="/admin">{t(locale, "nav.admin")}</Link> : null}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-8 text-sm text-muted md:grid-cols-[1.4fr_1fr]">
          <p>{t(locale, "footer.disclaimer")}</p>
          <div className="flex flex-col gap-1 md:items-end">
            <Link href="/metodologia">Metodologia de preço</Link>
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
            <p>{t(locale, "footer.charts")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
