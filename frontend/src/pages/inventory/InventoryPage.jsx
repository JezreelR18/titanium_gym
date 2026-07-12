import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { inventoryService } from "../../services/inventoryService";
import {
  Search, Plus, Pencil, PackagePlus, AlertTriangle,
  Package, ChevronLeft, ChevronRight, Tag, History,
  Trash2, X, Check,
} from "lucide-react";
import toast from "react-hot-toast";
import ProductModal from "./ProductModal";
import MovementModal from "./MovementModal";
import clsx from "clsx";
import ExportButton from "../../components/ui/ExportButton";
import { exportCSV, exportExcel } from "../../utils/exportUtils";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS = {
  purchase:   "Compra",
  sale:       "Venta",
  adjustment: "Ajuste",
  return:     "Devolución",
};

const MOVEMENT_COLORS = {
  purchase:   "bg-green-100 text-green-700",
  sale:       "bg-red-100 text-red-700",
  adjustment: "bg-amber-100 text-amber-700",
  return:     "bg-blue-100 text-blue-700",
};

const TABS = [
  { id: "products",    label: "Productos",    icon: Package },
  { id: "categories",  label: "Categorías",   icon: Tag },
  { id: "movements",   label: "Movimientos",  icon: History },
];

// ── Stock badge ───────────────────────────────────────────────────────────────

function StockBadge({ stock, min }) {
  if (stock === 0)
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Sin stock</span>;
  if (stock <= min)
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1"><AlertTriangle size={11} />{stock}</span>;
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{stock}</span>;
}

// ── Products tab ──────────────────────────────────────────────────────────────

