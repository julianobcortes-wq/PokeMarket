import type { MetadataRoute } from "next";
import { brand } from "@/domain/brand";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `https://${brand.domain}/sitemap.xml` };
}
