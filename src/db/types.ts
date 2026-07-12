export type TransactionType = "income" | "expense";
export type AccountType = "cash" | "bank" | "wallet" | "other";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  initial_balance: number;
  currency: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  icon: string | null;
  color: string | null;
}

export interface Transaction {
  id: number;
  account_id: number;
  category_id: number;
  type: TransactionType;
  amount: number;
  note: string | null;
  date: string; // ISO date string, e.g. 2026-07-10
  created_at: string;
}

// Transaction joined with its category + account, for display in lists
export interface TransactionWithRelations extends Transaction {
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
  account_name: string;
}

export interface NewTransactionInput {
  account_id: number;
  category_id: number;
  type: TransactionType;
  amount: number;
  note?: string;
  date: string;
}

export interface PeriodSummary {
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryBreakdown {
  category_id: number;
  category_name: string;
  category_color: string | null;
  total: number;
}
