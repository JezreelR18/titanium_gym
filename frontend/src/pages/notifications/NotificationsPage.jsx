import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { notificationService } from "../../services/notificationService";
import { memberService } from "../../services/memberService";
import {
  Bell, AlertTriangle, CheckCircle2, Info, CreditCard, Cake,
  Lock, Plus, X, Pencil, Trash2, Check, Search, RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

function extractError(err) {
  const d = err?.response?.data?.detail;
  if (!d) return "Ocurrió un error";
  return Array.isArray(d) ? d.map((e) => e.msg).join("; ") : d;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPE_ICON = {
  membership_expiry: CreditCard,
  membership_expired: CreditCard,
  birthday: Cake,
  locker_expiry: Lock,
  payment_due: AlertTriangle,
  custom: Bell,
  class_reminder: Bell,
};

const SEVERITY_CONFIG = {
  critical: { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    icon: "text-red-500",    badge: "bg-red-100 text-red-700"    },
  warning:  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: "text-orange-500", badge: "bg-orange-100 text-orange-700" },
  info:     { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   icon: "text-blue-500",   badge: "bg-blue-100 text-blue-700"    },
};

const CHANNEL_LABEL = { in_app: "En app", email: "Email", whatsapp: "WhatsApp", sms: "SMS" };
const TYPE_LABEL = {
  membership_expiry: "Membresía por vencer",
  membership_expired: "Membresía vencida",
  birthday: "Cumpleaños",
  locker_expiry: "Casillero por vencer",
  payment_due: "Pago pendiente",
  custom: "Personalizado",
  class_reminder: "Recordatorio de clase",
};

// ── Reminder Modal ─────────────────────────────────────────────
function ReminderModal({ mode, reminder, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(
    reminder?.member ? { id: reminder.member.id, first_name: reminder.member.first_name, last_name: reminder.member.last_name, member_code: reminder.member.member_code } : null
  );
  const [results, setResults] = useState([]);

  const { data: searchData } = useQuery({
    queryKey: ["member-search-notif", search],
    queryFn: () => memberService.getAll({ search, limit: 8 }),
    enabled: search.trim().length > 1,
  });
  if (searchData?.data && !selected && JSON.stringify(searchData.data) !== JSON.stringify(results)) {
    setResults(searchData.data);
  }

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      type: reminder?.type ?? "custom",
      title: reminder?.title ?? "",
      message: reminder?.message ?? "",
      trigger_date: reminder?.trigger_date
        ? new Date(reminder.trigger_date).toISOString().slice(0, 16)
        : new Date(Date.now() + 3600000).toISOString().slice(0, 16),
      channel: reminder?.channel ?? "in_app",
      note: reminder?.note ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (raw) => {
      const data = {
        type: raw.type,
        title: raw.title,
        message: raw.message,
        trigger_date: new Date(raw.trigger_date).toISOString(),
        channel: raw.channel,
        note: raw.note || null,
        member_id: selected?.id ?? null,
      };
      return mode === "create"
        ? notificationService.createReminder(data)
        : notificationService.updateReminder(reminder.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success(mode === "create" ? "Recordatorio creado" : "Recordatorio actualizado");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{mode === "create" ? "Nuevo recordatorio" : "Editar recordatorio"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">

          {/* Member (optional) */}
          <div>
            <label className="label">Miembro (opcional)</label>
            {selected ? (
              <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-sm text-brand-900">{selected.first_name} {selected.last_name}</p>
                  <p className="text-xs font-mono text-brand-600">{selected.member_code}</p>
                </div>
                <button type="button" onClick={() => { setSelected(null); setSearch(""); }}
                  className="text-xs text-gray-400 hover:text-red-500">Quitar</button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    className="input pl-9" placeholder="Buscar miembro..." />
                </div>
                {results.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {results.map((m) => (
                      <button key={m.id} type="button"
                        onClick={() => { setSelected(m); setSearch(""); setResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                        <p className="font-medium">{m.first_name} {m.last_name}</p>
                        <p className="text-xs font-mono text-brand-600">{m.member_code}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo</label>
              <select {...register("type")} className="input">
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Canal</label>
              <select {...register("channel")} className="input">
                {Object.entries(CHANNEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Título *</label>
            <input {...register("title", { required: "Requerido" })} className="input" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label">Mensaje *</label>
            <textarea {...register("message", { required: "Requerido" })} rows={3} className="input resize-none" />
            {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message.message}</p>}
          </div>

          <div>
            <label className="label">Fecha y hora *</label>
            <input type="datetime-local" {...register("trigger_date", { required: "Requerido" })} className="input" />
          </div>

          <div>
            <label className="label">Nota interna</label>
            <input {...register("note")} className="input" placeholder="Opcional..." />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : mode === "create" ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Alert card ─────────────────────────────────────────────────
function AlertCard({ alert }) {
  const cfg = SEVERITY_CONFIG[alert.severity];
  const Icon = TYPE_ICON[alert.type] ?? Bell;
  return (
    <div className={clsx("border rounded-xl p-3 flex items-start gap-3", cfg.bg, cfg.border)}>
      <div className={clsx("mt-0.5 shrink-0", cfg.icon)}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-gray-900">{alert.title}</p>
          {alert.member && (
            <span className="text-xs font-mono text-gray-400">{alert.member.member_code}</span>
          )}
        </div>
        <p className={clsx("text-sm mt-0.5", cfg.text)}>{alert.message}</p>
      </div>
    </div>
  );
}

// ── Alerts Tab ─────────────────────────────────────────────────
function AlertsTab() {
  const { data: alerts, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["alerts"],
    queryFn: notificationService.getAlerts,
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="text-center py-16 text-gray-400 text-sm">Cargando alertas...</div>;

  const total = alerts?.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          {total === 0 ? "Todo en orden — no hay alertas activas." : `${total} alerta${total !== 1 ? "s" : ""} activa${total !== 1 ? "s" : ""}`}
        </p>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 transition-colors">
          <RefreshCw size={13} className={clsx(isFetching && "animate-spin")} /> Actualizar
        </button>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 size={48} className="text-green-300 mb-3" />
          <p className="text-sm text-gray-500 font-medium">¡Todo al día!</p>
          <p className="text-xs text-gray-400 mt-1">No hay membresías por vencer, casilleros ni cumpleaños próximos.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {alerts.critical.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-red-500" />
                <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide">
                  Crítico ({alerts.critical.length})
                </h3>
              </div>
              <div className="space-y-2">
                {alerts.critical.map((a, i) => <AlertCard key={i} alert={a} />)}
              </div>
            </div>
          )}
          {alerts.warning.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-orange-500" />
                <h3 className="text-sm font-bold text-orange-700 uppercase tracking-wide">
                  Atención ({alerts.warning.length})
                </h3>
              </div>
              <div className="space-y-2">
                {alerts.warning.map((a, i) => <AlertCard key={i} alert={a} />)}
              </div>
            </div>
          )}
          {alerts.info.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Info size={15} className="text-blue-500" />
                <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">
                  Información ({alerts.info.length})
                </h3>
              </div>
              <div className="space-y-2">
                {alerts.info.map((a, i) => <AlertCard key={i} alert={a} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reminders Tab ──────────────────────────────────────────────
function RemindersTab() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [includeSent, setIncludeSent] = useState(false);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["reminders", includeSent],
    queryFn: () => notificationService.getReminders({ include_sent: includeSent }),
  });

  const markSentMutation = useMutation({
    mutationFn: (id) => notificationService.markSent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["alert-count"] });
      toast.success("Marcado como enviado");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => notificationService.deleteReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Recordatorio eliminado");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const now = new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={includeSent} onChange={(e) => setIncludeSent(e.target.checked)}
            className="w-4 h-4 accent-brand-600" />
          Mostrar ya enviados
        </label>
        <button onClick={() => setModal({ mode: "create" })} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo recordatorio
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay recordatorios pendientes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => {
            const isPast = new Date(r.trigger_date) < now;
            const Icon = TYPE_ICON[r.type] ?? Bell;
            return (
              <div key={r.id}
                className={clsx("card flex items-start gap-4", r.is_sent && "opacity-60")}>
                <div className={clsx(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  r.is_sent ? "bg-gray-100" : isPast ? "bg-orange-100" : "bg-brand-100"
                )}>
                  <Icon size={16} className={r.is_sent ? "text-gray-400" : isPast ? "text-orange-500" : "text-brand-600"} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {TYPE_LABEL[r.type] ?? r.type}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {CHANNEL_LABEL[r.channel]}
                    </span>
                    {r.is_sent && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Enviado</span>}
                    {!r.is_sent && isPast && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Vencido</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{r.message}</p>
                  {r.member && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      👤 {r.member.first_name} {r.member.last_name}
                      <span className="font-mono ml-1">{r.member.member_code}</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    🕐 {fmtDateTime(r.trigger_date)}
                    {r.sent_at && ` · Enviado: ${fmtDateTime(r.sent_at)}`}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!r.is_sent && (
                    <button onClick={() => markSentMutation.mutate(r.id)}
                      title="Marcar como enviado/atendido"
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      <Check size={16} />
                    </button>
                  )}
                  <button onClick={() => setModal({ mode: "edit", reminder: r })}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => { if (confirm("¿Eliminar recordatorio?")) deleteMutation.mutate(r.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <ReminderModal mode={modal.mode} reminder={modal.reminder} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Log Tab ────────────────────────────────────────────────────
function LogTab() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["notification-log"],
    queryFn: () => notificationService.getLog(100),
  });

  const STATUS_COLOR = {
    sent: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-600",
    cancelled: "bg-gray-100 text-gray-500",
  };
  const STATUS_LABEL = { sent: "Enviado", pending: "Pendiente", failed: "Fallido", cancelled: "Cancelado" };

  if (isLoading) return <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>;

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Bell size={48} className="text-gray-200 mb-3" />
        <p className="text-sm text-gray-500">El historial está vacío.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="card flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <Bell size={14} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm text-gray-900">{log.title}</p>
              <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[log.status])}>
                {STATUS_LABEL[log.status]}
              </span>
              <span className="text-xs text-gray-400">{CHANNEL_LABEL[log.channel]}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{log.message}</p>
            {log.member && (
              <p className="text-xs text-gray-400 mt-0.5">
                👤 {log.member.first_name} {log.member.last_name}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(log.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function NotificationsPage() {
  const [tab, setTab] = useState("alerts");

  const { data: countData } = useQuery({
    queryKey: ["alert-count"],
    queryFn: notificationService.getAlertCount,
    refetchInterval: 120000,
  });
  const alertCount = countData?.count ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Alertas automáticas y recordatorios del sistema</p>
        </div>
        {alertCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 font-medium">
            <AlertTriangle size={16} />
            {alertCount} alerta{alertCount !== 1 ? "s" : ""} activa{alertCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "alerts",    label: alertCount > 0 ? `Alertas (${alertCount})` : "Alertas" },
          { key: "reminders", label: "Recordatorios" },
          { key: "log",       label: "Historial" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "alerts"    && <AlertsTab />}
        {tab === "reminders" && <RemindersTab />}
        {tab === "log"       && <LogTab />}
      </div>
    </div>
  );
}
