import { create } from "zustand";

import type {
  Account,
  Category,
  NewTransactionInput,
  PeriodSummary,
  TransactionWithRelations,
} from "@/db/types";
import * as accountsRepo from "@/repositories/accounts.repo";
import * as categoriesRepo from "@/repositories/categories.repo";
import * as txRepo from "@/repositories/transactions.repo";

interface LedgerState {
  isReady: boolean;
  accounts: Account[];
  categories: Category[];
  recentTransactions: TransactionWithRelations[];
  currentPeriodSummary: PeriodSummary;

  init: () => Promise<void>;
  refresh: (rangeStart: string, rangeEnd: string) => Promise<void>;

  addTransaction: (
    input: NewTransactionInput,
    rangeStart: string,
    rangeEnd: string,
  ) => Promise<void>;

  removeTransaction: (
    id: number,
    rangeStart: string,
    rangeEnd: string,
  ) => Promise<void>;

  addCategory: (input: {
    name: string;
    type: "income" | "expense";
    icon?: string;
    color?: string;
  }) => Promise<void>;

  renameAccount: (id: number, name: string) => Promise<void>;
  removeAccount: (id: number) => Promise<void>;
  renameCategory: (id: number, name: string) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  isReady: false,
  accounts: [],
  categories: [],
  recentTransactions: [],
  currentPeriodSummary: { income: 0, expense: 0, balance: 0 },

  init: async () => {
    const [accounts, categories, recentTransactions] = await Promise.all([
      accountsRepo.getAllAccounts(),
      categoriesRepo.getAllCategories(),
      txRepo.getRecentTransactions(50),
    ]);
    set({ accounts, categories, recentTransactions, isReady: true });
  },

  refresh: async (rangeStart, rangeEnd) => {
    const [accounts, categories, recentTransactions, currentPeriodSummary] =
      await Promise.all([
        accountsRepo.getAllAccounts(),
        categoriesRepo.getAllCategories(),
        txRepo.getRecentTransactions(50),
        txRepo.getPeriodSummary(rangeStart, rangeEnd),
      ]);
    set({ accounts, categories, recentTransactions, currentPeriodSummary });
  },

  addTransaction: async (input, rangeStart, rangeEnd) => {
    await txRepo.createTransaction(input);
    await get().refresh(rangeStart, rangeEnd);
  },

  removeTransaction: async (id, rangeStart, rangeEnd) => {
    await txRepo.deleteTransaction(id);
    await get().refresh(rangeStart, rangeEnd);
  },

  addCategory: async (input) => {
    await categoriesRepo.createCategory(input);
    const categories = await categoriesRepo.getAllCategories();
    set({ categories });
  },

  renameAccount: async (id, name) => {
    await accountsRepo.updateAccount(id, { name });
    const accounts = await accountsRepo.getAllAccounts();
    set({ accounts });
  },

  removeAccount: async (id) => {
    await accountsRepo.deleteAccount(id);
    const accounts = await accountsRepo.getAllAccounts();
    set({ accounts });
  },

  renameCategory: async (id, name) => {
    await categoriesRepo.updateCategory(id, { name });
    const categories = await categoriesRepo.getAllCategories();
    set({ categories });
  },

  removeCategory: async (id) => {
    await categoriesRepo.deleteCategory(id);
    const categories = await categoriesRepo.getAllCategories();
    set({ categories });
  },
}));
