import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { classService } from "../../services/classService";
import { memberService } from "../../services/memberService";
import { userService } from "../../services/userService";
import {
  Plus, Pencil, X, Calendar, Users, Clock, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Search, Tag, Dumbbell,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

const STATUS_LABEL = { scheduled: "Programada", in_progress: "En curso", completed: "Completada", cancelled: "Cancelada" };
const STATUS_COLOR = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};
const ENROLL_COLOR = { enrolled: "bg-blue-50 text-blue-700", attended: "bg-green-100 text-green-700", absent: "bg-gray-100 text-gray-500", cancelled: "bg-red-50 text-red-500" };
const ENROLL_LABEL = { enrolled: "Inscrito", attended: "Asistió", absent: "Ausente", cancelled: "Cancelado" };

function extractError(err) {
  const d = err?.response?.data?.detail;
  if (!d) return "Ocurrió un error";
  if (Array.isArray(d)) return d.map((e) => e.msg).join("; ");
  return d;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

function ColorDot({ color }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full shrink-0"
      style={{ backgroundColor: color ?? "#6b7280" }}
    />
  );
}

// ── Category Modal ─────────────────────────────────────────────
function CategoryModal({ mode, category, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      color_hex: category?.color_hex ?? "#6366f1",
      is_active: category?.is_active ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (raw) => {
      const data = { name: raw.name, description: raw.description || null, color_hex: raw.color_hex || null };
      if (mode === "edit") data.is_active = raw.is_active === true || raw.is_active === "true";
      return mode === "create" ? classService.createCategory(data) : classService.updateCategory(category.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(mode === "create" ? "Categoría creada" : "Categoría actualizada");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{mode === "create" ? "Nueva categoría" : "Editar categoría"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...register("name", { required: "Requerido" })} className="input" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea {...register("description")} rows={2} className="input resize-none" />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex items-center gap-3">
              <input type="color" {...register("color_hex")} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
              <input {...register("color_hex")} className="input flex-1" placeholder="#6366f1" />
            </div>
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("is_active")} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-gray-700">Activa</span>
            </label>
          )}
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

// ── Class Modal ────────────────────────────────────────────────
function ClassModal({ mode, gymClass, categories, trainers, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: gymClass?.name ?? "",
      category_id: gymClass?.category?.id ?? "",
      trainer_id: gymClass?.trainer?.id ?? "",
      description: gymClass?.description ?? "",
      duration_minutes: gymClass?.duration_minutes ?? 60,
      max_capacity: gymClass?.max_capacity ?? "",
      room: gymClass?.room ?? "",
      note: gymClass?.note ?? "",
      is_active: gymClass?.is_active ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (raw) => {
      const data = {
        name: raw.name,
        category_id: raw.category_id || null,
        trainer_id: raw.trainer_id || null,
        description: raw.description || null,
        duration_minutes: Number(raw.duration_minutes),
        max_capacity: raw.max_capacity ? Number(raw.max_capacity) : null,
        room: raw.room || null,
        note: raw.note || null,
      };
      if (mode === "edit") data.is_active = raw.is_active === true || raw.is_active === "true";
      return mode === "create" ? classService.createClass(data) : classService.updateClass(gymClass.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(mode === "create" ? "Clase creada" : "Clase actualizada");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{mode === "create" ? "Nueva clase" : "Editar clase"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...register("name", { required: "Requerido" })} className="input" placeholder="Yoga, Spinning, CrossFit..." />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría</label>
              <select {...register("category_id")} className="input">
                <option value="">Sin categoría</option>
                {categories.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Entrenador</label>
              <select {...register("trainer_id")} className="input">
                <option value="">Sin asignar</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Duración (min) *</label>
              <input type="number" min="1" {...register("duration_minutes", { required: "Requerido" })} className="input" />
            </div>
            <div>
              <label className="label">Capacidad máx.</label>
              <input type="number" min="1" {...register("max_capacity")} className="input" placeholder="Sin límite" />
            </div>
            <div>
              <label className="label">Sala / Área</label>
              <input {...register("room")} className="input" placeholder="Sala A, Piscina..." />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea {...register("description")} rows={2} className="input resize-none" />
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("is_active")} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-gray-700">Clase activa</span>
            </label>
          )}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : mode === "create" ? "Crear clase" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Schedule Modal ─────────────────────────────────────────────
function ScheduleModal({ classes, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const mutation = useMutation({
    mutationFn: (raw) => classService.createSchedule({
      class_id: raw.class_id,
      scheduled_at: new Date(raw.scheduled_at).toISOString(),
      note: raw.note || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Horario creado");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Programar clase</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div>
            <label className="label">Clase *</label>
            <select {...register("class_id", { required: "Requerido" })} className="input">
              <option value="">Seleccionar...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.class_id && <p className="text-xs text-red-500 mt-1">{errors.class_id.message}</p>}
          </div>
          <div>
            <label className="label">Fecha y hora *</label>
            <input type="datetime-local" {...register("scheduled_at", { required: "Requerido" })} className="input" />
            {errors.scheduled_at && <p className="text-xs text-red-500 mt-1">{errors.scheduled_at.message}</p>}
          </div>
          <div>
            <label className="label">Nota</label>
            <input {...register("note")} className="input" placeholder="Opcional..." />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : "Programar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Enroll Modal ───────────────────────────────────────────────
function EnrollModal({ schedule, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);

  const { data: searchData } = useQuery({
    queryKey: ["member-search-class", search],
    queryFn: () => memberService.getAll({ search, limit: 8 }),
    enabled: search.trim().length > 1,
  });

  if (searchData?.data && !selected) {
    if (JSON.stringify(searchData.data) !== JSON.stringify(results)) setResults(searchData.data);
  }

  const mutation = useMutation({
    mutationFn: () => classService.enroll(schedule.id, { member_id: selected.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments", schedule.id] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(`${selected.first_name} inscrito`);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Inscribir miembro</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm">
            <p className="font-medium text-gray-800">{schedule.gym_class?.name}</p>
            <p className="text-xs text-gray-500">{fmtDateTime(schedule.scheduled_at)}</p>
          </div>

          {selected ? (
            <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
              <div>
                <p className="font-medium text-sm text-brand-900">{selected.first_name} {selected.last_name}</p>
                <p className="text-xs font-mono text-brand-600">{selected.member_code}</p>
              </div>
              <button onClick={() => { setSelected(null); setSearch(""); }} className="text-xs text-gray-400 hover:text-red-500">Cambiar</button>
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
                    <button key={m.id} type="button" onClick={() => { setSelected(m); setSearch(""); setResults([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                      <p className="font-medium">{m.first_name} {m.last_name}</p>
                      <p className="text-xs font-mono text-brand-600">{m.member_code}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={() => { if (!selected) { toast.error("Selecciona un miembro"); return; } mutation.mutate(); }}
              disabled={mutation.isPending || !selected} className="btn-primary">
              {mutation.isPending ? "Inscribiendo..." : "Inscribir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Detail (enrollments + attendance) ─────────────────
function ScheduleDetail({ schedule, onClose }) {
  const queryClient = useQueryClient();
  const [showEnroll, setShowEnroll] = useState(false);

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["enrollments", schedule.id],
    queryFn: () => classService.getEnrollments(schedule.id),
  });

  const attendMutation = useMutation({
    mutationFn: (id) => classService.markAttended(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments", schedule.id] });
      toast.success("Asistencia registrada");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const cancelEnrollMutation = useMutation({
    mutationFn: (id) => classService.cancelEnrollment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments", schedule.id] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Inscripción cancelada");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const cap = schedule.gym_class?.max_capacity;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{schedule.gym_class?.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{fmtDateTime(schedule.scheduled_at)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <Users size={15} />
              {schedule.enrolled_count}{cap ? `/${cap}` : ""} inscritos
            </span>
            {schedule.gym_class?.room && <span className="text-gray-400">📍 {schedule.gym_class.room}</span>}
            <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLOR[schedule.status])}>
              {STATUS_LABEL[schedule.status]}
            </span>
          </div>
          {schedule.status === "scheduled" && (
            <button onClick={() => setShowEnroll(true)}
              className="flex items-center gap-1.5 text-sm btn-primary py-1.5 px-3">
              <Plus size={15} /> Inscribir
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Cargando...</div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Nadie inscrito todavía.</div>
          ) : (
            <div className="space-y-2">
              {enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                      {e.member?.first_name?.[0]}{e.member?.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.member?.first_name} {e.member?.last_name}</p>
                      <p className="text-xs font-mono text-gray-400">{e.member?.member_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", ENROLL_COLOR[e.status])}>
                      {ENROLL_LABEL[e.status]}
                    </span>
                    {e.status === "enrolled" && (
                      <>
                        <button onClick={() => attendMutation.mutate(e.id)}
                          title="Marcar asistencia"
                          className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors">
                          <CheckCircle2 size={16} />
                        </button>
                        <button onClick={() => cancelEnrollMutation.mutate(e.id)}
                          title="Cancelar inscripción"
                          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                          <XCircle size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEnroll && <EnrollModal schedule={schedule} onClose={() => setShowEnroll(false)} />}
    </div>
  );
}

// ── Agenda Tab ─────────────────────────────────────────────────
function AgendaTab({ classes }) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [detail, setDetail] = useState(null);

  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["schedules", dateFrom, dateTo],
    queryFn: () => classService.getSchedules({ date_from: dateFrom, date_to: dateTo }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => classService.cancelSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Horario cancelado");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  // Group by local date
  const grouped = useMemo(() => {
    const map = {};
    for (const s of schedules) {
      const key = new Date(s.scheduled_at).toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
      if (!map[key]) map[key] = { label: fmtDateShort(s.scheduled_at), items: [] };
      map[key].items.push(s);
    }
    return Object.values(map);
  }, [schedules]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="label">Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
        </div>
        <button onClick={() => setShowScheduleModal(true)}
          className="btn-primary flex items-center gap-2 ml-auto">
          <Plus size={16} /> Programar clase
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay clases programadas en este período.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 capitalize">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.items.map((s) => {
                  const cap = s.gym_class?.max_capacity;
                  const full = cap && s.enrolled_count >= cap;
                  const catColor = s.gym_class?.category?.color_hex;
                  return (
                    <div key={s.id}
                      className={clsx("card flex items-center gap-4", s.status === "cancelled" && "opacity-60")}>
                      {/* Color bar */}
                      <div className="w-1 self-stretch rounded-full shrink-0"
                        style={{ backgroundColor: catColor ?? "#e5e7eb" }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{s.gym_class?.name}</span>
                          {s.gym_class?.category && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: (catColor ?? "#6b7280") + "20", color: catColor ?? "#6b7280" }}>
                              {s.gym_class.category.name}
                            </span>
                          )}
                          <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[s.status])}>
                            {STATUS_LABEL[s.status]}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1"><Clock size={12} />{fmtTime(s.scheduled_at)} · {s.gym_class?.duration_minutes} min</span>
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            <span className={clsx(full && "text-red-500 font-medium")}>
                              {s.enrolled_count}{cap ? `/${cap}` : ""}{full ? " (llena)" : ""}
                            </span>
                          </span>
                          {s.gym_class?.trainer && (
                            <span>👤 {s.gym_class.trainer.first_name} {s.gym_class.trainer.last_name}</span>
                          )}
                          {s.gym_class?.room && <span>📍 {s.gym_class.room}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setDetail(s)}
                          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-colors">
                          Ver inscritos
                        </button>
                        {s.status === "scheduled" && (
                          <button onClick={() => { if (confirm("¿Cancelar este horario?")) cancelMutation.mutate(s.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showScheduleModal && <ScheduleModal classes={classes} onClose={() => setShowScheduleModal(false)} />}
      {detail && <ScheduleDetail schedule={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ── Classes Tab ────────────────────────────────────────────────
function ClassesTab({ categories, trainers }) {
  const [modal, setModal] = useState(null);
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classService.getClasses(false),
  });

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button onClick={() => setModal({ mode: "create" })} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva clase
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Dumbbell size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay clases creadas aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {classes.map((c) => (
            <div key={c.id} className={clsx("card flex flex-col gap-2", !c.is_active && "opacity-50")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.category && <ColorDot color={c.category.color_hex} />}
                    <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                  </div>
                  {c.category && <p className="text-xs text-gray-400 mt-0.5">{c.category.name}</p>}
                </div>
                <button onClick={() => setModal({ mode: "edit", gymClass: c })}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg shrink-0">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><Clock size={12} />{c.duration_minutes} min</span>
                {c.max_capacity && <span className="flex items-center gap-1"><Users size={12} />{c.max_capacity} máx.</span>}
                {c.room && <span>📍 {c.room}</span>}
              </div>
              {c.trainer && (
                <p className="text-xs text-gray-500">👤 {c.trainer.first_name} {c.trainer.last_name}</p>
              )}
              {c.description && <p className="text-xs text-gray-400 line-clamp-2">{c.description}</p>}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ClassModal
          mode={modal.mode}
          gymClass={modal.gymClass}
          categories={categories}
          trainers={trainers}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Categories Tab ─────────────────────────────────────────────
function CategoriesTab() {
  const [modal, setModal] = useState(null);
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: classService.getCategories,
  });

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button onClick={() => setModal({ mode: "create" })} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva categoría
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Tag size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay categorías creadas aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className={clsx("card flex items-center justify-between gap-4", !cat.is_active && "opacity-50")}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl shrink-0"
                  style={{ backgroundColor: (cat.color_hex ?? "#6b7280") + "30" }}>
                  <div className="w-full h-full rounded-xl flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color_hex ?? "#6b7280" }} />
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{cat.name}</p>
                  {cat.description && <p className="text-xs text-gray-400">{cat.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!cat.is_active && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactiva</span>}
                <button onClick={() => setModal({ mode: "edit", category: cat })}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CategoryModal mode={modal.mode} category={modal.category} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function ClassesPage() {
  const [tab, setTab] = useState("agenda");

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: classService.getCategories });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => classService.getClasses(true) });
  const { data: usersData } = useQuery({
    queryKey: ["users-trainers"],
    queryFn: () => userService.getAll({ limit: 100 }),
  });
  const trainers = usersData?.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clases</h1>
          <p className="text-sm text-gray-500 mt-0.5">Agenda, clases y categorías</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "agenda",     label: "Agenda" },
          { key: "classes",    label: "Clases" },
          { key: "categories", label: "Categorías" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "agenda"     && <AgendaTab classes={classes} />}
        {tab === "classes"    && <ClassesTab categories={categories} trainers={trainers} />}
        {tab === "categories" && <CategoriesTab />}
      </div>
    </div>
  );
}
