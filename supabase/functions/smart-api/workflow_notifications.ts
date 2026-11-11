// Uses the same delivery key as the bot, so publishing through either interface
// cannot send the same successful notification twice.
export async function notifyPublished(
  db: any,
  bot: string,
  row: any,
): Promise<{ sent: number; failed: number }> {
  const report = { sent: 0, failed: 0 };
  for (let offset = 0; ; offset += 100) {
    const users = await db
      .from("rpv_customer_visible_acts")
      .select("telegram_id")
      .eq("act_id", row.act_id)
      .order("telegram_id")
      .range(offset, offset + 99);
    if (users.error) throw new Error("Notification recipient lookup failed");
    for (const user of users.data || []) {
      const visible = await db
        .from("rpv_customer_visible_acts")
        .select("act_id")
        .eq("telegram_id", user.telegram_id)
        .eq("act_id", row.act_id)
        .maybeSingle();
      if (visible.error) throw new Error("Notification access lookup failed");
      if (!visible.data) continue;
      const claimed = await db
        .from("rpv_customer_delivery")
        .upsert(
          { act_id: row.act_id, telegram_id: user.telegram_id },
          { onConflict: "act_id,telegram_id", ignoreDuplicates: true },
        )
        .select("telegram_id");
      if (claimed.error) throw new Error("Notification delivery lookup failed");
      if (!claimed.data?.length) continue;
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${bot}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: user.telegram_id,
              text: `Опубліковано акт · заявка № ${row.application_number || "—"}\nДата виконання: ${row.work_date}\nВідкачано ${row.pumped_m3} м³. Перегляньте акт і лічильник у кабінеті.`,
            }),
          },
        );
        const result = await response.json();
        if (result.ok) report.sent++;
        else {
          report.failed++;
          if (result.error_code)
            await db
              .from("rpv_customer_delivery")
              .delete()
              .eq("act_id", row.act_id)
              .eq("telegram_id", user.telegram_id);
        }
      } catch {
        report.failed++;
      } // Ambiguous transport delivery keeps its claim, matching the existing bot.
    }
    if ((users.data || []).length < 100) break;
  }
  return report;
}
export async function notifyContact(
  bot: string,
  id: number,
  approved: boolean,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${bot}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: id,
          text: approved
            ? "Офіс підтвердив ваш контакт. Продовжіть реєстрацію та заповніть паспорт об’єкта."
            : "Офіс відхилив запит на підтвердження контакту. Зверніться до офісу.",
          ...(approved
            ? {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Продовжити реєстрацію",
                        callback_data: "rpvc:continue",
                      },
                    ],
                  ],
                },
              }
            : {}),
        }),
      },
    );
    return !!(await response.json()).ok;
  } catch {
    return false;
  }
}
