import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { lockerService } from "../../services/lockerService";
import { memberService } from "../../services/memberService";
import {
  Plus, Pencil, X, Search, Lock, LockOpen, AlertTriangle,
  Wrench, RefreshCw, Ban, History,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

function extractError(err) {
  const d = err?.response?.data?.detail;
  if (!d) return "Ocurrió un error";
  return Array.isArray(d) ? d.map((e) => e.msg).join("; ") : d;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function daysLeft(endDate) {
  const diff = Math.ceil((new Date(endDate + "T12:00:00") - new Date()) / 86400000);
  return diff;
}

const STATUS_CONFIG = {
  available:   { label: "Libre",        bg: "bg-green-50",  border: "border-green-200", text: "text-green-700",  dot: "bg-green-400",  icon: LockOpen },
  rented:      { label: "Rentado",      bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-700",  dot: "bg-blue-400",   icon: Lock },
  maintenance: { label: "Mantenimiento",bg: "bg-yellow-50", border: "border-yellow-200",text: "text-yellow-700",dot: "bg-yellow-400", icon: Wrench },
  reserved:    { label: "Reservado",    bg: "bg-purple-50", border: "border-purple-200",text: "text-purple-700",dot: "bg-purple-400", icon: Lock },
};

// ── Locker Modal (create / edit) ───────────────────────────────
function LockerModal({ mode, locker, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      number: locker?.number ?? "",
      zone: locker?.zone ?? "",
      has_lock: locker?.has_lock ?? false,
      status: locker?.status ?? "available",
      note: locker?.note ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (raw) => {
      const data = {
        number: raw.number,
        zone: raw.zone || null,
        has_lock: raw.has_lock === true || raw.has_lock === "true",
        note: raw.note || null,
      };
      if (mode === "edit") data.status = raw.status;
      return mode === "create"
        ? lockerService.createLocker(data)
        : lockerService.updateLocker(locker.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lockers"] });
      toast.success(mode === "create" ? "Casillero creado" : "Casillero actualizado");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{mode === "create" ? "Nuevo casillero" : "Editar casillero"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Número / ID *</label>
              <input {...register("number", { required: "Requerido" })} className="input" placeholder="A-01" />
              {errors.number && <p className="text-xs text-red-500 mt-1">{errors.number.message}</p>}
            </div>
            <div>
              <label className="label">Zona / Área</label>
              <input {...register("zone")} className="input" placeholder="Hombres, Mujeres..." />
            </div>
          </div>

          {mode === "edit" && (
            <div>
              <label className="label">Estado</label>
              <select {...register("status")} className="input">
                <option value="available">Libre</option>
                <option value="rented">Rentado</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="reserved">Reservado</option>
              </select>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register("has_lock")} className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-gray-700">Incluye candado propio</span>
          </label>

          <div>
            <label className="label">Nota</label>
            <textarea {...register("note")} rows={2} className="input resize-none" />
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

// ── Rent Modal ─────────────────────────────────────────────────
function RentModal({ locker, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      price: "",
      currency: "MXN",
      includes_lock: false,
      deposit_amount: "0",
      note: "",
    },
  });

  const { data: searchData } = useQuery({
    queryKey: ["member-search-locker", search],
    queryFn: () => memberService.getAll({ search, limit: 8 }),
    enabled: search.trim().length > 1,
  });

  if (searchData?.data && !selected) {
    if (JSON.stringify(searchData.data) !== JSON.stringify(results)) setResults(searchData.data);
  }

  const mutation = useMutation({
    mutationFn: (raw) => lockerService.rentLocker(locker.id, {
      member_id: selected.id,
      start_date: raw.start_date,
      end_date: raw.end_date,
      price: Number(raw.price),
      currency: raw.currency,
      includes_lock: raw.includes_lock === true || raw.includes_lock === "true",
      deposit_amount: Number(raw.deposit_amount) || 0,
      note: raw.note || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lockers"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast.success(`Casillero ${locker.number} rentado`);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Rentar casillero {locker.number}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit((raw) => { if (!selected) { toast.error("Selecciona un miembro"); return; } mutation.mutate(raw); })}
          className="p-6 space-y-4">

          {/* Member search */}
          <div>
            <label className="label">Miembro *</label>
            {selected ? (
              <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-sm text-brand-900">{selected.first_name} {selected.last_name}</p>
                  <p className="text-xs font-mono text-brand-600">{selected.member_code}</p>
                </div>
                <button type="button" onClick={() => { setSelected(null); setSearch(""); }}
                  className="text-xs text-gray-400 hover:text-red-500">Cambiar</button>
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
              <label className="label">Inicio *</label>
              <input type="date" {...register("start_date", { required: "Requerido" })} className="input" />
            </div>
            <div>
              <label className="label">Vencimiento *</label>
              <input type="date" {...register("end_date", { required: "Requerido" })} className="input" />
              {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date.message}</p>}
            </div>
            <div>
              <label className="label">Precio *</label>
              <input type="number" min="0" step="0.01" {...register("price", { required: "Requerido" })} className="input" placeholder="200.00" />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="label">Moneda</label>
              <select {...register("currency")} className="input">
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="label">Depósito</label>
              <input type="number" min="0" step="0.01" {...register("deposit_amount")} className="input" placeholder="0.00" />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register("includes_lock")} className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-gray-700">Incluye renta de candado</span>
          </label>

          <div>
            <label className="label">Nota</label>
            <input {...register("note")} className="input" placeholder="Opcional..." />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Rentando..." : "Confirmar renta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Renew Modal ────────────────────────────────────────────────
function RenewModal({ rental, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      end_date: rental.end_date,
      price: String(rental.price),
      note: rental.note ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (raw) => lockerService.updateRental(rental.id, {
      end_date: raw.end_date,
      price: Number(raw.price),
      note: raw.note || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["lockers"] });
      toast.success("Renta renovada");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Renovar renta — Casillero {rental.locker?.number}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div>
            <label className="label">Nueva fecha de vencimiento *</label>
            <input type="date" {...register("end_date", { required: "Requerido" })} className="input" />
            {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date.message}</p>}
          </div>
          <div>
            <label className="label">Precio</label>
            <input type="number" min="0" step="0.01" {...register("price")} className="input" />
          </div>
          <div>
            <label className="label">Nota</label>
            <input {...register("note")} className="input" />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : "Renovar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── History Modal ──────────────────────────────────────────────
function HistoryModal({ locker, onClose }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["locker-history", locker.id],
    queryFn: () => lockerService.getLockerHistory(locker.id),
  });

  const STATUS_LABEL = { active: "Activa", expired: "Vencida", cancelled: "Cancelada" };
  const STATUS_COLOR = { active: "bg-green-100 text-green-700", expired: "bg-gray-100 text-gray-500", cancelled: "bg-red-100 text-red-500" };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold">Historial — Casillero {locker.number}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Cargando...</div>
          ) : history.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">Sin historial de rentas.</p>
          ) : (
            <div className="space-y-3">
              {history.map((r) => (
                <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        {r.member?.first_name} {r.member?.last_name}
                      </p>
                      <p className="text-xs font-mono text-gray-400">{r.member?.member_code}</p>
                    </div>
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", STATUS_COLOR[r.status])}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                    <span>{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</span>
                    <span className="font-medium text-gray-700">${Number(r.price).toFixed(2)} {r.currency}</span>
                  </div>
                  {r.includes_lock && <p className="text-xs text-gray-400 mt-1">🔒 Con candado</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lockers grid tab ───────────────────────────────────────────
function LockersGridTab() {
  const [modal, setModal] = useState(null);
  const [filterZone, setFilterZone] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data: lockers = [], isLoading } = useQuery({
    queryKey: ["lockers", filterZone, filterStatus],
    queryFn: () => lockerService.getLockers({
      zone: filterZone || undefined,
      status: filterStatus || undefined,
    }),
  });

  const zones = [...new Set(lockers.map((l) => l.zone).filter(Boolean))];

  const summary = lockers.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Summary chips */}
      {lockers.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            summary[key] ? (
              <button key={key}
                onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                  filterStatus === key ? `${cfg.bg} ${cfg.border} ${cfg.text}` : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                )}>
                <span className={clsx("w-2 h-2 rounded-full", cfg.dot)} />
                {cfg.label} ({summary[key]})
              </button>
            ) : null
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        {zones.length > 0 && (
          <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)} className="input w-44">
            <option value="">Todas las zonas</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        )}
        <button onClick={() => setModal({ type: "create" })}
          className="btn-primary flex items-center gap-2 ml-auto">
          <Plus size={16} /> Nuevo casillero
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : lockers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Lock size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay casilleros registrados aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {lockers.map((locker) => {
            const cfg = STATUS_CONFIG[locker.status];
            const Icon = cfg.icon;
            const days = locker.active_rental ? daysLeft(locker.active_rental.end_date) : null;
            const urgent = days !== null && days <= 7;
            return (
              <div key={locker.id}
                className={clsx("border-2 rounded-2xl p-3 flex flex-col gap-1.5 cursor-pointer transition-all hover:shadow-md", cfg.bg, cfg.border)}>
                <div className="flex items-center justify-between">
                  <span className={clsx("text-lg font-bold", cfg.text)}>{locker.number}</span>
                  <Icon size={16} className={cfg.text} />
                </div>
                {locker.zone && <p className="text-xs text-gray-400">{locker.zone}</p>}
                <span className={clsx("text-xs font-medium", cfg.text)}>{cfg.label}</span>

                {locker.active_rental && (
                  <div className="mt-1 pt-1.5 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {locker.active_rental.member?.first_name} {locker.active_rental.member?.last_name}
                    </p>
                    <p className={clsx("text-xs mt-0.5", urgent ? "text-red-500 font-medium" : "text-gray-400")}>
                      {urgent && <AlertTriangle size={10} className="inline mr-0.5" />}
                      Vence {fmtDate(locker.active_rental.end_date)}
                    </p>
                    {locker.active_rental.includes_lock && (
                      <p className="text-xs text-gray-400 mt-0.5">🔒 Candado</p>
                    )}
                  </div>
                )}

                <div className="flex gap-1 mt-1">
                  {locker.status === "available" && (
                    <button onClick={() => setModal({ type: "rent", locker })}
                      className="flex-1 text-xs py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium transition-colors">
                      Rentar
                    </button>
                  )}
                  <button onClick={() => setModal({ type: "edit", locker })}
                    className="p-1 rounded-lg text-gray-400 hover:bg-white/70 hover:text-gray-600 transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => setModal({ type: "history", locker })}
                    className="p-1 rounded-lg text-gray-400 hover:bg-white/70 hover:text-gray-600 transition-colors">
                    <History size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === "create"  && <LockerModal mode="create" onClose={() => setModal(null)} />}
      {modal?.type === "edit"    && <LockerModal mode="edit" locker={modal.locker} onClose={() => setModal(null)} />}
      {modal?.type === "rent"    && <RentModal locker={modal.locker} onClose={() => setModal(null)} />}
      {modal?.type === "history" && <HistoryModal locker={modal.locker} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Rentals tab ────────────────────────────────────────────────
function RentalsTab() {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState(null);

  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ["rentals", showAll],
    queryFn: () => lockerService.getRentals(!showAll),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => lockerService.updateRental(id, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["lockers"] });
      toast.success("Renta cancelada — casillero liberado");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const returnDepositMutation = useMutation({
    mutationFn: (id) => lockerService.updateRental(id, { deposit_returned: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast.success("Depósito marcado como devuelto");
    },
  });

  const STATUS_LABEL = { active: "Activa", expired: "Vencida", cancelled: "Cancelada" };
  const STATUS_COLOR = { active: "bg-green-100 text-green-700", expired: "bg-orange-100 text-orange-700", cancelled: "bg-gray-100 text-gray-500" };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)}
            className="w-4 h-4 accent-brand-600" />
          Mostrar todas (incluye canceladas y vencidas)
        </label>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : rentals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LockOpen size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay rentas activas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rentals.map((r) => {
            const days = daysLeft(r.end_date);
            const urgent = r.status === "active" && days <= 7;
            return (
              <div key={r.id} className={clsx("card flex items-center gap-4", r.status !== "active" && "opacity-60")}>
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex flex-col items-center justify-center shrink-0">
                  <Lock size={16} className="text-gray-500" />
                  <span className="text-xs font-bold text-gray-700 mt-0.5">{r.locker?.number}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">
                      {r.member?.first_name} {r.member?.last_name}
                    </p>
                    <p className="text-xs font-mono text-gray-400">{r.member?.member_code}</p>
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[r.status])}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                    <span>{fmtDate(r.start_date)} → <span className={clsx(urgent && "text-red-500 font-semibold")}>{fmtDate(r.end_date)}</span></span>
                    {r.status === "active" && (
                      <span className={clsx(urgent ? "text-red-500 font-medium" : "text-gray-400")}>
                        {urgent && <AlertTriangle size={11} className="inline mr-0.5" />}
                        {days > 0 ? `${days} día${days !== 1 ? "s" : ""} restante${days !== 1 ? "s" : ""}` : "Vence hoy"}
                      </span>
                    )}
                    <span className="font-medium text-gray-700">${Number(r.price).toFixed(2)} {r.currency}</span>
                    {r.includes_lock && <span>🔒 Candado</span>}
                    {Number(r.deposit_amount) > 0 && (
                      <span className={clsx(r.deposit_returned ? "text-green-600" : "text-orange-500")}>
                        Depósito ${Number(r.deposit_amount).toFixed(2)} {r.deposit_returned ? "✓ devuelto" : "pendiente"}
                      </span>
                    )}
                  </div>
                </div>

                {r.status === "active" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setModal({ type: "renew", rental: r })}
                      title="Renovar"
                      className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                      <RefreshCw size={16} />
                    </button>
                    {Number(r.deposit_amount) > 0 && !r.deposit_returned && (
                      <button onClick={() => returnDepositMutation.mutate(r.id)}
                        title="Marcar depósito devuelto"
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors text-xs">
                        💰
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm("¿Cancelar esta renta? El casillero quedará libre.")) cancelMutation.mutate(r.id); }}
                      title="Cancelar renta"
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Ban size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === "renew" && <RenewModal rental={modal.rental} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function LockersPage() {
  const [tab, setTab] = useState("grid");

  const { data: expiring = [] } = useQuery({
    queryKey: ["lockers-expiring"],
    queryFn: () => lockerService.getExpiring(7),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Casilleros</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administración de rentas de casilleros y candados</p>
        </div>
        {expiring.length > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-sm text-orange-700">
            <AlertTriangle size={16} />
            <span>{expiring.length} renta{expiring.length !== 1 ? "s" : ""} vence{expiring.length !== 1 ? "n" : ""} en 7 días</span>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "grid",    label: "Casilleros" },
          { key: "rentals", label: "Rentas activas" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "grid"    && <LockersGridTab />}
        {tab === "rentals" && <RentalsTab />}
      </div>
    </div>
  );
}
