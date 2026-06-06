import axios from 'axios';
import { API_URL } from '../../config';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (__DEV__) {
      console.warn('[ScamShield API Error]', error?.response?.status, error?.message);
    }
    return Promise.reject(error);
  }
);
