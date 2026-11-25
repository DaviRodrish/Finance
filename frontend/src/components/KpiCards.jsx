import { Wallet, TrendingDown, PiggyBank } from "lucide-react";
import { formatBRL, parseMoney } from "../utils/format";

export default function KpiCards({
  dashboard,
  editingIncome,
  setEditingIncome,
  incomeInput,
  setIncomeInput,
  onSaveIncome,
  onOpenReceivables,
}) {
  if (!dashboard) return null;

  const remaining = Number(dashboard.remaining);
  const pendingReceivables = Number(dashboard.receivables_pending);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      {/* Ganhos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
          <span>GANHOS</span>
          <Wallet className="w-4 h-4 text-emerald-600" />
        </div>
        {editingIncome ? (
          <form onSubmit={onSaveIncome} className="flex gap-2 mt-1">
            <input
              type="text"
              value={incomeInput}
              onChange={(e) => setIncomeInput(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-semibold"
              autoFocus
            />
            <button
              type="submit"
              className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-medium cursor-pointer"
            >
              Salvar
            </button>
          </form>
        ) : (
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold text-slate-900">
              {formatBRL(dashboard.income)}
            </p>
            <button
              onClick={() => {
                setIncomeInput(String(parseMoney(dashboard.income)));
                setEditingIncome(true);
              }}
              className="text-xs text-blue-600 hover:underline cursor-pointer"
            >
              Editar
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1.5">
          Pago: {formatBRL(dashboard.total_paid)} • Pendente:{" "}
          {formatBRL(dashboard.total_pending)}
        </p>
      </div>

      {/* Total do Mês */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
          <span>TOTAL DO MÊS</span>
          <TrendingDown className="w-4 h-4 text-rose-500" />
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold text-slate-900">
            {formatBRL(dashboard.total_expenses)}
          </p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {dashboard.commitment_percentage}% da renda
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden">
          <div
            className="bg-slate-900 h-full rounded-full transition-all"
            style={{
              width: `${Math.min(dashboard.commitment_percentage, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Restante + Saldo Projetado */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
          <span>RESTANTE</span>
          <PiggyBank className="w-4 h-4 text-blue-600" />
        </div>
        <p
          className={`text-2xl font-bold ${
            remaining >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {formatBRL(dashboard.remaining)}
        </p>
        <p className="text-xs text-slate-400 mt-1.5">
          {pendingReceivables > 0 ? (
            <>
              Com{" "}
              <button
                onClick={onOpenReceivables}
                className="text-blue-600 hover:underline font-medium cursor-pointer"
              >
                +{formatBRL(pendingReceivables)} a receber
              </button>
              : <strong>{formatBRL(dashboard.projected_balance)}</strong>
            </>
          ) : remaining >= 0 ? (
            "Margem disponível no mês"
          ) : (
            "Despesas acima dos ganhos"
          )}
        </p>
      </div>
    </section>
  );
}