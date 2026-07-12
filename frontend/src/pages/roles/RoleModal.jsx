import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roleService } from "../../services/roleService";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";

const MODULE_LABELS = {
  attendance:  "Asistencia",
  classes:     "Clases",
  debts:       "Deudas",
  inventory:   "Inventario",
  members:     "Miembros",
  memberships: "Membresías",
  reports:     "Reportes",
  routines:    "Rutinas",
  sales:       "Ventas",
  settings:    "Configuración",
  users:       "Usuarios",
};

const PERM_LABELS = {
  "attendance.register":  "Registrar asistencia",
  "classes.manage":       "Gestionar clases",
  "classes.view":         "Ver clases",
  "debts.manage":         "Gestionar deudas",
  "debts.view":           "Ver deudas",
  "inventory.manage":     "Gestionar inventario",
  "inventory.view":       "Ver inventario",
  "members.create":       "Registrar miembros",
  "members.delete":       "Eliminar miembros",
  "members.edit":         "Editar miembros",
  "members.view":         "Ver miembros",
  "memberships.manage":   "Gestionar membresías",
  "memberships.view":     "Ver membresías",
  "reports.view":         "Ver reportes",
  "routines.manage":      "Gestionar rutinas",
  "routines.view":        "Ver rutinas",
  "sales.cancel":         "Cancelar ventas",
  "sales.create":         "Crear ventas",
  "sales.view":           "Ver ventas",
  "settings.manage":      "Gestionar configuración",
  "users.create":         "Crear usuarios",
  "users.delete":         "Eliminar usuarios",
  "users.edit":           "Editar usuarios",
  "users.view":           "Ver usuarios",
};

function groupByModule(permissions) {
  return permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});
}

export default function RoleModal({ mode, role, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [collapsed, setCollapsed]     = useState({});

  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: roleService.getPermissions,
  });

  const grouped = groupByModule(permissions);

  useEffect(() => {
    if (mode === "edit" && role) {
      reset({ name: role.name, description: role.description ?? "", is_active: role.is_active });
      setSelectedIds(new Set(role.permissions.map((p) => p.id)));
    } else {
      reset({ is_active: true });
      setSelectedIds(new Set());
    }
  }, [mode, role]);

  const mutation = useMutation({
    mutationFn: (formData) => {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active === true || formData.is_active === "true",
        permission_ids: [...selectedIds],
      };
      return mode === "create"
        ? roleService.create(payload)
        : roleService.update(role.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["roles-list"] });
      toast.success(mode === "create" ? "¡Rol creado!" : "¡Rol actualizado!");
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Ocurrió un error"),
  });

  const togglePerm = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleModule = (module) => {
    const moduleIds = grouped[module].map((p) => p.id);
    const allSelected = moduleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        moduleIds.forEach((id) => next.delete(id));
      } else {
        moduleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleCollapse = (module) =>
    setCollapsed((prev) => ({ ...prev, [module]: !prev[module] }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Nuevo rol" : `Editar rol — ${role?.name}`}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(mutation.mutate)} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Nombre del rol *</label>
                <input
                  {...register("name", { required: "Requerido" })}
                  className="input"
                  placeholder="Ej: Recepcionista"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-end">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" {...register("is_active")} />
                    <div className="w-10 h-6 rounded-full bg-gray-200 peer-checked:bg-brand-600 transition-colors" />
                    <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Rol activo</span>
                </label>
              </div>

              <div className="col-span-2">
                <label className="label">Descripción</label>
                <input
                  {...register("description")}
                  className="input"
                  placeholder="Breve descripción de este rol..."
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-800">Permisos</p>
                <span className="text-xs text-gray-400">{selectedIds.size} seleccionados</span>
              </div>

              {permissions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay permisos disponibles</p>
              ) : (
                <div className="space-y-0 border border-gray-200 rounded-xl overflow-hidden">
                  {Object.entries(grouped).map(([module, perms]) => {
                    const allSelected  = perms.every((p) => selectedIds.has(p.id));
                    const someSelected = perms.some((p) => selectedIds.has(p.id));
                    const isOpen = !collapsed[module];

                    return (
                      <div key={module} className="border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => toggleModule(module)}
                            className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
                          />
                          <span className="flex-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            {MODULE_LABELS[module] ?? module}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleCollapse(module)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>

                        {isOpen && (
                          <div className="grid grid-cols-1 sm:grid-cols-2">
                            {perms.map((perm) => (
                              <label
                                key={perm.id}
                                className="flex items-start gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(perm.id)}
                                  onChange={() => togglePerm(perm.id)}
                                  className="w-4 h-4 rounded accent-brand-600 mt-0.5 cursor-pointer"
                                />
                                <div>
                                  <p className="text-xs font-medium text-gray-700">{PERM_LABELS[perm.name] ?? perm.name}</p>
                                  {perm.description && (
                                    <p className="text-xs text-gray-400">{perm.description}</p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Guardando..." : mode === "create" ? "Crear rol" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
