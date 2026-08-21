import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DurablePaymentState =
  | "PREFLIGHT_RESERVED"
  | "ORDER_CREATED"
  | "SUBMISSION_UNKNOWN"
  | "SETTLED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export interface DurablePaymentRecord {
  idempotencyKey: string;
  contractHash?: string;
  orderId?: string;
  transactionHash?: string;
  state: DurablePaymentState;
  updatedAt: string;
}

interface LedgerFile { version: 1; records: Record<string, DurablePaymentRecord>; }

export class DurablePaymentLedger {
  readonly filePath: string;
  private readonly lockPath: string;

  constructor(filePath = process.env["GOAT_IDEMPOTENCY_FILE"] || ".metermind/live-payment-ledger.json") {
    this.filePath = resolve(filePath);
    this.lockPath = `${this.filePath}.lock`;
  }

  private read(): LedgerFile {
    if (!existsSync(this.filePath)) return { version: 1, records: {} };
    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as LedgerFile;
    if (parsed.version !== 1 || !parsed.records) throw new Error("IDEMPOTENCY_LEDGER_INVALID");
    return parsed;
  }

  private mutate(update: (ledger: LedgerFile) => void): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    let lock: number | undefined;
    try {
      lock = openSync(this.lockPath, "wx");
      const ledger = this.read();
      update(ledger);
      const temporary = `${this.filePath}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(ledger, null, 2), { encoding: "utf8", mode: 0o600 });
      renameSync(temporary, this.filePath);
    } finally {
      if (lock !== undefined) {
        closeSync(lock);
        if (existsSync(this.lockPath)) unlinkSync(this.lockPath);
      }
    }
  }

  get(idempotencyKey: string): DurablePaymentRecord | undefined {
    return this.read().records[idempotencyKey];
  }

  has(idempotencyKey: string): boolean {
    const record = this.get(idempotencyKey);
    return !!record && !["FAILED", "EXPIRED", "CANCELLED"].includes(record.state);
  }

  countSettled(): number {
    return Object.values(this.read().records).filter((record) => record.state === "SETTLED").length;
  }

  reserve(idempotencyKey: string, contractHash?: string): DurablePaymentRecord {
    let created!: DurablePaymentRecord;
    this.mutate((ledger) => {
      const existing = ledger.records[idempotencyKey];
      if (existing && !["FAILED", "EXPIRED", "CANCELLED"].includes(existing.state)) {
        throw new Error(`IDEMPOTENCY_RETRY_BLOCKED_${existing.state}`);
      }
      created = { idempotencyKey, ...(contractHash ? { contractHash } : {}), state: "PREFLIGHT_RESERVED", updatedAt: new Date().toISOString() };
      ledger.records[idempotencyKey] = created;
    });
    return created;
  }

  update(idempotencyKey: string, state: DurablePaymentState, fields: Partial<Pick<DurablePaymentRecord, "contractHash" | "orderId" | "transactionHash">> = {}): DurablePaymentRecord {
    let result!: DurablePaymentRecord;
    this.mutate((ledger) => {
      const existing = ledger.records[idempotencyKey];
      if (!existing) throw new Error("IDEMPOTENCY_RECORD_NOT_FOUND");
      result = { ...existing, ...fields, state, updatedAt: new Date().toISOString() };
      ledger.records[idempotencyKey] = result;
    });
    return result;
  }

  retryRequiresReconciliation(idempotencyKey: string): boolean {
    const state = this.get(idempotencyKey)?.state;
    return state === "ORDER_CREATED" || state === "SUBMISSION_UNKNOWN" || state === "SETTLED";
  }
}
