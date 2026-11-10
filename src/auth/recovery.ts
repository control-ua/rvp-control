export function parseRecoveryLink(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const intended =
    url.searchParams.get("auth") === "recovery" ||
    hash.get("type") === "recovery";
  return {
    intended,
    accessToken: intended ? hash.get("access_token") : null,
    refreshToken: intended ? hash.get("refresh_token") : null,
    code: intended ? url.searchParams.get("code") : null,
    failed: intended && (hash.has("error") || url.searchParams.has("error")),
  };
}
export function passwordError(password: string, repeat: string) {
  if (password.length < 12) return "Використайте щонайменше 12 символів.";
  if (password !== repeat) return "Паролі не збігаються.";
  return "";
}
export function recoveryRedirect(href: string) {
  const url = new URL(href);
  url.search = "?auth=recovery";
  url.hash = "";
  return url.href;
}
