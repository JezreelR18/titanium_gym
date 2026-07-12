import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cashRegisterService } from "../../services/cashRegisterService";
import clsx from "clsx";
import { CheckCircle, AlertTriangle, Trash2, Lock, FileText } from "lucide-react";
import ExportButton from "../../components/ui/ExportButton";
import { exportCSV, exportExcel } from "../../utils/exportUtils";

// ── Denomination configuration ─────────────────────────────────
const BILLS = [
  { type: "bill", denomination: 1000, label: "$1,000" },
  { type: "bill", denomination: 500,  label: "$500" },
  { type: "bill", denomination: 200,  label: "$200" },
  { type: "bill", denomination: 100,  label: "$100" },
  { type: "bill", denomination: 50,   label: "$50" },
  { type: "bill", denomination: 20,   label: "$20" },
];
const COINS = [
  { type: "coin", denomination: 20,   label: "$20" },
  { type: "coin", denomination: 10,   label: "$10" },
  { type: "coin", denomination: 5,    label: "$5" },
  { type: "coin", denomination: 2,    label: "$2" },
  { type: "coin", denomination: 1,    label: "$1" },
  { type: "coin", denomination: 0.5,  label: "$0.50" },
];
const ALL_DENOMS = [...BILLS, ...COINS];

// ── Helpers ────────────────────────────────────────────────────
function fmtMoney(val) {
  return Number(val).toLocaleString("es-MX", {
    style: "currency", currency: "MXN", minimumFractionDigits: 2,
  });
}

function todayISO() {
  return new Date().toLocaleDateString("sv-SE");
}

function initQtys(denominations) {
  const map = {};
  ALL_DENOMS.forEach((d) => { map[d.denomination] = 0; });
  if (denominations) {
    denominations.forEach((d) => { map[Number(d.denomination)] = d.quantity; });
  }
  return map;
}

// ── Sub-components ─────────────────────────────────────────────
function DenomRow({ denom, qty, onChange, disabled }) {
  const subtotal = denom.denomination * qty;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="w-20 text-sm font-semibold text-gray-700">{denom.label}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={disabled || qty <= 0}
          onClick={() => onChange(Math.max(0, qty - 1))}
          className="w-7 h-7 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold disabled:opacity-40 transition-colors flex items-center justify-center text-lg leading-none"
        >−</button>
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          disabled={disabled}
          className="w-16 text-center border border-gray-300 rounded-md px-1 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
        />
        <button
          disabled={disabled}
          onClick={() => onChange(qty + 1)}
          className="w-7 h-7 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold disabled:opacity-40 transition-colors flex items-center justify-center text-lg leading-none"
        >+</button>
      </div>
      <span className="flex-1 text-right text-sm text-gray-500 font-mono">
        {subtotal > 0 ? fmtMoney(subtotal) : "—"}
      </span>
    </div>
  );
}

