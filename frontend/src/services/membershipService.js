import api from "./api";

export const membershipService = {
  getPlans: (params = {}) => api.get("/memberships/plans", { params }).then((r) => r.data),
  createPlan: (data) => api.post("/memberships/plans", data).then((r) => r.data),
  updatePlan: (id, data) => api.put(`/memberships/plans/${id}`, data).then((r) => r.data),
  assign: (data) => api.post("/memberships/assign", data).then((r) => r.data),
  getMemberMemberships: (memberId) => api.get(`/memberships/member/${memberId}`).then((r) => r.data),
  updateMembership: (id, data) => api.put(`/memberships/${id}`, data).then((r) => r.data),
  getExpiring: (days = 7) => api.get("/memberships/expiring", { params: { days } }).then((r) => r.data),
};
