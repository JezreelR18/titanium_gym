import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceService } from "../../services/attendanceService";
import { memberService } from "../../services/memberService";
import { Search, CheckCircle2, LogIn, LogOut, Clock, Users, Calendar, TrendingUp, X } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

const METHOD_LABELS = { manual: "Manual", qr_code: "QR", card: "Tarjeta" };

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function duration(inIso, outIso) {
  if (!outIso) return null;
  const mins = Math.round((new Date(outIso) - new Date(inIso)) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

// ── Check-in tab ───────────────────────────────────────────────
function CheckInTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [method, setMethod] = useState("manual");

  const { data: searchData } = useQuery({
    queryKey: ["member-search-att", search],
    queryFn: () => memberService.getAll({ search, limit: 8 }),
    enabled: search.trim().length > 1,
  });

  // Update results when searchData changes
  if (searchData?.data && searchData.data !== results && !selected) {
    setResults(searchData.data);
  }

  const mutation = useMutation({
    mutationFn: () => attendanceService.checkIn({ member_id: selected.id, method }),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-stats"] });
      toast.success(`Check-in registrado: ${record.member?.first_name} ${record.member?.last_name}`);
      setSelected(null);
      setSearch("");
      setResults([]);
    },
    onError: (err) => {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Error al registrar");
    },
  });

  function selectMember(m) {
    setSelected(m);
    setSearch("");
    setResults([]);
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <LogIn size={18} className="text-brand-600" /> Registrar entrada
        </h2>

        {selected ? (
          <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 flex items-center justify-between mb-5">
            <div>
              <p className="font-semibold text-brand-900">{selected.first_name} {selected.last_name}</p>
              <p className="text-xs font-mono text-brand-600 mt-0.5">{selected.member_code}</p>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-brand-100 rounded-lg text-brand-500">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="mb-5">
            <label className="label">Buscar miembro</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o código..."
                className="input pl-9"
              />
            </div>
            {results.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 shadow-sm">
                {results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMember(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                      <p className="text-xs font-mono text-brand-600">{m.member_code}</p>
                    </div>
                    <span className={clsx(
                      "text-xs px-2 py-0.5 rounded-full",
                      m.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    )}>
                      {m.status === "active" ? "Activo" : m.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-5">
          <label className="label">Método</label>
          <div className="flex gap-2">
            {Object.entries(METHOD_LABELS).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setMethod(val)}
                className={clsx(
                  "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                  method === val
                    ? "bg-brand-600 text-white border-brand-600"
                    : "border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600"
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => { if (!selected) { toast.error("Selecciona un miembro"); return; } mutation.mutate(); }}
          disabled={mutation.isPending || !selected}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={18} />
          {mutation.isPending ? "Registrando..." : "Registrar check-in"}
        </button>
      </div>
    </div>
  );
}

// ── Today tab ──────────────────────────────────────────────────
function TodayTab() {
  const queryClient = useQueryClient();
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: attendanceService.getToday,
    refetchInterval: 30000,
  });

  const checkOutMutation = useMutation({
    mutationFn: (id) => attendanceService.checkOut(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-stats"] });
      toast.success("Check-out registrado");
    },
    onError: () => toast.error("Error al registrar salida"),
  });

  if (isLoading) return <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>;

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users size={48} className="text-gray-200 mb-3" />
        <p className="text-sm text-gray-500">Nadie ha entrado hoy todavía.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{records.length} visita{records.length !== 1 ? "s" : ""} hoy</p>
      <div className="space-y-2">
        {records.map((r) => (
          <div key={r.id} className="card flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                {r.member?.first_name?.[0]}{r.member?.last_name?.[0]}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{r.member?.first_name} {r.member?.last_name}</p>
                <p className="text-xs font-mono text-gray-400">{r.member?.member_code}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <LogIn size={13} className="text-green-500" /> {fmtTime(r.checked_in_at)}
              </span>
              {r.checked_out_at ? (
                <span className="flex items-center gap-1">
                  <LogOut size={13} className="text-gray-400" /> {fmtTime(r.checked_out_at)}
                  <span className="ml-1 text-gray-400">({duration(r.checked_in_at, r.checked_out_at)})</span>
                </span>
              ) : (
                <button
                  onClick={() => checkOutMutation.mutate(r.id)}
                  disabled={checkOutMutation.isPending}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-brand-300 hover:text-brand-600 transition-colors"
                >
                  <LogOut size={13} /> Salida
                </button>
              )}
              <span className="hidden sm:inline px-2 py-0.5 bg-gray-100 rounded-full">
                {METHOD_LABELS[r.method] ?? r.method}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────
function HistoryTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-history", dateFrom, dateTo, page],
    queryFn: () => attendanceService.getHistory({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      limit: 20,
    }),
  });

  const records = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div>
          <label className="label">Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="input" />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="input" />
        </div>
        {(dateFrom || dateTo) && (
          <div className="flex items-end">
            <button onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }} className="btn-secondary text-sm">
              Limpiar filtros
            </button>
          </div>
        )}
        <div className="flex items-end ml-auto">
          <p className="text-sm text-gray-500">{total} registro{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay registros en el período seleccionado.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="card flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                    {r.member?.first_name?.[0]}{r.member?.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{r.member?.first_name} {r.member?.last_name}</p>
                    <p className="text-xs font-mono text-gray-400">{r.member?.member_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap justify-end">
                  <span className="text-gray-700 font-medium">{fmtDate(r.checked_in_at)}</span>
                  <span className="flex items-center gap-1">
                    <LogIn size={13} className="text-green-500" /> {fmtTime(r.checked_in_at)}
                  </span>
                  {r.checked_out_at && (
                    <span className="flex items-center gap-1">
                      <LogOut size={13} className="text-gray-400" /> {fmtTime(r.checked_out_at)}
                      <span className="ml-1">({duration(r.checked_in_at, r.checked_out_at)})</span>
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full hidden sm:inline">
                    {METHOD_LABELS[r.method] ?? r.method}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm disabled:opacity-40">
                ← Anterior
              </button>
              <span className="text-sm text-gray-500">Página {page} de {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="btn-secondary text-sm disabled:opacity-40">
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Stats tab ──────────────────────────────────────────────────
function StatsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["attendance-stats"],
    queryFn: attendanceService.getStats,
  });

  if (isLoading) return <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>;
  if (!stats) return null;

  const maxDay = Math.max(...(stats.daily_last_7.map((d) => d.count) || [1]), 1);
  const maxHour = Math.max(...(stats.peak_hours.map((h) => h.count) || [1]), 1);

  const dayLabels = { "0": "Dom", "1": "Lun", "2": "Mar", "3": "Mié", "4": "Jue", "5": "Vie", "6": "Sáb" };

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Hoy", value: stats.today, icon: Clock, color: "text-brand-600 bg-brand-50" },
          { label: "Esta semana", value: stats.this_week, icon: Calendar, color: "text-green-600 bg-green-50" },
          { label: "Este mes", value: stats.this_month, icon: TrendingUp, color: "text-purple-600 bg-purple-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card text-center">
            <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2", color)}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Daily bar chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Visitas — últimos 7 días</h3>
        {stats.daily_last_7.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin datos aún</p>
        ) : (
          <div className="flex items-end gap-2 h-28">
            {stats.daily_last_7.map((d) => {
              const dt = new Date(d.date + "T12:00:00");
              const dayIdx = dt.getDay();
              const pct = d.count / maxDay;
              return (
                <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xs text-gray-500 font-medium">{d.count}</span>
                  <div
                    className="w-full bg-brand-500 rounded-t-md transition-all"
                    style={{ height: `${Math.max(pct * 80, 4)}px` }}
                  />
                  <span className="text-xs text-gray-400">{dayLabels[String(dayIdx)]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Peak hours */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Horas pico — últimos 30 días</h3>
        {stats.peak_hours.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin datos aún</p>
        ) : (
          <div className="flex items-end gap-1 h-28">
            {Array.from({ length: 24 }, (_, h) => {
              const found = stats.peak_hours.find((x) => x.hour === h);
              const count = found?.count ?? 0;
              const pct = count / maxHour;
              return (
                <div key={h} className="flex flex-col items-center gap-1 flex-1" title={`${h}:00 — ${count} visitas`}>
                  <div
                    className={clsx("w-full rounded-t-sm transition-all", count > 0 ? "bg-brand-400" : "bg-gray-100")}
                    style={{ height: `${Math.max(pct * 80, count > 0 ? 4 : 2)}px` }}
                  />
                  {h % 4 === 0 && <span className="text-xs text-gray-400">{h}h</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function AttendancePage() {
  const [tab, setTab] = useState("checkin");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asistencia</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control de entradas y salidas</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "checkin",  label: "Check-in" },
          { key: "today",    label: "Hoy" },
          { key: "history",  label: "Historial" },
          { key: "stats",    label: "Estadísticas" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {label}
          </button>
        ))}
      </div>

      <div className={clsx(tab !== "checkin" && "card")}>
        {tab === "checkin" && <CheckInTab />}
        {tab === "today"   && <TodayTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "stats"   && <StatsTab />}
      </div>
    </div>
  );
}
