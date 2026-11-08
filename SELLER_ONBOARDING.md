# Entrada de vendedores

Página `/vender`, texto “Venda suas cartas em nosso marketplace.” Qualquer conta pode pedir, de qualquer UF, pessoa física ou jurídica. Não há convite nem aprovação automática.

Campos: tipo, nome ou razão social, CPF ou CNPJ com dígito verificador, contato, cidade, estado, tipo de operação, categorias, histórico de canal, volume e aceite dos termos. O documento é cifrado. A tela administrativa mostra só os quatro finais.

Estados: `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `DOCS_REQUESTED`, `APPROVED`, `REJECTED`, `SUSPENDED`, `BLOCKED`. Cada passagem grava `SellerReviewEvent` e `AuditLog` com autor e motivo.

Aprovar cria a loja no mesmo schema da Bella. Rejeitar, suspender e bloquear atualizam a loja. Suspensão pausa anúncio ativo.

Depois de aprovado, o vendedor pesquisa a carta, escolhe a impressão, informa condição, quantidade e preço. Graduação é opcional e separa a série de preço. Foto por URL https ainda não vai para object storage; o campo aceita o endereço e o armazenamento de arquivo continua pendente.
