# Pagamentos

O provedor em execução é `sandbox`, e só fora de produção quando `SANDBOX_COMMERCE=1`. No site público esse caminho fica desligado: ninguém aprova o próprio pagamento, libera plano pago nem baixa estoque. Ele não fala com Mercado Pago, Stripe ou Adyen. A tela de checkout e a de assinatura dizem que a captura é simulada quando o sandbox está ligado.

Uma venda aprovada no sandbox gera observação com `demo: true`. Ela prova o fluxo, mas fica fora da série pública, da estimativa e da contagem de vendas verificadas. Só um pagamento de provedor real entra na cotação.

O pedido do comprador pode reunir itens de mais de uma loja. Por dentro há um `SellerOrder` por vendedor, com frete daquela origem. O pagamento é um só no sandbox, no valor da soma. Quando houver PSP, o split precisa de contrato: o núcleo não assume que o provedor aceita 1:N.

Estados do pagamento: pendente, aprovado, recusado, reembolsado. Aprovação é idempotente. Comissão só na conclusão, para respeitar cancelamento antes do recebimento. O prazo legal de arrependimento no Brasil ainda não tem relógio próprio; o pedido permanece `PAID` até o comprador confirmar o recebimento nesta versão de teste.

Conciliação: `Payment`, `CommissionEntry` e `BillingInvoice` são tabelas diferentes. GMV é a soma dos itens de pedidos `COMPLETED`. Receita de comissão é a soma das linhas reconhecidas. Repasse é `sellerNetMinor`. Assinatura não entra no GMV.

Webhook de assinatura: único por (`provider`, `externalId`).

Segredo de PSP, quando existir, fica em ambiente, não no repositório.
