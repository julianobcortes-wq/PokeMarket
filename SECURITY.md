# Segurança

- Senha com bcrypt.
- Sessão JWT em cookie httpOnly, SameSite lax, assinada por `AUTH_SECRET` de no mínimo 32 caracteres.
- Papel `ADMIN` separado do usuário da Bella.
- Consulta de pedido da loja filtrada pelo `sellerId` da sessão. Outra loja recebe não encontrado.
- CPF/CNPJ cifrados com AES-GCM e `TAX_ID_KEY`.
- Histórico premium negado no servidor, com corpo sem pontos.
- Cache da série: `private, no-store`.
- Limite simples de taxa na rota de histórico, em memória do processo.
- Upload de documento não existe, então não há arquivo de identidade no disco.
- Venda entre a mesma conta não vira observação de mercado.
- Demonstração, se for ligada no futuro, fica marcada e fora da estimativa.
- Segredos de exemplo no `.env.example` não são senha de produção.

LGPD: minimização na inscrição, finalidade de análise e obrigação fiscal, sem venda de dado. GDPR fica o mesmo desenho quando um mercado europeu ligar o checkout; hoje esse checkout está desligado.

Pendências: provedor de e-mail, object storage com política de acesso, backup automatizado, rate limit distribuído e revisão de fraude entre contas relacionadas além do caso comprador = vendedor.
