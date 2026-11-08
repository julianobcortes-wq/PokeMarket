# Arquitetura

Aplicação única em Next.js e TypeScript. PostgreSQL é o sistema de registro, com Prisma e migração versionada. A regra de negócio que não depende de tela está em `src/domain`. Persistência, sessão e integrações estão em `src/server`. A interface em `src/app` chama esses serviços. Não há segundo catálogo por país.

## Módulos

- Catálogo: série, expansão, carta, tradução, impressão, lacrado.
- Preços: observação, estimativa, histórico com janela de direito.
- Mercado: índice e ranking, publicados só com dado suficiente.
- Identidade: conta, sessão, idioma.
- Vendedores: inscrição, decisão, loja.
- Ofertas, carrinho, pedido, pagamento sandbox, comissão, frete informado.
- Assinatura: plano, preço administrável, webhook idempotente, entitlement.
- Coleção, watchlist e alerta.
- Administração e auditoria.

## Direitos

`accessFor` recalcula os direitos a partir das assinaturas vigentes. Código de tela e de API pergunta pelo código do direito, não pelo nome do plano. Seller Pro inclui `price_history_full` e as ferramentas `seller_*`. Ferramenta de loja some se o vendedor não está aprovado. Anunciar olha o status da loja, não a assinatura.

A série histórica é filtrada na consulta. Resposta premium usa `Cache-Control: private, no-store`, porque a URL é a mesma para gratuito e assinante.

## Mercados

A tabela `Market` separa inteligência, oferta visível, vendedor, checkout e compra internacional. Brasil nasce com checkout. Os demais nascem com inteligência ligada e checkout desligado. Abrir país é atualizar essa linha e o provedor, não criar outro banco.

## Integrações

Cada fonte tem registro próprio e um job de ingestão. TCGdex preenche ficha. Scrydex está desligada. Venda concluída do próprio marketplace grava observação `VERIFIED_SALE`, exceto demonstração e compra da própria loja.

Pagamento e assinatura passam pelo provedor `sandbox`. Não há SDK de Mercado Pago ou Stripe espalhado pela interface. Trocar o provedor é substituir o adaptador e manter o mesmo pedido, a mesma fatura e o mesmo evento.

## O que esta versão não reconstrói depois

Catálogo, moeda, mercado, impressão, graduação, pedido por vendedor e entitlement já estão no schema. Logística contratada, PSP real, visão computacional e índice calculado entram como dados e adaptadores em cima disso.
