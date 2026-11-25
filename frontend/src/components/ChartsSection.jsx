import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatBRL } from "../utils/format";

export default function ChartsSection({ dashboard }) {
  const entityChartData = useMemo(() => {
    if (!dashboard?.by_entity) return [];
    return dashboard.by_entity.map((item) => ({
      ...item,
      total_num: Number(item.total_amount || 0),
      pago_num: Number(item.paid_amount || 0),
      pendente_num: Number(item.pending_amount || 0),
    }));
  }, [dashboard]);

  const projectionChartData = useMemo(() => {
    if (!dashboard?.next_6_months) return [];
    return dashboard.next_6_months.map((item) => ({
      month: item.month,
      total_mensal: Number(item.total_amount || 0),
    }));
  }, [dashboard]);

  if (!dashboard || dashboard.entries.length === 0) return null;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            Por Pessoa / Categoria
          </h2>
          <span className="text-xs text-slate-400">Somatório no mês</span>
        </div>

        <div className="w-full h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={entityChartData}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#f1f5f9"
              />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="entity_name"
                width={82}
                tick={{ fontSize: 11 }}
              />
              <RechartsTooltip
                formatter={(v) => formatBRL(v)}
                labelFormatter={(label) => `Pessoa/Categoria: ${label}`}
              />
              <Bar dataKey="total_num" name="Total" radius={[0, 6, 6, 0]}>
                {entityChartData.map((item) => (
                  <Cell key={item.entity_id} fill={item.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          {entityChartData.map((item) => (
            <div
              key={item.entity_id}
              className="flex items-center justify-between text-xs gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-slate-700 truncate">
                  {item.entity_name}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0">
                  (Pago {formatBRL(item.pago_num)} • Pend.{" "}
                  {formatBRL(item.pendente_num)})
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold text-slate-900">
                  {formatBRL(item.total_num)}
                </span>
                <span className="text-slate-400 ml-1">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Projeção dos Próximos Meses
          </h2>
          <span className="text-xs text-slate-400">6 meses</span>
        </div>
        <div className="w-full h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectionChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={58} />
              <RechartsTooltip
                formatter={(v) => formatBRL(v)}
                labelFormatter={(label) => `Mês: ${label}`}
              />
              <Bar
                dataKey="total_mensal"
                name="Total previsto"
                fill="#0f172a"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}