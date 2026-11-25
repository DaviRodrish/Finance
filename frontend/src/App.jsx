import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  CheckCircle2,
  Circle,
  UserPlus,
  Pencil,
} from "lucide-react";
import { api } from "./services/api";
import { supabase } from "./services/supabase";
import {
  formatBRL,
  shiftMonth,
  getCurrentYearMonth,
  parseMoney,
} from "./utils/format";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
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
  const [currentMonth, setCurrentMonth] = useState(() => getCurrentYearMonth());
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
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) loadData(currentMonth);
  }, [currentMonth, session, loadData]);

  const runAction = async (fn, onSuccess) => {
    setError("");
    try {
      await fn();
      if (onSuccess) onSuccess();
      await loadData(currentMonth);
    } catch (err) {
      setError(err.message || "Erro ao executar ação");
    }
  };

  const handleSaveIncome = async (e) => {
    e.preventDefault();
    const amount = parseMoney(incomeInput);
    if (amount < 0) {
      setError("O valor de ganhos não pode ser negativo.");
      return;
    }
    await runAction(
      () =>
        api.upsertIncome({
          reference_month: currentMonth,
          amount,
        }),
      () => setEditingIncome(false)
    );
  };

  const handleCreateExpense = async (payload) => {
    await runAction(
      () => api.createExpense(payload),
      () => setLaunchModalMode(null)
    );
  };

  const handleCreateReceivable = async (payload) => {
    await runAction(
      () => api.createReceivable(payload),
      () => setLaunchModalMode(null)
    );
  };

  const handleCreateEntity = async (payload) => {
    await runAction(
      () => api.createEntity(payload),
      () => setShowEntityModal(false)
    );
  };

  const handleToggleStatus = async (entry) => {
    const nextStatus = entry.status === "paid" ? "pending" : "paid";
    await runAction(() => api.updateEntry(entry.id, { status: nextStatus }, false));
  };

  const handlePayAllEntity = async (entityId) => {
    await runAction(() => api.payAllEntity(currentMonth, entityId));
  };

  const handleSaveEditEntry = async (id, data, applyFuture) => {
    await runAction(
      () => api.updateEntry(id, data, applyFuture),
      () => setEditingEntry(null)
    );
  };

  const handleDeleteCurrentEntry = async (entryId) => {
    await runAction(
      () => api.deleteEntry(entryId),
      () => setEditingEntry(null)
    );
  };

  const handleDeleteEntireExpense = async (expenseId) => {
    await runAction(
      () => api.deleteExpense(expenseId),
      () => setEditingEntry(null)
    );
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      <Sidebar
        userEmail={session.user?.email}
        currentMonth={currentMonth}
        onPrevMonth={() => setCurrentMonth((m) => shiftMonth(m, -1))}
        onNextMonth={() => setCurrentMonth((m) => shiftMonth(m, 1))}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingReceivablesCount={pendingReceivablesCount}
        onOpenLaunch={() =>
          setLaunchModalMode(
            activeTab === "receivables" ? "receivable" : "expense"
          )
        }
        onOpenEntityModal={() => setShowEntityModal(true)}
        onSignOut={() => supabase.auth.signOut()}
      />

      <div className="flex-1 min-w-0 pb-24">
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
                      type="button"
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
                        type="button"
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

                  <div className="flex items-center gap-2">
                    {selectedEntity !== "all" && (
                      <button
                        type="button"
                        onClick={() => handlePayAllEntity(Number(selectedEntity))}
                        className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                      >
                        Marcar tudo como pago
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowEntityModal(true)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Pessoa/Categoria</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaunchModalMode("expense")}
                      className="flex items-center gap-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Lançar</span>
                    </button>
                  </div>
                </div>

                {loading ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    A carregar...
                  </p>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-sm text-slate-500">
                      Nenhum lançamento registado neste mês.
                    </p>
                    <p className="text-xs text-slate-400">
                      Cadastre uma pessoa/categoria e clique em &ldquo;Lançar&rdquo;.
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
                              type="button"
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
                              type="button"
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
      </div>

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
