import { identifyCard } from "@/server/tcgdex";

export default function IdentifyPage() {
  const result = identifyCard();
  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-4xl">Identificação por foto</h1>
      <p className="mt-3 text-muted">O conector de visão não está configurado. A página não sugere carta, nota nem autenticidade a partir de uma imagem.</p>
      <p className="mt-4 font-mono text-sm">{result.status}</p>
    </div>
  );
}
