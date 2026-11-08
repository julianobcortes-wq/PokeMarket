# Testes

`npm test` sobe a migração no banco de aplicação e no `DATABASE_URL_TEST`, depois roda Vitest.

## Domínio, sem banco

- Janela de 90 dias e recusa de 1 ano.
- Variação nula sem ponto no início do período.
- Anúncio e referência externa não viram preço estimado.
- Carta japonesa graduada fora da mediana da carta inglesa crua.
- Poucas vendas, venda cancelada, demonstração e auto-negociação.
- Compra não conta como valorização; falta de cotação não vira zero.
- Índice não publica com amostra pequena.
- Ordenação não privilegia a loja da operação.
- Comissão, frete e GMV separados.
- União de planos sem duplicar `price_history_full`.
- Ferramenta de vendedor cai sem aprovação; direito pago cai quando a assinatura expira.
- CPF, CNPJ e identificação por foto sem provedor.

## Integração, PostgreSQL

- Duas reservas da última unidade: uma falha.
- Pedido de teste gera comissão, líquido do vendedor e uma venda verificada na série certa.
- Loja suspensa não anuncia; outra loja não lê o pedido.
- Inscrição de Pernambuco é aprovada com evento e auditoria.
- Gratuito não recebe observação de 2024 na janela de 3 meses nem no `max`. Assinante recebe as duas. Webhook repetido não duplica fatura. Reembolso tira o direito.

## Ainda sem suíte de browser automatizada

O fluxo de tela foi exercitado no servidor de desenvolvimento: home, busca, carta, paywall da API, planos sem preço, loja da Bella e painel. Pagamento real, frete contratado e fonte paga de histórico não têm teste porque não estão ligados.
