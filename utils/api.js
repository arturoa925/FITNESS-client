// client/utils/api.js
import { Platform } from "react-native";

export const resolveApiBase = () => {
  // If you define this in app.config.js / .env for Expo:
  // EXPO_PUBLIC_API_BASE="http://192.168.1.68:3004"
  if (process.env.EXPO_PUBLIC_API_BASE) {
    return process.env.EXPO_PUBLIC_API_BASE;
  }

  // Fallbacks for dev
  if (Platform.OS === "android") {
    // Android emulator -> host machine
    return "http://10.0.2.2:3004";
  }

  // iOS simulator / web – change to your LAN IP if needed
  return "http://localhost:3004";
};