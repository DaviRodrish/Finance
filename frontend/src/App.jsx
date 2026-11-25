import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Circle,
  UserPlus,
  LogOut,
  Pencil,
} from "lucide-react";
import { api } from "./services/api";
import { supabase } from "./services/supabase";
import {
  formatBRL,
  formatMonthLabel,
  shiftMonth,
  parseMoney,
} from "./utils/format";
import Login from "./components/Login";
import ReceivablesTab from "./components/ReceivablesTab";
import KpiCards from "./components/KpiCards";
import ChartsSection from "./components/ChartsSection";
import ExpenseModal from "./components/ExpenseModal";
import EditExpenseModal from "./components/EditExpenseModal";
import EntityModal from "./components/EntityModal";

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("expenses");
  const [currentMonth, setCurrentMonth] = useState("2026-11");
  const [dashboard, setDashboard] = useState(null);
  const [receivables, setReceivables] = useState(null);
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [launchModalMode, setLaunchModalMode] = useState(null); // null | "expense" | "receivable"
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async (month) => {
    setLoading(true);
    setError("");
    try {
      const [dashData, recData, entsData] = await Promise.all([
        api.getDashboard(month),
        api.getReceivables(month),
        api.getEntities(),
      ]);
      setDashboard(dashData);
      setReceivables(recData);
      setEntities(entsData);
      setIncomeInput(String(dashData.income ?? ""));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) loadData(currentMonth);
  }, [currentMonth, session, loadData]);

  const handleSaveIncome = async (e) => {
    e.preventDefault();
    await api.upsertIncome({
      reference_month: currentMonth,
      amount: parseMoney(incomeInput),
    });
    setEditingIncome(false);
    await loadData(currentMonth);
  };

  const handleCreateExpense = async (payload) => {
    await api.createExpense(payload);
    setLaunchModalMode(null);
    await loadData(currentMonth);
  };

  const handleCreateReceivable = async (payload) => {
    await api.createReceivable(payload);
    setLaunchModalMode(null);
    await loadData(currentMonth);
  };

  const handleCreateEntity = async (payload) => {
    await api.createEntity(payload);
    setShowEntityModal(false);
    await loadData(currentMonth);
  };

  const handleToggleStatus = async (entry) => {
    const nextStatus = entry.status === "paid" ? "pending" : "paid";
    await api.updateEntry(entry.id, { status: nextStatus }, false);
    await loadData(currentMonth);
  };

  const handlePayAllEntity = async (entityId) => {
    await api.payAllEntity(currentMonth, entityId);
    await loadData(currentMonth);
  };

  const handleSaveEditEntry = async (id, data, applyFuture) => {
    await api.updateEntry(id, data, applyFuture);
    setEditingEntry(null);
    await loadData(currentMonth);
  };

  const handleDeleteCurrentEntry = async (entryId) => {
    await api.deleteEntry(entryId);
    setEditingEntry(null);
    await loadData(currentMonth);
  };

  const handleDeleteEntireExpense = async (expenseId) => {
    await api.deleteExpense(expenseId);
    setEditingEntry(null);
    await loadData(currentMonth);
  };

  const filteredEntries = useMemo(() => {
    if (!dashboard?.entries) return [];
    if (selectedEntity === "all") return dashboard.entries;
    return dashboard.entries.filter(
      (e) => e.entity.id === Number(selectedEntity)
    );
  }, [dashboard, selectedEntity]);

  const pendingReceivablesCount = useMemo(() => {
    if (!receivables?.entries) return 0;
    return receivables.entries.filter((e) => e.status === "pending").length;
  }, [receivables]);

  if (authLoading) return null;
  if (!session) return <Login />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate">
              Finanças
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {session.user?.email}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setCurrentMonth((m) => shiftMonth(m, -1))}
              className="p-1.5 rounded-lg hover:bg-white transition cursor-pointer"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-sm font-semibold min-w-[125px] text-center">
              {formatMonthLabel(currentMonth)}
            </span>
            <button
              onClick={() => setCurrentMonth((m) => shiftMonth(m, 1))}
              className="p-1.5 rounded-lg hover:bg-white transition cursor-pointer"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEntityModal(true)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
              title="Nova Pessoa / Categoria"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setLaunchModalMode(
                  activeTab === "receivables" ? "receivable" : "expense"
                )
              }
              className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeTab === "receivables" ? "Nova Cobrança" : "Lançar"}
              </span>
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 pb-2.5 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "expenses"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Despesas
          </button>
          <button
            onClick={() => setActiveTab("receivables")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "receivables"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>A Receber</span>
            {pendingReceivablesCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                  activeTab === "receivables"
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {pendingReceivablesCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {activeTab === "receivables" ? (
          <ReceivablesTab
            currentMonth={currentMonth}
            receivables={receivables}
            entities={entities}
            loading={loading}
            onRefresh={loadData}
            onOpenNewModal={() => setLaunchModalMode("receivable")}
          />
        ) : (
          <>
            <KpiCards
              dashboard={dashboard}
              editingIncome={editingIncome}
              setEditingIncome={setEditingIncome}
              incomeInput={incomeInput}
              setIncomeInput={setIncomeInput}
              onSaveIncome={handleSaveIncome}
              onOpenReceivables={() => setActiveTab("receivables")}
            />

            <ChartsSection dashboard={dashboard} />

            <section className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setSelectedEntity("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      selectedEntity === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Todos
                  </button>
                  {entities.map((ent) => (
                    <button
                      key={ent.id}
                      onClick={() => setSelectedEntity(String(ent.id))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                        selectedEntity === String(ent.id)
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: ent.color }}
                      />
                      {ent.name}
                    </button>
                  ))}
                </div>

                {selectedEntity !== "all" && (
                  <button
                    onClick={() => handlePayAllEntity(Number(selectedEntity))}
                    className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                  >
                    Marcar tudo como pago
                  </button>
                )}
              </div>

              {loading ? (
                <p className="text-sm text-slate-400 py-8 text-center">
                  Carregando...
                </p>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm text-slate-500">
                    Nenhum lançamento registrado neste mês.
                  </p>
                  <p className="text-xs text-slate-400">
                    Cadastre uma pessoa/categoria no botão + usuário e clique em
                    &ldquo;Lançar&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredEntries.map((entry) => {
                    const isPaid = entry.status === "paid";
                    return (
                      <div
                        key={entry.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => handleToggleStatus(entry)}
                            className="text-slate-400 hover:text-emerald-600 transition shrink-0 cursor-pointer"
                            title={
                              isPaid
                                ? "Marcar como pendente"
                                : "Marcar como pago"
                            }
                          >
                            {isPaid ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-md text-white shrink-0"
                                style={{ backgroundColor: entry.entity.color }}
                              >
                                {entry.entity.name}
                              </span>
                              <span
                                className={`text-sm font-medium truncate ${
                                  isPaid
                                    ? "line-through text-slate-400"
                                    : "text-slate-900"
                                }`}
                              >
                                {entry.description}
                              </span>
                              {entry.installment_label && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                  {entry.installment_label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <p
                            className={`text-sm font-bold ${
                              isPaid ? "text-slate-400" : "text-slate-900"
                            }`}
                          >
                            {formatBRL(entry.amount)}
                          </p>
                          <button
                            onClick={() => setEditingEntry(entry)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            title="Editar ou excluir lançamento"
                            aria-label="Editar ou excluir lançamento"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <ExpenseModal
        open={Boolean(launchModalMode)}
        mode={launchModalMode || "expense"}
        entities={entities}
        defaultMonth={currentMonth}
        onClose={() => setLaunchModalMode(null)}
        onOpenEntityModal={() => {
          setLaunchModalMode(null);
          setShowEntityModal(true);
        }}
        onSubmitExpense={handleCreateExpense}
        onSubmitReceivable={handleCreateReceivable}
      />

      <EditExpenseModal
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={handleSaveEditEntry}
        onDeleteCurrent={handleDeleteCurrentEntry}
        onDeleteAll={handleDeleteEntireExpense}
      />

      <EntityModal
        open={showEntityModal}
        onClose={() => setShowEntityModal(false)}
        onCreate={handleCreateEntity}
      />
    </div>
  );
}