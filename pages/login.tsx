import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/authContext';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated, login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : '/processes';
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.replace(returnTo);
    }
  }, [isAuthenticated, loading, router, returnTo]);

  const handleSuccess = async (response: CredentialResponse) => {
    setError('');
    const idToken = response?.credential;
    if (!idToken) {
      setError('Não foi possível obter o token do Google.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao autenticar via Google.');
      }
      if (data?.user) {
        login(data.user);
        router.push(returnTo);
      } else {
        throw new Error('Resposta inesperada do servidor.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao autenticar.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    setError('Não foi possível completar o login com o Google no momento.');
  };

  return (
    <section className="py-20 bg-brand-dark-secondary min-h-screen">
      <div className="bg-brand-dark text-brand-light min-h-screen font-sans">
        <Header />
        <main className="flex flex-col items-center justify-center pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-white">Bem-vindo de volta!</h2>
              <p className="mt-2 text-lg text-brand-cyan-200/80">
                Use um login seguro do Google para acessar o painel da Richter Perícia.
              </p>
            </div>
            <div className="rounded-3xl border border-brand-cyan-500/40 bg-brand-dark-secondary/90 p-8 shadow-2xl shadow-black/30">
              <p className="text-sm text-brand-cyan-100/70 mb-4">
                Nosso SaaS entrega acompanhamento completo de perícias judiciais, pagamentos e relatórios para equipes autorizadas.
              </p>
              {googleClientId ? (
                <div className="flex flex-col items-center gap-4">
                  <GoogleLogin onSuccess={handleSuccess} onError={handleError} useOneTap />
                  <p className="text-xs text-brand-cyan-100/60 text-center">
                    O acesso é protegido por sessão e você pode entrar com qualquer conta Google autorizada.
                  </p>
                  {loading && <span className="text-sm text-brand-cyan-200">Verificando credenciais...</span>}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-cyan-500/60 bg-brand-dark/70 p-6 text-sm text-brand-cyan-200">
                  <p className="font-semibold text-white mb-2">Login via Google não configurado</p>
                  <p>Defina as variáveis de ambiente <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> e <code className="font-mono">GOOGLE_CLIENT_ID</code> antes de rodar o app.</p>
                </div>
              )}
              {error && <p className="text-sm text-red-400 mt-4 text-center">{error}</p>}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </section>
  );
};

export default LoginPage;
