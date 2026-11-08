# Operação do marketplace

Uma impressão, uma condição e uma graduação podem ter várias ofertas. A ordem neutra é: menor total de produto mais frete, depois menor prazo de manuseio, depois mais pedidos concluídos, depois id. `isOperationStore` é exibido e não participa da ordenação.

A Bella Figurinha nasce aprovada, com slug `bella-figurinha` e conta distinta da administração. Sem anúncio até alguém publicar. Não há preço semeado como se fosse estoque real.

Estoque: reservar aumenta `reserved` só se `quantity - reserved` alcança. Duas reservas da última unidade não passam juntas. Pagamento aprovado baixa `quantity` e a reserva. Recusa devolve a reserva. Conclusão reconhece a comissão. Antes disso o pedido pago ainda não é GMV.

Comissão lê `CommissionRule`. A regra inicial está em zero por cento, com o nome de que a administração ainda não definiu. O painel troca a alíquota e grava auditoria. Base é o valor dos itens. Frete vai ao vendedor e não entra na base. Taxa de pagamento é outro campo, hoje zero porque não há PSP.

Avaliação verificada exige pedido. O modelo existe; a tela de nota ainda não está aberta, para não aceitar avaliação solta.

Vendedor suspenso ou bloqueado tem os anúncios ativos pausados e não cria outro.
