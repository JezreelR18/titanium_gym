import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roleService } from "../../services/roleService";
import { Shield, Plus, Pencil, Trash2 } from "lucide-react";

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
import toast from "react-hot-toast";
import RoleModal from "./RoleModal";
import clsx from "clsx";

export default function RolesList() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: roleService.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: roleService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["roles-list"] });
      toast.success("Rol eliminado");
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "No se pudo eliminar el rol"),
  });

  const handleDelete = (role) => {
    if (confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) {
      deleteMutation.mutate(role.id);
    }
  };

  const permsByModule = (permissions) =>
    permissions.reduce((acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
          <p className="text-sm text-gray-500 mt-0.5">{roles.length} roles configurados</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setModal({ mode: "create" })}
        >
          <Plus size={16} />
          Nuevo rol
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : roles.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Shield size={48} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No hay roles configurados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => {
            const grouped = permsByModule(role.permissions);
            const modules  = Object.keys(grouped);

            return (
              <div key={role.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <Shield size={18} className="text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 capitalize">{role.name}</h3>
                        <span className={clsx(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          role.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        )}>
                          {role.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>
                      )}

                      {role.permissions.length > 0 ? (
                        <div className="mt-3 space-y-1.5">
                          {modules.map((mod) => (
                            <div key={mod} className="flex items-start gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-24 shrink-0 pt-0.5">
                                {MODULE_LABELS[mod] ?? mod}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {grouped[mod].map((p) => (
                                  <span
                                    key={p.id}
                                    className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                                  >
                                    {p.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-2 italic">Sin permisos asignados</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setModal({ mode: "edit", role })}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(role)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <RoleModal
          mode={modal.mode}
          role={modal.role}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
