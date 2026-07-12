import api from "./api";

export const trainingService = {
  getMuscleGroups: () => api.get("/training/muscle-groups").then((r) => r.data),
  createMuscleGroup: (data) => api.post("/training/muscle-groups", data).then((r) => r.data),
  updateMuscleGroup: (id, data) => api.put(`/training/muscle-groups/${id}`, data).then((r) => r.data),
  deleteMuscleGroup: (id) => api.delete(`/training/muscle-groups/${id}`),

  getExercises: () => api.get("/training/exercises").then((r) => r.data),
  createExercise: (data) => api.post("/training/exercises", data).then((r) => r.data),
  updateExercise: (id, data) => api.put(`/training/exercises/${id}`, data).then((r) => r.data),

  getRoutines: () => api.get("/training/routines").then((r) => r.data),
  getRoutine: (id) => api.get(`/training/routines/${id}`).then((r) => r.data),
  createRoutine: (data) => api.post("/training/routines", data).then((r) => r.data),
  updateRoutine: (id, data) => api.put(`/training/routines/${id}`, data).then((r) => r.data),
  addExerciseToRoutine: (routineId, data) => api.post(`/training/routines/${routineId}/exercises`, data).then((r) => r.data),
  removeExerciseFromRoutine: (reId) => api.delete(`/training/routine-exercises/${reId}`),

  getRoutineMembers: (routineId) => api.get(`/training/routine/${routineId}/members`).then((r) => r.data),
  assignRoutine: (data) => api.post("/training/assign", data).then((r) => r.data),
  getMemberRoutines: (memberId) => api.get(`/training/member/${memberId}`).then((r) => r.data),
  updateMemberRoutine: (id, data) => api.put(`/training/member-routines/${id}`, data).then((r) => r.data),
};
