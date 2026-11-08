import { prisma } from "@/server/db";

export default async function SealedPage() {
  const products = await prisma.sealedProduct.findMany({ orderBy: { name: "asc" }, include: { expansion: true } });
  return (
    <div>
      <h1 className="font-serif text-4xl">Produtos lacrados</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Booster, booster box e ETB são produtos diferentes. O preço de um lacrado nunca é a soma das cartas de dentro. Um item só entra na cotação quando a identidade — código, idioma, região e embalagem — está confirmada.
      </p>
      {products.length === 0 ? (
        <p className="mt-8 border border-line p-4 text-muted">Nenhum lacrado com identidade confirmada. A administração cadastra o produto antes de qualquer anúncio.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border border-line">
          {products.map((product) => (
            <li key={product.id} className="px-4 py-3">
              <p className="font-medium">{product.name}</p>
              <p className="font-mono text-xs text-muted">
                {product.packaging} · {product.language} · {product.identityStatus}
                {product.productCode ? ` · ${product.productCode}` : " · sem código oficial"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
