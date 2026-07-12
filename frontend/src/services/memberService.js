import api from "./api";

export const memberService = {
  getAll: (params = {}) => api.get("/members", { params }).then((r) => r.data),
  getById: (id) => api.get(`/members/${id}`).then((r) => r.data),
  create: (data) => api.post("/members", data).then((r) => r.data),
  update: (id, data) => api.put(`/members/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/members/${id}`),
  addEmergencyContact: (id, data) => api.post(`/members/${id}/emergency-contacts`, data).then((r) => r.data),
  deleteEmergencyContact: (memberId, contactId) => api.delete(`/members/${memberId}/emergency-contacts/${contactId}`),
  addPhysicalStats: (id, data) => api.post(`/members/${id}/physical-stats`, data).then((r) => r.data),
};
