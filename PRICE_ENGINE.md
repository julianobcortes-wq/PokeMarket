# Global TCG Price Engine

Implementação em `src/domain/price-engine.ts` e leitura em `src/server/pricing.ts`.

Tipos que não se misturam:

- preço anunciado e menor anúncio, lidos das ofertas ativas que não são demonstração
- mediana anunciada
- última venda verificada
- preço estimado, só com venda verificada bastante
- referência externa, se um dia a licença permitir, sempre rotulada
- preço convertido, ainda não exibido como substituto do original

A estimativa não usa anúncio nem indicador licenciado no lugar da venda. Com menos de cinco vendas comparáveis na janela de 90 dias, o estado é `insufficient` ou, se houver pelo menos três anúncios, `asking_only`.

Variação percentual só sai quando existe ponto na largada do período e ponto atual. Caso contrário o número não aparece.

Série diária é a mediana das vendas daquele dia. Não há candle. Um único anúncio de hoje não é desenhado para trás.

Auditoria: a observação original permanece. A metodologia pública está em `/metodologia`.
