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

// Helper to resolve the API base URL (no trailing slash, no `/api`)
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

export default function ProgramDetails({ navigation, route }) {
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  // Params from navigation
  const { programName, program, noProgram, message } =
    (route && route.params) || {};
  const [title, setTitle] = useState(programName || "Program Details");

  // Normalized weeks → days → workouts for centered column display
  const [weeks, setWeeks] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [activeProgram, setActiveProgram] = useState(null);
  const [loadingActive, setLoadingActive] = useState(false);

  const formatWorkoutLabel = (w) => {
    // Build a concise label from known fields; fall back to name
    if (!w) return "";
    if (w.distanceKm) return `${w.name || "Run"} · ${w.distanceKm} km`;
    if (w.distanceM) return `${w.name || "Run"} · ${w.distanceM} m`;
    if (w.durationSec && w.sets)
      return `${w.name || "Intervals"} · ${w.sets}×${Math.round(
        w.durationSec / 60
      )} min`;
    if (w.durationSec)
      return `${w.name || "Session"} · ${Math.round(w.durationSec / 60)} min`;
    if (w.sets && w.reps)
      return `${w.name || "Strength"} · ${w.sets}×${w.reps}`;
    return w.name || "Workout";
  };

  const formatExerciseLabel = (ex) => {
    if (!ex) return "";
    const n = ex.name || "Exercise";
    if (ex.distanceKm) return `${n} — ${ex.distanceKm} km`;
    if (ex.distanceM) return `${n} — ${ex.distanceM} m`;
    if (ex.durationSec && ex.sets)
      return `${n} — ${ex.sets}×${Math.round(ex.durationSec / 60)} min`;
    if (ex.durationSec) return `${n} — ${Math.round(ex.durationSec / 60)} min`;
    if (ex.sets && ex.reps) return `${n} — ${ex.sets}×${ex.reps}`;
    return n;
  };

  const normalizeWeeks = useCallback((p) => {
    if (!p) return [];
    const src = Array.isArray(p.weeks)
      ? p.weeks
      : Array.isArray(p.workouts)
      ? p.workouts
      : [];
    return src.map((w, wi) => {
      const weekNumber =
        (typeof w.week === "number" && w.week) ||
        (typeof w.number === "number" && w.number) ||
        (typeof w.index === "number" && w.index + 1) ||
        (typeof w.weekIndex === "number" && w.weekIndex + 1) ||
        wi + 1;

      const days = Array.isArray(w.days)
        ? w.days.map((d, di) => {
            const title = d.title || d.name || `Day ${di + 1}`;
            const dayWorkouts = Array.isArray(d.workouts) ? d.workouts : [];
            // Each day workout may itself contain exercises; prefer the workout's name
            const workouts = dayWorkouts.map((dw) => {
              const wName =
                dw.name ||
                (Array.isArray(dw.exercises) && dw.exercises[0]
                  ? formatWorkoutLabel(dw.exercises[0])
                  : formatWorkoutLabel(dw));
              const exercises = Array.isArray(dw.exercises)
                ? dw.exercises.map((ex) => formatExerciseLabel(ex))
                : [];
              return { name: wName, exercises };
            });
            return {
              dayIndex: d.dayIndex ?? di,
              title,
              workouts,
            };
          })
        : [];

      return { week: weekNumber, days };
    });
  }, []);

  useEffect(() => {
    setTitle(programName || program?.name || "Program Details");
    setWeeks(normalizeWeeks(program));
  }, [programName, program, normalizeWeeks]);

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
        const movedRightEnough = dx > 50; // distance
        const horizontalEnough = Math.abs(dx) > Math.abs(dy);
        const fastEnough = vx > 0.1; // velocity
        const isRightSwipe =
          startedAtEdge && movedRightEnough && horizontalEnough && fastEnough;
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

  // Helper to fetch the user's current/active program (first program returned)
  const fetchActiveProgram = useCallback(async (uid, token) => {
    const base = resolveApiBase();
    const res = await fetch(`${base}/users/${uid}/training-programs`, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Expires": "0",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;
    return Array.isArray(data) ? (data[0] || null) : data;
  }, []);

  // Helper: persist active program id to SecureStore
  // Refetch active program on focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      (async () => {
        try {
          setLoadingActive(true);
          const storedUserId = await SecureStore.getItemAsync("userId");
          const token =
            (await SecureStore.getItemAsync("authToken")) ||
            (await SecureStore.getItemAsync("token")) ||
            (await SecureStore.getItemAsync("accessToken")) || null;
          if (!storedUserId || !token) {
            if (isMounted) setActiveProgram(null);
            return;
          }
          const ap = await fetchActiveProgram(storedUserId, token);
          if (isMounted) setActiveProgram(ap);
        } catch (e) {
          console.log("[ProgramDetails] fetch active error", e?.message || e);
          if (isMounted) setActiveProgram(null);
        } finally {
          if (isMounted) setLoadingActive(false);
        }
      })();
      return () => {
        isMounted = false;
      };
    }, [fetchActiveProgram])
  );

  const persistActiveProgramId = useCallback(async (p) => {
    try {
      const pid = p?.id || p?.programId;
      if (pid) {
        await SecureStore.setItemAsync("programId", String(pid));
      }
    } catch {}
  }, []);

  const handleBeginPrep = useCallback(async () => {
    try {
      setSubmitting(true);
      console.log("[ProgramDetails] BeginPrep tapped", {
        viewingProgramId: program?.id || program?.programId,
        activeProgramId: activeProgram?.id || activeProgram?.programId,
      });

      // Resolve user id
      const storedUserId = await SecureStore.getItemAsync("userId");
      const uid =
        storedUserId ||
        program?.userId ||
        (route && route.params && route.params.userId);
      if (!uid) {
        Alert.alert("Missing user ID", "Could not determine your user ID.");
        return;
      }

      // Resolve token
      const tokenKeys = ["accessToken", "token", "idToken", "jwt", "authToken"];
      let authToken = null;
      for (const k of tokenKeys) {
        const v = await SecureStore.getItemAsync(k);
        if (v) { authToken = v; break; }
      }
      if (!authToken) {
        Alert.alert("Not signed in", "Your session token is missing. Please log in again.");
        try { navigation.navigate("Login"); } catch {}
        return;
      }

      const base = resolveApiBase();
      const chooseUrl = `${base}/users/${uid}/program/choose`;

      // Determine active program (if any)
      const active = await fetchActiveProgram(uid, authToken);
      const activeId = active?.id || active?.programId || null;
      const activeName = active?.name || "Current Program";
      const targetId = program?.id || program?.programId || null;
      const targetName = program?.name || programName || "Selected Program";

      // If no active program, enroll directly
      if (!activeId) {
        const res = await fetch(chooseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ programId: targetId }),
        });
        if (!res.ok) throw new Error(`Enroll failed (${res.status})`);
        const data = await res.json().catch(() => null);
        // Verify server state by refetching the active program
        const verified = await fetchActiveProgram(uid, authToken);
        if (verified) {
          await persistActiveProgramId(verified);
        }
        Alert.alert("Subscribed", "Your training program has been selected.");
        console.log("[ProgramDetails] verified active program", verified || data);
        navigation.replace("Home", { refreshed: true, subscription: verified || data });
        return;
      }

      // Already enrolled in this same program
      if (activeId && targetId && String(activeId) === String(targetId)) {
        Alert.alert(
          "Already Enrolled",
          `You're already enrolled in "${targetName}".`,
          [
            { text: "Keep Current", style: "cancel" },
            {
              text: "Re-enroll",
              onPress: async () => {
                const res = await fetch(chooseUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({ programId: targetId }),
                });
                if (!res.ok) throw new Error(`Enroll failed (${res.status})`);
                const data = await res.json().catch(() => null);
                const verified = await fetchActiveProgram(uid, authToken);
                if (verified) {
                  await persistActiveProgramId(verified);
                }
                Alert.alert("Re-subscribed", "Your program has been refreshed.");
                console.log("[ProgramDetails] verified active program", verified || data);
                navigation.replace("Home", { refreshed: true, subscription: verified || data });
              },
            },
          ]
        );
        return;
      }

      // Enrolled in a different program — offer to switch
      Alert.alert(
        "Switch Program?",
        `You're currently enrolled in "${activeName}".\nSwitch to "${targetName}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch",
            style: "destructive",
            onPress: async () => {
              // Optional: mark the current program as complete via the user's route hint
              // Note: if your backend expects a different payload for completion, adjust here.
              try {
                const completeUrl = `${base}/users/${uid}/program/complete`;
                await fetch(completeUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({ programId: activeId }),
                }).catch(() => {});
              } catch {}

              // Choose the new program
              const res = await fetch(chooseUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ programId: targetId }),
              });
              if (!res.ok) throw new Error(`Switch failed (${res.status})`);
              const data = await res.json().catch(() => null);
              const verified = await fetchActiveProgram(uid, authToken);
              if (verified) {
                await persistActiveProgramId(verified);
              }
              Alert.alert("Switched", `You are now enrolled in "${targetName}".`);
              console.log("[ProgramDetails] verified active program", verified || data);
              navigation.replace("Home", { refreshed: true, subscription: verified || data });
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert("Action failed", String(err?.message || err));
    } finally {
      setSubmitting(false);
    }
  }, [navigation, program, programName, route, fetchActiveProgram, persistActiveProgramId]);

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
                  tw`mb-6 text-center text-4xl`,
                  { color: "#87DAF0", fontFamily: "Joan" },
                ]}
              >
                {title}
              </Text>
            </View>


            {/* Not enrolled / error message */}
            {noProgram ? (
              <View
                style={{
                  width: maxWidth,
                  alignSelf: "center",
                  marginBottom: 24,
                }}
              >
                <Text
                  style={{
                    color: "#000",
                    fontFamily: "Joan",
                    fontSize: 18,
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                >
                  {message || "You’re not enrolled in a training program yet."}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Home")}
                  style={{
                    backgroundColor: "#E6B82C",
                    paddingVertical: 10,
                    paddingHorizontal: 22,
                    borderRadius: 20,
                    alignSelf: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#000",
                      fontSize: 18,
                      fontFamily: "Joan",
                      fontWeight: "600",
                    }}
                  >
                    Go Home and Enroll
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Weeks → Days → Workouts (centered column) */}
            {weeks.length > 0 && !noProgram ? (
              <View
                style={{
                  width: maxWidth,
                  alignSelf: "center",
                  marginBottom: 24,
                }}
              >
                {weeks.map((wk) => (
                  <View
                    key={`week-${wk.week}`}
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: 12,
                      marginBottom: 16,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "rgba(0,0,0,0.08)",
                    }}
                  >
                    <View
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: "#EEE",
                      }}
                    >
                      <Text
                        style={{
                          color: "#0E0E0E",
                          fontFamily: "Joan",
                          fontSize: 20,
                          textAlign: "center",
                        }}
                      >
                        {`Week ${wk.week}`}
                      </Text>
                    </View>

                    <View style={{ paddingVertical: 8 }}>
                      {wk.days.map((day) => (
                        <View
                          key={`w${wk.week}-d${day.dayIndex}`}
                          style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                        >
                          <Text
                            style={{
                              color: "#0E0E0E",
                              fontFamily: "Joan",
                              fontSize: 18,
                              textAlign: "center",
                            }}
                          >
                            {day.title}
                          </Text>
                          {Array.isArray(day.workouts) &&
                          day.workouts.length > 0 ? (
                            <View style={{ marginTop: 6 }}>
                              {day.workouts.map((w, wi) => (
                                <View
                                  key={`w${wk.week}-d${day.dayIndex}-workout-${wi}`}
                                  style={{ marginTop: wi === 0 ? 0 : 6 }}
                                >
                                  <Text
                                    style={{
                                      color: "#333",
                                      fontFamily: "Joan",
                                      fontSize: 16,
                                      textAlign: "center",
                                    }}
                                  >
                                    {w.name}
                                  </Text>
                                  {Array.isArray(w.exercises) &&
                                  w.exercises.length > 0 ? (
                                    <View style={{ marginTop: 4 }}>
                                      {w.exercises.map((label, ei) => (
                                        <Text
                                          key={`w${wk.week}-d${day.dayIndex}-ex-${ei}`}
                                          style={{
                                            color: "#444",
                                            fontFamily: "Manrope",
                                            fontSize: 14,
                                            textAlign: "center",
                                            marginTop: 2,
                                          }}
                                        >
                                          {label}
                                        </Text>
                                      ))}
                                    </View>
                                  ) : null}
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : !noProgram ? (
              <Text
                style={{
                  color: "#000",
                  fontFamily: "Joan",
                  fontSize: 18,
                  textAlign: "center",
                  marginVertical: 24,
                }}
              >
                No program structure to display.
              </Text>
            ) : null}

            {/* Done button */}
            <TouchableOpacity
              onPress={handleBeginPrep}
              disabled={submitting}
              style={{
                backgroundColor: "#E6B82C",
                paddingVertical: 10,
                paddingHorizontal: 22,
                borderRadius: 20,
                minWidth: 110,
                alignItems: "center",
                justifyContent: "center",
                opacity: submitting ? 0.6 : 1,
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
                {submitting ? "Working..." : "Begin Prep"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
