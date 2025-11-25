import React, { useEffect, useState, useCallback, useRef } from "react";
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
  Modal,
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar } from "react-native-calendars";
import { Picker } from "@react-native-picker/picker";
import { TouchableWithoutFeedback } from "react-native";

import { FlatList } from "react-native";

// Resolve API base robustly for simulator/device (port 3004, no trailing slash)
const resolveApiBase = () => {
  const env = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (env) return env.replace(/\/+$/, "");
  const isAndroid = Platform.OS === "android";
  // Try to derive host used by Expo dev session (optional)
  let host = null;
  try {
    const Constants = require("expo-constants").default;
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants?.manifest?.debuggerHost;
    if (hostUri) host = String(hostUri).split(":")[0];
  } catch {}
  if (isAndroid) {
    return host ? `http://${host}:3004` : `http://10.0.2.2:3004`;
  }
  return host ? `http://${host}:3004` : `http://127.0.0.1:3004`;
};

// Normalize weeks from different backend shapes
const deriveWeeksFromProgram = (programLike, fallbackDuration) => {
  if (!programLike) return [];
  // 1) Native weeks array
  if (Array.isArray(programLike.weeks)) return programLike.weeks;
  // 2) Workouts grouped by weekIndex → build weeks with days
  if (Array.isArray(programLike.workouts)) {
    const grouped = {};
    for (const w of programLike.workouts) {
      const wi = Number(w.weekIndex ?? w.week ?? 0);
      if (!grouped[wi]) grouped[wi] = [];
      const days = Array.isArray(w.days) ? w.days : [];
      grouped[wi].push(...days);
    }
    // Convert grouped map to ordered weeks [{ days: [...] }, ...]
    const weekIndexes = Object.keys(grouped)
      .map((n) => Number(n))
      .sort((a, b) => a - b);
    return weekIndexes.map((i) => ({ days: grouped[i] }));
  }
  // 3) Duration fallback → create empty weeks
  const dur = Number(programLike.duration ?? fallbackDuration ?? 0);
  if (dur > 0) {
    return Array.from({ length: dur }, () => ({ days: [] }));
  }
  return [];
};

// Retrieve the user's current training program (requires auth token)
const fetchCurrentProgram = async (userId, token, baseURL) => {
  if (!userId || !token) return null;
  const url = `${baseURL}/users/${userId}/training-programs`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Expires: "0",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (Array.isArray(data) && data.length) return data[0];
    return data;
  } catch (err) {
    console.error("[fetchCurrentProgram] error:", err);
    return null;
  }
};

// A day is completed if explicitly flagged OR if all workouts are completed.
const isDayCompleted = (day) => {
  if (!day) return false;
  if (day.completed || day.done || day.status === "done") return true;
  if (Array.isArray(day.workouts) && day.workouts.length > 0) {
    return day.workouts.every(
      (w) => w?.completed === true || w?.done === true || w?.status === "done"
    );
  }
  return false;
};

// Map a training program to its hero image
const getProgramHeroImage = (program) => {
  try {
    if (!program) {
      return require("../../assets/gym.jpeg");
    }
    const key = String(program.slug || program.name || "")
      .toLowerCase()
      .trim();

    if (
      key.includes("half-marathon") ||
      key.includes("marathon")
    ) {
      return require("../../assets/marathon.jpeg");
    }

    if (
      key.includes("hypertrophy") ||
      key.includes("split") ||
      key.includes("hybrid")
    ) {
      return require("../../assets/hybrid.jpeg");
    }

    if (key.includes("kettlebell")) {
      return require("../../assets/kb2.jpeg");
    }

    if (key.includes("yoga")) {
      return require("../../assets/yoga3.jpeg");
    }

    if (key.includes("calisthenics")) {
      return require("../../assets/calis.jpeg");
    }

    // Fallback hero
    return require("../../assets/gym.jpeg");
  } catch (e) {
    // In case require fails for some reason, use a safe fallback
    return require("../../assets/gym.jpeg");
  }
};

