import { useState } from "react";
import { ArrowRight, Droplets } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error(err);

      if (err?.message === "Invalid login credentials") {
        setError("Невірний логін або пароль");
      } else {
        setError(err?.message || "Не вдалося виконати вхід");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ws-login">
      <section className="ws-login-intro">
        <div className="ws-brand">
          <span className="ws-logo">
            <Droplets size={25} />
          </span>
          <span>
            <b>
              RPV Control<span className="ws-brand-dot">.</span>
            </b>
            <small>CONTROL SYSTEM</small>
          </span>
        </div>
        <div>
          <p className="ws-eyebrow">ЄДИНИЙ РОБОЧИЙ ПРОСТІР</p>
          <h1>
            Кожен об’єкт.
            <br />
            <span>Під контролем.</span>
          </h1>
          <p>
            Заявки, виконавці, результати робіт та документи — в одному робочому
            циклі.
          </p>
        </div>
        <small>Гідра Сервіс · RPV Control System</small>
      </section>
      <section className="ws-login-form">
        <form onSubmit={handleLogin}>
          <h2>Вхід до системи</h2>
          <p>
            Робочий простір офісу.
            <br />
            Увійдіть зі своїм обліковим записом.
          </p>
          <label htmlFor="office-email">Електронна пошта</label>
          <input
            id="office-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="name@company.ua"
          />
          <label htmlFor="office-password">Пароль</label>
          <input
            id="office-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Ваш пароль"
          />
          {error && (
            <div className="ws-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="ws-button ws-primary"
            type="submit"
            disabled={loading || !email || !password}
          >
            {loading ? "Входимо…" : "Увійти до робочого простору"}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </div>
  );
}
