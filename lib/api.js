import axios from "axios";
import Constants from "expo-constants";

const baseURL = Constants?.expoConfig?.extra?.API_BASE_URL;

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

// Attach token if present
import { getToken } from "./auth";
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});