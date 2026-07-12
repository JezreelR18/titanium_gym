import api from "./api";

export const inventoryService = {
  // Summary
  getSummary: () => api.get("/inventory/summary").then((r) => r.data),

  // Categories
  getCategories: () => api.get("/inventory/categories").then((r) => r.data),
  createCategory: (data) => api.post("/inventory/categories", data).then((r) => r.data),
  updateCategory: (id, data) => api.put(`/inventory/categories/${id}`, data).then((r) => r.data),
  deleteCategory: (id) => api.delete(`/inventory/categories/${id}`),

  // Products
  getProducts: (params) => api.get("/inventory", { params }).then((r) => r.data),
  createProduct: (data) => api.post("/inventory", data).then((r) => r.data),
  updateProduct: (id, data) => api.put(`/inventory/${id}`, data).then((r) => r.data),

  // Movements
  getMovements: (params) => api.get("/inventory/movements", { params }).then((r) => r.data),
  addMovement: (productId, data) =>
    api.post(`/inventory/${productId}/movement`, data).then((r) => r.data),
};
