import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
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

      if (err?.message === 'Invalid login credentials') {
        setError('Невірний логін або пароль');
      } else {
        setError(err?.message || 'Не вдалося виконати вхід');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center px-4">

      <div className="w-full max-w-[420px]">

        <div className="mb-8 text-center">
          <div
            className="
              mx-auto
              mb-5
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              bg-cyan-500/10
              text-3xl
              border
              border-cyan-500/20
            "
          >
            ⚙️
          </div>

          <h1 className="text-3xl font-bold text-white">
            RVP Control
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Адміністративна панель
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="
            rounded-2xl
            border
            border-white/10
            bg-[#13161d]
            p-6
            shadow-2xl
          "
        >

          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Логін
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@rvp.local"
              autoComplete="email"
              className="
                w-full
                rounded-xl
                border
                border-white/10
                bg-[#0d0f14]
                px-4
                py-3
                text-white
                outline-none
                transition
                placeholder:text-gray-600
                focus:border-cyan-500/50
                focus:ring-2
                focus:ring-cyan-500/10
              "
            />
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Пароль
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="
                w-full
                rounded-xl
                border
                border-white/10
                bg-[#0d0f14]
                px-4
                py-3
                text-white
                outline-none
                transition
                placeholder:text-gray-600
                focus:border-cyan-500/50
                focus:ring-2
                focus:ring-cyan-500/10
              "
            />
          </div>

          {error && (
            <div
              className="
                mb-5
                rounded-xl
                border
                border-red-500/20
                bg-red-500/10
                px-4
                py-3
                text-sm
                text-red-400
              "
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="
              w-full
              rounded-xl
              bg-cyan-500
              py-3
              font-semibold
              text-[#061018]
              transition
              hover:bg-cyan-400
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {loading ? 'Вхід...' : 'Увійти'}
          </button>

        </form>

        <p className="mt-5 text-center text-xs text-gray-600">
          G Service Group • RVP Control System
        </p>

      </div>

    </div>
  );
}