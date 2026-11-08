import "./load-env";
import { PrismaClient, PersonType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sealTaxId } from "../src/server/crypto";
import { importCatalog } from "../src/server/tcgdex";

const prisma = new PrismaClient();

const ENTITLEMENTS: { code: string; description: string }[] = [
  ["catalog_search", "Pesquisar o catálogo"],
  ["current_prices", "Ver preços atuais e ofertas"],
  ["price_history_90d", "Histórico móvel de 90 dias"],
  ["price_history_full", "Histórico disponível além de 90 dias"],
  ["listing_comparison", "Comparar anúncios atuais"],
  ["purchase", "Comprar"],
  ["collection_basic", "Coleção básica"],
  ["watchlist_limited", "Lista de desejos com limite"],
  ["rankings_basic", "Rankings do período gratuito"],
  ["alerts_limited", "Alertas com limite"],
  ["indices_public", "Índices publicados"],
  ["advanced_comparison", "Comparação histórica entre cartas"],
  ["index_comparison", "Comparar com índices"],
  ["liquidity_advanced", "Liquidez avançada"],
  ["volatility_analysis", "Volatilidade"],
  ["portfolio_analytics", "Evolução da coleção"],
  ["collection_price_history", "Histórico da coleção"],
  ["regional_market_comparison", "Comparação regional"],
  ["advanced_alerts", "Alertas avançados"],
  ["rankings_full", "Rankings completos"],
  ["market_reports", "Relatórios"],
  ["professional_filters", "Filtros profissionais"],
  ["seller_analytics", "Área profissional do vendedor"],
  ["seller_price_intelligence", "Inteligência de preço"],
  ["seller_competitor_monitoring", "Concorrentes"],
  ["seller_pricing_suggestions", "Sugestão de preço"],
  ["seller_inventory_analytics", "Giro de estoque"],
  ["seller_margin_reports", "Margem"],
  ["seller_demand_analysis", "Demanda"],
  ["seller_commercial_alerts", "Alertas comerciais"],
  ["data_export", "Exportação"],
  ["enterprise_access", "Reservado"],
  ["api_commercial", "Reservado"],
].map(([code, description]) => ({ code, description }));

