import api from "./api";

export const lockerService = {
  getLockers: (params) => api.get("/lockers", { params }).then((r) => r.data),
  createLocker: (data) => api.post("/lockers", data).then((r) => r.data),
  updateLocker: (id, data) => api.put(`/lockers/${id}`, data).then((r) => r.data),
  getLockerHistory: (id) => api.get(`/lockers/${id}/rentals`).then((r) => r.data),

  getRentals: (activeOnly = true) =>
    api.get("/lockers/rentals", { params: { active_only: activeOnly } }).then((r) => r.data),
  getExpiring: (days = 7) =>
    api.get("/lockers/rentals/expiring", { params: { days } }).then((r) => r.data),
  rentLocker: (lockerId, data) => api.post(`/lockers/${lockerId}/rent`, data).then((r) => r.data),
  updateRental: (rentalId, data) => api.put(`/lockers/rentals/${rentalId}`, data).then((r) => r.data),
};
