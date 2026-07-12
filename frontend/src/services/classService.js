import api from "./api";

export const classService = {
  // Categories
  getCategories: () => api.get("/classes/categories").then((r) => r.data),
  createCategory: (data) => api.post("/classes/categories", data).then((r) => r.data),
  updateCategory: (id, data) => api.put(`/classes/categories/${id}`, data).then((r) => r.data),

  // Classes
  getClasses: (activeOnly = true) =>
    api.get("/classes", { params: { active_only: activeOnly } }).then((r) => r.data),
  createClass: (data) => api.post("/classes", data).then((r) => r.data),
  updateClass: (id, data) => api.put(`/classes/${id}`, data).then((r) => r.data),

  // Schedules
  getSchedules: (params) => api.get("/classes/schedules", { params }).then((r) => r.data),
  createSchedule: (data) => api.post("/classes/schedules", data).then((r) => r.data),
  updateSchedule: (id, data) => api.put(`/classes/schedules/${id}`, data).then((r) => r.data),
  cancelSchedule: (id, reason) =>
    api.delete(`/classes/schedules/${id}`, { params: reason ? { reason } : {} }),

  // Enrollments
  getEnrollments: (scheduleId) =>
    api.get(`/classes/schedules/${scheduleId}/enrollments`).then((r) => r.data),
  enroll: (scheduleId, data) =>
    api.post(`/classes/schedules/${scheduleId}/enroll`, data).then((r) => r.data),
  markAttended: (enrollmentId) =>
    api.put(`/classes/enrollments/${enrollmentId}/attend`).then((r) => r.data),
  cancelEnrollment: (enrollmentId) =>
    api.delete(`/classes/enrollments/${enrollmentId}`),
};
