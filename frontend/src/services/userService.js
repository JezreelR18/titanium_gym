import api from "./api";

export const userService = {
  getAll: (params) => api.get("/users", { params }).then((r) => r.data),
  getMe: () => api.get("/users/me").then((r) => r.data),
  updateMe: (data) => api.put("/users/me", data).then((r) => r.data),
  create: (data) => api.post("/users", data).then((r) => r.data),
  update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/users/${id}`),
  getRoles: () => api.get("/users/roles").then((r) => r.data),
  resetPassword: (id, new_password) =>
    api.post(`/users/${id}/reset-password`, { new_password }).then((r) => r.data),
  changePassword: (id, data) =>
    api.put(`/users/${id}/password`, data).then((r) => r.data),
};
