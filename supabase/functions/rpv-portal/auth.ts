export class PortalError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const encoder = new TextEncoder();
export async function hmac(
  key: Uint8Array,
  value: string,
): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key).buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", imported, encoder.encode(value)),
  );
}
export async function verifyTelegram(
  initData: unknown,
  token: string,
  now = Date.now(),
): Promise<number> {
  if (typeof initData !== "string" || initData.length > 12000 || !initData)
    throw new PortalError(401, "Відкрийте кабінет із Telegram-бота.");
  const fields = new URLSearchParams(initData);
  const keys = [...fields.keys()];
  if (new Set(keys).size !== keys.length)
    throw new PortalError(401, "Некоректні дані входу.");
  const hash = fields.get("hash") || "";
  const date = Number(fields.get("auth_date"));
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    !Number.isSafeInteger(date) ||
    date > now / 1000 + 30 ||
    now / 1000 - date > 3600
  )
    throw new PortalError(
      401,
      "Сесію завершено. Відкрийте кабінет у боті ще раз.",
    );
  fields.delete("hash");
  const data = [...fields.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), token);
  const expected = await hmac(secret, data);
  let diff = 0;
  for (let i = 0; i < 32; i++)
    diff |= expected[i] ^ parseInt(hash.slice(i * 2, i * 2 + 2), 16);
  if (diff) throw new PortalError(401, "Не вдалося підтвердити Telegram-вхід.");
  let user;
  try {
    user = JSON.parse(fields.get("user") || "{}");
  } catch {
    throw new PortalError(401, "Некоректний профіль.");
  }
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || user.is_bot)
    throw new PortalError(401, "Некоректний профіль.");
  return user.id;
}
export function kyivDay(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function monthRange(value: unknown, now = new Date()) {
  const current = kyivDay(now).slice(0, 7);
  const month = value === undefined ? current : String(value);
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    month < "2020-01" ||
    month > current
  )
    throw new PortalError(400, "Оберіть поточний або минулий місяць.");
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return {
    month,
    start: `${month}-01`,
    end: d.toISOString().slice(0, 10),
    today: kyivDay(now),
  };
}
export function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value)
  )
    throw new PortalError(400, "Некоректний ідентифікатор.");
  return value;
}
