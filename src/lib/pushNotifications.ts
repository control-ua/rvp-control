import { supabase } from '@/lib/supabase';

// Must match the VAPID public key configured in the Supabase push-notify Edge Function.
const VAPID_PUBLIC_KEY =
  'BJIa2lzWu01LFefW0rRYEghdFswW37M-uk1w8ykAOvaJEr9xRegtHhynFpsVz-FTFB8KEXzilW8JqIoUISncY2U';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function subscriptionUsesCurrentVapidKey(subscription: PushSubscription) {
  const currentKey = subscription.options?.applicationServerKey;
  if (!currentKey) return false;

  const actual = new Uint8Array(currentKey);
  const expected = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

  if (actual.length !== expected.length) return false;

  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) return false;
  }

  return true;
}

async function removeStoredSubscription(subscription: PushSubscription) {
  const endpoint = subscription.endpoint;

  try {
    await subscription.unsubscribe();
  } catch {
    // Ignore browser cleanup errors and still remove the old row from Supabase.
  }

  try {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);
  } catch {
    // A failed cleanup must not block creating a fresh subscription later.
  }
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error('Не вдалося визначити користувача.');
  }

  const endpoint = json.endpoint || subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Браузер не повернув дані push-підписки.');
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userData.user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

  if (error) throw error;
}

export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushSubscription() {
  if (!isPushSupported()) return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return null;

  // Apple binds a subscription to the VAPID public key. If the app key changed,
  // the old subscription can never be used and Apple returns VapidPkHashMismatch.
  if (!subscriptionUsesCurrentVapidKey(subscription)) {
    await removeStoredSubscription(subscription);
    return null;
  }

  return subscription;
}

export async function enablePushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Push-сповіщення не підтримуються на цьому пристрої.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Дозвіл на сповіщення не надано.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await getPushSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await saveSubscription(subscription);
  return subscription;
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await removeStoredSubscription(subscription);
}
