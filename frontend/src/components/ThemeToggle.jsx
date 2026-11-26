import { useTheme } from "../hooks/useTheme";
import { TabbyCat, TuxedoCat } from "./CatIcons";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const base =
    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer";
  const active = "bg-white text-slate-900 shadow-2xs";
  const idle = "text-slate-500 hover:text-slate-800";

  return (
    <div
      className="flex items-center bg-slate-100 rounded-xl p-1 gap-1"
      role="group"
      aria-label="Tema"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        title="Tema claro (gato rajado)"
        className={`${base} ${theme === "light" ? active : idle}`}
      >
        <TabbyCat className="w-5 h-5" />
        <span>Claro</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        title="Tema escuro (gato frajola)"
        className={`${base} ${theme === "dark" ? active : idle}`}
      >
        <TuxedoCat className="w-5 h-5" />
        <span>Escuro</span>
      </button>
    </div>
  );
}