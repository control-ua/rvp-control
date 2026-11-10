import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { recoveryRedirect } from "@/auth/recovery";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reset, setReset] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#0d0f14] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = reset
        ? await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: recoveryRedirect(window.location.href),
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (response.error) {
        if (response.error.status === 429)
          throw new Error(
            "Забагато спроб. Зачекайте кілька хвилин і повторіть.",
          );
        throw new Error(
          reset
            ? "Не вдалося надіслати лист. Повторіть пізніше або зверніться до адміністратора."
            : "Невірний логін або пароль.",
        );
      }
      if (reset) setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не вдалося виконати запит.",
      );
    } finally {
      setLoading(false);
    }
  }
  function switchMode(value: boolean) {
    setReset(value);
    setSent(false);
    setError("");
    setPassword("");
  }
  return (
    <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-3xl border border-cyan-500/20">
            ⚙️
          </div>
          <h1 className="text-3xl font-bold text-white">RPV Control</h1>
          <p className="mt-2 text-sm text-gray-500">
            {reset ? "Відновлення пароля" : "Адміністративна панель"}
          </p>
        </div>
        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/10 bg-[#13161d] p-6 shadow-2xl"
        >
          {sent ? (
            <div role="status" className="text-sm leading-6 text-gray-300">
              <h2 className="mb-3 text-lg font-semibold text-white">
                Перевірте пошту
              </h2>
              <p>
                Якщо для цієї адреси є обліковий запис, ви отримаєте лист із
                посиланням для встановлення нового пароля.
              </p>
              <p className="mt-3">
                Перевірте також папку «Спам». Відкрийте останній лист і задайте
                новий пароль на нашому сайті.
              </p>
              <button
                type="button"
                onClick={() => switchMode(false)}
                className="mt-6 w-full rounded-xl bg-cyan-500 py-3 font-semibold text-[#061018]"
              >
                Повернутися до входу
              </button>
            </div>
          ) : (
            <>
              {reset && (
                <p className="mb-5 text-sm leading-6 text-gray-400">
                  Введіть робочу електронну адресу. Надішлемо посилання для
                  відновлення доступу.
                </p>
              )}
              <div className="mb-5">
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  {reset ? "Електронна пошта" : "Логін"}
                </label>
                <input
                  id="login-email"
                  required
                  type="email"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              {!reset && (
                <div className="mb-5">
                  <label
                    htmlFor="login-password"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Пароль
                  </label>
                  <input
                    id="login-password"
                    required
                    type="password"
                    value={password}
                    disabled={loading}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={inputClass}
                  />
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !email || (!reset && !password)}
                className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-[#061018] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Зачекайте…"
                  : reset
                    ? "Надіслати посилання"
                    : "Увійти"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => switchMode(!reset)}
                className="mt-5 w-full text-sm text-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                {reset ? "← Повернутися до входу" : "Забули пароль?"}
              </button>
            </>
          )}
        </form>
        <p className="mt-5 text-center text-xs text-gray-600">
          Гідра Сервіс • RPV Control System
        </p>
      </div>
    </div>
  );
}
