import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { parseMoney } from "../utils/format";

export default function EditExpenseModal({
  entry,
  onClose,
  onSave,
  onDeleteCurrent,
  onDeleteAll,
}) {
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    status: "pending",
    applyFuture: false,
  });

  useEffect(() => {
    if (entry) {
      setEditForm({
        description: entry.description,
        amount: String(entry.amount),
        status: entry.status,
        applyFuture: Boolean(entry.installment_label),
      });
    }
  }, [entry]);

  if (!entry) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(
      entry.id,
      {
        description: editForm.description.trim(),
        amount: parseMoney(editForm.amount),
        status: editForm.status,
      },
      editForm.applyFuture
    );
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Editar Lançamento</h3>
            {entry.installment_label && (
              <p className="text-xs text-slate-400">
                Parcela {entry.installment_label} • {entry.reference_month}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
                Status
              </label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value })
                }
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
              </select>
            </div>
          </div>

          {entry.installment_label && (
            <label className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.applyFuture}
                onChange={(e) =>
                  setEditForm({ ...editForm, applyFuture: e.target.checked })
                }
                className="rounded border-slate-300"
              />
              <span>Aplicar a este mês e às parcelas/meses seguintes</span>
            </label>
          )}

          <button
            type="submit"
            className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
          >
            Salvar alterações
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onDeleteCurrent(entry.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {entry.installment_label
                ? "Excluir só este mês"
                : "Excluir lançamento"}
            </span>
          </button>

          {entry.installment_label && (
            <button
              type="button"
              onClick={() => onDeleteAll(entry.expense_id)}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir todas as parcelas</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}