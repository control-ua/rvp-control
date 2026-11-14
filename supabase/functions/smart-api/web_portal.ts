const PORTAL = "https://gidraservicedp-alt.github.io/rvp-control/";
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
  const [c, k, session] = await Promise.all([
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
    office
      ? db.from("bot_sessions").select("state").eq("telegram_id", id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (c.error || k.error || session.error)
    throw new Error("Web cabinet profile lookup failed");
  const state = session.data?.state;
  const contractorMode = office && (
    state === "admin_contractor_mode" || state === "manager_message" ||
      /^wf_(volume|date|note|upload|decline|problem):/.test(state || "") ||
    ["waiting_act:", "waiting_act_start:", "waiting_act_files:"].some(
      (prefix) => state?.startsWith(prefix),
    )
  );
  if (contractorMode && k.data?.status === "active" && !k.data.phone) {
    await telegram("sendMessage", {
      chat_id: id,
      text: "Щоб відкрити особистий вебкабінет підрядника, спочатку підтвердьте свій номер телефону кнопкою нижче. Після збереження контакту натисніть «🌐 Відкрити вебкабінет» ще раз.",
      reply_markup: {
        keyboard: [[{ text: "📱 Поділитися своїм контактом", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return true;
  }
  const buttons = [];
  if (!contractorMode && c.data?.status === "active" && c.data.phone)
    buttons.push([
      {
        text: "Кабінет менеджера АЗК",
        web_app: { url: PORTAL + "?cabinet=customer" },
      },
    ]);
  if (k.data?.status === "active" && k.data.phone)
    buttons.push([
      {
        text: "Кабінет виконавця",
        web_app: { url: PORTAL + "?cabinet=contractor" },
      },
    ]);
  if (office && !contractorMode)
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
