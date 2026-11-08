import { PersonType, SellerStatus } from "@prisma/client";
import { BRAZIL_STATES, isValidCnpj, isValidCpf, onlyDigits } from "@/domain/documents";
import { prisma } from "./db";
import { sealTaxId } from "./crypto";

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "loja";
}

export async function submitSellerApplication(input: {
  userId: string;
  personType: PersonType;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  operationType: string;
  salesHistory?: string;
  categories: string;
  volumeNote?: string;
  acceptTerms: boolean;
}) {
  if (!input.acceptTerms) return { error: "É preciso aceitar os termos." };
  if (!BRAZIL_STATES.includes(input.state as (typeof BRAZIL_STATES)[number])) {
    return { error: "Informe um estado brasileiro." };
  }
  const digits = onlyDigits(input.taxId);
  const valid = input.personType === "INDIVIDUAL" ? isValidCpf(digits) : isValidCnpj(digits);
  if (!valid) return { error: input.personType === "INDIVIDUAL" ? "CPF inválido." : "CNPJ inválido." };
  const open = await prisma.sellerApplication.findFirst({
    where: {
      userId: input.userId,
      status: { in: ["SUBMITTED", "IN_REVIEW", "DOCS_REQUESTED", "APPROVED"] },
    },
  });
  if (open?.status === "APPROVED") return { error: "Esta conta já tem uma loja aprovada." };
  if (open) return { error: "Já existe uma inscrição em análise." };
  const application = await prisma.sellerApplication.create({
    data: {
      userId: input.userId,
      personType: input.personType,
      legalName: input.legalName.trim(),
      taxIdLast4: digits.slice(-4),
      taxIdCipher: sealTaxId(digits),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      city: input.city.trim(),
      state: input.state,
      countryCode: "BR",
      operationType: input.operationType.trim(),
      salesHistory: input.salesHistory?.trim(),
      categories: input.categories.trim(),
      volumeNote: input.volumeNote?.trim(),
      termsVersion: "2026-11-07",
      termsAcceptedAt: new Date(),
      status: "SUBMITTED",
      events: {
        create: {
          toStatus: "SUBMITTED",
          reason: "Inscrição enviada pelo vendedor.",
          actorId: input.userId,
        },
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: input.userId,
      action: "seller_application.submit",
      entity: "SellerApplication",
      entityId: application.id,
    },
  });
  return { application };
}

async function uniqueSlug(base: string) {
  let slug = slugify(base);
  let n = 2;
  while (await prisma.seller.findUnique({ where: { slug } })) {
    slug = `${slugify(base).slice(0, 40)}-${n}`;
    n += 1;
  }
  return slug;
}

export async function reviewApplication(input: {
  actorId: string;
  applicationId: string;
  to: SellerStatus;
  reason: string;
}) {
  if (!input.reason.trim()) return { error: "A decisão precisa de justificativa." };
  const actor = await prisma.user.findUnique({ where: { id: input.actorId } });
  if (!actor || actor.role !== "ADMIN") return { error: "Apenas a administração pode decidir." };
  const application = await prisma.sellerApplication.findUnique({ where: { id: input.applicationId } });
  if (!application) return { error: "Inscrição não encontrada." };
  const allowed: SellerStatus[] = ["IN_REVIEW", "DOCS_REQUESTED", "APPROVED", "REJECTED", "SUSPENDED", "BLOCKED"];
  if (!allowed.includes(input.to)) return { error: "Transição inválida." };
  if (input.to === "APPROVED" && application.status === "APPROVED") return { error: "Já aprovada." };

  const seller = await prisma.$transaction(async (tx) => {
    await tx.sellerApplication.update({
      where: { id: application.id },
      data: { status: input.to === "SUSPENDED" || input.to === "BLOCKED" ? application.status : input.to },
    });
    await tx.sellerReviewEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: input.to,
        reason: input.reason.trim(),
        actorId: input.actorId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: `seller_application.${input.to.toLowerCase()}`,
        entity: "SellerApplication",
        entityId: application.id,
        reason: input.reason.trim(),
        before: { status: application.status },
        after: { status: input.to },
      },
    });
    if (input.to === "APPROVED") {
      const existing = await tx.seller.findUnique({ where: { userId: application.userId } });
      if (existing) {
        return tx.seller.update({
          where: { id: existing.id },
          data: { status: "APPROVED", applicationId: application.id },
        });
      }
      return tx.seller.create({
        data: {
          userId: application.userId,
          applicationId: application.id,
          slug: await uniqueSlug(application.legalName),
          displayName: application.legalName,
          legalName: application.legalName,
          city: application.city,
          state: application.state,
          countryCode: "BR",
          status: "APPROVED",
        },
      });
    }
    if (input.to === "SUSPENDED" || input.to === "BLOCKED" || input.to === "REJECTED") {
      await tx.seller.updateMany({
        where: { userId: application.userId },
        data: { status: input.to === "REJECTED" ? "REJECTED" : input.to },
      });
      if (input.to === "SUSPENDED" || input.to === "BLOCKED") {
        await tx.listing.updateMany({
          where: { seller: { userId: application.userId }, status: "ACTIVE" },
          data: { status: "PAUSED" },
        });
      }
    }
    return null;
  });
  return { seller };
}
