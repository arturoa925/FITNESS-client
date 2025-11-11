import React, { useEffect, useState, useCallback, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Pressable,
  useWindowDimensions,
  KeyboardAvoidingView,
  ScrollView,
  Image,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import * as Network from "expo-network";

// Resolve API base for simulator/device (no trailing slash)
const resolveApiBase = () => {
  const env = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (env) return env.replace(/\/+$/, "");
  let host = null;
  try {
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants?.manifest?.debuggerHost;
    if (hostUri) host = String(hostUri).split(":")[0];
  } catch {}
  if (Platform.OS === "android") {
    return host ? `http://${host}:3004` : `http://10.0.2.2:3004`;
  }
  return host ? `http://${host}:3004` : `http://127.0.0.1:3004`;
};

// Reusable exercise card
function ExerciseCard({ exercise, maxWidth }) {
  return (
    <View style={{ width: maxWidth, alignSelf: "center", paddingVertical: 16 }}>
      {/* Exercise Name */}
      <Text
        style={{
          textAlign: "center",
          color: "#000000ff",
          fontFamily: "Joan",
          fontSize: 20,
          marginBottom: 8,
        }}
      >
        {exercise.name}
      </Text>

      {/* Image placeholder or real image */}
      {exercise.imageUri ? (
        <Image
          source={{ uri: exercise.imageUri }}
          style={{
            width: maxWidth * 0.8,
            height: maxWidth * 0.6,
            alignSelf: "center",
            borderRadius: 12,
            marginTop: 20,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: maxWidth * 0.8,
            height: maxWidth * 0.6,
            alignSelf: "center",
            borderRadius: 12,
            marginTop: 20,
            backgroundColor: "#ccc",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Joan",
              color: "#000",
              fontSize: 18,
              textAlign: "center",
            }}
          >
            Image Placeholder
          </Text>
        </View>
      )}

      {/* Target and Description */}
      <Text
        style={{
          fontFamily: "Joan",
          color: "#000",
          fontSize: 18,
          textAlign: "center",
          marginTop: 30,
          borderWidth: 1,
          borderColor: "#000",
          padding: 10,
          width: maxWidth * 0.9,
          alignSelf: "center",
        }}
      >
        {exercise.description}
      </Text>

      {/* Reps */}
      <View style={{ width: maxWidth * 0.9, marginTop: 30, marginBottom: 50,alignSelf: "center" }}>
        {(exercise.reps || []).map((line, idx) => (
          <View
            key={`rep-${exercise.id || exercise.name}-${idx}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              marginBottom: 6,
            }}
          >
            <Text style={{ fontFamily: "Joan", fontSize: 18, color: "#000", marginRight: 8 }}>•</Text>
            <Text
              style={{
                fontFamily: "Joan",
                fontSize: 20,
                color: "#000",
                lineHeight: 26,
                textAlign: "center",
              }}
            >
              {line}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function DailyGrind({ navigation }) {
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  // Online-only AI plan state
  const [planId, setPlanId] = useState(null);
  const [exercises, setExercises] = useState([]); // start empty; requires internet/AI
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // --- Swipe right to go Home ---
  const swipeHandledRef = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        const { dx, dy, x0 } = gesture;
        const startedAtEdge = x0 <= 24; // require touch to begin within 24px of left edge
        const horizontal = Math.abs(dx) > Math.abs(dy);
        return startedAtEdge && horizontal && Math.abs(dx) > 10;
      },
      onPanResponderGrant: (_evt, gesture) => {
        swipeHandledRef.current = false;
        // No-op, kept for clarity; could add visual feedback here if desired
      },
      onPanResponderMove: () => {},
      onPanResponderRelease: (_evt, gesture) => {
        const { dx, vx, dy, x0 } = gesture;
        const startedAtEdge = x0 <= 32;
        const movedRightEnough = dx > 50;     // distance
        const horizontalEnough = Math.abs(dx) > Math.abs(dy);
        const fastEnough = vx > 0.1;          // velocity
        const isRightSwipe = startedAtEdge && movedRightEnough && horizontalEnough && fastEnough;
        if (isRightSwipe && !swipeHandledRef.current) {
          swipeHandledRef.current = true;
          try {
            navigation.navigate("Home");
          } finally {
            setTimeout(() => {
              swipeHandledRef.current = false;
            }, 400);
          }
        }
      },
      onPanResponderTerminationRequest: () => true,
    })
  ).current;

  // Generate immediately when the screen gains focus
  useFocusEffect(
    useCallback(() => {
      // fire-and-forget; generateDailyWorkout handles connectivity + errors
      generateDailyWorkout();
      return () => {};
    }, [generateDailyWorkout])
  );

  const generateDailyWorkout = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      // Require internet connectivity
      const net = await Network.getNetworkStateAsync();
      if (!net?.isConnected || !net?.isInternetReachable) {
        setPlanId(null);
        setExercises([]);
        setErrorMsg("No internet connection. Connect to the internet to generate today's workout.");
        return;
      }
      // Server AI only
      const base = resolveApiBase();
      const token =
        (await SecureStore.getItemAsync("authToken")) ||
        (await SecureStore.getItemAsync("token")) ||
        (await SecureStore.getItemAsync("accessToken"));
      const userId = (await SecureStore.getItemAsync("userId")) || "anonymous";
      const res = await fetch(`${base}/ai/daily-workout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          // Optional: pass lightweight context, no program linkage
          preferences: { equipment: "any", timeMin: 30, focus: "balanced" },
        }),
      });
      if (!res.ok) {
        setPlanId(null);
        setExercises([]);
        setErrorMsg(`Server error (${res.status}). Unable to generate workout right now.`);
        return;
      }
      const payload = await res.json().catch(() => null);
      if (!payload || !payload.exercises || !Array.isArray(payload.exercises) || payload.exercises.length === 0) {
        setPlanId(null);
        setExercises([]);
        setErrorMsg("No workout returned. Please try again in a moment.");
        return;
      }
      setPlanId(payload.id || Date.now().toString());
      setExercises(payload.exercises);
    } catch (e) {
      setPlanId(null);
      setExercises([]);
      setErrorMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={tw`flex-grow`}
          keyboardShouldPersistTaps="handled"
        >
          {/* outer centered container with max width */}
          <View
            {...panResponder.panHandlers}
            style={[tw`flex-1 items-center`, { paddingHorizontal: 16 }]}
          >
            <View
              style={{
                width: maxWidth,
                alignSelf: "center",
                paddingVertical: isShort ? 16 : 24,
              }}
            >
              {/* Title */}
              <Text
                style={[
                  tw`mb-6 text-center text-5xl`,
                  { color: "#87DAF0", fontFamily: "Joan" },
                ]}
              >
                Daily Grind
              </Text>
            </View>

            {errorMsg ? (
              <Text style={{ color: "#B00020", fontFamily: "Joan", fontSize: 14, textAlign: "center", marginBottom: 8 }}>
                {errorMsg}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={generateDailyWorkout}
              disabled={loading}
              style={{
                backgroundColor: "#4DA3FF",
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 16,
                opacity: loading ? 0.7 : 1,
                marginBottom: 6,
              }}
            >
              <Text style={{ color: "#fff", fontFamily: "Joan", fontSize: 16 }}>
                {loading ? "Generating…" : (exercises.length ? "Regenerate" : "Generate Workout")}
              </Text>
            </TouchableOpacity>

            {/* Exercises list */}
            {exercises.map((ex) => (
              <ExerciseCard key={ex.id} exercise={ex} maxWidth={maxWidth} />
            ))}


            {/* Done button */}
            <TouchableOpacity
                              onPress={() => {
                                navigation.replace("Home");
                                Alert.alert("Button pressed")}}
                              style={{
                                backgroundColor: "#E6B82C",
                                paddingVertical: 10,
                                paddingHorizontal: 22,
                                borderRadius: 20,
                                minWidth: 110,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#000",
                                  fontSize: 24,
                                  fontFamily: "Joan",
                                  fontWeight: "600",
                                }}
                               
                              >
                               Done for the Day
                              </Text>
                            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
