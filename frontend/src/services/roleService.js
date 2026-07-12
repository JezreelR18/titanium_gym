import api from "./api";

export const roleService = {
  getAll: () => api.get("/users/roles").then((r) => r.data),
  create: (data) => api.post("/users/roles", data).then((r) => r.data),
  update: (id, data) => api.put(`/users/roles/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/users/roles/${id}`),
  getPermissions: () => api.get("/users/permissions").then((r) => r.data),
};
