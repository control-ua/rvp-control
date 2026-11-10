function equalToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i=0; i<a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}

export function makeCustomerTelegram(botToken: string) {
  const secret = sha256("rpv-customer-cabinet-webhook/v1\n"+botToken);
  async function call(method: string, body: Record<string, unknown> = {}) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
        signal:AbortSignal.timeout(8000),
      });
      return await response.json();
    } catch {
      return null;
    }
  }

  async function verifies(req: Request) {
    const supplied = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    return supplied !== null && equalToken(supplied,await secret);
  }

  return {call,verifies,secret};
}

