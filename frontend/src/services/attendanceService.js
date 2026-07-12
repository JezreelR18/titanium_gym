import api from "./api";

export const attendanceService = {
  checkIn: (data) => api.post("/attendance/check-in", data).then((r) => r.data),
  checkOut: (recordId) => api.put(`/attendance/${recordId}/check-out`).then((r) => r.data),

  getToday: () => api.get("/attendance/today").then((r) => r.data),
  getHistory: (params) => api.get("/attendance/", { params }).then((r) => r.data),
  getMemberHistory: (memberId, limit = 30) =>
    api.get(`/attendance/member/${memberId}`, { params: { limit } }).then((r) => r.data),
  getStats: () => api.get("/attendance/stats").then((r) => r.data),
};
