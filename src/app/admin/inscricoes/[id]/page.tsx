import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { reviewSellerAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  const { id } = await params;
  const application = await prisma.sellerApplication.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "asc" } } } });
  if (!application) notFound();
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-4xl">{application.legalName}</h1>
      <p className="mt-2 text-sm text-muted">{application.personType} · {application.city}/{application.state} · documento final {application.taxIdLast4} · {application.status}</p>
      <p className="mt-3 text-sm">{application.operationType}. {application.categories}. {application.volumeNote}</p>
      <h2 className="mt-6 font-serif text-2xl">Decisões</h2>
      <ol className="mt-2 space-y-2 text-sm">
        {application.events.map((event) => (
          <li key={event.id}>{event.toStatus} — {event.reason}</li>
        ))}
      </ol>
      <ActionForm action={reviewSellerAction} className="mt-6 space-y-2">
        <input type="hidden" name="applicationId" value={application.id} />
        <select name="to" className="w-full border border-line px-2 py-2">
          <option value="IN_REVIEW">Em análise</option>
          <option value="DOCS_REQUESTED">Pedir documento</option>
          <option value="APPROVED">Aprovar</option>
          <option value="REJECTED">Rejeitar</option>
          <option value="SUSPENDED">Suspender</option>
          <option value="BLOCKED">Bloquear</option>
        </select>
        <textarea name="reason" required placeholder="Justificativa" className="w-full border border-line px-2 py-2" />
        <button className="bg-ink px-3 py-2 text-sm text-paper">Registrar decisão</button>
      </ActionForm>
    </div>
  );
}
