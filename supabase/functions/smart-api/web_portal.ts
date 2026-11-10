const PORTAL = "https://control-ua.github.io/rvp-control/";
export const WEB_CABINET = "🌐 Відкрити вебкабінет";
export async function handleWebPortal(
  update: any,
  db: any,
  telegram: (method: string, body: Record<string, unknown>) => Promise<any>,
  office: boolean,
): Promise<boolean> {
  const m = update?.message;
  if (m?.chat?.type !== "private" || !m?.from?.id || m.chat.id !== m.from.id)
    return false;
  const text = String(m.text || "").trim();
  if (text !== "/web" && text !== WEB_CABINET) return false;
  const id = m.from.id;
  const [c, k] = await Promise.all([
    db
      .from("customers")
      .select("status,phone")
      .eq("telegram_id", id)
      .maybeSingle(),
    db
      .from("contractors")
      .select("status,phone")
      .eq("telegram_id", id)
      .maybeSingle(),
  ]);
  if (c.error || k.error) throw new Error("Web cabinet profile lookup failed");
  const buttons = [];
  if (c.data?.status === "active" && c.data.phone)
    buttons.push([
      {
        text: "Кабінет замовника",
        web_app: { url: PORTAL + "?cabinet=customer" },
      },
    ]);
  if (k.data?.status === "active" && k.data.phone)
    buttons.push([
      {
        text: "Кабінет підрядника",
        web_app: { url: PORTAL + "?cabinet=contractor" },
      },
    ]);
  if (office)
    buttons.push([{ text: "Адмін-панель Гідра Сервіс", url: PORTAL }]);
  await telegram("sendMessage", {
    chat_id: id,
    text: buttons.length
      ? "Відкрити вебкабінет RPV Control"
      : "Спочатку зареєструйтеся в боті та дочекайтеся підтвердження контакту від офісу.",
    ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
  return true;
}