// ── Closing detail modal ───────────────────────────────────────
function ClosingDetailModal({ closing, onClose }) {
  if (!closing) return null;
  const isClosed = closing.status === "closed";
  const diff = Number(closing.difference);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Corte — {new Date(closing.closing_date + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
            </h2>
            <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full",
              isClosed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            )}>
              {isClosed ? "Cerrado" : "Borrador"}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Payment breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Ventas por método de pago</h3>
            <div className="space-y-1.5">
              {closing.payment_breakdown.map((b) => (
                <div key={b.method} className="flex justify-between text-sm">
                  <span className="text-gray-600">{b.display_name}</span>
                  <span className="font-mono font-medium">{fmtMoney(b.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-1 border-t">
                <span>Total ventas</span>
                <span className="font-mono">{fmtMoney(closing.total_sales_amount)}</span>
              </div>
            </div>
          </div>

          {/* Denominations */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Denominaciones contadas</h3>
            {closing.denominations.length === 0 ? (
              <p className="text-xs text-gray-400">Sin denominaciones registradas</p>
            ) : (
              <div className="divide-y">
                {closing.denominations.filter(d => d.quantity > 0).map((d) => (
                  <div key={d.id} className="flex justify-between py-1.5 text-sm">
                    <span className="text-gray-600">{d.quantity} × {fmtMoney(d.denomination)}</span>
                    <span className="font-mono">{fmtMoney(d.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Efectivo en ventas (esperado)</span>
              <span className="font-mono">{fmtMoney(closing.cash_sales_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Efectivo contado</span>
              <span className="font-mono">{fmtMoney(closing.cash_counted_amount)}</span>
            </div>
            <div className={clsx("flex justify-between text-sm font-bold pt-2 border-t",
              diff > 0 ? "text-green-700" : diff < 0 ? "text-red-700" : "text-gray-800"
            )}>
              <span>Diferencia</span>
              <span className="font-mono">
                {diff > 0 ? "+" : ""}{fmtMoney(diff)}
              </span>
            </div>
          </div>

          {closing.notes && (
            <div className="bg-yellow-50 rounded-lg p-3 text-sm text-gray-700">
              <span className="font-semibold">Notas: </span>{closing.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────
const TABS = ["Nuevo corte", "Historial"];

// ── Main page ──────────────────────────────────────────────────
export default function CashRegisterPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  // ── New closing state ──────────────────────────────────────
  const [targetDate, setTargetDate] = useState(todayISO());
  const [qtys, setQtys] = useState(() => initQtys(null));
  const [notes, setNotes] = useState("");
  const [savedClosingId, setSavedClosingId] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // ── History state ──────────────────────────────────────────
  const [detailModal, setDetailModal] = useState(null);

  // ── Queries ────────────────────────────────────────────────
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["cash-summary", targetDate],
    queryFn: () => cashRegisterService.getSummary(targetDate),
    enabled: tab === 0,
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["cash-history"],
    queryFn: () => cashRegisterService.list(),
    enabled: tab === 1,
  });

  // Pre-fill from existing draft when summary loads
  const existingClosing = summary?.existing_closing ?? null;
  const isLocked = existingClosing?.status === "closed";

  // When summary loads and there's an existing draft, fill the form
  const [lastLoadedDate, setLastLoadedDate] = useState(null);
  if (summary && summary.closing_date !== lastLoadedDate) {
    setLastLoadedDate(summary.closing_date);
    if (existingClosing) {
      setQtys(initQtys(existingClosing.denominations));
      setNotes(existingClosing.notes ?? "");
      setSavedClosingId(existingClosing.id);
    } else {
      setQtys(initQtys(null));
      setNotes("");
      setSavedClosingId(null);
    }
  }

  // ── Mutations ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (body) => cashRegisterService.save(body),
    onSuccess: (data) => {
      setSavedClosingId(data.id);
      qc.invalidateQueries({ queryKey: ["cash-summary", targetDate] });
      qc.invalidateQueries({ queryKey: ["cash-history"] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id) => cashRegisterService.close(id),
    onSuccess: () => {
      setConfirmClose(false);
      qc.invalidateQueries({ queryKey: ["cash-summary", targetDate] });
      qc.invalidateQueries({ queryKey: ["cash-history"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => cashRegisterService.delete(id),
    onSuccess: () => {
      setSavedClosingId(null);
      setQtys(initQtys(null));
      setNotes("");
      qc.invalidateQueries({ queryKey: ["cash-summary", targetDate] });
      qc.invalidateQueries({ queryKey: ["cash-history"] });
    },
  });

  // ── Computed ───────────────────────────────────────────────
  const cashCounted = useMemo(
    () => ALL_DENOMS.reduce((sum, d) => sum + d.denomination * (qtys[d.denomination] ?? 0), 0),
    [qtys]
  );
  const cashExpected = Number(summary?.cash_sales_amount ?? 0);
  const difference = cashCounted - cashExpected;

  const denominationsPayload = ALL_DENOMS.map((d) => ({
    type: d.type,
    denomination: d.denomination,
    quantity: qtys[d.denomination] ?? 0,
  }));

  function handleSave() {
    saveMutation.mutate({
      closing_date: targetDate,
      denominations: denominationsPayload,
      notes: notes || null,
    });
  }

  function handleDateChange(d) {
    setTargetDate(d);
    setLastLoadedDate(null);
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corte de Caja</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cierre diario y conteo de efectivo</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={clsx(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              tab === i ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB: Nuevo corte ──────────────────────────── */}
      {tab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Sales summary + denomination counter */}
          <div className="space-y-5">

            {/* Date selector */}
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del corte</label>
                  <input
                    type="date"
                    value={targetDate}
                    max={todayISO()}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                {isLocked && (
                  <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-3 py-2 rounded-lg text-sm font-medium mt-5">
                    <Lock size={14} />
                    Cerrado
                  </div>
                )}
                {!isLocked && existingClosing && (
                  <div className="flex items-center gap-1.5 text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg text-sm font-medium mt-5">
                    <FileText size={14} />
                    Borrador
                  </div>
                )}
              </div>
            </div>

            {/* Sales breakdown */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Ventas del día</h3>
              {loadingSummary ? (
                <p className="text-xs text-gray-400 py-4 text-center">Cargando...</p>
              ) : !summary || summary.total_sales_count === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">Sin ventas confirmadas para esta fecha</p>
              ) : (
                <div className="space-y-2">
                  {summary.payment_breakdown.map((b) => (
                    <div key={b.method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={clsx("w-2 h-2 rounded-full", {
                          "bg-green-500": b.method === "cash",
                          "bg-blue-500": b.method === "card",
                          "bg-purple-500": b.method === "bank_transfer",
                          "bg-orange-500": b.method === "credit",
                          "bg-teal-500": b.method === "qr_code",
                        })} />
                        <span className="text-sm text-gray-700">{b.display_name}</span>
                        <span className="text-xs text-gray-400">({b.count})</span>
                      </div>
                      <span className="text-sm font-mono font-medium">{fmtMoney(b.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t text-sm font-bold">
                    <span>Total ({summary.total_sales_count} ventas)</span>
                    <span className="font-mono">{fmtMoney(summary.total_sales_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-700 font-semibold">
                    <span>Efectivo esperado</span>
                    <span className="font-mono">{fmtMoney(summary.cash_sales_amount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="card">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLocked}
                rows={2}
                placeholder="Observaciones del corte..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Right: Denomination counter */}
          <div className="space-y-5">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Billetes</h3>
              {BILLS.map((d) => (
                <DenomRow
                  key={d.denomination}
                  denom={d}
                  qty={qtys[d.denomination] ?? 0}
                  onChange={(v) => setQtys((prev) => ({ ...prev, [d.denomination]: v }))}
                  disabled={isLocked}
                />
              ))}
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Monedas</h3>
              {COINS.map((d) => (
                <DenomRow
                  key={d.denomination}
                  denom={d}
                  qty={qtys[d.denomination] ?? 0}
                  onChange={(v) => setQtys((prev) => ({ ...prev, [d.denomination]: v }))}
                  disabled={isLocked}
                />
              ))}
            </div>

            {/* Totals summary */}
            <div className={clsx(
              "card border-2 transition-colors",
              difference === 0 ? "border-gray-200"
                : difference > 0 ? "border-green-300 bg-green-50"
                : "border-red-300 bg-red-50"
            )}>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Efectivo contado</span>
                  <span className="font-mono font-bold text-gray-900">{fmtMoney(cashCounted)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Efectivo esperado</span>
                  <span className="font-mono text-gray-600">{fmtMoney(cashExpected)}</span>
                </div>
                <div className={clsx(
                  "flex justify-between text-base font-bold pt-2 border-t",
                  difference > 0 ? "text-green-700 border-green-200"
                    : difference < 0 ? "text-red-700 border-red-200"
                    : "text-gray-700 border-gray-200"
                )}>
                  <span>
                    {difference === 0 ? "✓ Cuadrado" : difference > 0 ? "Sobrante" : "Faltante"}
                  </span>
                  <span className="font-mono">
                    {difference !== 0 && (difference > 0 ? "+" : "")}{fmtMoney(difference)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {!isLocked && (
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2.5 px-4 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                >
                  {saveMutation.isPending ? "Guardando..." : existingClosing ? "Actualizar corte" : "Guardar corte"}
                </button>
                {savedClosingId && existingClosing?.status === "draft" && (
                  <button
                    onClick={() => setConfirmClose(true)}
                    className="bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Lock size={14} />
                    Cerrar día
                  </button>
                )}
              </div>
            )}

            {saveMutation.isError && (
              <p className="text-sm text-red-600">
                {saveMutation.error?.response?.data?.detail || "Error al guardar"}
              </p>
            )}
            {saveMutation.isSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={14} /> Corte guardado correctamente
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Historial ───────────────────────────── */}
      {tab === 1 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Historial de cortes</h3>
            {history && history.length > 0 && (
              <ExportButton
                onExportCSV={() => exportCSV(history.map((c) => ({
                  Fecha: c.closing_date, Ventas: c.total_sales_count,
                  "Total ventas": Number(c.total_sales_amount).toFixed(2),
                  "Efectivo esperado": Number(c.cash_sales_amount).toFixed(2),
                  "Efectivo contado": Number(c.cash_counted_amount).toFixed(2),
                  Diferencia: Number(c.difference).toFixed(2),
                  Estado: c.status === "closed" ? "Cerrado" : "Borrador",
                })), "cortes-de-caja")}
                onExportExcel={() => exportExcel(history.map((c) => ({
                  Fecha: c.closing_date, Ventas: c.total_sales_count,
                  "Total ventas": Number(c.total_sales_amount).toFixed(2),
                  "Efectivo esperado": Number(c.cash_sales_amount).toFixed(2),
                  "Efectivo contado": Number(c.cash_counted_amount).toFixed(2),
                  Diferencia: Number(c.difference).toFixed(2),
                  Estado: c.status === "closed" ? "Cerrado" : "Borrador",
                })), null, "cortes-de-caja")}
              />
            )}
          </div>
          {loadingHistory ? (
            <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin cortes registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="text-left">Fecha</th>
                    <th className="text-left">Ventas</th>
                    <th className="text-left">Total ventas</th>
                    <th className="text-left">Efectivo esperado</th>
                    <th className="text-left">Efectivo contado</th>
                    <th className="text-left">Diferencia</th>
                    <th className="text-left">Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => {
                    const diff = Number(c.difference);
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4 font-medium text-gray-800">
                          {new Date(c.closing_date + "T12:00:00").toLocaleDateString("es-MX", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{c.total_sales_count}</td>
                        <td className="py-3 pr-4 font-mono">{fmtMoney(c.total_sales_amount)}</td>
                        <td className="py-3 pr-4 font-mono text-green-700">{fmtMoney(c.cash_sales_amount)}</td>
                        <td className="py-3 pr-4 font-mono">{fmtMoney(c.cash_counted_amount)}</td>
                        <td className={clsx("py-3 pr-4 font-mono font-semibold",
                          diff > 0 ? "text-green-700" : diff < 0 ? "text-red-700" : "text-gray-500"
                        )}>
                          {diff > 0 ? "+" : ""}{fmtMoney(diff)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full",
                            c.status === "closed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          )}>
                            {c.status === "closed" ? "Cerrado" : "Borrador"}
                          </span>
                        </td>
                        <td className="py-3 pl-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setDetailModal(c)}
                              className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                            >
                              Ver
                            </button>
                            {c.status === "draft" && (
                              <button
                                onClick={() => {
                                  if (confirm("¿Eliminar este borrador?")) {
                                    deleteMutation.mutate(c.id);
                                  }
                                }}
                                className="text-xs text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm close modal ───────────────────────── */}
      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-orange-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">¿Cerrar el día?</h3>
                <p className="text-sm text-gray-500">Esta acción es irreversible</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Una vez cerrado el corte no podrá modificarse. Asegúrate de que las cantidades sean correctas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClose(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => closeMutation.mutate(savedClosingId)}
                disabled={closeMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Lock size={14} />
                {closeMutation.isPending ? "Cerrando..." : "Cerrar día"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail modal ──────────────────────────────── */}
      {detailModal && (
        <ClosingDetailModal closing={detailModal} onClose={() => setDetailModal(null)} />
      )}
    </div>
  );
}
