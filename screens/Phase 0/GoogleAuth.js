import React, { useMemo, useRef } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { WebView } from "react-native-webview";

// Parse ?query=params from URL
function parseQuery(url) {
  try {
    const q = url.split("?")[1] || "";
    const usp = new URLSearchParams(q);
    const obj = {};
    usp.forEach((v, k) => (obj[k] = v));
    return obj;
  } catch {
    return {};
  }
}

export default function GoogleAuth() {
  const navigation = useNavigation();
  const route = useRoute();
  const webviewRef = useRef(null);

  const mode = route.params?.mode || "minimal";
  const baseURL =
    Platform.OS === "android" ? "http://10.0.2.2:3004" : "http://localhost:3004";
  const startUrl = useMemo(
    () => `${baseURL}/auth/google?mode=${encodeURIComponent(mode)}`,
    [baseURL, mode]
  );

  const handleNavChange = (navState) => {
    const { url } = navState || {};
    if (!url) return;

    // Treat any of these as success (adapt to your backend’s final redirect)
    if (
      url.includes("success=true") ||
      url.includes("/auth/google/success") ||
      url.includes("/auth/callback")
    ) {
      const params = parseQuery(url);
      const token = params.token || params.accessToken || params.jwt || null;
      const email = params.email || null;
      const name = params.name || null;
      const photo = params.photo || null;

      // Continue in your app
      navigation.replace("OutsideAuth", {
        token,
        email,
        name,
        photo,
        provider: "google",
      });
    }

    // Basic error/deny handling
    if (url.includes("error=") || url.includes("denied")) {
      navigation.goBack();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <WebView
        ref={webviewRef}
        source={{ uri: startUrl }}
        onNavigationStateChange={handleNavChange}
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        )}
      />
    </View>
  );
}