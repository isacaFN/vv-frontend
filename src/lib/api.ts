import axios from 'axios';
import { loginConVolver } from '@/lib/volver';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Sesión vencida: al login, recordando dónde estaba para volver ahí después de entrar.
      window.location.href = loginConVolver(window.location.pathname + window.location.search + window.location.hash);
    }
    return Promise.reject(error);
  }
);
