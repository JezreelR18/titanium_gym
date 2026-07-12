import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tg_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const hadToken = !!localStorage.getItem("tg_token");
    if (error.response?.status === 401 && hadToken) {
      localStorage.removeItem("tg_token");
      localStorage.removeItem("tg_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
