import { evaluateProcurement } from "@/domain/procurement/scoring";
import type { ProcurementRequest, ProcurementResult } from "@/domain/procurement/types";
import { demoProviders } from "@/lib/mock";

export async function procureTaskServerFn(data: ProcurementRequest): Promise<ProcurementResult> {
  return evaluateProcurement(data, demoProviders);
}