function ProductsTab() {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canManage = ["propietario", "administrador"].includes(user?.role?.name) || hasPermission("inventory.manage");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const [lowStock, setLowStock] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [modal, setModal]   = useState(null);
  const [movementProduct, setMovementProduct] = useState(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: inventoryService.getCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", page, search, lowStock, categoryId],
    queryFn: () => inventoryService.getProducts({
      page, limit: 15,
      search: search || undefined,
      low_stock: lowStock || undefined,
      category_id: categoryId || undefined,
      include_inactive: true,
    }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }) => inventoryService.updateProduct(id, { is_active: !is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto actualizado");
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error"),
  });

  const products   = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto o SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pl-9"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={() => { setLowStock((v) => !v); setPage(1); }}
          className={clsx(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
            lowStock
              ? "bg-amber-50 border-amber-400 text-amber-700"
              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
          )}
        >
          <AlertTriangle size={15} />
          Stock bajo
        </button>

        <div className="ml-auto flex items-center gap-2">
          <ExportButton
            onExportCSV={() => exportCSV(products.map((p) => ({
              Producto: p.name, SKU: p.sku ?? "", Categoría: p.category?.name ?? "", Unidad: p.unit,
              Precio: Number(p.price).toFixed(2), Stock: p.stock, Estado: p.is_active ? "Activo" : "Inactivo",
            })), "inventario")}
            onExportExcel={() => exportExcel(products.map((p) => ({
              Producto: p.name, SKU: p.sku ?? "", Categoría: p.category?.name ?? "", Unidad: p.unit,
              Precio: Number(p.price).toFixed(2), Stock: p.stock, Estado: p.is_active ? "Activo" : "Inactivo",
            })), null, "inventario")}
          />
          {canManage && (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setModal({ mode: "create" })}
            >
              <Plus size={16} />
              Nuevo producto
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Package size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No se encontraron productos.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="text-left">Producto</th>
                <th className="text-left">Categoría</th>
                <th className="text-left">Unidad</th>
                <th className="text-left">Precio</th>
                <th className="text-left">Stock</th>
                <th className="text-left">Estado</th>
                {canManage && <th className="text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className={clsx("hover:bg-gray-50 transition-colors", !p.is_active && "opacity-50")}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.sku && <span className="text-xs text-gray-400">SKU: {p.sku}</span>}
                      {p.location && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          📍 {p.location}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.category ? (
                      <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs font-medium">
                        {p.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{p.unit}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    ${parseFloat(p.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <StockBadge stock={p.stock} min={p.min_stock_alert} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {p.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setMovementProduct(p)}
                          title="Agregar stock"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <PackagePlus size={14} />
                        </button>
                        <button
                          onClick={() => setModal({ mode: "edit", product: p })}
                          title="Editar"
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive.mutate({ id: p.id, is_active: p.is_active })}
                          title={p.is_active ? "Desactivar" : "Activar"}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          {p.is_active ? <X size={14} /> : <Check size={14} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {modal && (
        <ProductModal mode={modal.mode} product={modal.product} onClose={() => setModal(null)} />
      )}
      {movementProduct && (
        <MovementModal product={movementProduct} onClose={() => setMovementProduct(null)} />
      )}
    </div>
  );
}

// ── Categories tab ────────────────────────────────────────────────────────────

function CategoriesTab() {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canManage = ["propietario", "administrador"].includes(user?.role?.name) || hasPermission("inventory.manage");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState("");
  const [editDesc, setEditDesc]   = useState("");
  const [newName, setNewName]     = useState("");
  const [newDesc, setNewDesc]     = useState("");
  const [creating, setCreating]   = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: inventoryService.getCategories,
  });

  const createMutation = useMutation({
    mutationFn: () => inventoryService.createCategory({ name: newName.trim(), description: newDesc.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      toast.success("¡Categoría creada!");
      setNewName(""); setNewDesc(""); setCreating(false);
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id }) => inventoryService.updateCategory(id, { name: editName.trim(), description: editDesc.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      toast.success("Categoría actualizada");
      setEditingId(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: inventoryService.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      toast.success("Categoría eliminada");
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "No se puede eliminar"),
  });

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">{categories.length} categorías</p>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={15} />
            Nueva categoría
          </button>
        )}
      </div>

      {/* New category form */}
      {canManage && creating && (
        <div className="card mb-4 border-brand-200">
          <p className="text-sm font-semibold mb-3 text-gray-800">Nueva categoría</p>
          <div className="space-y-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input"
              placeholder="Nombre (Ej: Suplementos, Bebidas, Accesorios...)"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input"
              placeholder="Descripción (opcional)"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancelar</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="btn-primary text-sm"
              >
                {createMutation.isPending ? "Guardando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
      ) : categories.length === 0 ? (
        <div className="text-center py-10">
          <Tag size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No hay categorías aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) =>
            editingId === cat.id ? (
              <div key={cat.id} className="card border-brand-300 space-y-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input"
                />
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="input"
                  placeholder="Descripción (opcional)"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-sm">Cancelar</button>
                  <button
                    onClick={() => updateMutation.mutate({ id: cat.id })}
                    disabled={!editName.trim() || updateMutation.isPending}
                    className="btn-primary text-sm"
                  >
                    {updateMutation.isPending ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                <div>
                  <p className="font-medium text-gray-800">{cat.name}</p>
                  {cat.description && <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(cat)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => confirm(`¿Eliminar "${cat.name}"?`) && deleteMutation.mutate(cat.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Movements tab ─────────────────────────────────────────────────────────────

function MovementsTab() {
  const [page, setPage]     = useState(1);
  const [typeFilter, setTypeFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["movements", page, typeFilter],
    queryFn: () =>
      inventoryService.getMovements({
        page, limit: 20,
        movement_type: typeFilter || undefined,
      }),
  });

  const movements  = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const qtyDisplay = (m) => {
    const qty = m.quantity;
    if (m.type === "purchase" || m.type === "return") return <span className="text-green-600 font-semibold">+{Math.abs(qty)}</span>;
    if (m.type === "sale") return <span className="text-red-600 font-semibold">-{Math.abs(qty)}</span>;
    return <span className={clsx("font-semibold", qty >= 0 ? "text-green-600" : "text-red-600")}>{qty >= 0 ? `+${qty}` : qty}</span>;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">Todos los tipos</option>
          <option value="purchase">Compras</option>
          <option value="sale">Ventas</option>
          <option value="adjustment">Ajustes</option>
          <option value="return">Devoluciones</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : movements.length === 0 ? (
        <div className="text-center py-16">
          <History size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No hay movimientos registrados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="text-left">Fecha</th>
                <th className="text-left">Producto</th>
                <th className="text-left">Tipo</th>
                <th className="text-left">Cantidad</th>
                <th className="text-left">Costo unit.</th>
                <th className="text-left">Referencia / Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString("es")}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{m.product.name}</p>
                    <p className="text-xs text-gray-400">{m.product.unit}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      MOVEMENT_COLORS[m.type]
                    )}>
                      {MOVEMENT_LABELS[m.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{qtyDisplay(m)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.unit_price ? `$${parseFloat(m.unit_price).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {m.reference && <span className="font-medium text-gray-700 mr-1">{m.reference}</span>}
                    {m.note}
                    {!m.reference && !m.note && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("products");

  const { data: summary } = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: inventoryService.getSummary,
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-sm text-gray-500 mt-0.5">Productos, existencias y movimientos</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Package size={18} className="text-brand-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{summary.active_products}</p>
              <p className="text-xs text-gray-500">Productos activos</p>
            </div>
          </div>
          <div className="card py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{summary.low_stock_count}</p>
              <p className="text-xs text-gray-500">Stock bajo</p>
            </div>
          </div>
          <div className="card py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <Package size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{summary.out_of_stock_count}</p>
              <p className="text-xs text-gray-500">Sin stock</p>
            </div>
          </div>
          <div className="card py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <Package size={18} className="text-gray-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{summary.total_products}</p>
              <p className="text-xs text-gray-500">Total registrados</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="flex gap-1 border-b border-gray-100 mb-6 -mt-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors",
                activeTab === id
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "products"   && <ProductsTab />}
        {activeTab === "categories" && <CategoriesTab />}
        {activeTab === "movements"  && <MovementsTab />}
      </div>
    </div>
  );
}
