import { useEffect, useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Circle,
  Wallet,
  TrendingDown,
  PiggyBank,
  UserPlus,
  Database,
  Trash2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./services/api";

const formatBRL = (val) =>
  Number(val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatMonthLabel = (ym) => {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
};

export default function App() {
  const [currentMonth, setCurrentMonth] = useState("2026-11");
  const [dashboard, setDashboard] = useState(null);
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modais
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);

  // Edição de ganhos
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");

  // Form Novo Lançamento
  const [form, setForm] = useState({
    entity_id: "",
    description: "",
    amount: "",
    expense_type: "single",
    total_installments: 1,
    start_installment: 1,
    start_month: "2026-11",
  });

  // Form Nova Entidade
  const [newEntity, setNewEntity] = useState({ name: "", color: "#3B82F6" });

  const loadData = async (month = currentMonth) => {
    setLoading(true);
    setError("");
    try {
      const [dashData, entsData] = await Promise.all([
        api.getDashboard(month),
        api.getEntities(),
      ]);
      setDashboard(dashData);
      setEntities(entsData);
      setIncomeInput(String(dashData.income ?? ""));
      if (entsData.length > 0 && !form.entity_id) {
        setForm((prev) => ({ ...prev, entity_id: entsData[0].id }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setForm((prev) => ({ ...prev, start_month: currentMonth }));
    loadData(currentMonth);
  }, [currentMonth]);

  const handleToggleStatus = async (entry) => {
    const nextStatus = entry.status === "paid" ? "pending" : "paid";
    await api.updateEntry(entry.id, { status: nextStatus });
    await loadData(currentMonth);
  };

  const handlePayAllEntity = async (entityId) => {
    await api.payAllEntity(currentMonth, entityId);
    await loadData(currentMonth);
  };

  const handleSaveIncome = async (e) => {
    e.preventDefault();
    await api.upsertIncome({
      reference_month: currentMonth,
      amount: Number(incomeInput.replace(",", ".")),
    });
    setEditingIncome(false);
    await loadData(currentMonth);
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const payload = {
      entity_id: Number(form.entity_id),
      description: form.description.trim(),
      amount: Number(String(form.amount).replace(",", ".")),
      expense_type: form.expense_type,
      total_installments:
        form.expense_type === "installment" ? Number(form.total_installments) : 1,
      start_installment:
        form.expense_type === "installment" ? Number(form.start_installment) : 1,
      start_month: form.start_month,
    };
    await api.createExpense(payload);
    setShowExpenseModal(false);
    setForm((prev) => ({
      ...prev,
      description: "",
      amount: "",
      expense_type: "single",
      total_installments: 1,
      start_installment: 1,
    }));
    await loadData(currentMonth);
  };

  const handleCreateEntity = async (e) => {
    e.preventDefault();
    if (!newEntity.name.trim()) return;
    const created = await api.createEntity(newEntity);
    setNewEntity({ name: "", color: "#3B82F6" });
    setShowEntityModal(false);
    setForm((prev) => ({ ...prev, entity_id: created.id }));
    await loadData(currentMonth);
  };

  const handleSeed = async () => {
    await api.seedSheet(currentMonth);
    await loadData(currentMonth);
  };

  const filteredEntries = useMemo(() => {
    if (!dashboard?.entries) return [];
    if (selectedEntity === "all") return dashboard.entries;
    return dashboard.entries.filter((e) => e.entity.id === Number(selectedEntity));
  }, [dashboard, selectedEntity]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Topbar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Finanças
            </h1>
            <p className="text-xs text-slate-500">Controle mensal & prestações</p>
          </div>

          {/* Seletor de Mês */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setCurrentMonth((m) => shiftMonth(m, -1))}
              className="p-1.5 rounded-lg hover:bg-white transition"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-sm font-semibold min-w-[125px] text-center">
              {formatMonthLabel(currentMonth)}
            </span>
            <button
              onClick={() => setCurrentMonth((m) => shiftMonth(m, 1))}
              className="p-1.5 rounded-lg hover:bg-white transition"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEntityModal(true)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              title="Nova Pessoa / Categoria"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Lançar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error} — verifique se o backend está rodando em `http://127.0.0.1:8000` e se a URL do Supabase está correta.
          </div>
        )}

        {/* Cards de KPI */}
        {dashboard && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Ganhos */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>GANHOS</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              {editingIncome ? (
                <form onSubmit={handleSaveIncome} className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={incomeInput}
                    onChange={(e) => setIncomeInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-semibold"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-medium"
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
                    onClick={() => setEditingIncome(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1.5">
                Pago: {formatBRL(dashboard.total_paid)} • Pendente: {formatBRL(dashboard.total_pending)}
              </p>
            </div>

            {/* Total */}
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
                  style={{ width: `${Math.min(dashboard.commitment_percentage, 100)}%` }}
                />
              </div>
            </div>

            {/* Restante */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>RESTANTE</span>
                <PiggyBank className="w-4 h-4 text-blue-600" />
              </div>
              <p
                className={`text-2xl font-bold ${
                  Number(dashboard.remaining) >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatBRL(dashboard.remaining)}
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                {Number(dashboard.remaining) >= 0
                  ? "Margem disponível no mês"
                  : "Despesas acima dos ganhos"}
              </p>
            </div>
          </section>
        )}

        {/* Gráficos (Rosca por Pessoa/Categoria + Projeção 6 meses) */}
        {dashboard && dashboard.entries.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rosca */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">
                Por Pessoa / Categoria
              </h2>
              <div className="flex items-center gap-4">
                <div className="w-36 h-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboard.by_entity}
                        dataKey="total_amount"
                        nameKey="entity_name"
                        innerRadius={36}
                        outerRadius={60}
                        paddingAngle={3}
                      >
                        {dashboard.by_entity.map((item) => (
                          <Cell key={item.entity_id} fill={item.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(v) => formatBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {dashboard.by_entity.map((item) => (
                    <div
                      key={item.entity_id}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-slate-700">
                          {item.entity_name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-900">
                          {formatBRL(item.total_amount)}
                        </span>
                        <span className="text-slate-400 ml-1.5">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Projeção Próximos 6 Meses */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">
                Projeção dos Próximos Meses
              </h2>
              <div className="w-full h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.next_6_months}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={55} />
                    <RechartsTooltip formatter={(v) => formatBRL(v)} />
                    <Bar dataKey="total_amount" fill="#0f172a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* Filtro por Pessoa + Ação Rápida de Quitar */}
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

          {/* Lista de Lançamentos */}
          {loading ? (
            <p className="text-sm text-slate-400 py-8 text-center">Carregando...</p>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-slate-500">
                Nenhum lançamento registrado neste mês.
              </p>
              <button
                onClick={handleSeed}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl transition cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                Importar dados da planilha atual
              </button>
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
                        title={isPaid ? "Marcar como pendente" : "Marcar como pago"}
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
                              isPaid ? "line-through text-slate-400" : "text-slate-900"
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

                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold ${
                          isPaid ? "text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {formatBRL(entry.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modal Novo Lançamento */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Novo Lançamento</h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Pessoa / Categoria
                </label>
                <select
                  value={form.entity_id}
                  onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  required
                >
                  {entities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  placeholder="Ex: AirBnB Novo, Academia..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Valor da prestação (R$)
                  </label>
                  <input
                    type="text"
                    placeholder="58.35"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Condição
                  </label>
                  <select
                    value={form.expense_type}
                    onChange={(e) => setForm({ ...form, expense_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="single">À vista / Único</option>
                    <option value="installment">Parcelado (ex: 2/6)</option>
                    <option value="recurring">Fixo mensal</option>
                  </select>
                </div>
              </div>

              {form.expense_type === "installment" && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Parcela atual
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.start_installment}
                      onChange={(e) =>
                        setForm({ ...form, start_installment: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Total de parcelas
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.total_installments}
                      onChange={(e) =>
                        setForm({ ...form, total_installments: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Mês inicial (YYYY-MM)
                </label>
                <input
                  type="text"
                  value={form.start_month}
                  onChange={(e) => setForm({ ...form, start_month: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Salvar lançamento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Pessoa / Categoria */}
      {showEntityModal && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Nova Pessoa / Categoria</h3>
              <button
                onClick={() => setShowEntityModal(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Fechar
              </button>
            </div>
            <form onSubmit={handleCreateEntity} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carol, Mamãe, Mercado..."
                  value={newEntity.name}
                  onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cor de identificação
                </label>
                <input
                  type="color"
                  value={newEntity.color}
                  onChange={(e) => setNewEntity({ ...newEntity, color: e.target.value })}
                  className="w-14 h-9 rounded cursor-pointer"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Adicionar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}