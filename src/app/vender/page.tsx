import { cookies } from "next/headers";
import { BRAZIL_STATES } from "@/domain/documents";
import { isLocale, t } from "@/i18n";
import { ActionForm } from "@/components/action-form";
import { applySellerAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function SellPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const user = await currentUser();
  const application = user
    ? await prisma.sellerApplication.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })
    : null;
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
      <div>
        <h1 className="font-serif text-4xl md:text-5xl">{t(locale, "sell.title")}</h1>
        <p className="mt-4 text-lg text-muted">{t(locale, "sell.lede")}</p>
        <ol className="mt-6 space-y-2 text-sm">
          <li>1. Cadastro enviado.</li>
          <li>2. Análise da administração.</li>
          <li>3. Documento complementar, se faltar algo.</li>
          <li>4. Aprovado, rejeitado com motivo, ou mais tarde suspenso.</li>
        </ol>
        {application ? <p className="mt-6 border border-line p-3 text-sm">Sua inscrição está em {application.status}.</p> : null}
        {enviado ? <p className="mt-3 text-sm text-up">Inscrição recebida. Ela não é aprovada automaticamente.</p> : null}
      </div>
      {user?.seller?.status === "APPROVED" ? (
        <p className="border border-line p-4">Sua loja já está aprovada. O anúncio fica no painel do vendedor.</p>
      ) : (
        <ActionForm action={applySellerAction} className="space-y-3 border border-line p-4">
          <label className="block text-sm">Tipo
            <select name="personType" className="mt-1 w-full border border-line px-2 py-2">
              <option value="INDIVIDUAL">Pessoa física</option>
              <option value="COMPANY">Pessoa jurídica</option>
            </select>
          </label>
          <Field name="legalName" label="Nome ou razão social" />
          <Field name="taxId" label="CPF ou CNPJ" />
          <Field name="email" label="E-mail" type="email" />
          <Field name="phone" label="Telefone" />
          <Field name="city" label="Cidade" />
          <label className="block text-sm">Estado
            <select name="state" className="mt-1 w-full border border-line px-2 py-2">
              {BRAZIL_STATES.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <Field name="operationType" label="Tipo de operação" />
          <Field name="categories" label="Categorias" />
          <Field name="salesHistory" label="Onde você vende hoje" />
          <Field name="volumeNote" label="Volume aproximado" />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="terms" />
            Aceito os termos e a análise da curadoria.
          </label>
          <button className="bg-ink px-3 py-2 text-sm text-paper">Enviar inscrição</button>
        </ActionForm>
      )}
    </div>
  );
}

function Field({ name, label, type = "text" }: { name: string; label: string; type?: string }) {
  return (
    <label className="block text-sm">
      {label}
      <input name={name} type={type} required className="mt-1 w-full border border-line px-2 py-2" />
    </label>
  );
}
