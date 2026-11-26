import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  HandCoins,
  Clock,
  CheckCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import { api } from "../services/api";
import { formatBRL, parseMoney } from "../utils/format";

export default function ReceivablesTab({
  currentMonth,
  receivables,
  entities,
  loading,
  onRefresh,
  onOpenNewModal,
}) {
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [editingEntry, setEditingEntry] = useState(null);
  const [actionError, setActionError] = useState("");
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    status: "pending",
    applyFuture: false,
  });

  // Se a pessoa filtrada for excluída, volta para "Todos".
  useEffect(() => {
    if (
      selectedEntity !== "all" &&
      !entities.some((e) => String(e.id) === selectedEntity)
    ) {
      setSelectedEntity("all");
    }
  }, [entities, selectedEntity]);

  const filteredEntries = useMemo(() => {
    if (!receivables?.entries) return [];
    if (selectedEntity === "all") return receivables.entries;
    return receivables.entries.filter(
      (e) => e.entity.id === Number(selectedEntity)
    );
  }, [receivables, selectedEntity]);

  const runReceivableAction = async (fn, closeModal = false) => {
    setActionError("");
    try {
      await fn();
      if (closeModal) setEditingEntry(null);
      await onRefresh(currentMonth);
    } catch (err) {
      setActionError(err.message || "Erro ao atualizar cobrança.");
    }
  };

  const handleToggleStatus = async (entry) => {
    const nextStatus = entry.status === "received" ? "pending" : "received";
    await runReceivableAction(() =>
      api.updateReceivableEntry(entry.id, { status: nextStatus }, false)
    );
  };

  const handleReceiveAllEntity = async (entityId) => {
    await runReceivableAction(() =>
      api.receiveAllEntity(currentMonth, entityId)
    );
  };

  const openEditModal = (entry) => {
    setActionError("");
    setEditingEntry(entry);
    setEditForm({
      description: entry.description,
      amount: String(entry.amount),
      status: entry.status,
      applyFuture: Boolean(entry.installment_label),
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingEntry) return;

    const amount = parseMoney(editForm.amount);
    if (amount <= 0) {
      setActionError("Informe um valor maior que zero.");
      return;
    }

    await runReceivableAction(
      () =>
        api.updateReceivableEntry(
          editingEntry.id,
          {
            description: editForm.description.trim(),
            amount,
            status: editForm.status,
          },
          editForm.applyFuture
        ),
      true
    );
  };

  const handleDeleteCurrent = async () => {
    if (!editingEntry) return;
    await runReceivableAction(
      () => api.deleteReceivableEntry(editingEntry.id),
      true
    );
  };

  const handleDeleteAll = async () => {
    if (!editingEntry) return;
    await runReceivableAction(
      () => api.deleteReceivable(editingEntry.receivable_id),
      true
    );
  };

  return (
    <div className="space-y-5">
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {actionError}
        </div>
      )}

      {/* KPIs de Cobranças */}
      {receivables && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>TOTAL A RECEBER</span>
              <HandCoins className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {formatBRL(receivables.total_receivable)}
            </p>
            <p className="text-xs text-slate-400 mt-1.5">
              Previsto para este mês
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>JÁ RECEBIDO</span>
              <CheckCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">
              {formatBRL(receivables.total_received)}
            </p>
            <p className="text-xs text-slate-400 mt-1.5">
              Valores já quitados
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
              <span>PENDENTE</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {formatBRL(receivables.total_pending)}
            </p>
            <p className="text-xs text-slate-400 mt-1.5">
              Ainda a aguardar pagamento
            </p>
          </div>
        </section>
      )}

      {/* Filtro por Pessoa + Lista */}
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

          {selectedEntity !== "all" && (
            <button
              type="button"
              onClick={() => handleReceiveAllEntity(Number(selectedEntity))}
              className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              Marcar tudo como recebido
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">A carregar...</p>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-slate-500">
              Nenhuma cobrança registada neste mês.
            </p>
            <button
              type="button"
              onClick={onOpenNewModal}
              className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
            >
              + Adicionar valor a receber
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEntries.map((entry) => {
              const isReceived = entry.status === "received";
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
                        isReceived
                          ? "Marcar como pendente"
                          : "Marcar como recebido"
                      }
                    >
                      {isReceived ? (
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
                            isReceived
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
                        isReceived ? "text-slate-400" : "text-emerald-700"
                      }`}
                    >
                      {formatBRL(entry.amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => openEditModal(entry)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      title="Editar ou excluir cobrança"
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

      {/* Modal Editar / Excluir Cobrança */}
      {editingEntry && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Editar Cobrança</h3>
                {editingEntry.installment_label && (
                  <p className="text-xs text-slate-400">
                    Parcela {editingEntry.installment_label} •{" "}
                    {editingEntry.reference_month}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    value={editForm.amount}
                    onChange={(e) =>
                      setEditForm({ ...editForm, amount: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Estado
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="pending">Pendente</option>
                    <option value="received">Recebido</option>
                  </select>
                </div>
              </div>

              {editingEntry.installment_label && (
                <label className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.applyFuture}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        applyFuture: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300"
                  />
                  <span>
                    Aplicar a este mês e às parcelas seguintes
                  </span>
                </label>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Guardar alterações
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDeleteCurrent}
                className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {editingEntry.installment_label
                    ? "Excluir só este mês"
                    : "Excluir cobrança"}
                </span>
              </button>

              {editingEntry.installment_label && (
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir todas as parcelas</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}