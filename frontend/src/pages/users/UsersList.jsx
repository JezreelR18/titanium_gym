import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../../services/userService";
import { useAuth } from "../../context/AuthContext";
import { Search, Plus, Pencil, Trash2, UserCog, KeyRound, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import UserModal from "./UserModal";
import clsx from "clsx";

const STATUS_COLORS = {
  active:    "bg-green-100 text-green-700",
  inactive:  "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  active:    "Activo",
  inactive:  "Inactivo",
  suspended: "Suspendido",
};

const ROLE_COLORS = {
  Propietario:   "bg-purple-100 text-purple-700",
  Administrador: "bg-blue-100 text-blue-700",
  Entrenador:    "bg-amber-100 text-amber-700",
  Recepcionista: "bg-teal-100 text-teal-700",
};

function ResetPasswordModal({ user, onClose }) {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const mutation = useMutation({
    mutationFn: (data) => userService.resetPassword(user.id, data.new_password),
    onSuccess: () => { toast.success(`Contraseña de ${user.first_name} restablecida`); onClose(); },
    onError: (err) => toast.error(err.response?.data?.detail ?? "Error al restablecer contraseña"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Restablecer contraseña</h2>
          <p className="text-sm text-gray-500 mt-0.5">{user.first_name} {user.last_name}</p>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-6 space-y-4">
          <div>
            <label className="label">Nueva contraseña *</label>
            <input
              type="password"
              {...register("new_password", {
                required: "Requerido",
                minLength: { value: 8, message: "Mínimo 8 caracteres" },
                validate: (v) => {
                  if (!/[A-Z]/.test(v)) return "Debe tener al menos una mayúscula";
                  if (!/[a-z]/.test(v)) return "Debe tener al menos una minúscula";
                  if (!/\d/.test(v))    return "Debe tener al menos un número";
                  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(v)) return "Debe tener un carácter especial";
                  return true;
                },
              })}
              className="input"
              placeholder="Ej. NuevaClave@123"
              autoFocus
            />
            {errors.new_password && <p className="text-xs text-red-500 mt-1">{errors.new_password.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary disabled:opacity-50">
              {mutation.isPending ? "Restableciendo..." : "Restablecer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersList() {
  const queryClient = useQueryClient();
  const { hasPermission, user: currentUser } = useAuth();
  const isOwner = currentUser?.role?.name?.toLowerCase() === "propietario";
  const canResetPassword = isOwner || hasPermission("users.reset_password");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const [modal, setModal]   = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", page, search],
    queryFn: () => userService.getAll({ page, limit: 15, search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: userService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario eliminado");
    },
    onError: (err) => toast.error(err.response?.data?.detail ?? "No se pudo eliminar el usuario"),
  });

  const handleDelete = (u) => {
    if (confirm(`¿Eliminar al usuario ${u.first_name} ${u.last_name}?`)) {
      deleteMutation.mutate(u.id);
    }
  };

  const users      = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? "—"} usuarios registrados</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setModal({ mode: "create" })}
        >
          <Plus size={16} />
          Nuevo usuario
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCog size={48} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No se encontraron usuarios.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="text-left">Usuario</th>
                  <th className="text-left">Rol</th>
                  <th className="text-left">Estado</th>
                  <th className="text-left">Último acceso</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                          {u.first_name[0]}{u.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                          {u.username && (
                            <p className="text-xs text-brand-600 font-mono">@{u.username}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "px-2.5 py-1 rounded-full text-xs font-medium capitalize",
                        ROLE_COLORS[u.role.name] ?? "bg-gray-100 text-gray-600"
                      )}>
                        {u.role.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        STATUS_COLORS[u.status] ?? "bg-gray-100 text-gray-600"
                      )}>
                        {STATUS_LABELS[u.status] ?? u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString("es")
                        : "Nunca"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canResetPassword && (
                          <button
                            onClick={() => setResetTarget(u)}
                            title="Restablecer contraseña"
                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          >
                            <KeyRound size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ mode: "edit", user: u })}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
