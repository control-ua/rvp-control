import { useEffect, useState } from "react";
import { supabase, recoveryLink } from "@/lib/supabase";
import { passwordError } from "./recovery";
// React StrictMode must not exchange a one-time code/refresh token twice.
let verifiedRecovery: Promise<void> | null = null;
function verifyRecovery() {
  if (verifiedRecovery) return verifiedRecovery;
  verifiedRecovery = (async () => {
    const root = new URL(window.location.href);
    root.search = "?auth=recovery";
    root.hash = "";
    window.history.replaceState({}, "", root.href);
    if (recoveryLink.failed) throw new Error("invalid");
    if (recoveryLink.accessToken && recoveryLink.refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: recoveryLink.accessToken,
        refresh_token: recoveryLink.refreshToken,
      });
      if (error) throw new Error("invalid");
    } else if (recoveryLink.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(
        recoveryLink.code,
      );
      if (error) throw new Error("invalid");
    } else throw new Error("invalid");
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("invalid");
  })();
  return verifiedRecovery;
}
export default function PasswordRecovery() {
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">(
    "checking",
  );
  const [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void verifyRecovery()
      .then(() => {
        if (active) setState("ready");
      })
      .catch(() => {
        if (active) setState("invalid");
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validation = passwordError(password, repeat);
    setError(validation);
    if (validation) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(
          error.code === "same_password"
            ? "Оберіть пароль, який відрізняється від попереднього."
            : "Не вдалося зберегти пароль. Спробуйте інший пароль або запросіть нове посилання.",
        );
        return;
      }
      setPassword("");
      setRepeat("");
      setState("done");
      await supabase.auth.signOut();
    } catch {
      setError("Помилка з’єднання. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  }
  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#0d0f14] px-4 py-3 text-white outline-none focus:border-cyan-400";
  return (
    <main className="min-h-screen bg-[#0d0f14] px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#13161d] p-6 text-gray-300 shadow-2xl">
        <p className="mb-3 text-xs uppercase tracking-widest text-cyan-300">
          Гідра Сервіс · RPV Control
        </p>
        <h1 className="mb-5 text-2xl font-bold text-white">
          {state === "done" ? "Пароль оновлено" : "Новий пароль"}
        </h1>
        {state === "checking" ? (
          <p role="status">Перевіряємо посилання…</p>
        ) : state === "invalid" ? (
          <>
            <p role="alert" className="mb-5 text-sm leading-6">
              Посилання недійсне або термін його дії минув. Запросіть новий лист
              через «Забули пароль?».
            </p>
            <a
              href="./"
              className="block rounded-xl bg-cyan-500 px-4 py-3 text-center font-semibold text-[#061018]"
            >
              Повернутися до входу
            </a>
          </>
        ) : state === "done" ? (
          <>
            <p className="mb-5 text-sm leading-6">
              Увійдіть з електронною адресою та новим паролем.
            </p>
            <a
              href="./"
              className="block rounded-xl bg-cyan-500 px-4 py-3 text-center font-semibold text-[#061018]"
            >
              Перейти до входу
            </a>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="mb-5 text-sm leading-6 text-gray-400">
              Щонайменше 12 символів. Не надсилайте свій пароль у чат.
            </p>
            <label htmlFor="new-password" className="mb-2 block text-sm">
              Новий пароль
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              disabled={busy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <label
              htmlFor="repeat-password"
              className="mb-2 mt-5 block text-sm"
            >
              Повторіть пароль
            </label>
            <input
              id="repeat-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              disabled={busy}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className={inputClass}
            />
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="mt-6 w-full rounded-xl bg-cyan-500 py-3 font-semibold text-[#061018] disabled:opacity-50"
            >
              {busy ? "Зберігаємо…" : "Зберегти новий пароль"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
