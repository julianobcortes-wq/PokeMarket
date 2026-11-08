"use server";

import { CardCondition, PersonType } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseMajorToMinor } from "@/domain/money";
import { isLocale } from "@/i18n";
import { accessFor } from "./access";
import { clearSession, currentUser, loginUser, registerUser } from "./auth";
import { applyBillingEvent, openSandboxSubscription } from "./billing";
import { addToCollection } from "./collection";
import {
  approveSandboxPayment,
  checkoutFromLines,
  CommerceError,
  completeOrder,
  createListing,
  declineSandboxPayment,
} from "./commerce";
import { prisma } from "./db";
import { sandboxCommerceEnabled } from "./sandbox";
import { reviewApplication, submitSellerApplication } from "./sellers";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function setLocaleAction(formData: FormData) {
  const locale = text(formData, "locale");
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set("pp_locale", locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export async function registerAction(formData: FormData) {
  const result = await registerUser({
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if ("error" in result && result.error) return { error: result.error };
  redirect("/conta");
}

export async function loginAction(formData: FormData) {
  const result = await loginUser(text(formData, "email"), text(formData, "password"));
  if ("error" in result && result.error) return { error: result.error };
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function addToCartAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const listingId = text(formData, "listingId");
  const quantity = Number(text(formData, "quantity") || "1");
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "ACTIVE", seller: { status: "APPROVED" } },
  });
  if (!listing || quantity < 1 || listing.quantity - listing.reserved < quantity) {
    return { error: "Estoque insuficiente." };
  }
  const cart = await prisma.cart.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  await prisma.cartItem.upsert({
    where: { cartId_listingId: { cartId: cart.id, listingId } },
    update: { quantity },
    create: { cartId: cart.id, listingId, quantity },
  });
  redirect("/carrinho");
}

export async function checkoutAction() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
  if (!cart?.items.length) return { error: "Carrinho vazio." };
  try {
    const result = await checkoutFromLines({
      buyerId: user.id,
      lines: cart.items.map((item) => ({ listingId: item.listingId, quantity: item.quantity })),
    });
    redirect(`/checkout/${result.paymentId}`);
  } catch (error) {
    if (error instanceof CommerceError && error.code === "SANDBOX_DISABLED") {
      return { error: "O pagamento simulado está desligado neste ambiente." };
    }
    if (error instanceof CommerceError) return { error: "Não foi possível reservar o estoque." };
    throw error;
  }
}

export async function paySandboxAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (!sandboxCommerceEnabled()) return { error: "O pagamento simulado está desligado neste ambiente." };
  const paymentId = text(formData, "paymentId");
  const decision = text(formData, "decision");
  if (decision === "decline") {
    await declineSandboxPayment(paymentId, user.id);
    redirect(`/checkout/${paymentId}?resultado=recusado`);
  }
  await approveSandboxPayment(paymentId, user.id);
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  redirect(`/pedidos/${payment?.orderId}`);
}

export async function completeOrderAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (!sandboxCommerceEnabled()) return { error: "A conclusão simulada está desligada neste ambiente." };
  await completeOrder(text(formData, "orderId"), user.id);
  redirect(`/pedidos/${text(formData, "orderId")}`);
}

export async function applySellerAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar?next=/vender");
  const result = await submitSellerApplication({
    userId: user.id,
    personType: text(formData, "personType") === "COMPANY" ? PersonType.COMPANY : PersonType.INDIVIDUAL,
    legalName: text(formData, "legalName"),
    taxId: text(formData, "taxId"),
    email: text(formData, "email") || user.email,
    phone: text(formData, "phone"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    operationType: text(formData, "operationType"),
    salesHistory: text(formData, "salesHistory"),
    categories: text(formData, "categories"),
    volumeNote: text(formData, "volumeNote"),
    acceptTerms: formData.get("terms") === "on",
  });
  if ("error" in result && result.error) return { error: result.error };
  redirect("/vender?enviado=1");
}

export async function reviewSellerAction(formData: FormData) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return { error: "Sem permissão." };
  const result = await reviewApplication({
    actorId: user.id,
    applicationId: text(formData, "applicationId"),
    to: text(formData, "to") as "IN_REVIEW" | "DOCS_REQUESTED" | "APPROVED" | "REJECTED" | "SUSPENDED" | "BLOCKED",
    reason: text(formData, "reason"),
  });
  if ("error" in result && result.error) return { error: result.error };
  redirect(`/admin/inscricoes/${text(formData, "applicationId")}`);
}

export async function createListingAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const currency = "BRL";
  const priceMinor = parseMajorToMinor(text(formData, "price"), currency);
  if (priceMinor == null) return { error: "Preço inválido." };
  try {
    const listing = await createListing({
      sellerUserId: user.id,
      printingId: text(formData, "printingId") || undefined,
      condition: (text(formData, "condition") || "NEAR_MINT") as CardCondition,
      gradeKey: text(formData, "gradeKey") || "raw",
      grader: text(formData, "grader") || undefined,
      grade: text(formData, "grade") || undefined,
      certNumber: text(formData, "certNumber") || undefined,
      priceMinor,
      currency,
      quantity: Number(text(formData, "quantity")),
      photoUrl: text(formData, "photoUrl") || undefined,
    });
    const printing = await prisma.printing.findUnique({ where: { id: listing.printingId ?? "" } });
    redirect(printing ? `/cartas/${printing.cardId}` : "/vendedor");
  } catch (error) {
    if (error instanceof CommerceError && error.code === "SELLER_NOT_APPROVED") {
      return { error: "A loja precisa estar aprovada para anunciar." };
    }
    if (error instanceof CommerceError && error.code === "PHOTO_URL") {
      return { error: "A foto precisa ser um endereço https, sem usuário ou senha na URL." };
    }
    throw error;
  }
}

