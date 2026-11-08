import { ActionForm } from "@/components/action-form";
import { registerAction } from "@/server/actions";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-serif text-4xl">Criar conta</h1>
      <ActionForm action={registerAction} className="mt-6 space-y-3">
        <label className="block text-sm">Nome<input name="name" required className="mt-1 w-full border border-line px-2 py-2" /></label>
        <label className="block text-sm">E-mail<input name="email" type="email" required className="mt-1 w-full border border-line px-2 py-2" /></label>
        <label className="block text-sm">Senha<input name="password" type="password" required minLength={8} className="mt-1 w-full border border-line px-2 py-2" /></label>
        <button className="bg-ink px-3 py-2 text-sm text-paper">Cadastrar</button>
      </ActionForm>
    </div>
  );
}
