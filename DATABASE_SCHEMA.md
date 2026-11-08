# Modelo de dados

PostgreSQL. Dinheiro em unidade menor inteira mais código de moeda. Tempo em `timestamptz`. O desenho físico está em `prisma/schema.prisma` e na migração `20261108010000_init`.

## Catálogo

`Series`, `Expansion`, `ExpansionTranslation`, `Card`, `CardTranslation`, `Printing`, `SealedProduct`.

A carta `sv03.5-001` é uma ficha. A impressão `sv03.5-001:pt:NORMAL:` é outra linha da impressão inglesa, do reverso ou de um carimbo. Lacrado não aponta para a soma das cartas. `identityStatus` distingue cadastro provisório de identidade confirmada.

## Mercado e câmbio

`Market`, `Currency`, `ExchangeRate`. Câmbio guarda taxa, momento e fonte. Conversão não apaga o valor original da observação.

## Preço

`DataSource`, `IngestionJob`, `PriceObservation`.

A observação carrega fonte, variante, condição, `gradeKey`, mercado, moeda, tipo (`ASKING`, `VERIFIED_SALE`, `LICENSED_INDICATOR`), licença de exibição, cancelamento, demonstração e auto-negociação. Nada é sobrescrito: uma venda nova é outra linha.

## Marketplace

`SellerApplication`, `SellerReviewEvent`, `Seller`, `Listing`, `ListingPhoto`, `Cart`, `CartItem`, `Order`, `SellerOrder`, `OrderItem`, `Payment`, `CommissionRule`, `CommissionEntry`, `Shipment`, `Review`, `Dispute`, `ReturnRequest`.

`Listing.quantity` e `Listing.reserved` se movem com `UPDATE` condicional. Comissão nasce na conclusão do pedido, com alíquota copiada para a linha.

## Assinatura

`SubscriptionPlan`, `Entitlement`, `PlanEntitlement`, `PlanPrice`, `Subscription`, `BillingInvoice`, `BillingEvent`, `UserEntitlement`, `FeatureUsage`.

`BillingEvent` é único por provedor e id externo. `PlanPrice.active` é o preço vigente. Preço antigo permanece.

## Coleção e acompanhamento

`Collection`, `CollectionItem`, `Acquisition`, `WatchItem`, `PriceAlert`, `Notification`.

## Índice e auditoria

`MarketIndex`, `IndexMethodology`, `IndexSnapshot`, `AuditLog`, `PaywallEvent`, `PlatformSetting`.

`IndexSnapshot.points` fica nulo enquanto a publicação não é autorizada pela regra de componentes.
