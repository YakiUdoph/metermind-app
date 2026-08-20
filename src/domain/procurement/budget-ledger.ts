/**
 * MeterMind Procurement Domain — Budget Ledger
 *
 * Process-local ledger that prevents overspending by enforcing reservations
 * and spent guarantees. Invariant: spent <= totalBudget.
 */
export class BudgetLedger {
  private totalBudget: number;
  private reservedMap = new Map<string, number>();
  private spentMap = new Map<string, number>();
  private remainingAmount: number;

  constructor(totalBudget: number) {
    this.totalBudget = totalBudget;
    this.remainingAmount = totalBudget;
  }

  /**
   * Reserves an amount for a task. Returns true if successful, false if insufficient budget.
   */
  public reserve(taskId: string, amount: number): boolean {
    if (amount <= 0) return true;
    
    // If a reservation already exists, release it first
    if (this.reservedMap.has(taskId)) {
      this.release(taskId);
    }

    if (amount <= this.remainingAmount) {
      this.reservedMap.set(taskId, amount);
      this.remainingAmount = Number((this.remainingAmount - amount).toFixed(6));
      return true;
    }
    return false;
  }

  /**
   * Confirms payment execution, converting reservation to actual spent.
   * Releases any excess reserved budget.
   */
  public confirm(taskId: string, actualAmount: number): void {
    const reservedAmount = this.reservedMap.get(taskId) ?? 0;
    
    // Release the reservation
    this.reservedMap.delete(taskId);

    // Save actual spent
    const currentSpent = this.spentMap.get(taskId) ?? 0;
    const newSpent = Number((currentSpent + actualAmount).toFixed(6));
    this.spentMap.set(taskId, newSpent);

    // Return the unused difference to remaining
    const diff = Number((reservedAmount - actualAmount).toFixed(6));
    this.remainingAmount = Number((this.remainingAmount + diff).toFixed(6));
  }

  /**
   * Releases a reservation back to the remaining budget on failure/cancellation.
   */
  public release(taskId: string): void {
    const reservedAmount = this.reservedMap.get(taskId) ?? 0;
    if (reservedAmount > 0) {
      this.reservedMap.delete(taskId);
      this.remainingAmount = Number((this.remainingAmount + reservedAmount).toFixed(6));
    }
  }

  public getRemaining(): number {
    return this.remainingAmount;
  }

  public getReserved(taskId: string): number {
    return this.reservedMap.get(taskId) ?? 0;
  }

  public getSpent(taskId: string): number {
    return this.spentMap.get(taskId) ?? 0;
  }

  public getTotalSpent(): number {
    return Number([...this.spentMap.values()].reduce((sum, v) => sum + v, 0).toFixed(6));
  }

  public reset(totalBudget: number): void {
    this.totalBudget = totalBudget;
    this.remainingAmount = totalBudget;
    this.reservedMap.clear();
    this.spentMap.clear();
  }
}
