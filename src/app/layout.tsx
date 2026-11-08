import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import { brand } from "@/domain/brand";
import { isLocale } from "@/i18n";
import { currentUser } from "@/server/auth";
import { Shell } from "@/components/shell";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: "Marketplace e inteligência de preços de Pokémon TCG.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const cookieLocale = jar.get("pp_locale")?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : "pt-BR";
  const user = await currentUser();
  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Shell
          locale={locale}
          user={user ? { name: user.name, role: user.role, sellerStatus: user.seller?.status } : null}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
