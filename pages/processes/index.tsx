
import React, { useState, useEffect, ReactNode } from 'react';
import type { GetServerSideProps } from 'next';
import { isRequestAuthenticated, redirectToLogin } from '../../lib/auth-server';
import Header from '../../components/Header';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getProcesses, getProcessPayments } from '../../services/processService';
import { JudicialProcess, ProcessStatus, Payment, JusticeType, PericiaType } from '../../types';
import { Combobox } from '../../components/ui/combobox';
import { useAuth } from '../../context/authContext';

// --- Modal Component ---
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300" aria-modal="true" role="dialog">
            <div className="bg-gray-200 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-brand-dark rounded-t-lg z-10">
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
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

// --- Payment Report Modal ---
interface ReportPayment extends Payment {
    processNumber: string;
    processAuthor?: string;
}

interface ReportMonth {
    monthName: string;
    payments: ReportPayment[];
    total: number;
    amount: number;
    taxes: number;
}

interface ReportData {
    months: ReportMonth[];
    grandTotal: number;
}

interface PaymentReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    processes: JudicialProcess[];
}

const PaymentReportModal: React.FC<PaymentReportModalProps> = ({ isOpen, onClose, processes }) => {
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [paymentsByProcess, setPaymentsByProcess] = useState<Record<string, Payment[]>>({});
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        const fetchPayments = async () => {
            setIsLoadingPayments(true);
            setLoadError(null);
            try {
                const entries = await Promise.all(processes.map(async (process) => {
                    const processId = process.id;
                    if (!processId || processId === 'new') {
                        return [processId ?? '', process.feesReceived ?? []] as const;
                    }
                    const payments = await getProcessPayments(processId);
                    if (payments.length > 0) {
                        return [processId, payments] as const;
                    }
                    return [processId, process.feesReceived ?? []] as const;
                }));

                if (cancelled) {
                    return;
                }

                const map: Record<string, Payment[]> = {};
                entries.forEach(([id, payments]) => {
                    if (id) {
                        map[id] = payments;
                    }
                });
                setPaymentsByProcess(map);
            } catch (error) {
                if (!cancelled) {
                    setLoadError('Não foi possível carregar os pagamentos do banco de dados.');
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingPayments(false);
                }
            }
        };

        fetchPayments();

        return () => {
            cancelled = true;
        };
    }, [isOpen, processes]);

    const handleGenerateReport = () => {
        const filteredPayments: ReportPayment[] = [];
        processes.forEach(process => {
            const payments = paymentsByProcess[process.id] ?? process.feesReceived ?? [];
            payments.forEach(payment => {
                if (new Date(payment.date + 'T00:00:00').getFullYear() === year) {
                    filteredPayments.push({ ...payment, processNumber: process.processNumber });
                }
            });
        });

        if (filteredPayments.length === 0) {
            setReportData({ months: [], grandTotal: 0 });
            return;
        }

        const groupedByMonth: { [key: number]: ReportPayment[] } = {};
        filteredPayments.forEach(payment => {
            const month = new Date(payment.date + 'T00:00:00').getMonth();
            if (!groupedByMonth[month]) {
                groupedByMonth[month] = [];
            }
            groupedByMonth[month].push(payment);
        });

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const months: ReportMonth[] = [];
        let grandTotal = 0;

        Object.keys(groupedByMonth).map(monthKeyStr => {
            const monthKey = parseInt(monthKeyStr);
            const monthPayments = groupedByMonth[monthKey].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const monthAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
            const monthTaxes = monthPayments.reduce((sum, p) => sum + (p.taxes || 0), 0);
            const monthTotal = monthPayments.reduce((sum, p) => sum + p.total, 0);
            grandTotal += monthTotal;

            months.push({
                monthName: monthNames[monthKey],
                payments: monthPayments,
                total: monthTotal,
                amount: monthAmount,
                taxes: monthTaxes,
            });
        });

        months.sort((a, b) => monthNames.indexOf(a.monthName) - monthNames.indexOf(b.monthName));

        setReportData({ months, grandTotal });
    };

    const handleClose = () => {
        setReportData(null);
        setPaymentsByProcess({});
        setLoadError(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Relatório de Pagamentos">
            <div className="space-y-4">
                {isLoadingPayments && (
                    <p className="text-sm text-gray-200 bg-gray-800 p-2 rounded">Carregando pagamentos...</p>
                )}
                {loadError && (
                    <p className="text-sm text-red-400 bg-red-900 bg-opacity-30 p-2 rounded">{loadError}</p>
                )}
                <div className="flex items-end space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <label htmlFor="reportYear" className="block text-sm font-medium text-gray-700">Ano</label>
                        <input
                            type="number"
                            id="reportYear"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                            className="mt-1 p-2 block w-full border rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="YYYY"
                        />
                    </div>
                    <button
                        onClick={handleGenerateReport}
                        disabled={isLoadingPayments}
                        className="bg-brand-cyan-500 hover:bg-brand-cyan-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-brand-cyan-300 disabled:cursor-not-allowed"
                    >
                        {isLoadingPayments ? 'Carregando...' : 'Gerar Relatório'}
                    </button>
                </div>

                {reportData && (
                    <div className="mt-6">
                        {reportData.months.length > 0 ? (
                            <div className="space-y-6">
                                {reportData.months.map(monthData => (
                                    <div key={monthData.monthName}>
                                        <h4 className="text-xl font-semibold text-brand-cyan-700 mb-3 pb-2 border-b">{monthData.monthName}</h4>
                                        <ul className="space-y-2 mb-3">
                                            {monthData.payments.map(p => (
                                                <li key={p.id} className="grid grid-cols-6 gap-4 items-center text-sm p-2 rounded-md bg-gray-100 hover:bg-gray-50">
                                                    <span className="text-gray-600 border">{new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                                    <span className="text-gray-800 border font-medium col-span-2">{p.processNumber} - {p.source}</span>
                                                    <span className="text-gray-900 border font-semibold text-right">{p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                    <span className="text-red-700 border font-semibold text-right">{`- ${p.taxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</span>
                                                    <span className="text-green-700 border font-semibold text-right">{p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="grid grid-cols-6 gap-4 items-center text-lg p-2 rounded-md bg-gray-100 hover:bg-gray-50 font-bold">
                                            <span className="col-span-3">Subtotal Mês: </span>
                                            <span className="col-span-1 font-normal text-right">{monthData.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                            <span className="col-span-1 font-normal text-right">{monthData.taxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                            <span className="col-span-1 font-bold text-right">{monthData.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="mt-8 pt-4 border-t-2 text-right">
                                    <h3 className="text-2xl font-bold text-gray-900">
                                        Total Anual: {reportData.grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </h3>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8">Nenhum pagamento encontrado para o ano de {year}.</p>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

const statusColors: { [key in ProcessStatus]: string } = {
    [ProcessStatus.ENVIAR_PROPOSTA]: 'bg-yellow-100 text-yellow-800',
    [ProcessStatus.ATRASO]: 'bg-red-100 text-red-800',
    [ProcessStatus.AGUARDANDO_RESPOSTA]: 'bg-blue-100 text-blue-800',
    [ProcessStatus.ELABORACAO_LAUDO]: 'bg-violet-100 text-violet-800',
    [ProcessStatus.PERICIA_MARCADA]: 'bg-amber-100 text-amber-800',
    [ProcessStatus.AGUARDANDO_PAGAMENTO]: 'bg-green-100 text-green-800',
    [ProcessStatus.ARQUIVADO]: 'bg-gray-200 text-gray-800',
    [ProcessStatus.RECUSADO]: 'bg-gray-200 text-gray-800',
};

const statusFilterOptions = [
    { value: 'all', label: 'Todos' },
    ...Object.values(ProcessStatus).map((status) => ({
        value: status,
        label: status,
    })),
] as { value: ProcessStatus | 'all'; label: string }[];

const justiceTypeColors: { [key in JusticeType]: string } = {
    [JusticeType.AJG]: 'bg-red-100 text-red-800',
    [JusticeType.PARTICULAR]: 'bg-green-100 text-green-800',
    [JusticeType.MISTO]: 'bg-cyan-100 text-cyan-800',
};

const periciaTypeColors: { [key in PericiaType]: string } = {
    [PericiaType.LOCAL]: 'bg-yellow-100 text-yellow-800',
    [PericiaType.DOCUMENTAL]: 'bg-blue-100 text-blue-800',
};

const Badge: React.FC<{ text: string; colorClass: string }> = ({ text, colorClass }) => (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
        {text}
    </span>
);

// -- Label process number ---
const ProcessNumberBadge: React.FC<{ number: string; className?: string }> = ({ number, className = "" }) => (
    <h3 className={`inline-flex items-center gap-2 text-base font-semibold tracking-wide text-brand-cyan-50 bg-gradient-to-r from-brand-cyan-500 to-brand-cyan-700 px-4 py-1 rounded-full shadow-lg shadow-brand-cyan-900/30 ${className}`}>
        {/* <span className="text-xs uppercase text-white">Processo</span> */}
        <span className="text-1xl uppercase text-white">{number}</span>
    </h3>
);

// --- Process Card Component ---
const ProcessCard: React.FC<{ process: JudicialProcess }> = ({ process }) => (
    <Link href={`/processes/${process.id}`} className="block">
        <div className="group relative min-h-[319px] max-h-[320px] overflow-hidden rounded-3xl border border-brand-cyan-900/40 bg-gradient-to-tr from-brand-cyan-600 via-cyan-900 to-brand-cyan-700 p-6 shadow-xl shadow-black/30 transition-all duration-500 hover:scale-105 hover:shadow-lg  hover:shadow-white/20">
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-bl from-brand-cyan-600 via-cyan-900 to-brand-cyan-700" />
            <div className="relative space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <ProcessNumberBadge number={process.processNumber} />
                    <Badge text={process.status} colorClass={`${statusColors[process.status]} uppercase tracking-wide`} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge text={process.justiceType} colorClass={justiceTypeColors[process.justiceType]} />
                    <Badge text={process.periciaType} colorClass={periciaTypeColors[process.periciaType]} />
                </div>
                <div className="text-sm text-gray-200 space-y-2">
                    <p><span className="text-brand-cyan-200 font-semibold">Autor:</span> {process.plaintiff}</p>
                    <p><span className="text-brand-cyan-200 font-semibold">Réu:</span> {process.defendant}</p>
                    <p className="flex justify-between text-xs md:text-sm text-brand-cyan-100/80">
                        <span className="font-semibold">Cidade:</span>
                        <span className="text-right text-white font-medium">{process.city}</span>
                    </p>
                </div>
                <div className="flex justify-end">
                    <div className="inline-flex items-center gap-2 rounded-full border border-brand-cyan-400/40 bg-gradient-to-r from-brand-cyan-500 to-brand-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-cyan-900/30 transition-colors duration-300 group-hover:from-brand-cyan-400 group-hover:to-brand-cyan-500">
                        Ver Detalhes
                        <span aria-hidden>{'>'}</span>
                    </div>
                </div>
            </div>
        </div>
    </Link>
);

const ProcessListPage: React.FC = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [processes, setProcesses] = useState<JudicialProcess[]>([]);
    const [loading, setLoading] = useState(true);
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProcessStatus | 'all'>('all');

    const canManageProcesses = user?.roles.some((role) => role === 'admin' || role === 'contributor');
    const isReadOnly = user?.roles.includes('readonly');

    useEffect(() => {
        const fetchProcesses = async () => {
            setLoading(true);
            const data = await getProcesses();
            setProcesses(data);
            setLoading(false);
        };
        fetchProcesses();
    }, [router]);

    const filteredProcesses = processes.filter((process) => {
        const matchesStatus = statusFilter === 'all' || process.status === statusFilter;
        if (!matchesStatus) {
            return false;
        }
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;

        const number = process.processNumber?.toLowerCase() ?? '';
        const plaintiff = process.plaintiff?.toLowerCase() ?? '';
        const defendant = process.defendant?.toLowerCase() ?? '';

        return number.includes(term) || plaintiff.includes(term) || defendant.includes(term);
    });

    if (loading) {
        return <div className="text-center p-10">Carregando processos...</div>;
    }

    return (
        <>
        <Header />
        <div className="bg-brand-dark min-h-screen pt-20 md:pt-24">
            <div className="container mx-auto px-6 py-10 bg-brand-dark">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Lista de Processos</h1>
                        <p className="text-sm text-brand-cyan-100/80 mt-1 text-white">Filtre por número do processo ou partes para localizar rapidamente.</p>
                    </div>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-3 w-full md:w-auto">
                        <Combobox
                            className="w-full md:w-60"
                            value={statusFilter}
                            onChange={(value) => setStatusFilter(value as ProcessStatus | 'all')}
                            options={statusFilterOptions}
                            placeholder="Selecione o status"
                            searchPlaceholder="Buscar status..."
                        />
                        <div className="relative flex-1 min-w-[240px]">
                            <label htmlFor="process-search" className="sr-only">Buscar processos</label>
                            <input
                                id="process-search"
                                type="text"
                                placeholder="Buscar por número, autor ou réu"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-2xl border border-brand-cyan-500/50 bg-brand-dark-secondary/70 px-5 py-3 text-sm text-white placeholder:text-brand-cyan-100/60 focus:border-brand-cyan-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/40 transition"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-brand-cyan-100/60">
                                <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <circle cx="9" cy="9" r="6" />
                                    <line x1="14" y1="14" x2="18" y2="18" />
                                </svg>
                            </span>
                        </div>
                        <button
                            onClick={() => setReportModalOpen(true)}
                            className="bg-gradient-to-r from-brand-cyan-500 to-brand-cyan-600 hover:from-brand-cyan-400 hover:to-brand-cyan-500 text-white font-bold py-3 px-5 rounded-2xl transition duration-300 ease-in-out shadow-brand-cyan-900/40 shadow-lg"
                        >
                            Relatório Pagamentos
                        </button>
                        {canManageProcesses ? (
                            <Link
                                href="/processes/new"
                                className="bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-white font-bold py-3 px-5 rounded-2xl transition duration-300 ease-in-out shadow-emerald-900/30 shadow-lg text-center"
                            >
                                + Adicionar Processo
                            </Link>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-brand-cyan-500/40 bg-brand-dark-secondary/70 px-5 py-3 text-sm font-semibold text-brand-cyan-100/70">
                                {isReadOnly ? 'Você está com acesso somente leitura. Peça um admin para liberar escrita.' : 'Peça a um administrador para liberar edição.'}
                            </div>
                        )}
                    </div>
                </div>
                {filteredProcesses.length ? (
                    <div className="grid mt-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {filteredProcesses.map(process => (
                            <ProcessCard key={process.id} process={process} />
                        ))}
                    </div>
                ) : (
                    <div className="mt-10 rounded-3xl border border-dashed border-brand-cyan-500/40 bg-brand-dark-secondary/80 p-10 text-center text-white">
                        Nenhum processo encontrado para os filtros selecionados{searchTerm ? ` e o termo "${searchTerm}"` : ''}.
                    </div>
                )}
                <PaymentReportModal 
                    isOpen={isReportModalOpen}
                    onClose={() => setReportModalOpen(false)}
                    processes={processes}
                />
            </div>
        </div>
        </>
    );
};

export default ProcessListPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    if (!isRequestAuthenticated(ctx)) {
        return redirectToLogin(ctx);
    }
    return { props: {} };
};
