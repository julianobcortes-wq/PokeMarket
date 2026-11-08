export default function MethodologyPage() {
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="font-serif text-4xl">Metodologia de preço</h1>
      <p>O preço estimado usa a mediana das vendas verificadas do PokePlace nos últimos 90 dias, depois de afastar outliers pelo intervalo interquartil de 1,5. São necessárias pelo menos cinco vendas comparáveis.</p>
      <p>Comparável significa o mesmo idioma, acabamento, condição, graduação e mercado. Uma carta japonesa PSA 10 não entra na conta de uma carta inglesa sem graduação.</p>
      <p>Anúncio não é venda. Com três ou mais ofertas, mostramos menor preço e mediana como referência de anúncio, com esse nome. Com menos dado, a tela diz que a estimativa não é confiável.</p>
      <p>Venda cancelada, oferta de demonstração e compra da própria loja ficam de fora. Referência externa licenciada, quando existir, aparece separada e nunca substitui a estimativa.</p>
      <p>O gráfico não preenche dias sem negócio. O histórico gratuito é uma janela móvel de 90 dias. A assinatura não cria observação anterior à primeira venda registrada.</p>
    </article>
  );
}
