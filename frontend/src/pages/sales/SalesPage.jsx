import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Banknote, Plus, Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";
import { salesService } from "../../services/salesService";
import NewSaleModal from "./NewSaleModal";
import PayDebtModal from "./PayDebtModal";
import ExportButton from "../../components/ui/ExportButton";
import { exportCSV, exportExcel } from "../../utils/exportUtils";

function fmt(n) {
  return Number(n || 0).toFixed(2);
}

function formatDate(dt) {
  return new Date(dt).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const PAYMENT_STATUS_LABELS = {
  paid:    { label: "Pagado",    cls: "bg-green-100 text-green-700" },
  partial: { label: "Parcial",  cls: "bg-amber-100  text-amber-700"  },
  pending: { label: "Pendiente",cls: "bg-red-100    text-red-700"    },
};

const SALE_STATUS_LABELS = {
  confirmed: { label: "Confirmada", cls: "bg-blue-100   text-blue-700"   },
  cancelled: { label: "Cancelada",  cls: "bg-gray-100   text-gray-500"   },
  draft:     { label: "Borrador",   cls: "bg-gray-100   text-gray-500"   },
};

const DEBT_STATUS_LABELS = {
  pending: { label: "Pendiente", cls: "bg-red-100    text-red-700"    },
  partial: { label: "Parcial",   cls: "bg-amber-100  text-amber-700"  },
  paid:    { label: "Saldada",   cls: "bg-green-100  text-green-700"  },
};

const METHOD_LABELS = {
  cash:          "Efectivo",
  card:          "Tarjeta",
  bank_transfer: "Transferencia",
  credit:        "Crédito",
  qr_code:       "QR / Digital",
};

function StatusBadge({ map, value }) {
  const config = map[value] ?? { label: value, cls: "bg-gray-100 text-gray-500" };
  return <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", config.cls)}>{config.label}</span>;
}

// ── Ventas Tab ────────────────────────────────────────────────────────────────
function SalesTab({ onNew }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  async function fetchAllSales() {
    const res = await salesService.getAll({ page: 1, limit: 1000, search: search || undefined, payment_status: paymentFilter || undefined });
    return res.data ?? [];
  }

  function buildSaleRows(sales) {
    return sales.map((s) => ({
      "N° Venta":  s.sale_number,
      Miembro:     s.member_name ?? "Sin miembro",
      Fecha:       new Date(s.sale_date).toLocaleDateString("es-MX"),
      Total:       Number(s.total_amount).toFixed(2),
      Recibido:    Number(s.paid_amount).toFixed(2),
      Cambio:      Number(s.change_amount).toFixed(2),
      Estado:      s.status,
      Pago:        s.payment_status,
    }));
  }

  async function handleExportCSV() {
    exportCSV(buildSaleRows(await fetchAllSales()), "ventas");
  }

  async function handleExportExcel() {
    exportExcel(buildSaleRows(await fetchAllSales()), null, "ventas");
  }
  const [expandedId, setExpandedId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sales", page, search, paymentFilter],
    queryFn: () => salesService.getAll({ page, limit: 20, search: search || undefined, payment_status: paymentFilter || undefined }),
    keepPreviousData: true,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["sale-detail", expandedId],
    queryFn: () => salesService.getById(expandedId),
    enabled: !!expandedId,
  });

  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: salesService.cancel,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sales"] }); toast.success("Venta cancelada"); },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error al cancelar"),
  });

  const sales = data?.data ?? [];
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por número o miembro..."
            className="input pl-9"
          />
        </div>
        <select
          value={paymentFilter}
          onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
          className="input w-44"
        >
          <option value="">Todos los pagos</option>
          <option value="paid">Pagado</option>
          <option value="partial">Parcial</option>
          <option value="pending">Pendiente</option>
        </select>
        <ExportButton onExportCSV={handleExportCSV} onExportExcel={handleExportExcel} />
        <button onClick={onNew} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus size={16} /> Nueva venta
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
          <p>No hay ventas registradas</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="text-left">N° Venta</th>
                <th className="text-left">Miembro</th>
                <th className="text-left">Fecha</th>
                <th className="text-right">Total</th>
                <th className="text-right">Recibido</th>
                <th className="text-right">Cambio</th>
                <th className="text-center">Estado</th>
                <th className="text-center">Pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <>
                  <tr
                    key={sale.id}
                    className={clsx(
                      "border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors",
                      sale.status === "cancelled" && "opacity-60"
                    )}
                    onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-brand-700">{sale.sale_number}</td>
                    <td className="px-4 py-3 text-gray-700">{sale.member_name ?? <span className="text-gray-400 italic">Sin miembro</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(sale.sale_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold">${fmt(sale.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">${fmt(sale.paid_amount)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">
                      {parseFloat(sale.change_amount) > 0 ? `$${fmt(sale.change_amount)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge map={SALE_STATUS_LABELS} value={sale.status} /></td>
                    <td className="px-4 py-3 text-center"><StatusBadge map={PAYMENT_STATUS_LABELS} value={sale.payment_status} /></td>
                    <td className="px-4 py-3 text-right">
                      {sale.status !== "cancelled" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm("¿Cancelar esta venta?")) cancelMutation.mutate(sale.id); }}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId === sale.id && (
                    <tr key={`${sale.id}-detail`} className="border-t border-gray-100 bg-blue-50/30">
                      <td colSpan={9} className="px-6 py-4">
                        {detailLoading ? (
                          <p className="text-sm text-gray-400">Cargando detalle...</p>
                        ) : detail ? (
                          <div className="grid grid-cols-2 gap-6 text-sm">
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Artículos</p>
                              <div className="space-y-1">
                                {detail.details.map((d) => (
                                  <div key={d.id} className="flex justify-between text-gray-600">
                                    <span>{d.description} × {parseFloat(d.quantity)}</span>
                                    <span className="font-medium">${fmt(d.subtotal)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Pagos</p>
                              {detail.payments.length === 0 ? (
                                <p className="text-gray-400 text-xs">Sin pago registrado</p>
                              ) : (
                                <div className="space-y-1">
                                  {detail.payments.map((p) => (
                                    <div key={p.id} className="flex justify-between text-gray-600">
                                      <div>
                                        <span>{METHOD_LABELS[p.payment_method?.name] ?? p.payment_method?.name ?? "—"}</span>
                                        {p.reference_code && (
                                          <span className="ml-2 text-xs text-gray-400 font-mono">#{p.reference_code}</span>
                                        )}
                                      </div>
                                      <span className="font-medium">${fmt(p.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {detail.note && (
                                <p className="mt-2 text-xs text-gray-500 italic">"{detail.note}"</p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-600">Pág. {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Deudas Tab ────────────────────────────────────────────────────────────────
function DebtsTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [debtToPay, setDebtToPay] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["all-debts", page, search, statusFilter],
    queryFn: () => salesService.getAllDebts({
      page,
      limit: 20,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
    keepPreviousData: true,
  });

  const debts = data?.data ?? [];
  const pages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por miembro..."
            className="input pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input w-44"
        >
          <option value="active">Activas (pendiente + parcial)</option>
          <option value="">Todas</option>
          <option value="pending">Solo pendientes</option>
          <option value="partial">Solo parciales</option>
          <option value="paid">Solo saldadas</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : debts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <AlertCircle size={40} className="mx-auto mb-2 opacity-30" />
          <p>No hay deudas con este filtro</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{total} deuda{total !== 1 ? "s" : ""} encontrada{total !== 1 ? "s" : ""}</p>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="text-left">Concepto</th>
                  <th className="text-left">Miembro</th>
                  <th className="text-left">Venta</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Abonado</th>
                  <th className="text-right">Pendiente</th>
                  <th className="text-center">Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {debts.map((debt) => (
                  <tr key={debt.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{debt.concept}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {debt.member_name ?? <span className="text-gray-400 italic">Anónimo</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-700">{debt.sale_number ?? "—"}</td>
                    <td className="px-4 py-3 text-right">${fmt(debt.original_amount)}</td>
                    <td className="px-4 py-3 text-right text-green-700">${fmt(debt.paid_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">${fmt(debt.remaining_amount)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge map={DEBT_STATUS_LABELS} value={debt.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {debt.status !== "paid" && (
                        <button
                          onClick={() => setDebtToPay(debt)}
                          className="text-xs font-medium text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Abonar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-600">Pág. {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {debtToPay && <PayDebtModal debt={debtToPay} onClose={() => setDebtToPay(null)} />}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesPage() {
  const [tab, setTab] = useState("sales");
  const [showNewSale, setShowNewSale] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de ventas y gestión de deudas</p>
        </div>
        <button onClick={() => setShowNewSale(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva venta
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {[
            { key: "sales", label: "Ventas", icon: ShoppingCart },
            { key: "debts", label: "Deudas", icon: Banknote },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === "sales" ? (
        <SalesTab onNew={() => setShowNewSale(true)} />
      ) : (
        <DebtsTab />
      )}

      {showNewSale && <NewSaleModal onClose={() => setShowNewSale(false)} />}
    </div>
  );
}
