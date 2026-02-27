
import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import type { GetServerSideProps } from 'next';
import { isRequestAuthenticated, redirectToLogin } from '../../lib/auth-server';
import { useRouter } from 'next/router';
import Header from '../../components/Header';
import { getProcessById, saveProcess } from '../../services/processService';
import { JudicialProcess, ProcessStatus, FeeProposal, Payment, JusticeType, PericiaType } from '../../types';

const applyProcessNumberMask = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 20);
    if (digitsOnly.length <= 7) return digitsOnly;
    if (digitsOnly.length <= 9) return `${digitsOnly.slice(0, 7)}-${digitsOnly.slice(7)}`;
    if (digitsOnly.length <= 13) return `${digitsOnly.slice(0, 7)}-${digitsOnly.slice(7, 9)}.${digitsOnly.slice(9)}`;
    if (digitsOnly.length <= 14) return `${digitsOnly.slice(0, 7)}-${digitsOnly.slice(7, 9)}.${digitsOnly.slice(9, 13)}.${digitsOnly.slice(13)}`;
    if (digitsOnly.length <= 16) return `${digitsOnly.slice(0, 7)}-${digitsOnly.slice(7, 9)}.${digitsOnly.slice(9, 13)}.${digitsOnly.slice(13, 14)}.${digitsOnly.slice(14)}`;
    return `${digitsOnly.slice(0, 7)}-${digitsOnly.slice(7, 9)}.${digitsOnly.slice(9, 13)}.${digitsOnly.slice(13, 14)}.${digitsOnly.slice(14, 16)}.${digitsOnly.slice(16)}`;
};

