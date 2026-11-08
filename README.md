# PokePlace

Marketplace e inteligência de preços de Pokémon TCG. A arquitetura nasce mundial. A venda começa no Brasil, com a Bella Figurinha como primeira loja e curadoria para qualquer vendedor nacional.

## O que já funciona

- Catálogo único importado do TCGdex, com carta, expansão, idioma e acabamento separados. Preços de terceiros que vêm no mesmo payload são ignorados.
- Busca por nome, número e expansão.
- Página da carta com tipo de preço separado: estimativa, anúncio e venda verificada.
- Gráfico de vendas verificadas. Usuário gratuito recebe só a janela de 90 dias. A API recusa período maior sem direito, e a resposta não traz a série.
- Planos Free, Collector Pro e Seller Pro. Preço de mensalidade só existe depois que a administração publica no painel.
- Inscrição de vendedor, decisão auditável, loja, anúncio ligado à ficha e ordenação que ignora o distintivo da Bella.
- Carrinho, reserva de estoque e checkout de teste. Comissão, frete e repasse ficam em lançamentos diferentes.
- Coleção que não transforma compra em valorização.
- Índices definidos, sem nível publicado enquanto faltam vendas.

## O que ainda não está operacional

- Mercado Pago, Stripe e Adyen não estão contratados. O checkout e a assinatura são sandbox e dizem isso na tela.
- Correios e Melhor Envio não estão integrados. O frete é o valor informado pela loja.
- Scrydex, TCGplayer, Cardmarket, eBay e Liga Pokémon não alimentam preço. O conector da Scrydex existe desligado, à espera de chave e licença.
- Identificação por foto não sugere carta sem provedor.
- Não há índice, ranking nem candle fabricado.

## Subir localmente

PostgreSQL 16, Node 22.

```bash
cp .env.example .env
# preencha AUTH_SECRET, TAX_ID_KEY e as senhas de seed
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Contas criadas pelo seed, com as senhas do `.env`:

- Administração: `SEED_ADMIN_EMAIL`
- Bella Figurinha: `SEED_BELLA_EMAIL` — vendedora, sem acesso ao painel administrativo

`CATALOG_SET_IDS` vazio importa todas as expansões do TCGdex. A lista padrão traz uma amostra vintage e moderna.

```bash
npm test
npm run lint
```

Os testes de integração usam `DATABASE_URL_TEST`.

## Documentação

Visão, benchmark, arquitetura, catálogo, preços, índices, assinatura, marketplace, pagamentos, segurança, roadmap e testes estão nos arquivos markdown da raiz. Eles descrevem o que o código faz hoje e o que continua pendente de contrato.
