import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type ApplicationPayload = {
  id: string;
  application_number?: string | null;
  title?: string | null;
  address?: string | null;
};

type WebhookBody = {
  type?: string;
  table?: string;
  schema?: string;
  record?: ApplicationPayload;
  application?: ApplicationPayload;
  event_key?: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@rvp-control.app";
const webhookSecret = Deno.env.get("PUSH_INTERNAL_SECRET") ?? Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return response({ error: "Supabase server secrets are not configured" }, 500);
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return response({ error: "VAPID secrets are not configured" }, 500);
  }

  if (!webhookSecret || req.headers.get("x-rvp-push-secret") !== webhookSecret) {
    return response({ error: "Unauthorized" }, 401);
  }

  let body: WebhookBody;
  try {
    body = await req.json();
  } catch {
    return response({ error: "Invalid JSON body" }, 400);
  }

  const application = body.record ?? body.application;
  if (!application?.id) {
    return response({ error: "Missing application record" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error: applicationError } = await supabase
    .from("applications")
    .select("id, application_number, title, address, created_at")
    .eq("id", application.id)
    .maybeSingle();

  if (applicationError) {
    return response({ error: applicationError.message }, 500);
  }

  if (!row) {
    return response({ error: "Application not found" }, 404);
  }

  const eventKey = body.event_key || `application-insert:${row.id}`;

  const { error: logError } = await supabase
    .from("push_delivery_log")
    .insert({ event_key: eventKey, application_id: row.id });

  if (logError) {
    if (logError.code === "23505") {
      return response({ ok: true, duplicate: true, sent: 0 });
    }
    return response({ error: logError.message }, 500);
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (subscriptionsError) {
    return response({ error: subscriptionsError.message }, 500);
  }

  const number = row.application_number || "Нова заявка";
  const title = `🔔 Нова заявка ${number}`;
  const bodyText = [row.title, row.address].filter(Boolean).join(" • ") || "Відкрийте RVP Control";

  const payload = JSON.stringify({
    title,
    body: bodyText,
    tag: `application-${row.id}`,
    application_id: row.id,
    url: `./?page=applications&application=${encodeURIComponent(row.id)}`,
  });

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          { TTL: 60 * 60 },
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 0;

        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(subscription.endpoint);
        } else {
          console.error("Push send failed", error);
        }
      }
    }),
  );

  if (expiredEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
  }

  await supabase
    .from("push_delivery_log")
    .update({ sent_count: sent, failed_count: failed })
    .eq("event_key", eventKey);

  return response({
    ok: true,
    sent,
    failed,
    removed_expired: expiredEndpoints.length,
  });
});
