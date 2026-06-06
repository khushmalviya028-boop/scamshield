import axios, { AxiosError, AxiosResponse } from 'axios';
import { API_URL } from '../config';

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

client.interceptors.request.use(
  (config) => {
    if (__DEV__) {
      console.log(`[ScamShield API] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }
    return config;
  },
  (error: AxiosError) => {
    if (__DEV__) {
      console.error('[ScamShield API] Request error:', error.message);
    }
    return Promise.reject(error);
  },
);

client.interceptors.response.use(
  (response: AxiosResponse) => {
    if (__DEV__) {
      console.log(`[ScamShield API] Response ${response.status}:`, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    if (__DEV__) {
      console.error(
        '[ScamShield API] Response error:',
        error.response?.status,
        error.message,
      );
    }
    return Promise.reject(error);
  },
);

export default client;
