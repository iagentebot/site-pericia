import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/authContext';
import Header from '../../components/Header';
import { AVAILABLE_ROLES, ROLE_DESCRIPTIONS } from '../../lib/roleDefinitions';
import { AuthRole } from '../../types';

const availableRoles: AuthRole[] = AVAILABLE_ROLES;

const AdminUsersPage: React.FC = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<{ email: string; role: AuthRole }[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<AuthRole>('readonly');

  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.roles.includes('admin'))) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || !user?.roles.includes('admin')) return;
    const fetchRoles = async () => {
      try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Erro ao carregar usuários');
        const json = await res.json();
        if (json?.ok && Array.isArray(json.data)) {
          setEntries(json.data);
        }
      } catch (err) {
        setError('Não foi possível carregar os perfis configurados.');
      }
    };
    fetchRoles();
  }, [isAuthenticated, user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setError('');
    setStatus('Adicionando...');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), role: roleInput }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({} as any));
        throw new Error(json?.error || 'Erro ao salvar o perfil');
      }
      const json = await res.json();
      if (json?.ok && json.data) {
        setEntries((prev) => [json.data, ...prev.filter((item) => item.email !== json.data.email)]);
        setEmailInput('');
        setStatus('Perfil salvo.');
        setTimeout(() => setStatus(''), 3000);
        return;
      }
      throw new Error('Resposta inesperada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar perfil');
    } finally {
      setStatus('');
    }
  };

  const handleRemove = async (email: string) => {
    setError('');
    setStatus('Removendo...');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({} as any));
        throw new Error(json?.error || 'Erro ao remover o perfil');
      }
      setEntries((prev) => prev.filter((item) => item.email !== email));
      setStatus('Perfil removido.');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover perfil');
    } finally {
      setStatus('');
    }
  };

  if (loading || !user) {
    return <div className="text-center p-10">Carregando...</div>;
  }

  return (
    <>
      <Header />
      <div className="bg-brand-dark min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-5xl rounded-3xl border border-brand-cyan-900/40 bg-brand-dark-secondary/80 p-8 shadow-2xl shadow-black/30">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-brand-cyan-200/80">Administração de Acesso</p>
                <h1 className="text-3xl font-bold text-white">Perfis de Equipe</h1>
                <p className="text-sm text-brand-cyan-100/70">Antes de liberar novos usuários ao painel, atribua um papel (admin, contributor ou readonly) para cada e-mail autorizado.</p>
              </div>
              <form className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]" onSubmit={handleAdd}>
                <div className="rounded-2xl border border-brand-cyan-500/40 bg-brand-dark/60 p-4 shadow-inner">
                  <label className="block text-xs font-semibold uppercase text-brand-cyan-200/60">E-mail</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    className="mt-1 w-full rounded-2xl border border-brand-cyan-700/60 bg-brand-dark-secondary/80 px-4 py-2 text-sm text-white focus:border-brand-cyan-400 focus:outline-none"
                    placeholder="usuario@empresa.com"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold uppercase text-brand-cyan-200/60">Papel</label>
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value as AuthRole)}
                    className="rounded-2xl border border-brand-cyan-700/60 bg-brand-dark-secondary/80 px-4 py-2 text-sm text-white focus:border-brand-cyan-400 focus:outline-none"
                  >
                    {availableRoles.map((role) => (
                      <option key={role} value={role}>
                        {role} — {ROLE_DESCRIPTIONS[role]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-2xl bg-gradient-to-r from-brand-cyan-500 to-brand-cyan-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-brand-cyan-900/40"
                  >
                    Definir Perfil
                  </button>
                </div>
              </form>
              {status && <p className="text-sm text-green-300">{status}</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
              {entries.length > 0 ? (
                <div className="space-y-3">
                  {entries.map(({ email, role }) => (
                    <div key={email} className="flex flex-col gap-2 rounded-2xl border border-brand-cyan-700/60 bg-gray-900/50 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm text-white font-semibold">{email}</p>
                        <p className="text-xs text-brand-cyan-100/70">{ROLE_DESCRIPTIONS[role]}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-brand-cyan-600 px-3 py-1 text-xs text-brand-cyan-200">{role}</span>
                        <button
                          onClick={() => handleRemove(email)}
                          className="text-sm font-semibold text-red-400 hover:text-red-200"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-brand-cyan-100/70">Nenhum perfil definido ainda. Adicione o primeiro usuário.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminUsersPage;
