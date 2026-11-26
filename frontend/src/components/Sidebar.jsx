import ThemeToggle from "./ThemeToggle";
import {
  Receipt,
  HandCoins,
  UserPlus,
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatMonthLabel } from "../utils/format";

export default function Sidebar({
  userEmail,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  activeTab,
  setActiveTab,
  pendingReceivablesCount,
  onOpenLaunch,
  onOpenEntityModal,
  onSignOut,
}) {
  return (
    <aside className="w-full md:w-64 md:shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between">
      <div className="p-4 space-y-5">
        {/* Marca + Utilizador */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate">
              Luzzy
            </h1>
            <p className="text-xs text-slate-500 truncate">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition cursor-pointer shrink-0"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Seletor de Mês */}
        <div className="flex items-center justify-between bg-slate-100 rounded-xl p-1">
          <button
            type="button"
            onClick={onPrevMonth}
            className="p-1.5 rounded-lg hover:bg-white transition cursor-pointer"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-800">
            {formatMonthLabel(currentMonth)}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            className="p-1.5 rounded-lg hover:bg-white transition cursor-pointer"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tema */}
        <ThemeToggle />

        {/* Ação Principal */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenLaunch}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 text-white px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeTab === "receivables" ? "Nova Cobrança" : "Novo Lançamento"}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenEntityModal}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
            title="Nova Pessoa / Categoria"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => setActiveTab("expenses")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
              activeTab === "expenses"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Receipt className="w-4 h-4" />
              <span>Despesas</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("receivables")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
              activeTab === "receivables"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <HandCoins className="w-4 h-4" />
              <span>A Receber</span>
            </span>
            {pendingReceivablesCount > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  activeTab === "receivables"
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {pendingReceivablesCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      <div className="hidden md:block p-4 border-t border-slate-100 text-[11px] text-slate-400">
        Controlo financeiro pessoal
      </div>
    </aside>
  );
}
