import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRecoveryLink,
  passwordError,
  recoveryRedirect,
} from "../src/auth/recovery.ts";
test("recovery email fragments are captured, ordinary login is unaffected", () => {
  const link = parseRecoveryLink(
    "https://control-ua.github.io/rvp-control/?auth=recovery#access_token=test-access&refresh_token=test-refresh&type=recovery",
  );
  assert.equal(link.intended, true);
  assert.equal(link.accessToken, "test-access");
  assert.equal(link.refreshToken, "test-refresh");
  assert.equal(
    parseRecoveryLink("https://control-ua.github.io/rvp-control/").intended,
    false,
  );
  assert.equal(
    parseRecoveryLink(
      "https://control-ua.github.io/rvp-control/#type=magiclink",
    ).intended,
    false,
  );
});
test("expired and tokenless recovery links are identified", () => {
  assert.equal(
    parseRecoveryLink(
      "https://control-ua.github.io/rvp-control/?auth=recovery#error=access_denied",
    ).failed,
    true,
  );
  assert.equal(
    parseRecoveryLink("https://control-ua.github.io/rvp-control/#type=recovery")
      .intended,
    true,
  );
  assert.equal(
    parseRecoveryLink("https://control-ua.github.io/rvp-control/?auth=recovery")
      .accessToken,
    null,
  );
});
test("PKCE callback and redirect retain the deployed subdirectory", () => {
  assert.equal(
    parseRecoveryLink(
      "https://control-ua.github.io/rvp-control/?auth=recovery&code=test-code",
    ).code,
    "test-code",
  );
  assert.equal(
    recoveryRedirect(
      "https://control-ua.github.io/rvp-control/?page=apps#anything",
    ),
    "https://control-ua.github.io/rvp-control/?auth=recovery",
  );
});
test("short and mismatching passwords rejected", () => {
  assert.ok(passwordError("short", "short"));
  assert.ok(passwordError("a-long-passphrase", "a-different-one"));
  assert.equal(passwordError("a-long-passphrase", "a-long-passphrase"), "");
});
