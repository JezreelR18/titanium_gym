import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import {
  Users, CreditCard, LogIn, TrendingUp, Lock,
  AlertTriangle, Cake, ShoppingCart,
} from "lucide-react";
import clsx from "clsx";

const fetchSummary = () => api.get("/dashboard/summary").then((r) => r.data);

function fmtMoney(val) {
  return Number(val).toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// ── Mini bar chart ─────────────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data || data.length === 0) return <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const DAY = { "0": "Dom", "1": "Lun", "2": "Mar", "3": "Mié", "4": "Jue", "5": "Vie", "6": "Sáb" };
  const todayStr = new Date().toLocaleDateString("sv-SE");
  return (
    <div className="flex items-end gap-1.5 h-16 mt-2">
      {data.map((d) => {
        const dt = new Date(d.date + "T12:00:00");
        const pct = d.count / max;
        const isToday = d.date === todayStr;
        return (
          <div key={d.date} className="flex flex-col items-center gap-1 flex-1" title={`${d.date}: ${d.count}`}>
            <span className="text-[10px] text-gray-400">{d.count || ""}</span>
            <div
              className={clsx("w-full rounded-t-sm", isToday ? "bg-brand-500" : "bg-gray-200")}
              style={{ height: `${Math.max(pct * 40, d.count > 0 ? 3 : 1)}px` }}
            />
            <span className="text-[10px] text-gray-400">{DAY[String(dt.getDay())]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────
function KpiCard({ icon: Icon, color, value, label, sublabel, onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx("card flex items-center gap-4", onClick && "cursor-pointer hover:shadow-md transition-shadow")}
    >
      <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchSummary,
    refetchInterval: 60000,
  });

  const todayStr = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Inicio</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">{todayStr}</p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Cargando...</div>
      ) : !data ? null : (
        <div className="space-y-6">

          {/* ── KPIs principales ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Users} color="bg-blue-50 text-blue-600"
              value={data.active_members}
              label="Miembros activos"
              sublabel={data.new_members_this_month > 0 ? `+${data.new_members_this_month} este mes` : "Sin nuevos este mes"}
              onClick={() => navigate("/members")}
            />
            <KpiCard
              icon={CreditCard}
              color={data.expiring_soon_count > 0 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}
              value={data.active_memberships}
              label="Membresías activas"
              sublabel={data.expiring_soon_count > 0
                ? `⚠ ${data.expiring_soon_count} vence${data.expiring_soon_count !== 1 ? "n" : ""} pronto`
                : "Al día"}
              onClick={() => navigate("/memberships")}
            />
            <KpiCard
              icon={LogIn} color="bg-purple-50 text-purple-600"
              value={data.checkins_today}
              label="Entradas hoy"
              sublabel={`${data.checkins_this_week} esta semana`}
              onClick={() => navigate("/attendance")}
            />
            <KpiCard
              icon={TrendingUp} color="bg-brand-50 text-brand-600"
              value={fmtMoney(data.revenue_this_month)}
              label="Ingresos del mes"
              sublabel={`${data.sales_this_month} venta${data.sales_this_month !== 1 ? "s" : ""}`}
              onClick={() => navigate("/sales")}
            />
          </div>

          {/* ── Fila media ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Gráfica entradas */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700">Entradas — últimos 7 días</h3>
              <MiniBarChart data={data.daily_checkins_last_7} />
            </div>

            {/* Membresías por vencer */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className={data.expiring_memberships.length > 0 ? "text-orange-500" : "text-gray-300"} />
                Por vencer en 7 días
              </h3>
              {data.expiring_memberships.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Ninguna por vencer</p>
              ) : (
                <div className="space-y-2">
                  {data.expiring_memberships.slice(0, 5).map((m) => (
                    <div key={String(m.member_id)} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-gray-400 truncate">{m.plan_name}</p>
                      </div>
                      <span className={clsx(
                        "shrink-0 text-xs font-bold px-2 py-0.5 rounded-full",
                        m.days_left === 0 ? "bg-red-100 text-red-700"
                          : m.days_left <= 3 ? "bg-orange-100 text-orange-700"
                          : "bg-yellow-100 text-yellow-700"
                      )}>
                        {m.days_left === 0 ? "Hoy" : `${m.days_left}d`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cumpleaños + casilleros */}
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Cake size={14} className={data.birthdays_this_week.length > 0 ? "text-pink-500" : "text-gray-300"} />
                  Cumpleaños esta semana
                </h3>
                {data.birthdays_this_week.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Sin cumpleaños esta semana</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.birthdays_this_week.map((b) => (
                      <div key={String(b.member_id)} className="flex items-center justify-between gap-2">
                        <p className="text-sm text-gray-800 truncate">
                          {b.days_until === 0 ? "🎂 " : ""}{b.first_name} {b.last_name}
                        </p>
                        <span className={clsx("text-xs shrink-0", b.days_until === 0 ? "font-bold text-pink-600" : "text-gray-400")}>
                          {b.days_until === 0 ? `¡Hoy! ${b.age} años` : `en ${b.days_until}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {data.active_lockers > 0 && (
                <div
                  className="card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate("/lockers")}
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Lock size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{data.active_lockers}</p>
                    <p className="text-sm text-gray-500">Casilleros rentados</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Actividad reciente ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Últimas entradas</h3>
                <button onClick={() => navigate("/attendance")}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver todo →</button>
              </div>
              {data.recent_checkins.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Sin entradas registradas</p>
              ) : (
                <div className="space-y-2.5">
                  {data.recent_checkins.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                          {c.first_name[0]}{c.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                          <p className="text-xs font-mono text-gray-400">{c.member_code}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{fmtTime(c.checked_in_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Últimas ventas</h3>
                <button onClick={() => navigate("/sales")}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver todo →</button>
              </div>
              {data.recent_sales.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Sin ventas registradas</p>
              ) : (
                <div className="space-y-2.5">
                  {data.recent_sales.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <ShoppingCart size={13} className="text-green-600" />
                        </div>
                        <p className="text-sm font-mono text-gray-700">{s.sale_number}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{fmtMoney(s.total_amount)}</p>
                        <p className="text-xs text-gray-400">{fmtDate(s.sale_date.slice(0, 10))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
