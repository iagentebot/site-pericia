// FIX: Removed incorrect self-import of `ProcessStatus`.
export enum ProcessStatus {
  ENVIAR_PROPOSTA = 'Enviar Proposta',
  ATRASO = 'Atraso',
  AGUARDANDO_RESPOSTA = 'Aguardando Resposta',
  ELABORACAO_LAUDO = 'Elaboração Laudo',
  PERICIA_MARCADA = 'Perícia Marcada',
  AGUARDANDO_PAGAMENTO = 'Aguardando Pagamento',
  ARQUIVADO = 'Arquivado',
  RECUSADO = 'Recusado',
}

export enum JusticeType {
  AJG = 'AJG',
  PARTICULAR = 'Particular',
  MISTO = 'Misto',
}

export enum PericiaType {
  LOCAL = 'Local',
  DOCUMENTAL = 'Documental',
}

export type AuthRole = 'admin' | 'contributor' | 'readonly';

export interface AuthUser {
  email: string;
  name?: string;
  picture?: string;
  roles: AuthRole[];
}

export interface FeeProposal {
  id: string;
  date: string;
  amount: number;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  taxes: number;
  total: number;
  source: string;
}

export interface JudicialProcess {
  id: string;
  processNumber: string;
  plaintiff: string;
  defendant: string;
  city: string;
  status: ProcessStatus;
  justiceType: JusticeType;
  periciaType: PericiaType;
  startDate: string;
  caseValue: number;
  feesCharged: FeeProposal[];
  feesReceived: Payment[];
  description: string;
}

// Database row typing and mapper (MySQL table `pericia`)
export interface PericiaRow {
  id: number;
  processo: string;
  classe: string;
  autor: string;
  reu: string;
  cidade: string;
  assunto: string;
  vara: number;
  status: string | null;
  descricao: string;
  valor_causa: string | number;
  fl_ajg: any; // BIT(1)
  fl_tipo: any; // BIT(1)
  valor_cobrado: string | number;
  dtins: string | Date;
  dataPericia: string | Date;
  dataInicio: string | Date;
}

export interface PaymentRow {
  id: number;
  proc_id: number;
  desc: string;
  valor_depositado: string | number;
  imposto_retido: string | number;
  valor_total: string | number;
  data: string | Date;
}

export interface HonorarioRow {
  id: number;
  proc_id: number;
  desc: string;
  valor: string | number;
  data: string | Date;
  dtins: string | Date;
}

function bitToBool(v: any): boolean {
  if (v == null) return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v !== '0' && v !== '';
  if (typeof Buffer !== 'undefined' && typeof (Buffer as any).isBuffer === 'function' && (Buffer as any).isBuffer(v)) {
    return (v as any)[0] !== 0;
  }
  return Boolean(v);
}

function mapJusticeTypeFromDb(value: any): JusticeType {
  if (value === null || typeof value === 'undefined') {
    return JusticeType.MISTO;
  }
  return bitToBool(value) ? JusticeType.AJG : JusticeType.PARTICULAR;
}

function toISODate(value: any): string {
  try {
    if (!value) return '';
    if (typeof value === 'string') {
      const normalized = value.trim();
      const simple = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (simple) {
        return `${simple[1]}-${simple[2]}-${simple[3]}`;
      }
      const br = normalized.match(/^(\d{2})-(\d{2})-(\d{4})/);
      if (br) {
        return `${br[3]}-${br[2]}-${br[1]}`;
      }
    }
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function mapPericiaRowToJudicialProcess(r: PericiaRow): JudicialProcess {
  const tipoLocal = bitToBool(r.fl_tipo);
  // Map DB textual enum status directly to UI enum value when possible
  const statusStr = String(r.status ?? '').trim();
  const allStatuses = Object.values(ProcessStatus) as string[];
  const status = (allStatuses.includes(statusStr) ? (statusStr as ProcessStatus) : ProcessStatus.ELABORACAO_LAUDO);

  const valorCobrado = Number(r.valor_cobrado || 0) || 0;
  const feesCharged: FeeProposal[] = valorCobrado > 0
    ? [{ id: `${r.id}-vc`, date: toISODate(r.dtins) || toISODate(r.dataInicio) || new Date().toISOString().slice(0, 10), amount: valorCobrado }]
    : [];

  return {
    id: String(r.id),
    processNumber: r.processo || '',
    plaintiff: r.autor || '',
    defendant: r.reu || '',
    city: r.cidade || '',
    status,
    justiceType: mapJusticeTypeFromDb(r.fl_ajg),
    periciaType: tipoLocal ? PericiaType.LOCAL : PericiaType.DOCUMENTAL,
    startDate: toISODate(r.dataInicio) || '',
    caseValue: Number(r.valor_causa || 0) || 0,
    feesCharged,
    feesReceived: [],
    description: r.descricao || '',
  };
}

export function mapPaymentRowToPayment(row: PaymentRow): Payment {
  return {
    id: String(row.id),
    source: row.desc || '',
    amount: Number(row.valor_depositado || 0) || 0,
    taxes: Number(row.imposto_retido || 0) || 0,
    total: Number(row.valor_total || 0) || 0,
    date: toISODate(row.data) || '',
  };
}

export function mapHonorarioRowToFeeProposal(row: HonorarioRow): FeeProposal {
  return {
    id: String(row.id),
    date: toISODate(row.data) || toISODate(row.dtins) || '',
    amount: Number(row.valor || 0) || 0,
  };
}
