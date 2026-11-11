import test from "node:test";
import assert from "node:assert/strict";
import {
  handleWebPortal,
  WEB_CABINET,
} from "../supabase/functions/smart-api/web_portal.ts";
function setup(customer, contractor, session = null, sessionError = null) {
  const messages = [];
  return {
    messages,
    db: {
      from(table) {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return {
              data: table === "customers" ? customer : table === "contractors" ? contractor : session,
              error: table === "bot_sessions" ? sessionError : null,
            };
          },
        };
      },
    },
    send: async (method, body) => {
      messages.push({ method, ...body });
      return { ok: true };
    },
  };
}
const update = (text = "/web", type = "private") => ({
  message: { text, from: { id: 123 }, chat: { id: 123, type } },
});
test("only confirmed roles receive Mini App buttons", async () => {
  const s = setup(
    { status: "active", phone: "+380111111111" },
    { status: "pending", phone: "+380222222222" },
  );
  assert.equal(await handleWebPortal(update(), s.db, s.send, false), true);
  const rows = s.messages[0].reply_markup.inline_keyboard;
  assert.equal(rows.length, 1);
  assert.equal(
    rows[0][0].web_app.url,
    "https://gidraservicedp-alt.github.io/rvp-control/?cabinet=customer",
  );
});
test("pending users and group messages do not get a private cabinet", async () => {
  const s = setup({ status: "pending", phone: "+380111111111" }, null);
  await handleWebPortal(update(), s.db, s.send, false);
  assert.equal(s.messages[0].reply_markup, undefined);
  assert.equal(
    await handleWebPortal(update("/web", "group"), s.db, s.send, false),
    false,
  );
  assert.equal(
    await handleWebPortal(update("/other"), s.db, s.send, false),
    false,
  );
});
test("multiple active roles and office use separate server-checked entries", async () => {
  const s = setup(
    { status: "active", phone: "1" },
    { status: "active", phone: "2" },
  );
  await handleWebPortal(update(WEB_CABINET), s.db, s.send, true);
  const rows = s.messages[0].reply_markup.inline_keyboard;
  assert.equal(rows.length, 3);
  assert.ok(rows[0][0].web_app);
  assert.ok(rows[1][0].web_app);
  assert.equal(rows[2][0].web_app, undefined);
  assert.equal(rows[2][0].url, "https://gidraservicedp-alt.github.io/rvp-control/");
});

test("office user in contractor mode receives only their contractor Mini App", async () => {
  for (const state of ["admin_contractor_mode", "manager_message", "waiting_act:123", "waiting_act_start:123", "waiting_act_files:123"]) {
    const s = setup({status:"active",phone:"1"}, {status:"active",phone:"2"}, {state});
    await handleWebPortal(update(WEB_CABINET), s.db, s.send, true);
    const rows = s.messages[0].reply_markup.inline_keyboard;
    assert.equal(rows.length, 1);
    assert.equal(rows[0][0].text, "Кабінет підрядника");
    assert.equal(rows[0][0].web_app.url, "https://gidraservicedp-alt.github.io/rvp-control/?cabinet=contractor");
    assert.equal(rows[0][0].url, undefined);
  }
});

test("contractor mode without a phone requests contact instead of falling back to office", async () => {
  const s = setup(null, {status:"active",phone:null}, {state:"admin_contractor_mode"});
  await handleWebPortal(update(WEB_CABINET), s.db, s.send, true);
  assert.equal(s.messages[0].reply_markup.inline_keyboard, undefined);
  assert.equal(s.messages[0].reply_markup.keyboard[0][0].request_contact, true);
});

test("revoked contractor mode cannot use office or customer fallback", async () => {
  const s = setup({status:"active",phone:"1"}, {status:"rejected",phone:"2"}, {state:"admin_contractor_mode"});
  await handleWebPortal(update(), s.db, s.send, true);
  assert.equal(s.messages[0].reply_markup, undefined);
});

test("failed mode lookup does not issue an office link", async () => {
  const s = setup(null, null, null, {message:"lookup failed"});
  await assert.rejects(handleWebPortal(update(), s.db, s.send, true));
  assert.equal(s.messages.length, 0);
});