// --- Modal Components ---

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) {
        // console.log('não abriu'); 
        return null;
    }
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300" aria-modal="true" role="dialog">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                <div className="flex justify-between items-center p-5 border-b sticky top-0 text  bg-cyan-800 rounded-t-lg">
                    <h3 className="text-xl font-semibold text-gray-100">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none" aria-label="Fechar">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
            <style>{`
                @keyframes fade-in-scale {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in-scale { animation: fade-in-scale 0.2s forwards ease-out; }
            `}</style>
        </div>
    );
};
// --- Proposta de Honorarios Modal --- 
const FeesChargedModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    processId?: string;
    proposals: FeeProposal[];
    onUpdate: (proposals: FeeProposal[]) => void;
}> = ({ isOpen, onClose, processId, proposals, onUpdate }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [editingProposal, setEditingProposal] = useState<FeeProposal | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const canPersist = Boolean(processId && processId !== 'new');
    const latestOnUpdate = useRef(onUpdate);

    useEffect(() => {
        latestOnUpdate.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        if (!isOpen || !canPersist || readOnlyMode) return;
        let cancelled = false;
        const fetchProposals = async () => {
            setIsLoading(true);
            setApiError(null);
            try {
                const res = await fetch(`/api/processes/${processId}/fees`);
                if (cancelled) return;
                if (res.status === 204) return;
                if (!res.ok) throw new Error('Erro ao carregar honorarios');
                const json = await res.json();
                if (!cancelled && json?.ok && Array.isArray(json.data)) {
                    latestOnUpdate.current(json.data as FeeProposal[]);
                }
            } catch (error) {
                if (!cancelled) {
                    setApiError('Nao foi possivel carregar as propostas do banco.');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };
        fetchProposals();
        return () => {
            cancelled = true;
            setIsLoading(false);
        };
    }, [isOpen, canPersist, processId]);

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setAmount('');
        setEditingProposal(null);
    };

    const handleEditClick = (proposal: FeeProposal) => {
        setEditingProposal(proposal);
        setDate(proposal.date);
        setAmount(String(proposal.amount));

    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !amount) return;
        if (readOnlyMode) {
            setApiError('Modo somente leitura.');
            return;
        }

        setIsSubmitting(true);
        setApiError(null);

        const amountValue = parseFloat(amount) || 0;
        const trimmedAmount = Number.isFinite(amountValue) ? amountValue : 0;
        const fallbackId = editingProposal ? editingProposal.id : new Date().getTime().toString();
        const baseProposal: FeeProposal = { id: fallbackId, date, amount: trimmedAmount };

        let persistedProposal: FeeProposal | null = null;
        let shouldFallback = !canPersist;

        if (!shouldFallback) {
            try {
                const endpoint = editingProposal
                    ? `/api/processes/${processId}/fees/${editingProposal.id}`
                    : `/api/processes/${processId}/fees`;
                const method = editingProposal ? 'PUT' : 'POST';
                const res = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: 'Proposta de Honorario',
                        amount: trimmedAmount,
                        date,
                    }),
                });

                if (res.status === 204) {
                    shouldFallback = true;
                } else if (!res.ok) {
                    throw new Error('Erro ao salvar honorario');
                } else {
                    const json = await res.json();
                    if (json?.ok) {
                        persistedProposal = json.data ?? null;
                    } else {
                        shouldFallback = true;
                    }
                }
            } catch (error) {
                setApiError('Nao foi possivel salvar a proposta no banco.');
                setIsSubmitting(false);
                return;
            }
        }

        const proposalToApply = persistedProposal ?? baseProposal;
        if (editingProposal) {
            const updatedProposals = proposals.map(p =>
                p.id === editingProposal.id ? { ...proposalToApply, id: editingProposal.id } : p
            );
            onUpdate(updatedProposals);
        } else {
            onUpdate([...proposals, proposalToApply]);
        }

        resetForm();
        setIsSubmitting(false);

        if (shouldFallback) {
            setApiError('Os dados foram atualizados localmente, mas o banco nao retornou confirmacao.');
        }
    };
    
    const handleRemove = async (id: string) => {
        if (readOnlyMode) {
            setApiError('Modo somente leitura.');
            return;
        }
        setApiError(null);
        let removalSucceeded = !canPersist;
        if (canPersist) {
            try {
                const res = await fetch(`/api/processes/${processId}/fees/${id}`, { method: 'DELETE' });
                if (res.status === 204) {
                    removalSucceeded = true;
                } else if (res.ok || res.status === 404) {
                    removalSucceeded = true;
                } else {
                    throw new Error('Erro ao remover honorario');
                }
            } catch (error) {
                setApiError('Nao foi possivel remover a proposta do banco.');
                return;
            }
        }

        if (removalSucceeded) {
            onUpdate(proposals.filter(p => p.id !== id));
            if (editingProposal?.id === id) {
                resetForm();
            }
        }
    };

    const sortedProposals = [...proposals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Propostas de Honorarios">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 pb-6 border-b">
                {readOnlyMode && (
                    <div className="md:col-span-3 rounded-2xl border border-amber-400/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        Este card está em modo somente leitura. Administração necessária.
                    </div>
                )}
                <div>
                    <label htmlFor="proposalDate" className="block text-sm font-medium text-gray-700">Data</label>
                    <input type="date" id="proposalDate" value={date} onChange={e => setDate(e.target.value)} required disabled={readOnlyMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="proposalAmount" className="block text-sm font-medium text-gray-700">Valor (R$)</label>
                    <input type="number" step="0.01" id="proposalAmount" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="Ex: 5000.00" disabled={readOnlyMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                </div>
                <div className="self-end flex space-x-2">
                    <button type="submit" disabled={isSubmitting || readOnlyMode} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-blue-300">
                        {readOnlyMode ? 'Somente leitura' : editingProposal ? (isSubmitting ? 'Atualizando...' : 'Atualizar') : (isSubmitting ? 'Adicionando...' : 'Adicionar')}
                    </button>
                    {editingProposal && <button type="button" onClick={resetForm} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-300">Cancelar</button>}
                </div>
            </form>
            {apiError && <p className="text-sm text-red-600 mb-4">{apiError}</p>}
            {isLoading ? (
                <p className="text-gray-500">Carregando propostas...</p>
            ) : (
                <>
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Propostas Adicionadas</h4>
                    <ul className="space-y-3">
                        {sortedProposals.length > 0 ? sortedProposals.map(p => (
                            <li key={p.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                <div>
                                    <span className="font-semibold">{new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>: 
                                    <span className="text-green-700 ml-2">{p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                                <div>
                                    {!readOnlyMode ? (
                                        <>
                                            <button onClick={() => handleEditClick(p)} className="text-blue-500 hover:text-blue-700 font-semibold mr-4">Editar</button>
                                            <button onClick={() => handleRemove(p.id)} className="text-red-500 hover:text-red-700 font-semibold">Remover</button>
                                        </>
                                    ) : (
                                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Somente leitura</span>
                                    )}
                                </div>
                            </li>
                        )) : <p className="text-gray-500">Nenhuma proposta adicionada.</p>}
                    </ul>
                </>
            )}
        </Modal>
    );
};

// --- Recebimento de Honorarios Modal ---
const FeesReceivedModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    processId?: string;
    payments: Payment[];
    onUpdate: (payments: Payment[]) => void;
    editable?: boolean;
}> = ({ isOpen, onClose, processId, payments, onUpdate, editable = true }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [taxes, setTaxes] = useState('');
    const [total, setTotal] = useState('');
    const [source, setSource] = useState('');
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const canPersist = Boolean(processId && processId !== 'new');
    const latestOnUpdate = useRef(onUpdate);
    const readOnlyMode = !editable;

    useEffect(() => {
        latestOnUpdate.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        if (!amount && !taxes) {
            setTotal('');
            return;
        }

        const amountValue = parseFloat(amount) || 0;
        const taxesValue = parseFloat(taxes) || 0;
        const calculatedTotal = amountValue - taxesValue;

        setTotal(Number.isFinite(calculatedTotal) ? calculatedTotal.toFixed(2) : '');
    }, [amount, taxes]);

    useEffect(() => {
        if (!isOpen || !canPersist || readOnlyMode) return;
        let cancelled = false;
        const fetchPayments = async () => {
            setIsLoading(true);
            setApiError(null);
            try {
                const res = await fetch(`/api/processes/${processId}/payments`);
                if (cancelled) return;
                if (res.status === 204) {
                    return;
                }
                if (!res.ok) throw new Error('Erro ao carregar pagamentos');
                const json = await res.json();
                if (!cancelled && json?.ok && Array.isArray(json.data)) {
                    latestOnUpdate.current(json.data as Payment[]);
                }
            } catch (error) {
                if (!cancelled) {
                    setApiError('Nao foi possivel carregar os pagamentos do banco.');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };
        fetchPayments();
        return () => {
            cancelled = true;
            setIsLoading(false);
        };
    }, [isOpen, canPersist, processId]);

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setAmount('');
        setTaxes('');
        setTotal('');
        setSource('');
        setEditingPayment(null);
    };

    const handleEditClick = (payment: Payment) => {
        setEditingPayment(payment);
        setDate(payment.date);
        setAmount(payment.amount.toString());
        setTaxes(payment.taxes?.toString() ?? '0');
        setTotal(payment.total?.toString() ?? '');
        setSource(payment.source);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !amount || !source) return;
        if (readOnlyMode) {
            setApiError('Modo somente leitura.');
            return;
        }

        setIsSubmitting(true);
        setApiError(null);

        const amountValue = Number(amount) || 0;
        const taxesValue = Number(taxes) || 0;
        const totalValue = Number(total) || amountValue - taxesValue;
        const trimmedSource = source.trim();
        const fallbackId = editingPayment ? editingPayment.id : new Date().getTime().toString();
        const basePayment: Payment = {
            id: fallbackId,
            date,
            amount: amountValue,
            taxes: taxesValue,
            total: totalValue,
            source: trimmedSource,
        };

        let persistedPayment: Payment | null = null;
        let shouldFallback = !canPersist;

        if (!shouldFallback) {
            try {
                const endpoint = editingPayment
                    ? `/api/processes/${processId}/payments/${editingPayment.id}`
                    : `/api/processes/${processId}/payments`;
                const method = editingPayment ? 'PUT' : 'POST';
                const res = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: trimmedSource,
                        amount: amountValue,
                        taxes: taxesValue,
                        total: totalValue,
                        date,
                    }),
                });

                if (res.status === 204) {
                    shouldFallback = true;
                } else if (!res.ok) {
                    throw new Error('Erro ao salvar pagamento');
                } else {
                    const json = await res.json();
                    if (json?.ok) {
                        persistedPayment = json.data ?? null;
                    } else {
                        shouldFallback = true;
                    }
                }
            } catch (error) {
                setApiError('Não foi possível salvar o pagamento no banco.');
                setIsSubmitting(false);
                return;
            }
        }

        const paymentToApply = persistedPayment ?? basePayment;
        if (editingPayment) {
            const updatedPayments = payments.map(p =>
                p.id === editingPayment.id ? { ...paymentToApply, id: editingPayment.id } : p
            );
            onUpdate(updatedPayments);
        } else {
            onUpdate([...payments, paymentToApply]);
        }

        resetForm();
        setIsSubmitting(false);
        if (shouldFallback) {
            setApiError('Os dados foram atualizados localmente, mas o banco não retornou confirmação.');
        }
    };
    
    const handleRemove = async (id: string) => {
        if (readOnlyMode) {
            setApiError('Modo somente leitura.');
            return;
        }
        setApiError(null);
        let removalSucceeded = !canPersist;
        if (canPersist) {
            try {
                const res = await fetch(`/api/processes/${processId}/payments/${id}`, { method: 'DELETE' });
                if (res.status === 204) {
                    removalSucceeded = true;
                } else if (res.ok || res.status === 404) {
                    removalSucceeded = true;
                } else {
                    throw new Error('Erro ao remover');
                }
            } catch (error) {
                setApiError('Não foi possível remover o pagamento do banco.');
                return;
            }
        }

        if (removalSucceeded) {
            onUpdate(payments.filter(p => p.id !== id));
            if (editingPayment?.id === id) {
                resetForm();
            }
        }
    };

    const sortedPayments = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
                <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Recebimentos de Honorarios">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 pb-6 border-b">
                {readOnlyMode && (
                    <div className="md:col-span-4 rounded-2xl border border-amber-400/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        Criar ou editar recebimentos está bloqueado porque o usuário está em modo somente leitura.
                    </div>
                )}
                <div>
                    <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700">Data</label>
                    <input type="date" id="paymentDate" value={date} onChange={e => setDate(e.target.value)} required disabled={readOnlyMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                </div>
                <div className="md:col-span-3">
                    <label htmlFor="paymentSource" className="block text-sm font-medium text-gray-700">Origem / Descricao</label>
                    <input type="text" id="paymentSource" value={source} onChange={e => setSource(e.target.value)} required placeholder="Ex: Adiantamento" disabled={readOnlyMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                </div> 
                <div>
                    <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700">Valor Depositado</label>
                    <input type="number" step="0.01" id="paymentAmount" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="Ex: 2500.00" disabled={readOnlyMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="paymentTaxes" className="block text-sm font-medium text-gray-700">Imposto Retido</label>
                    <input type="number" step="0.01" id="paymentTaxes" value={taxes} onChange={e => setTaxes(e.target.value)} required placeholder="Ex: 250.00" disabled={readOnlyMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="paymentTotal" className="block text-sm font-medium text-gray-700">Valor Total</label>
                    <input type="number" step="0.01" id="paymentTotal" value={total} readOnly required placeholder="Ex: 2250.00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-gray-100"/>
                </div>
                
                <div className="md:col-span-4 self-end flex space-x-2">
                    <button type="submit" disabled={isSubmitting || readOnlyMode} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-blue-300">{readOnlyMode ? 'Somente leitura' : editingPayment ? (isSubmitting ? 'Atualizando...' : 'Atualizar') : (isSubmitting ? 'Adicionando...' : 'Adicionar')}</button>
                    {editingPayment && <button type="button" onClick={resetForm} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-300">Cancelar</button>}
                </div>
            </form>
            {apiError && <p className="text-sm text-red-600 mb-4">{apiError}</p>}
            {isLoading ? (
                <p className="text-gray-500">Carregando pagamentos...</p>
            ) : (
                <>
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Pagamentos Recebidos</h4>
                    <ul className="space-y-3">
                        {sortedPayments.length > 0 ? sortedPayments.map(p => (
                            <li key={p.id} className="flex flex-col md:flex-row md:justify-between md:items-center bg-gray-50 p-3 rounded-md gap-2">
                                <div>
                                    <span className="font-semibold">{new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span> - {p.source}
                                    <span className="block text-sm text-gray-600">Deposito: {p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Imposto: {p.taxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Total: {p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => handleEditClick(p)} className="text-blue-500 hover:text-blue-700 font-semibold">Editar</button>
                                    <button onClick={() => handleRemove(p.id)} className="text-red-500 hover:text-red-700 font-semibold">Remover</button>
                                </div>
                            </li>
                        )) : <p className="text-gray-500">Nenhum pagamento recebido.</p>}
                    </ul>
                </>
            )}
        </Modal>
    );
};

// --- Main Page Component ---

const ProcessDetailPage: React.FC = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { id } = router.query;
    const [process, setProcess] = useState<JudicialProcess | null>(null);
    const [loading, setLoading] = useState(true);
    const canEditProcess = Boolean(user?.roles?.some(role => role === 'admin' || role === 'contributor'));
    const readOnlyMode = !canEditProcess;
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isFeesChargedModalOpen, setFeesChargedModalOpen] = useState(false);
    const [isFeesReceivedModalOpen, setFeesReceivedModalOpen] = useState(false);
    const [caseValueInput, setCaseValueInput] = useState('');
    
    const isNew = id === 'new';
    const labelClasses = "block text-xs font-semibold uppercase tracking-[0.2em] text-white mb-2";
    const inputClasses = "w-full rounded-2xl border border-brand-cyan-900/30 bg-brand-dark-secondary/70 px-4 py-3 text-sm text-white placeholder:text-brand-cyan-100/60 focus:border-brand-cyan-300 focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/40";

    const formatCurrencyBRL = (value: number): string => {
        const safeValue = Number.isFinite(value) ? value : 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeValue);
    };

    const fetchProcess = useCallback(async () => {
        if (typeof id !== 'string') return;
        
        if (!isNew) {
            setLoading(true);
            const data = await getProcessById(id);
            if(data) setProcess(data);
            else router.push('/processes');
            setLoading(false);
        } else {
            setProcess({
                id: 'new',
                processNumber: '',
                plaintiff: '',
                defendant: '',
                city: '',
                status: ProcessStatus.ENVIAR_PROPOSTA,
                justiceType: JusticeType.PARTICULAR,
                periciaType: PericiaType.LOCAL,
                startDate: new Date().toISOString().split('T')[0],
                caseValue: 0,
                feesCharged: [],
                feesReceived: [],
                description: ''
            });
            setLoading(false);
        }
    }, [id, isNew, router]);
    
    useEffect(() => {
        if (router.isReady) {
            fetchProcess();
        }
    }, [router, router.isReady, fetchProcess]);

    useEffect(() => {
        if (process) {
            setCaseValueInput(formatCurrencyBRL(process.caseValue || 0));
        }
    }, [process?.caseValue]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (process) {
            setSaveError(null);
            const updatedValue =
                name === 'processNumber'
                    ? applyProcessNumberMask(value)
                    : value;
            setProcess({ ...process, [name]: updatedValue });
        }
    };

    const handleCaseValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value || '';
        const digitsOnly = rawValue.replace(/\D/g, '');
        const numericValue = digitsOnly.length ? Number(digitsOnly) / 100 : 0;
        setCaseValueInput(formatCurrencyBRL(numericValue));
        if (process) {
            setProcess({ ...process, caseValue: numericValue });
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!process) return;
        if (!canEditProcess) {
            setSaveError('Modo somente leitura. Entre em contato com um administrador para atualizar o processo.');
            return;
        }

        setIsSaving(true);
        setSaveError(null);

        try {
            const saved = await saveProcess(process);
            setProcess(saved);
            await router.push('/processes');
        } catch (error) {
            console.error('[ProcessDetailPage] Falha ao salvar processo:', error);
            const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o processo. Tente novamente.';
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const getLatestFeeCharged = (): number => {
        if (!process || process.feesCharged.length === 0) return 0;
        const sorted = [...process.feesCharged].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return sorted[0].amount;
    };

    const getTotalFeesReceived = (): number => {
        if (!process || process.feesReceived.length === 0) return 0;
        return process.feesReceived.reduce((sum, payment) => sum + (payment.total ?? payment.amount), 0);
    };
    
    if (loading) return <div className="text-center p-10">Carregando dados do processo...</div>;
    if (!process) return <div className="text-center p-10">Carregando...</div>;

    return (
        <>
            <Header />
            <div className="bg-brand-dark min-h-screen pt-20 md:pt-24 pb-16">
                <div className="container mx-auto px-6">
                    <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-brand-cyan-900/40 bg-gradient-to-br from-brand-dark-secondary via-gray-900 to-brand-cyan-950 p-8 shadow-2xl shadow-black/40">
                        <div className="pointer-events-none absolute inset-0 opacity-60 bg-gradient-to-r from-brand-cyan-600/20 via-transparent to-emerald-500/20" />
                        <div className="relative space-y-8">
                            <div className="flex flex-col gap-2 border-b border-white/10 pb-6">
                                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-brand-cyan-100/70">Gestão de Processos</p>
                                <h1 className="text-3xl font-bold text-white">{isNew ? 'Adicionar Novo Processo' : `Processo: ${process.processNumber}`}</h1>
                                <p className="text-sm text-brand-cyan-100/70">Atualize os dados e acompanhe honorários em um só lugar.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                {readOnlyMode && (
                                    <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                        <strong className="font-semibold">Modo somente leitura:</strong> este usuário não tem permissão para editar. Apenas administradores e editores podem salvar alterações.
                                    </div>
                                )}
                                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                    <div className="space-y-6">
                                        <div>
                                            <label htmlFor="processNumber" className={labelClasses}>Número do Processo</label>
                                            <input
                                                type="text"
                                                name="processNumber"
                                                id="processNumber"
                                                value={process.processNumber}
                                                onChange={handleChange}
                                                required
                                                disabled={readOnlyMode}
                                                className={inputClasses}
                                                placeholder="5006383-06.2025.8.21.0087"
                                                maxLength={25}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="plaintiff" className={labelClasses}>Autor</label>
                                            <input
                                                type="text"
                                                name="plaintiff"
                                                id="plaintiff"
                                                value={process.plaintiff}
                                                onChange={handleChange}
                                                required
                                                disabled={readOnlyMode}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="defendant" className={labelClasses}>Réu</label>
                                            <input
                                                type="text"
                                                name="defendant"
                                                id="defendant"
                                                value={process.defendant}
                                                onChange={handleChange}
                                                required
                                                disabled={readOnlyMode}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="city" className={labelClasses}>Cidade</label>
                                            <input
                                                type="text"
                                                name="city"
                                                id="city"
                                                value={process.city}
                                                onChange={handleChange}
                                                required
                                                disabled={readOnlyMode}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="status" className={labelClasses}>Status</label>
                                            <select
                                                name="status"
                                                id="status"
                                                value={process.status}
                                                onChange={handleChange}
                                                disabled={readOnlyMode}
                                                className={`${inputClasses} appearance-none pr-10`}
                                            >
                                                {Object.values(ProcessStatus).map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="caseValue" className={labelClasses}>Valor da Causa</label>
                                            <div className="mt-2 rounded-2xl border border-brand-cyan-900/30 bg-brand-dark-secondary/70 px-4 py-3">
                                                <input
                                                    type="text"
                                                    name="caseValue"
                                                    id="caseValue"
                                                    inputMode="numeric"
                                                    value={caseValueInput}
                                                    onChange={handleCaseValueChange}
                                                    disabled={readOnlyMode}
                                                    className="w-full bg-transparent text-base font-semibold text-white placeholder:text-brand-cyan-100/40 focus:outline-none focus:ring-0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <label htmlFor="startDate" className={labelClasses}>Data Início do Processo</label>
                                            <input
                                                type="date"
                                                name="startDate"
                                                id="startDate"
                                                value={process.startDate}
                                                onChange={handleChange}
                                                required
                                                disabled={readOnlyMode}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Tipo de Perícia</label>
                                            <div className="mt-3 flex flex-wrap gap-3">
                                                {Object.values(PericiaType).map(type => {
                                                    const active = process.periciaType === type;
                                                    return (
                                                        <label
                                                            key={type}
                                                            htmlFor={`pericia-${type}`}
                                                            className={`cursor-pointer rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-300${
                                                                active
                                                                    ? 'border-brand-cyan-400 bg-brand-cyan-500/10 text-white shadow-lg shadow-brand-cyan-900/20'
                                                                    : 'border-white/10 text-gray-300 hover:border-white/30'
                                                            }`}
                                                        >
                                                            <input
                                                                id={`pericia-${type}`}
                                                                name="periciaType"
                                                                type="radio"
                                                                value={type}
                                                                checked={active}
                                                                onChange={handleChange}
                                                                disabled={readOnlyMode}
                                                                className="sr-only"
                                                            />
                                                            {type}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Tipo de Processo</label>
                                            <div className="mt-3 flex flex-wrap gap-3">
                                                {Object.values(JusticeType).map(type => {
                                                    const active = process.justiceType === type;
                                                    return (
                                                        <label
                                                            key={type}
                                                            htmlFor={`justica-${type}`}
                                                            className={`cursor-pointer rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-300 ${
                                                                active
                                                                    ? 'border-emerald-400 bg-emerald-500/10 text-white shadow-lg shadow-emerald-900/20'
                                                                    : 'border-white/10 text-gray-300 hover:border-white/30'
                                                            }`}
                                                        >
                                                            <input
                                                                id={`justica-${type}`}
                                                                name="justiceType"
                                                                type="radio"
                                                                value={type}
                                                                checked={active}
                                                                onChange={handleChange}
                                                                disabled={readOnlyMode}
                                                                className="sr-only"
                                                            />
                                                            {type}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Proposta de Honorários</label>
                                            <div className="mt-2 flex items-center justify-between rounded-2xl border border-brand-cyan-900/30 bg-brand-dark-secondary/70 px-4 py-3">
                                                <span className="text-base font-semibold text-white">
                                                    {getLatestFeeCharged().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setFeesChargedModalOpen(true)}
                                                    className="rounded-full bg-gradient-to-r from-brand-cyan-500 to-brand-cyan-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-brand-cyan-900/40 shadow-lg hover:from-brand-cyan-400 hover:to-brand-cyan-500"
                                                >
                                                    Gerenciar
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Honorários Recebidos</label>
                                            <div className="mt-2 flex items-center justify-between rounded-2xl border border-brand-cyan-900/30 bg-brand-dark-secondary/70 px-4 py-3">
                                                <span className="text-base font-semibold text-white">
                                                    {getTotalFeesReceived().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setFeesReceivedModalOpen(true)}
                                                    className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-emerald-900/30 hover:from-emerald-300 hover:to-emerald-400"
                                                >
                                                    Gerenciar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="description" className={labelClasses}>Descrição</label>
                                    <textarea
                                        name="description"
                                        id="description"
                                        rows={4}
                                        value={process.description}
                                        onChange={handleChange}
                                        readOnly={readOnlyMode}
                                        className={`${inputClasses} mt-2 min-h-[120px] ${readOnlyMode ? 'cursor-not-allowed' : ''}`}
                                    ></textarea>
                                </div>

                                {saveError && (
                                    <p className="text-right text-sm text-red-300">{saveError}</p>
                                )}

                                <div className="flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => router.push('/processes')}
                                        className="rounded-2xl border border-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/60"
                                    >
                                        Cancelar
                                    </button>
                                    {canEditProcess ? (
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="rounded-2xl bg-gradient-to-r from-brand-cyan-500 to-brand-cyan-600 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-brand-cyan-900/40 shadow-xl transition hover:from-brand-cyan-400 hover:to-brand-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isSaving ? 'Salvando...' : 'Salvar Processo'}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-emerald-200">
                                            <span className="h-8 w-8 rounded-full bg-emerald-400/90 text-center text-white">OK</span>
                                            <span className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">Somente leitura</span>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <FeesChargedModal 
                isOpen={isFeesChargedModalOpen}
                onClose={() => setFeesChargedModalOpen(false)}
                processId={typeof id === 'string' ? id : process?.id}
                proposals={process.feesCharged}
                onUpdate={(updatedProposals) => setProcess({ ...process, feesCharged: updatedProposals })}
            />
            <FeesReceivedModal
                isOpen={isFeesReceivedModalOpen}
                onClose={() => setFeesReceivedModalOpen(false)}
                processId={typeof id === 'string' ? id : process?.id}
                payments={process.feesReceived}
                onUpdate={(updatedPayments) => setProcess({ ...process, feesReceived: updatedPayments })}
            />
        </>
    );
};

export default ProcessDetailPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    if (!isRequestAuthenticated(ctx)) {
        return redirectToLogin(ctx);
    }
    return { props: {} };
};
