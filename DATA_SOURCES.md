# Fontes de dados

Ordem seguida: API e serviço com licença, contrato, feed, arquivo autorizado, scraping só se for lícito, dado próprio. Não há scraping, contorno de CAPTCHA nem uso de credencial alheia.

| Fonte | Estado | Catálogo | Preço |
| --- | --- | --- | --- |
| TCGdex | ligada, `tcgdex-catalog-1` | sim | não. O campo `pricing` do JSON é ignorado. |
| Scrydex | desligada | não | não, até `SCRYDEX_API_KEY`, `SCRYDEX_TEAM_ID` e licença de redistribuição |
| PokePlace | ligada | não | sim, venda concluída própria |
| TCGplayer, Cardmarket, eBay, Liga Pokémon | sem conector | não | não |

Cada carga grava `IngestionJob` com versão, status e contagem. Falha de uma fonte não apaga o catálogo já salvo.

Proveniência da observação: fonte, referência, produto, variante, mercado, moeda, valor, momento, condição, tipo, validação, versão do conector e se a licença permite exibir.