const FREE = [
  "catalog_search",
  "current_prices",
  "price_history_90d",
  "listing_comparison",
  "purchase",
  "collection_basic",
  "watchlist_limited",
  "rankings_basic",
  "alerts_limited",
  "indices_public",
];
const COLLECTOR = [
  ...FREE.filter((code) => code !== "watchlist_limited" && code !== "alerts_limited"),
  "watchlist_limited",
  "alerts_limited",
  "price_history_full",
  "advanced_comparison",
  "index_comparison",
  "liquidity_advanced",
  "volatility_analysis",
  "portfolio_analytics",
  "collection_price_history",
  "regional_market_comparison",
  "advanced_alerts",
  "rankings_full",
  "market_reports",
  "professional_filters",
];
const SELLER = [
  "price_history_full",
  "seller_analytics",
  "seller_price_intelligence",
  "seller_competitor_monitoring",
  "seller_pricing_suggestions",
  "seller_inventory_analytics",
  "seller_margin_reports",
  "seller_demand_analysis",
  "seller_commercial_alerts",
  "data_export",
];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const bellaEmail = process.env.SEED_BELLA_EMAIL;
  const bellaPassword = process.env.SEED_BELLA_PASSWORD;
  if (!adminEmail || !adminPassword || !bellaEmail || !bellaPassword) {
    throw new Error("Defina os e-mails e senhas de seed no ambiente.");
  }

  await prisma.currency.createMany({
    data: [
      { code: "BRL", minorDigits: 2, name: "Real" },
      { code: "USD", minorDigits: 2, name: "Dólar americano" },
      { code: "EUR", minorDigits: 2, name: "Euro" },
      { code: "JPY", minorDigits: 0, name: "Iene" },
      { code: "GBP", minorDigits: 2, name: "Libra" },
      { code: "CAD", minorDigits: 2, name: "Dólar canadense" },
      { code: "AUD", minorDigits: 2, name: "Dólar australiano" },
      { code: "MXN", minorDigits: 2, name: "Peso mexicano" },
    ],
    skipDuplicates: true,
  });

  const markets = [
    ["BR", "BR", "Brasil", "LATAM", "BRL", "pt-BR", true, true, true, true, false],
    ["US", "US", "Estados Unidos", "NA", "USD", "en", true, false, false, false, false],
    ["CA", "CA", "Canadá", "NA", "CAD", "en", true, false, false, false, false],
    ["MX", "MX", "México", "LATAM", "MXN", "es", true, false, false, false, false],
    ["GB", "GB", "Reino Unido", "EU", "GBP", "en", true, false, false, false, false],
    ["EU", "DE", "União Europeia", "EU", "EUR", "de", true, false, false, false, false],
    ["JP", "JP", "Japão", "JP", "JPY", "ja", true, false, false, false, false],
    ["AU", "AU", "Austrália", "OC", "AUD", "en", true, false, false, false, false],
  ] as const;
  for (const [id, countryCode, name, regionCode, defaultCurrency, locale, intelligence, offers, sellers, checkout, cross] of markets) {
    await prisma.market.upsert({
      where: { id },
      update: {},
      create: {
        id,
        countryCode,
        name,
        regionCode,
        defaultCurrency,
        locale,
        intelligenceEnabled: intelligence,
        offersVisible: offers,
        sellersEnabled: sellers,
        checkoutEnabled: checkout,
        crossBorderEnabled: cross,
      },
    });
  }

  await prisma.platformSetting.upsert({
    where: { key: "past_due_grace_hours" },
    update: {},
    create: { key: "past_due_grace_hours", value: 72 },
  });

  for (const entitlement of ENTITLEMENTS) {
    await prisma.entitlement.upsert({ where: { code: entitlement.code }, update: {}, create: entitlement });
  }

  const plans = [
    { id: "free", name: "Free", audience: "collector", sort: 0, codes: FREE },
    { id: "collector_pro", name: "Collector Pro", audience: "collector", sort: 1, codes: COLLECTOR },
    { id: "seller_pro", name: "Seller Pro", audience: "seller", sort: 2, codes: SELLER },
  ];
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: { name: plan.name },
      create: { id: plan.id, name: plan.name, audience: plan.audience, sort: plan.sort, public: plan.id !== "free" ? true : true },
    });
    for (const code of plan.codes) {
      const config =
        code === "watchlist_limited" ? { max: plan.id === "free" ? 20 : 200 } : code === "alerts_limited" ? { max: plan.id === "free" ? 3 : 50 } : undefined;
      await prisma.planEntitlement.upsert({
        where: { planId_code: { planId: plan.id, code } },
        update: { config },
        create: { planId: plan.id, code, config },
      });
    }
  }

  const existingRule = await prisma.commissionRule.findFirst({ where: { name: "Comissão ainda não definida" } });
  if (!existingRule) {
    await prisma.commissionRule.create({
      data: {
        name: "Comissão ainda não definida",
        rateBps: 0,
        active: true,
      },
    });
  }

  const sources = [
    {
      id: "tcgdex",
      name: "TCGdex",
      kind: "catalog",
      baseUrl: "https://api.tcgdex.net/v2",
      enabled: true,
      catalogAllowed: true,
      pricingAllowed: false,
      licenseNote: "Catálogo e imagens para identificação. Campos de preço de terceiros no payload são ignorados.",
    },
    {
      id: "scrydex",
      name: "Scrydex",
      kind: "prices",
      baseUrl: "https://api.scrydex.com",
      enabled: false,
      catalogAllowed: false,
      pricingAllowed: false,
      licenseNote: "Conector pronto, desligado. Exige API key, team id e licença de redistribuição.",
    },
    {
      id: "pokeplace",
      name: "PokePlace",
      kind: "marketplace",
      baseUrl: null,
      enabled: true,
      catalogAllowed: false,
      pricingAllowed: true,
      licenseNote: "Vendas concluídas neste marketplace, excluindo demonstração e auto-negociação.",
    },
  ];
  for (const source of sources) {
    await prisma.dataSource.upsert({ where: { id: source.id }, update: source, create: source });
  }

  const indices = [
    ["global-pokemon", "Global Pokémon Market Index", null, "market"],
    ["north-america", "North America Index", "NA", "region"],
    ["europe", "Europe Index", "EU", "region"],
    ["japan", "Japan Index", "JP", "region"],
    ["latin-america", "Latin America Index", "LATAM", "region"],
    ["vintage", "Vintage Pokémon Index", null, "vintage"],
    ["modern", "Modern Pokémon Index", null, "modern"],
    ["sealed", "Sealed Products Index", null, "sealed"],
  ] as const;
  for (const [id, name, region, category] of indices) {
    await prisma.marketIndex.upsert({
      where: { id },
      update: {},
      create: { id, name, region, category, published: false },
    });
    const existing = await prisma.indexMethodology.findFirst({ where: { indexId: id, version: 1 } });
    if (!existing) {
      await prisma.indexMethodology.create({
        data: {
          indexId: id,
          version: 1,
          minConstituents: 30,
          summary:
            "Peso igual da variação de cartas com preço estimado por venda verificada, líquidas e com observação no período anterior. Sem isso o índice não é publicado e nenhum nível é inventado.",
        },
      });
    }
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Administração PokePlace",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
    },
  });
  const bellaUser = await prisma.user.upsert({
    where: { email: bellaEmail },
    update: {},
    create: {
      email: bellaEmail,
      name: "Bella Figurinha",
      passwordHash: await bcrypt.hash(bellaPassword, 12),
      role: "USER",
    },
  });
  const bellaSeller = await prisma.seller.findUnique({ where: { userId: bellaUser.id } });
  if (!bellaSeller) {
    const application = await prisma.sellerApplication.create({
      data: {
        userId: bellaUser.id,
        personType: PersonType.COMPANY,
        legalName: "Bella Figurinha",
        taxIdLast4: "0000",
        taxIdCipher: sealTaxId("00000000000000"),
        email: bellaEmail,
        phone: "00000000000",
        city: "São Paulo",
        state: "SP",
        operationType: "Loja da operação",
        categories: "Cartas e lacrados",
        termsVersion: "2026-11-07",
        termsAcceptedAt: new Date(),
        status: "APPROVED",
        events: {
          create: {
            toStatus: "APPROVED",
            reason: "Loja pioneira da operação. Conta separada da administração da plataforma.",
            actorId: admin.id,
          },
        },
      },
    });
    await prisma.seller.create({
      data: {
        userId: bellaUser.id,
        applicationId: application.id,
        slug: "bella-figurinha",
        displayName: "Bella Figurinha",
        legalName: "Bella Figurinha",
        city: "São Paulo",
        state: "SP",
        countryCode: "BR",
        status: "APPROVED",
        isOperationStore: true,
        bio: "Primeira loja do marketplace. Usa a mesma infraestrutura das demais.",
      },
    });
  }

  const setIds = (process.env.CATALOG_SET_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (setIds.length === 0) {
    const index = await fetch("https://api.tcgdex.net/v2/pt/sets").then((response) => response.json() as Promise<{ id: string }[]>);
    setIds.push(...index.map((set) => set.id));
  }
  const result = await importCatalog(setIds);
  console.log(`Catálogo importado: ${result.cards} fichas de idioma. Preços externos: 0.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
