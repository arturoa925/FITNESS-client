import React, { useEffect } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";

// Safe JWT decode (works without requiring Buffer)
function decodeJwt(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return {};
    const payload = parts[1];
    const pad = "=".repeat((4 - (payload.length % 4)) % 4);
    const b64 = (payload + pad).replace(/-/g, "+").replace(/_/g, "/");
    let json = "";
    if (typeof atob === "function") {
      json = decodeURIComponent(
        Array.prototype.map
          .call(atob(b64), (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } else if (typeof Buffer !== "undefined") {
      json = Buffer.from(b64, "base64").toString("utf8");
    } else {
      return {};
    }
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export default function OutsideAuth({ route, navigation }) {
  const params = route?.params || {};
  const token = params.token || null;
  const provider = params.provider || "google";

  useEffect(() => {
    (async () => {
      try {
        // Store token if present
        if (token) {
          await SecureStore.setItemAsync("authToken", String(token));
        }

        // Derive user info from params or JWT claims so we don't lose names/photo
        const claims = token ? decodeJwt(token) : {};
        const paramFullName = (params.name || "").trim();
        const splitGiven = paramFullName ? paramFullName.split(/\s+/)[0] : null;
        const splitFamily = paramFullName ? paramFullName.split(/\s+/).slice(1).join(" ") : null;

        const firstName = params.firstName || claims.given_name || splitGiven || null;
        const lastName  = params.lastName  || claims.family_name || splitFamily || null;
        const email     = params.email     || claims.email || null;
        const photo     = params.photo     || claims.picture || null;

        // Navigate into the app; Home can pull what it needs from params or fetch /me
        navigation.replace("Home", {
          provider,
          email,
          firstName,
          lastName,
          name: firstName && lastName ? `${firstName} ${lastName}` : paramFullName || null,
          photo,
        });
      } catch (e) {
        console.log("[OutsideAuth] error:", e);
        Alert.alert("Error", "Could not finish sign-in.");
        navigation.replace("Welcome");
      }
    })();
   
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
      <ActivityIndicator />
    </View>
  );
}