// * user context
import { useUser } from "../../components/UserContext";

// * components
import ProfileAvatarMenu from "../../components/Home/ProfilePic";
import ProgressBar from "../../components/Home/CurrentWeekBar";
import CalendarFoodLog from "../../components/Home/Calendar";

export default function Home({ navigation, route }) {
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  // * user context
  const { user, pendingOps, syncPendingOps } = useUser();

  // * log out user
  const handleLogout = async () => {
    try {
      // Get the stored token (optional)
      const token = await SecureStore.getItemAsync("authToken");

      const baseURL =
        Platform.OS === "android"
          ? "http://10.0.2.2:3004"
          : "http://localhost:3004";
      const logoutUrl = `${baseURL}/users/logout`;

      await fetch(logoutUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      // Clear all auth-related data
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("refreshToken");

      // Navigate back to Welcome
      navigation.replace("Welcome");
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Unable to log out. Please try again.");
    }
  };

  const [weekInfo, setWeekInfo] = useState({
    current: null,
    total: null,
    noProgram: false,
  });
  const [currentProgram, setCurrentProgram] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [calendarUserId, setCalendarUserId] = useState(null);
  const [calendarAuthToken, setCalendarAuthToken] = useState(null);
  const handleOpenSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const storedId = await SecureStore.getItemAsync("userId");
      if (!storedId) {
        Alert.alert("Sign in required", "Please log in to view your sessions.");
        return;
      }
      const baseURL = resolveApiBase();
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert(
          "Authentication required",
          "Your session expired. Please sign in again."
        );
        navigation.navigate("Login");
        return;
      }

      // Prefer the latest from the dedicated endpoint
      let program = await fetchCurrentProgram(storedId, token, baseURL);

      // If we landed here right after subscribing, also consider a recent payload
      if (!program && route?.params?.subscription) {
        const sub = route.params.subscription;
        program =
          sub?.trainingProgram ||
          sub?.program ||
          (Array.isArray(sub?.trainingPrograms)
            ? sub.trainingPrograms[0]
            : null) ||
          null;
      }

      if (!program) {
        Alert.alert(
          "No training program",
          "You aren't enrolled in a program yet."
        );
        return;
      }

      const weeks = deriveWeeksFromProgram(program, program?.duration);
      navigation.navigate("Sessions", {
        program,
        weeks,
        totalWeeks: weeks?.length || Number(program?.duration) || 0,
      });
    } catch (e) {
      console.error("[Home] handleOpenSessions error:", e);
      Alert.alert("Error", "Could not load your training program.");
    } finally {
      setSessionsLoading(false);
    }
  }, [navigation, route]);

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const storedId = await SecureStore.getItemAsync("userId");
        const token = await SecureStore.getItemAsync("authToken");
        const resolvedUserId = storedId || user?.id || null;

        if (isActive) {
          setCalendarUserId(resolvedUserId);
          setCalendarAuthToken(token || null);
        }
      } catch (e) {
        console.error("[Home] calendar creds error:", e);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        // If we were navigated here with a fresh subscription/program payload, update immediately
        try {
          const sub = route?.params?.subscription;
          if (sub) {
            const programFromSub =
              sub?.trainingProgram ||
              sub?.program ||
              (Array.isArray(sub?.trainingPrograms)
                ? sub.trainingPrograms[0]
                : null) ||
              null;
            if (programFromSub && isActive) {
              setCurrentProgram(programFromSub);
            }
            const weeksArrSub =
              deriveWeeksFromProgram(
                programFromSub,
                programFromSub?.duration
              ) || (Array.isArray(sub?.weeks) ? sub.weeks : []);
            const totalWeeksSub =
              weeksArrSub.length || Number(programFromSub?.duration) || 0;
            if (totalWeeksSub > 0) {
              const completedWeeksSub = weeksArrSub.reduce((acc, w) => {
                const daysArr = Array.isArray(w?.days)
                  ? w.days
                  : Array.isArray(w)
                  ? w
                  : [];
                const td = Number(w.totalDays) || daysArr.length;
                const cd =
                  Number(w.completedDays) ||
                  daysArr.filter(isDayCompleted).length;
                return acc + (td > 0 && cd >= td ? 1 : 0);
              }, 0);
              const currentWeekSub = Math.min(
                totalWeeksSub,
                completedWeeksSub + 1
              );
              if (isActive)
                setWeekInfo({
                  current: currentWeekSub,
                  total: totalWeeksSub,
                  noProgram: false,
                });
            }
          }
        } catch {}
        try {
          const storedId = await SecureStore.getItemAsync("userId");
          if (!storedId) {
            if (isActive)
              setWeekInfo({ current: null, total: null, noProgram: true });
            return;
          }
          const baseURL = resolveApiBase();
          const token = await SecureStore.getItemAsync("authToken");

          // Before fetching fresh user/program data, try to sync any
          // offline-completed workouts queued in pendingOps.
          if (
            typeof syncPendingOps === "function" &&
            pendingOps &&
            pendingOps.length > 0 &&
            token
          ) {
            try {
              await syncPendingOps({
                userId: storedId,
                authToken: token,
                baseUrl: baseURL,
              });
            } catch (syncErr) {
              console.error("[Home] syncPendingOps error:", syncErr);
            }
          }

          const res = await fetch(`${baseURL}/users/${storedId}`, {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
              Expires: "0",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (!res.ok) {
            if (isActive)
              setWeekInfo({ current: null, total: null, noProgram: true });
            return;
          }
          const data = await res.json();
          // Resolve program and weeks from common shapes
          let program =
            (Array.isArray(data?.trainingPrograms) &&
              data.trainingPrograms[0]) ||
            data?.currentProgram ||
            data?.program ||
            null;
          if (!program) {
            program = await fetchCurrentProgram(storedId, token, baseURL);
          }
          if (program && isActive) {
            setCurrentProgram(program);
          }
          const weeksArr =
            deriveWeeksFromProgram(program, program?.duration) ||
            (Array.isArray(data?.weeks) ? data.weeks : []);
          const totalWeeks = weeksArr.length || Number(program?.duration) || 0;
          if (!program || totalWeeks === 0) {
            if (isActive)
              setWeekInfo({ current: null, total: null, noProgram: true });
            return;
          }
          // Count fully completed weeks
          const completedWeeks = weeksArr.reduce((acc, w) => {
            const daysArr = Array.isArray(w?.days)
              ? w.days
              : Array.isArray(w)
              ? w
              : [];
            const td = Number(w.totalDays) || daysArr.length;
            const cd =
              Number(w.completedDays) || daysArr.filter(isDayCompleted).length;
            return acc + (td > 0 && cd >= td ? 1 : 0);
          }, 0);
          // Current week is the next one in progress
          const currentWeek = Math.min(totalWeeks, completedWeeks + 1);
          if (isActive)
            setWeekInfo({
              current: currentWeek,
              total: totalWeeks,
              noProgram: false,
            });
        } catch (e) {
          console.error("[Home] week fetch error:", e);
          if (isActive)
            setWeekInfo({ current: null, total: null, noProgram: true });
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );

  // Hard-coded workout completions for display (YYYY-MM-DD)
  const completedWorkouts = {
    "2025-10-01": [{ name: "5K Run" }],
    "2025-10-02": [{ name: "Upper Body Lift" }],
    "2025-10-04": [{ name: "Mobility + Core" }],
    "2025-10-06": [{ name: "Long Run 8mi" }],
  };

  // Open ProgramDetails for a selected catalog program (from /users/training-programs)
  const handleOpenCatalogDetails = useCallback(
    async (label, slug) => {
      try {
        const token = await SecureStore.getItemAsync("authToken");
        const baseURL =
          Platform.OS === "android"
            ? "http://10.0.2.2:3004"
            : "http://localhost:3004";
        const res = await fetch(`${baseURL}/users/training-programs`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          navigation.navigate("ProgramDetails", {
            programName: label || "Program",
            program: null,
            noProgram: true,
            message: "Could not load training programs. Please try again.",
          });
          return;
        }
        const catalog = await res.json();
        let selected = null;
        if (Array.isArray(catalog)) {
          // 1) Exact slug/key/id equality (case-insensitive)
          if (slug) {
            const slugLc = String(slug).toLowerCase();
            selected =
              catalog.find((p) =>
                [p?.slug, p?.key, p?.id].some(
                  (v) => v && String(v).toLowerCase() === slugLc
                )
              ) || null;
          }

          // 2) Exact name equality (case-insensitive)
          if (!selected && label) {
            const labelLc = String(label).toLowerCase();
            selected =
              catalog.find(
                (p) =>
                  typeof p?.name === "string" &&
                  p.name.toLowerCase() === labelLc
              ) || null;
          }

          // 3) Alias-based partial matching (e.g., "Hybrid" → "Hypertrophy Split")
          if (!selected && label) {
            const labelLc = String(label).toLowerCase();
            const aliases = {
              hybrid: ["hypertrophy", "push", "pull", "split"],
              marathon: ["marathon", "half marathon"],
            };
            const needles = [labelLc, ...(aliases[labelLc] || [])];
            selected =
              catalog.find((p) => {
                const n = (p?.name || "").toLowerCase();
                return needles.some((k) => k && n.includes(k));
              }) || null;
          }
        }
        if (!selected) {
          navigation.navigate("ProgramDetails", {
            programName: label || "Program",
            program: null,
            noProgram: true,
            message: "Program not found in catalog.",
          });
          return;
        }
        // Pass the full selected program; ProgramDetails normalizes (workouts or weeks)
        navigation.navigate("ProgramDetails", {
          programName: selected.name || label || "Program",
          program: selected,
          noProgram: false,
          source: "catalog",
        });
      } catch (e) {
        console.error("[Home] handleOpenCatalogDetails error:", e);
        navigation.navigate("ProgramDetails", {
          programName: label || "Program",
          program: null,
          noProgram: true,
          message: "Something went wrong opening Program Details.",
        });
      }
    },
    [navigation]
  );

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}>
      {/* Formatting */}
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={tw`flex-grow`}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[tw`flex-1 items-center`, { paddingHorizontal: 16 }]}>
            <View
              style={{
                width: maxWidth,
                alignSelf: "center",
                paddingVertical: isShort ? 16 : 24,
              }}
            >
              {/* Profile picture placeholder (top right) */}
              <View style={{ alignItems: "flex-end" }}>
                <ProfileAvatarMenu
                  navigation={navigation}
                  onLogout={handleLogout}
                  profilePicture={user?.profilePicture}
                  user={{
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    id: user.id,
                    // password: userPasswordIfYouReallyStoreIt
                  }}
                />
              </View>

              {/* Title below, centered */}
              <Text
                style={[
                  tw`text-5xl`,
                  {
                    color: "#87DAF0",
                    fontFamily: "Joan",
                    textAlign: "center",
                    marginTop: 12,
                  },
                ]}
              >
                Fitness
              </Text>
              {/* hero section: gym image */}
              <View
                style={{ width: maxWidth, alignSelf: "center", marginTop: 16 }}
              >
                <View
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    backgroundColor: "#D9D9D9",
                  }}
                >
                  <Image
                    source={require("../../assets/gym.jpeg")}
                    style={{
                      width: "100%",
                      height: undefined,
                      aspectRatio: 16 / 10,
                    }}
                    resizeMode="cover"
                  />
                </View>

                {/* Main content right below image */}
                <View style={[tw`items-center mt-16`]}>
                  <Text
                    style={[
                      tw`text-center text-2xl`,
                      { color: "black", fontFamily: "Joan" },
                    ]}
                  >
                    Welcome to Today's Sweat
                  </Text>

                  <Text
                    style={[
                      tw`text-center text-3xl mt-8`,
                      { color: "black", fontFamily: "Joan" },
                    ]}
                  >
                    In Progress:
                  </Text>
                </View>

                <View
                  style={[tw`mt-4`, { borderRadius: 16, overflow: "hidden" }]}
                >
                  <Image
                    source={getProgramHeroImage(currentProgram)}
                    style={{
                      width: maxWidth * 0.8,
                      height: maxWidth * 0.6,
                      alignSelf: "center",
                      borderRadius: 12,
                    }}
                    resizeMode="cover"
                  />
                </View>
              </View>

              {/* statistics section */}
              <View
                style={[
                  tw`mt-8 mb-8`,
                  {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: maxWidth * 0.8,
                    alignSelf: "center",
                  },
                ]}
              >
                {/* weeks need to be updated with user data */}
                <Text
                  style={[
                    tw`text-3xl`,
                    {
                      color: "black",
                      fontFamily: "Joan",
                      opacity: weekInfo.noProgram ? 0.5 : 1,
                    },
                  ]}
                >
                  {weekInfo.current && weekInfo.total
                    ? `Week ${weekInfo.current}/${weekInfo.total}`
                    : "Week --/--"}
                </Text>

                {/* see sweat button on the right */}
                <TouchableOpacity
                  onPress={handleOpenSessions}
                  disabled={sessionsLoading}
                  style={{
                    backgroundColor: "#E6B82C",
                    paddingVertical: 10,
                    paddingHorizontal: 22,
                    borderRadius: 20,
                    minWidth: 110,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: sessionsLoading ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: "#000",
                      fontSize: 20,
                      fontFamily: "Joan",
                      fontWeight: "600",
                    }}
                  >
                    {sessionsLoading ? "Loading…" : "See Sweat"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* gradient progress bar */}
              <ProgressBar width={maxWidth * 0.8} />

              {/* New section: Start a New Training Program */}
              <View
                style={{
                  backgroundColor: "#5492DA",
                  paddingVertical: 20,
                  paddingHorizontal: 16,
                  marginTop: 180,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 28,
                    fontFamily: "Manrope",
                    fontWeight: "400",
                    textAlign: "center",
                  }}
                >
                  Start a New Training Program
                </Text>
              </View>
              {/* marathon */}
              <Pressable
                onPress={() =>
                  handleOpenCatalogDetails(
                    "Marathon",
                    "half-marathon-8-week-prep"
                  )
                }
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Image
                  source={require("../../assets/marathon.jpeg")}
                  style={{
                    width: maxWidth * 0.8,
                    height: maxWidth * 0.6,
                    alignSelf: "center",
                    borderRadius: 12,
                    marginTop: 100,
                  }}
                  resizeMode="cover"
                />
              </Pressable>
              <Text
                style={{
                  color: "#060000ff",
                  fontSize: 28,
                  fontFamily: "Joan",
                  fontWeight: "600",
                  textAlign: "center",
                  marginTop: 60,
                }}
              >
                Marathon
              </Text>

              {/* hybrid */}
              <Pressable
                onPress={() =>
                  handleOpenCatalogDetails("Hybrid", "hypertrophy-split")
                }
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Image
                  source={require("../../assets/hybrid.jpeg")}
                  style={{
                    width: maxWidth * 0.8,
                    height: maxWidth * 0.6,
                    alignSelf: "center",
                    borderRadius: 12,
                    marginTop: 100,
                  }}
                  resizeMode="cover"
                />
              </Pressable>
              <Text
                style={{
                  color: "#060000ff",
                  fontSize: 28,
                  fontFamily: "Joan",
                  fontWeight: "600",
                  textAlign: "center",
                  marginTop: 60,
                }}
              >
                Hybrid
              </Text>

              {/* Kettlebell Burner */}
              <Pressable
                onPress={() =>
                  handleOpenCatalogDetails("Kettlebell Burner", "kettlebell-burner")
                }
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Image
                  source={require("../../assets/kb2.jpeg")}
                  style={{
                    width: maxWidth * 0.8,
                    height: maxWidth * 0.6,
                    alignSelf: "center",
                    borderRadius: 12,
                    marginTop: 100,
                  }}
                  resizeMode="cover"
                />
              </Pressable>
              <Text
                style={{
                  color: "#060000ff",
                  fontSize: 28,
                  fontFamily: "Joan",
                  fontWeight: "600",
                  textAlign: "center",
                  marginTop: 60,
                }}
              >
                Kettlebell Burner
              </Text>

              {/* Yoga */}
              <Pressable
                onPress={() =>
                  handleOpenCatalogDetails("Yoga Foundations", "yoga-foundations-3-week-reset")
                }
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Image
                  source={require("../../assets/yoga3.jpeg")}
                  style={{
                    width: maxWidth * 0.8,
                    height: maxWidth * 0.6,
                    alignSelf: "center",
                    borderRadius: 12,
                    marginTop: 100,
                  }}
                  resizeMode="cover"
                />
              </Pressable>
              <Text
                style={{
                  color: "#060000ff",
                  fontSize: 28,
                  fontFamily: "Joan",
                  fontWeight: "600",
                  textAlign: "center",
                  marginTop: 60,
                }}
              >
                Yoga Foundations
              </Text>

              {/* calisthenics */}
              <Pressable
                onPress={() =>
                  handleOpenCatalogDetails("Calisthenics Foundations", "calisthenics-foundations-4-weeks")
                }
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Image
                  source={require("../../assets/calis.jpeg")}
                  style={{
                    width: maxWidth * 0.8,
                    height: maxWidth * 0.6,
                    alignSelf: "center",
                    borderRadius: 12,
                    marginTop: 100,
                  }}
                  resizeMode="cover"
                />
              </Pressable>
              <Text
                style={{
                  color: "#060000ff",
                  fontSize: 28,
                  fontFamily: "Joan",
                  fontWeight: "600",
                  textAlign: "center",
                  marginTop: 60,
                }}
              >
                Calisthenics Foundations
              </Text>




              <View
                style={{
                  backgroundColor: "#5492DA",
                  paddingVertical: 20,
                  paddingHorizontal: 16,
                  marginTop: 180,
                  alignItems: "center",
                }}
              >

                
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 28,
                    fontFamily: "Manrope",
                    fontWeight: "600",
                  }}
                >
                  Daily Reps
                </Text>
              </View>

              <Text
                style={{
                  color: "#000000ff",
                  fontSize: 28,
                  fontFamily: "Joan",
                  fontWeight: "600",
                  textAlign: "center",
                  marginTop: 80,
                }}
              >
                For Movement and Momentum is the key
              </Text>

              <TouchableOpacity
                onPress={() => navigation.navigate("DailyGrind")}
                style={{
                  backgroundColor: "#E6B82C",
                  paddingVertical: 10,
                  paddingHorizontal: 22,
                  borderRadius: 20,
                  minWidth: 110,
                  marginTop: 100,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#000",
                    fontSize: 28,
                    fontFamily: "Joan",
                    fontWeight: "600",
                  }}
                >
                  Generate Workout
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  backgroundColor: "#5492DA",
                  paddingVertical: 20,
                  paddingHorizontal: 16,
                  marginTop: 360,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 28,
                    fontFamily: "Manrope",
                    fontWeight: "600",
                  }}
                >
                  View Your Consistency
                </Text>
              </View>

              {/* Calendar & Day Log */}

              <CalendarFoodLog
                maxWidth={maxWidth}
                userId={calendarUserId}
                authToken={calendarAuthToken}
                completedWorkouts={completedWorkouts}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
