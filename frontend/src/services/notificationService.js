import api from "./api";

export const notificationService = {
  getAlerts: () => api.get("/notifications/alerts").then((r) => r.data),
  getAlertCount: () => api.get("/notifications/alerts/count").then((r) => r.data),

  getReminders: (params) => api.get("/notifications/reminders", { params }).then((r) => r.data),
  createReminder: (data) => api.post("/notifications/reminders", data).then((r) => r.data),
  updateReminder: (id, data) => api.put(`/notifications/reminders/${id}`, data).then((r) => r.data),
  markSent: (id) => api.put(`/notifications/reminders/${id}/mark-sent`).then((r) => r.data),
  deleteReminder: (id) => api.delete(`/notifications/reminders/${id}`),

  getLog: (limit = 50) => api.get("/notifications/log", { params: { limit } }).then((r) => r.data),
};
