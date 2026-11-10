import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyTelegram,
  hmac,
  monthRange,
  kyivDay,
  uuid,
} from "../supabase/functions/rpv-portal/auth.ts";
const token = "test-token-only";
const time = Date.parse("2026-11-10T22:30:00Z");
async function signed(overrides = {}) {
  const p = new URLSearchParams({
    auth_date: String(time / 1000),
    query_id: "query",
    user: JSON.stringify({ id: 123, first_name: "Test" }),
    ...overrides,
  });
  const value = [...p.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), token);
  const signature = await hmac(secret, value);
  p.set("hash", Buffer.from(signature).toString("hex"));
  return p.toString();
}
test("Telegram signature verifies and tampering is rejected", async () => {
  const data = await signed();
  assert.equal(await verifyTelegram(data, token, time), 123);
  await assert.rejects(
    verifyTelegram(data.replace("Test", "Other"), token, time),
  );
  await assert.rejects(verifyTelegram(data, "other-token", time));
});
test("stale, future, duplicate and absent data fail closed", async () => {
  const data = await signed();
  await assert.rejects(verifyTelegram(data, token, time + 3601000));
  await assert.rejects(
    verifyTelegram(
      await signed({ auth_date: String(time / 1000 + 90) }),
      token,
      time,
    ),
  );
  await assert.rejects(verifyTelegram(data + "&auth_date=0", token, time));
  await assert.rejects(verifyTelegram("", token, time));
});
test("no user, unsafe IDs and bot identities cannot authenticate", async () => {
  for (const user of [
    {},
    { id: -1 },
    { id: 2 ** 54 },
    { id: 123, is_bot: true },
  ])
    await assert.rejects(
      verifyTelegram(await signed({ user: JSON.stringify(user) }), token, time),
    );
});
test("Kyiv month boundaries and leap year archive", () => {
  assert.equal(kyivDay(new Date("2026-10-31T22:30:00Z")), "2026-11-01");
  assert.deepEqual(monthRange("2024-02", new Date(time)), {
    month: "2024-02",
    start: "2024-02-01",
    end: "2024-03-01",
    today: "2026-11-11",
  });
  assert.throws(() => monthRange("2026-13", new Date(time)));
  assert.throws(() => monthRange("2026-12", new Date(time)));
});
test("record identifiers validate before queries", () => {
  assert.throws(() => uuid("or(id.eq.anything)"));
  assert.equal(
    uuid("12345678-1234-1234-1234-123456789012"),
    "12345678-1234-1234-1234-123456789012",
  );
});
