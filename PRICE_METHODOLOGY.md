# Metodologia de preço

Versão inicial, a mesma do código.

1. Filtrar a série: idioma, acabamento, condição, graduação e mercado iguais.
2. Descartar canceladas, demonstração e compra em que comprador e vendedor são a mesma conta.
3. Ficar com vendas verificadas dos últimos 90 dias.
4. Se houver quatro ou mais preços, afastar outliers fora de 1,5 IQR. Se o filtro esvaziar a amostra, a amostra original permanece para a contagem.
5. Com cinco ou mais preços restantes, a estimativa é a mediana. O método registrado é `median_verified_sales_90d_iqr`.
6. Abaixo disso, não chamar o número de preço de mercado.
7. Três ou mais anúncios válidos geram menor preço e mediana de anúncio, com método `asking_reference_not_a_transaction`.

Não há intervalo de confiança publicado nesta versão: a amostra ainda não justifica.

O peso de fonte externa não entra enquanto a fonte não estiver licenciada para exibição. Quando entrar, continua fora da mediana de venda e com rótulo próprio.

Janela gratuita de leitura: 90 dias corridos a partir do instante da consulta. “3 meses” na interface é esse intervalo. “6 meses”, “1 ano”, “3 anos” e “5 anos” são 180, 365, 1095 e 1825 dias. “Máximo” é desde a primeira observação exibível. Assinatura não fabrica o trecho anterior.
