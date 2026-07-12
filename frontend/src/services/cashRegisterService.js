import api from "./api";

export const cashRegisterService = {
  getSummary: (date) =>
    api.get("/cash-register/summary", { params: date ? { date } : {} }).then((r) => r.data),
  list: (skip = 0, limit = 30) =>
    api.get("/cash-register/", { params: { skip, limit } }).then((r) => r.data),
  getById: (id) => api.get(`/cash-register/${id}`).then((r) => r.data),
  save: (body) => api.post("/cash-register/", body).then((r) => r.data),
  close: (id) => api.put(`/cash-register/${id}/close`).then((r) => r.data),
  delete: (id) => api.delete(`/cash-register/${id}`).then((r) => r.data),
};
