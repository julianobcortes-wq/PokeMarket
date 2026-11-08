# Catálogo

Hierarquia: jogo implícito Pokémon TCG, série, expansão, carta, impressão, condição, graduação, anúncio.

A carta não muda de identidade quando outro vendedor anuncia. O anúncio escolhe `printingId`, condição e, se houver, certificadora, nota e número. `gradeKey` `raw` não se mistura com `PSA_10`.

Condições: Near Mint, Lightly Played, Moderately Played, Heavily Played e Damaged, com texto curto na página da carta.

Lacrado tem tipo de embalagem, idioma, região, código e quantidade de unidades. Sem código oficial o registro fica provisório e fora de índice. Nesta versão o seed não cria lacrado com palpite de conteúdo.

A busca usa `pg_trgm` e `ILIKE` em nome, número, id e expansão.

A imagem vem do TCGdex para identificação, com crédito na página. Isso não é licença de uso comercial da arte da The Pokémon Company.