export async function saveCollectionAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const access = await accessFor(user.id);
  if (!access.has("collection_basic")) return { error: "Coleção indisponível." };
  const currency = text(formData, "currency") || "BRL";
  const paidMinor = parseMajorToMinor(text(formData, "paid"), currency);
  if (paidMinor == null) return { error: "Valor pago inválido." };
  await addToCollection({
    userId: user.id,
    printingId: text(formData, "printingId"),
    condition: (text(formData, "condition") || "NEAR_MINT") as CardCondition,
    gradeKey: text(formData, "gradeKey") || "raw",
    quantity: Number(text(formData, "quantity") || "1"),
    paidMinor,
    currency,
    acquiredAt: new Date(text(formData, "acquiredAt") || Date.now()),
  });
  redirect("/colecao");
}

export async function watchAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const access = await accessFor(user.id);
  const limit = access.get("watchlist_limited")?.max ?? 20;
  const count = await prisma.watchItem.count({ where: { userId: user.id } });
  if (count >= limit) return { error: "Limite da lista de desejos atingido." };
  await prisma.watchItem.upsert({
    where: {
      userId_subjectType_subjectId: {
        userId: user.id,
        subjectType: "printing",
        subjectId: text(formData, "printingId"),
      },
    },
    update: {},
    create: { userId: user.id, subjectType: "printing", subjectId: text(formData, "printingId") },
  });
  redirect("/conta");
}

export async function alertAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const access = await accessFor(user.id);
  const kind = text(formData, "kind");
  if (kind === "change_pct" && !access.has("advanced_alerts")) {
    return { error: "Alerta de variação percentual exige Collector Pro." };
  }
  const limit = access.has("advanced_alerts") ? 50 : (access.get("alerts_limited")?.max ?? 3);
  const count = await prisma.priceAlert.count({ where: { userId: user.id, active: true } });
  if (count >= limit) return { error: "Limite de alertas atingido." };
  const currency = "BRL";
  const threshold = text(formData, "threshold");
  const thresholdMinor = threshold ? parseMajorToMinor(threshold, currency) : null;
  await prisma.priceAlert.create({
    data: {
      userId: user.id,
      subjectType: "printing",
      subjectId: text(formData, "printingId"),
      kind,
      thresholdMinor,
      currency,
    },
  });
  await prisma.notification.create({
    data: {
      userId: user.id,
      channel: "IN_APP",
      title: "Alerta criado",
      body: "O aviso fica na conta. E-mail segue desligado até haver um provedor configurado.",
      status: "stored",
    },
  });
  redirect("/conta");
}

export async function subscribeAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar?next=/planos");
  const opened = await openSandboxSubscription({
    userId: user.id,
    planId: text(formData, "planId"),
    priceId: text(formData, "priceId"),
  });
  if ("error" in opened && opened.error) return { error: opened.error };
  if (!("subscription" in opened) || !opened.subscription) return { error: "Não foi possível abrir a assinatura." };
  redirect(`/planos/pagar/${opened.subscription.id}`);
}

export async function confirmSubscriptionAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (!sandboxCommerceEnabled()) return { error: "A assinatura simulada está desligada neste ambiente." };
  const subscriptionId = text(formData, "subscriptionId");
  const subscription = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId: user.id } });
  if (!subscription) return { error: "Assinatura não encontrada." };
  const decision = text(formData, "decision");
  await applyBillingEvent({
    provider: "sandbox",
    externalId: `${decision}_${subscription.id}_${Date.now()}`,
    type: decision === "decline" ? "payment_declined" : "payment_approved",
    subscriptionId: subscription.id,
  });
  redirect("/conta");
}

export async function cancelSubscriptionAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const subscription = await prisma.subscription.findFirst({
    where: { id: text(formData, "subscriptionId"), userId: user.id, status: "ACTIVE" },
  });
  if (!subscription) return { error: "Assinatura ativa não encontrada." };
  await applyBillingEvent({
    provider: subscription.provider,
    externalId: `cancel_${subscription.id}_${Date.now()}`,
    type: "canceled",
    subscriptionId: subscription.id,
  });
  redirect("/conta");
}

export async function publishPriceAction(formData: FormData) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return { error: "Sem permissão." };
  const amount = parseMajorToMinor(text(formData, "amount"), text(formData, "currency"));
  if (amount == null) return { error: "Valor inválido." };
  await prisma.planPrice.updateMany({
    where: {
      planId: text(formData, "planId"),
      marketId: text(formData, "marketId"),
      interval: text(formData, "interval"),
      active: true,
    },
    data: { active: false, activeTo: new Date() },
  });
  await prisma.planPrice.create({
    data: {
      planId: text(formData, "planId"),
      marketId: text(formData, "marketId"),
      currency: text(formData, "currency"),
      interval: text(formData, "interval"),
      amountMinor: amount,
      active: true,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "plan_price.publish",
      entity: "PlanPrice",
      entityId: text(formData, "planId"),
      after: { amount, currency: text(formData, "currency"), interval: text(formData, "interval") },
    },
  });
  redirect("/admin/planos");
}

export async function commissionAction(formData: FormData) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return { error: "Sem permissão." };
  const rateBps = Number(text(formData, "rateBps"));
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 5000) return { error: "Use pontos-base entre 0 e 5000." };
  await prisma.commissionRule.updateMany({ where: { active: true, sellerId: null, countryCode: null }, data: { active: false } });
  await prisma.commissionRule.create({
    data: { name: "Regra geral", rateBps, active: true },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "commission.update",
      entity: "CommissionRule",
      entityId: "global",
      reason: text(formData, "reason"),
      after: { rateBps },
    },
  });
  redirect("/admin");
}
