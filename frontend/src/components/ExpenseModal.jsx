import { useEffect, useState } from "react";
import { parseMoney } from "../utils/format";

export default function ExpenseModal({
  open,
  mode = "expense", // "expense" | "receivable"
  entities,
  defaultEntityId,
  defaultMonth,
  onClose,
  onOpenEntityModal,
  onSubmitExpense,
  onSubmitReceivable,
}) {
  const isReceivable = mode === "receivable";

  const [form, setForm] = useState({
    entity_id: "",
    description: "",
    amount: "",
    expense_type: "single",
    total_installments: 2,
    start_installment: 1,
    start_month: defaultMonth,
  });

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        entity_id: entities.some((e) => String(e.id) === String(prev.entity_id))
          ? prev.entity_id
          : (defaultEntityId ?? entities[0]?.id ?? ""),
        start_month: defaultMonth,
      }));
    }
  }, [open, entities, defaultEntityId, defaultMonth]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.entity_id) return;

    const amountNum = parseMoney(form.amount);
    const isInstallment = isReceivable
      ? form.expense_type === "installment"
      : form.expense_type === "installment";

    if (isReceivable) {
      await onSubmitReceivable({
        entity_id: Number(form.entity_id),
        description: form.description.trim(),
        amount: amountNum,
        total_installments: isInstallment ? Number(form.total_installments) : 1,
        start_installment: isInstallment ? Number(form.start_installment) : 1,
        start_month: form.start_month,
      });
    } else {
      await onSubmitExpense({
        entity_id: Number(form.entity_id),
        description: form.description.trim(),
        amount: amountNum,
        expense_type: form.expense_type,
        total_installments: isInstallment ? Number(form.total_installments) : 1,
        start_installment: isInstallment ? Number(form.start_installment) : 1,
        start_month: form.start_month,
      });
    }

    setForm((prev) => ({
      ...prev,
      description: "",
      amount: "",
      expense_type: "single",
      total_installments: 2,
      start_installment: 1,
    }));
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {isReceivable ? "Novo Valor a Receber" : "Novo Lançamento"}
          </h3>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600">
                {isReceivable ? "De quem vai receber?" : "Pessoa / Categoria"}
              </label>
              <button
                type="button"
                onClick={onOpenEntityModal}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                + Cadastrar nova
              </button>
            </div>
            <select
              value={form.entity_id}
              onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
              required
            >
              <option value="" disabled>
                {entities.length === 0
                  ? "Nenhuma pessoa cadastrada ainda"
                  : "Selecione..."}
              </option>
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
              placeholder={
                isReceivable
                  ? "Ex: Empréstimo, Rachadinha jantar..."
                  : "Ex: AirBnB Novo, Academia..."
              }
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
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
                onChange={(e) =>
                  setForm({ ...form, expense_type: e.target.value })
                }
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="single">À vista / Único</option>
                <option value="installment">Parcelado (ex: 2/6)</option>
                {!isReceivable && <option value="recurring">Fixo mensal</option>}
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
                  min={isReceivable ? 2 : 1}
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
              onChange={(e) =>
                setForm({ ...form, start_month: e.target.value })
              }
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
          >
            {isReceivable ? "Salvar cobrança" : "Salvar lançamento"}
          </button>
        </form>
      </div>
    </div>
  );
}