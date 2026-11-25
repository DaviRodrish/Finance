export const formatBRL = (val) =>
  Number(val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const formatMonthLabel = (ym) => {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
};

export const parseMoney = (val) => Number(String(val || 0).replace(",", "."));