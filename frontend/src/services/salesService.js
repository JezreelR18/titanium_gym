import api from "./api";

export const salesService = {
  getAll: (params = {}) => api.get("/sales", { params }).then((r) => r.data),
  getById: (id) => api.get(`/sales/${id}`).then((r) => r.data),
  create: (data) => api.post("/sales", data).then((r) => r.data),
  cancel: (id) => api.post(`/sales/${id}/cancel`).then((r) => r.data),
  getPaymentMethods: () => api.get("/sales/payment-methods").then((r) => r.data),
  getAllDebts: (params = {}) => api.get("/sales/debts", { params }).then((r) => r.data),
  getMemberDebts: (memberId) => api.get(`/sales/debts/member/${memberId}`).then((r) => r.data),
  payDebt: (debtId, data) => api.post(`/sales/debts/${debtId}/pay`, data).then((r) => r.data),
};
