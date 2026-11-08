# Assinaturas

Planos: `free`, `collector_pro`, `seller_pro`. Reservados no catálogo de direitos, sem plano: `enterprise_access` e `api_commercial`.

Free inclui busca, preço atual, histórico de 90 dias, comparação de anúncio, compra, coleção básica, watchlist, ranking básico, alerta limitado e índice quando publicado.

Collector Pro acrescenta histórico integral, comparações, liquidez, volatilidade, carteira, ranking completo, filtro profissional e relatório.

Seller Pro acrescenta o histórico integral e as ferramentas de loja. Não aprova vendedor e não é obrigatório para anunciar. Sem loja aprovada, o direito `seller_*` não é entregue; o histórico integral continua.

Cotas iniciais, editáveis na ligação plano–direito: watchlist 20 no Free e 200 no Collector Pro; alertas 3 e 50. Não estão espalhadas como constante de tela.

Não há mensalidade no seed. A administração publica `PlanPrice` por mercado, moeda e ciclo mensal ou anual. Sem preço ativo, o botão de assinar não cobra.

O fluxo de teste cria assinatura `INCOMPLETE`, confirma um evento `payment_approved` e grava fatura. O mesmo evento repetido não duplica fatura. Cancelamento marca fim de ciclo e mantém o direito até lá. Reembolso e expiração revogam. Tolerância de `past_due` está em `PlatformSetting.past_due_grace_hours` (72 horas na configuração inicial).

Nenhum plano pago vem marcado por padrão.
