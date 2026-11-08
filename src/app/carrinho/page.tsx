import Link from "next/link";
import { cookies } from "next/headers";
import { formatMoney } from "@/domain/money";
import { isLocale, t } from "@/i18n";
import { ActionForm } from "@/components/action-form";
import { checkoutAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";

export default async function CartPage() {
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const user = await currentUser();
  if (!user) {
    return (
      <div>
        <h1 className="font-serif text-4xl">{t(locale, "cart.title")}</h1>
        <p className="mt-3"><Link href="/entrar">Entre</Link> para guardar o carrinho.</p>
      </div>
    );
  }
  const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
  const listings = await prisma.listing.findMany({
    where: { id: { in: cart?.items.map((item) => item.listingId) ?? [] } },
    include: { seller: true, printing: { include: { card: { include: { translations: true } } } } },
  });
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  const total = (cart?.items ?? []).reduce((sum, item) => {
    const listing = byId.get(item.listingId);
    return sum + (listing ? listing.priceMinor * item.quantity : 0);
  }, 0);
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-4xl">{t(locale, "cart.title")}</h1>
      <p className="mt-3 text-sm text-muted">{t(locale, "cart.sandbox")}</p>
      {(cart?.items.length ?? 0) === 0 ? <p className="mt-6 text-muted">Carrinho vazio.</p> : null}
      <ul className="mt-4 divide-y divide-line border border-line">
        {(cart?.items ?? []).map((item) => {
          const listing = byId.get(item.listingId);
          const name = preferredTranslation(listing?.printing?.card.translations ?? [], locale)?.name ?? "Item";
          return (
            <li key={item.id} className="flex justify-between px-3 py-3 text-sm">
              <span>{name} · {item.quantity} · {listing?.seller.displayName}</span>
              <span className="font-mono">{listing ? formatMoney(listing.priceMinor * item.quantity, listing.currency) : ""}</span>
            </li>
          );
        })}
      </ul>
      {cart?.items.length ? (
        <ActionForm action={checkoutAction} className="mt-4">
          <p className="font-mono">Itens {formatMoney(total, "BRL")}</p>
          <button className="mt-3 bg-ink px-3 py-2 text-sm text-paper">{t(locale, "cart.pay")}</button>
        </ActionForm>
      ) : null}
    </div>
  );
}
