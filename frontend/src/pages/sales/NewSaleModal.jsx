import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, Plus, Minus, Trash2, ShoppingCart, User, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";
import { salesService } from "../../services/salesService";
import { memberService } from "../../services/memberService";
import { inventoryService } from "../../services/inventoryService";

function fmt(n) {
  return Number(n || 0).toFixed(2);
}

const METHOD_LABELS = {
  cash:          "Efectivo",
  card:          "Tarjeta",
  bank_transfer: "Transferencia bancaria",
  credit:        "Crédito",
  qr_code:       "QR / Digital",
};

function methodLabel(m) {
  return METHOD_LABELS[m.name] ?? m.name;
}

export default function NewSaleModal({ onClose }) {
  const queryClient = useQueryClient();

  // Cart
  const [items, setItems] = useState([]);
  // Member
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  // Product search
  const [productSearch, setProductSearch] = useState("");
  // Payment
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [receivedRaw, setReceivedRaw] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [createDebt, setCreateDebt] = useState(false);
  const [note, setNote] = useState("");

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: salesService.getPaymentMethods,
  });

  const { data: membersResult } = useQuery({
    queryKey: ["member-search-sale", memberSearch],
    queryFn: () => memberService.getAll({ search: memberSearch, limit: 8 }),
    enabled: memberSearch.trim().length >= 2,
  });
  const memberResults = membersResult?.data ?? [];

  const { data: productsResult, isLoading: productsLoading, isError: productsError } = useQuery({
    queryKey: ["products-for-sale"],
    queryFn: () => inventoryService.getProducts({ limit: 500 }),
  });
  const allProducts = productsResult?.data ?? [];

  // ── Payment method default ────────────────────────────────────────────────
  useEffect(() => {
    if (paymentMethods.length && !paymentMethodId) {
      const cash = paymentMethods.find((m) => m.name.toLowerCase().includes("cash") || m.name.toLowerCase().includes("efectivo"));
      setPaymentMethodId((cash ?? paymentMethods[0]).id);
    }
  }, [paymentMethods]);

  // ── Filtered products ─────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const active = allProducts.filter((p) => p.is_active);
    if (!productSearch.trim()) return active.slice(0, 20);
    const q = productSearch.toLowerCase();
    return active.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allProducts, productSearch]);


  // ── Totals ────────────────────────────────────────────────────────────────
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const needsReference = selectedMethod && ["bank_transfer", "card", "qr_code"].includes(selectedMethod.name);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0), [items]);
  const received = parseFloat(receivedRaw) || 0;
  const change = Math.max(received - total, 0);
  const debtAmount = Math.max(total - received, 0);
  const showDebtSection = debtAmount > 0.001 && items.length > 0;

  // ── Cart helpers ─────────────────────────────────────────────────────────
  const addProduct = useCallback((product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        id: crypto.randomUUID(),
        productId: product.id,
        description: product.name,
        qty: 1,
        unitPrice: parseFloat(product.price),
        unit: product.unit,
      }];
    });
    setProductSearch("");
  }, []);

  const addFreeItem = useCallback(() => {
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      productId: null,
      description: "",
      qty: 1,
      unitPrice: 0,
      unit: "unidad",
    }]);
  }, []);

  const updateItem = useCallback((id, field, value) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: salesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["all-debts"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      toast.success("¡Venta registrada!");
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error al registrar venta"),
  });

  const handleSubmit = () => {
    if (items.length === 0) return toast.error("Agrega al menos un artículo");
    if (!items.every((i) => i.description.trim() && i.unitPrice > 0))
      return toast.error("Todos los artículos deben tener descripción y precio mayor a 0");

    const hasPayment = received > 0;

    const payload = {
      member_id: selectedMember?.id ?? null,
      create_anonymous_debt: !selectedMember && createDebt,
      details: items.map((i) => ({
        product_id: i.productId ?? null,
        description: i.description,
        quantity: i.qty,
        unit_price: i.unitPrice,
        discount_pct: 0,
      })),
      payments: hasPayment ? [{ payment_method_id: paymentMethodId, amount: received, reference_code: referenceCode.trim() || null }] : [],
      note: note.trim() || null,
    };

    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-brand-600" />
            <h2 className="text-lg font-semibold">Nueva venta</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* ── Member ───────────────────────────────────────────────────── */}
          <section>
            <label className="label flex items-center gap-1.5">
              <User size={14} className="text-gray-400" />
              Miembro <span className="text-gray-400 font-normal">(opcional)</span>
            </label>

            {selectedMember ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 rounded-lg border border-brand-200">
                <span className="text-sm font-medium text-brand-800 flex-1">
                  {selectedMember.first_name} {selectedMember.last_name}
                </span>
                <button onClick={() => setSelectedMember(null)} className="text-brand-500 hover:text-brand-700">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="input pl-9"
                    placeholder="Buscar por nombre o cédula..."
                    autoComplete="off"
                  />
                </div>
                {memberResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden bg-white">
                    {memberResults.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedMember(m); setMemberSearch(""); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b last:border-0 border-gray-100"
                      >
                        <span className="font-medium">{m.first_name} {m.last_name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{m.id_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Products ─────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Artículos</label>
              <button onClick={addFreeItem} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                <Plus size={12} /> Artículo libre
              </button>
            </div>

            {/* Product search */}
            <div className="mb-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="input pl-9 pr-9"
                  placeholder="Escribe para buscar producto del inventario..."
                  autoComplete="off"
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {productSearch.trim() && (
                <div className="mt-1 border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-white">
                  {productsLoading ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Cargando productos...</p>
                  ) : filteredProducts.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Sin resultados para "{productSearch}"</p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addProduct(p)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b last:border-0 border-gray-100 flex justify-between"
                      >
                        <span>
                          <span className="font-medium">{p.name}</span>
                          {p.sku && <span className="text-gray-400 text-xs ml-2">{p.sku}</span>}
                          <span className={clsx("ml-2 text-xs", p.stock === 0 ? "text-red-500" : "text-gray-400")}>
                            Stock: {p.stock} {p.unit}
                          </span>
                        </span>
                        <span className="font-semibold text-gray-700">${fmt(p.price)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Cart items */}
            {items.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                Busca un producto o agrega un artículo libre
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Artículo</th>
                      <th className="px-3 py-2 text-center w-28">Cant.</th>
                      <th className="px-3 py-2 text-right w-24">Precio</th>
                      <th className="px-3 py-2 text-right w-24">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          {item.productId ? (
                            <span className="font-medium">{item.description}</span>
                          ) : (
                            <input
                              value={item.description}
                              onChange={(e) => updateItem(item.id, "description", e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand-400"
                              placeholder="Descripción..."
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => item.qty > 1 ? updateItem(item.id, "qty", item.qty - 1) : removeItem(item.id)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-500"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => updateItem(item.id, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-12 text-center text-sm border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-brand-400"
                            />
                            <button
                              onClick={() => updateItem(item.id, "qty", item.qty + 1)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-500"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-700">
                          ${fmt(item.unitPrice)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          ${fmt(item.qty * item.unitPrice)}
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeItem(item.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-200 text-right">
                  <span className="text-sm text-gray-500 mr-3">Total</span>
                  <span className="text-xl font-bold text-gray-900">${fmt(total)}</span>
                </div>
              </div>
            )}
          </section>

          {/* ── Payment ───────────────────────────────────────────────────── */}
          {items.length > 0 && (
            <section className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-700">Pago</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Método de pago</label>
                  <select
                    value={paymentMethodId}
                    onChange={(e) => { setPaymentMethodId(e.target.value); setReferenceCode(""); }}
                    className="input"
                  >
                    <option value="">Sin pago registrado</option>
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>{methodLabel(m)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Monto recibido</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={receivedRaw}
                      onChange={(e) => setReceivedRaw(e.target.value)}
                      className="input pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {needsReference && (
                <div>
                  <label className="label">
                    {selectedMethod.name === "bank_transfer" ? "No. de transferencia" : "Referencia / Folio"}
                    <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                  </label>
                  <input
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    className="input"
                    placeholder={selectedMethod.name === "bank_transfer" ? "Ej. 1234567890" : "Folio o referencia..."}
                  />
                </div>
              )}

              {/* Change display */}
              {received > 0 && (
                <div className={clsx(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium",
                  change > 0 ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                )}>
                  <span>Cambio</span>
                  <span className="text-lg font-bold">${fmt(change)}</span>
                </div>
              )}

              {/* Debt section */}
              {showDebtSection && (
                <div className={clsx(
                  "rounded-lg border p-3 space-y-2",
                  createDebt || selectedMember ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
                )}>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        Quedan <span className="text-red-600">${fmt(debtAmount)}</span> sin pagar
                      </p>

                      {selectedMember ? (
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createDebt || true}
                            readOnly
                            className="rounded accent-brand-600"
                          />
                          <span className="text-xs text-gray-700">
                            Registrar deuda en cuenta de <strong>{selectedMember.first_name} {selectedMember.last_name}</strong>
                          </span>
                        </label>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 mt-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createDebt}
                              onChange={(e) => setCreateDebt(e.target.checked)}
                              className="rounded accent-brand-600"
                            />
                            <span className="text-xs text-gray-700">Registrar como deuda anónima</span>
                          </label>
                          {createDebt && (
                            <p className="text-xs text-amber-600 mt-1">
                              Sin miembro asignado no podrás cobrar esta deuda a una persona específica.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Note ─────────────────────────────────────────────────────── */}
          <div>
            <label className="label">Nota <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
              placeholder="Observaciones, referencia..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || items.length === 0}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Registrando..." : `Confirmar venta $${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
