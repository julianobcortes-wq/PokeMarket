import { NextRequest, NextResponse } from "next/server";
import { sortOffers } from "@/domain/offers";
import { prisma } from "@/server/db";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const printingId = request.nextUrl.searchParams.get("printing");
  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      seller: { status: "APPROVED" },
      ...(printingId ? { printingId } : { printing: { cardId: id } }),
    },
    include: { seller: true },
  });
  const offers = sortOffers(
    listings
      .filter((listing) => listing.quantity - listing.reserved > 0)
      .map((listing) => ({
        id: listing.id,
        priceMinor: listing.priceMinor,
        shippingMinor: listing.seller.shippingFlatMinor,
        handlingDays: listing.seller.handlingDays,
        completedOrders: 0,
        isOperationStore: listing.seller.isOperationStore,
        seller: listing.seller.displayName,
        currency: listing.currency,
        condition: listing.condition,
        gradeKey: listing.gradeKey,
        demo: listing.isDemo,
      })),
  ).map(({ isOperationStore: _ignored, ...offer }) => offer);
  return NextResponse.json({ offers });
}
