import { useState } from "react";

export default function EntityModal({ open, onClose, onCreate }) {
  const [newEntity, setNewEntity] = useState({ name: "", color: "#3B82F6" });

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEntity.name.trim()) return;
    await onCreate({
      name: newEntity.name.trim(),
      color: newEntity.color,
    });
    setNewEntity({ name: "", color: "#3B82F6" });
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Nova Pessoa / Categoria</h3>
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
              Nome
            </label>
            <input
              type="text"
              placeholder="Ex: Carol, Mamãe, Mercado..."
              value={newEntity.name}
              onChange={(e) =>
                setNewEntity({ ...newEntity, name: e.target.value })
              }
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
              onChange={(e) =>
                setNewEntity({ ...newEntity, color: e.target.value })
              }
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
  );
}