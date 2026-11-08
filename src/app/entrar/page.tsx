import Link from "next/link";
import { cookies } from "next/headers";
import { isLocale, t } from "@/i18n";
import { ActionForm } from "@/components/action-form";
import { loginAction } from "@/server/actions";

export default async function LoginPage() {
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-serif text-4xl">{t(locale, "auth.login")}</h1>
      <ActionForm action={loginAction} className="mt-6 space-y-3">
        <label className="block text-sm">E-mail<input name="email" type="email" required className="mt-1 w-full border border-line px-2 py-2" /></label>
        <label className="block text-sm">Senha<input name="password" type="password" required className="mt-1 w-full border border-line px-2 py-2" /></label>
        <button className="bg-ink px-3 py-2 text-sm text-paper">Entrar</button>
      </ActionForm>
      <p className="mt-4 text-sm"><Link href="/cadastro">Criar conta</Link></p>
    </div>
  );
}
