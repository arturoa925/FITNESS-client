
import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import tw from "twrnc";
import * as SecureStore from "expo-secure-store";
import { useUser } from "../../components/UserContext";
import { resolveApiBase } from "../../utils/api";

export default function AuthGate({ navigation }) {
  const { setUser } = useUser();

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const [token, cachedJson] = await Promise.all([
          SecureStore.getItemAsync("authToken"),
          SecureStore.getItemAsync("cachedUserProfile"),
        ]);

        // No prior login → go to Welcome
        if (!token || !cachedJson) {
          if (isMounted) navigation.replace("Welcome");
          return;
        }

        let cachedUser;
        try {
          cachedUser = JSON.parse(cachedJson);
        } catch {
          if (isMounted) navigation.replace("Welcome");
          return;
        }

        if (!cachedUser?.id) {
          if (isMounted) navigation.replace("Welcome");
          return;
        }

        // Immediately hydrate user context from cache (works offline)
        if (isMounted) {
          setUser(cachedUser);
        }

        const baseURL = resolveApiBase();

        // Try to refresh from server (best-effort)
        try {
          const res = await fetch(`${baseURL}/users/${cachedUser.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            const fresh = await res.json();
            const normalized = {
              id: fresh.id || cachedUser.id,
              email: fresh.email || cachedUser.email,
              firstName: fresh.firstName || cachedUser.firstName,
              lastName: fresh.lastName || cachedUser.lastName,
              profilePicture:
                fresh.profilePicture || cachedUser.profilePicture || null,
              provider: fresh.provider || cachedUser.provider || "local",
              raw: fresh,
            };

            if (isMounted) {
              setUser(normalized);
            }

            await SecureStore.setItemAsync(
              "cachedUserProfile",
              JSON.stringify(normalized)
            );
          }
          // if !ok, just stay with cached user
        } catch (err) {
          // offline or server down → stay with cached user
        }

        if (isMounted) {
          navigation.replace("Home");
        }
      } catch (err) {
        if (isMounted) {
          navigation.replace("Welcome");
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [navigation, setUser]);

  return (
    <View style={tw`flex-1 items-center justify-center bg-white`}>
      <ActivityIndicator size="small" color="#111827" />
      <Text
        style={{
          marginTop: 8,
          fontFamily: "Manrope",
          fontSize: 14,
          color: "#4B5563",
        }}
      >
        Loading your session…
      </Text>
    </View>
  );
}