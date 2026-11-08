/** Sandbox checkout and billing stay off in production, including the public site. */
export function sandboxCommerceEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.SANDBOX_COMMERCE === "1";
}
