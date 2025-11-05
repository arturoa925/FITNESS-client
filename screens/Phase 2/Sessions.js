// ! begin at phase 2 : strength (title) -> weeks

import React, { useEffect, useState, useCallback, useRef } from "react";
import { PanResponder, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
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
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useUser } from "../../components/UserContext";

// Normalize a program into week rows: [{ week, completedDays, totalDays, days: [{title,completed}] }]
const deriveWeekRows = (programLike, fallbackDuration) => {
  if (!programLike) return [];
  // If already in row form
  if (
    Array.isArray(programLike) &&
    programLike.length &&
    typeof programLike[0] === "object" &&
    "week" in programLike[0]
  ) {
    return programLike.map((r, idx) => ({
      week: r.week ?? r.number ?? r.index ?? idx + 1,
      completedDays: Number(r.completedDays) || 0,
      totalDays: Number(r.totalDays) || 0,
      days: Array.isArray(r.days)
        ? r.days.map((d, di) => ({
            title: d?.title || `Day ${di + 1}`,
            completed: Boolean(d?.completed || d?.done || d?.status === "done"),
          }))
        : Array.from({ length: Number(r.totalDays) || 0 }, (_, di) => ({
            title: `Day ${di + 1}`,
            completed: di < (Number(r.completedDays) || 0),
          })),
    }));
  }
  // If program.weeks exists
  if (Array.isArray(programLike.weeks)) {
    return programLike.weeks.map((w, idx) => {
      const days = Array.isArray(w?.days) ? w.days : [];
      const cd =
        Number(w?.completedDays) ||
        days.filter((d) => d?.completed || d?.done || d?.status === "done")
          .length;
      const td = Number(w?.totalDays) || days.length || Number(w?.total) || 0;
      const dayRows = days.map((d, di) => ({
        title: d?.title || `Day ${di + 1}`,
        completed: Boolean(d?.completed || d?.done || d?.status === "done"),
      }));
      return {
        week: w.week || w.number || w.index || idx + 1,
        completedDays: cd,
        totalDays: td || 5,
        days: dayRows,
      };
    });
  }
  // If program.workouts grouped by weekIndex
  if (Array.isArray(programLike.workouts)) {
    const grouped = {};
    for (const wk of programLike.workouts) {
      const wi = Number(wk.weekIndex ?? wk.week ?? 0);
      const days = Array.isArray(wk.days) ? wk.days : [];
      if (!grouped[wi]) grouped[wi] = [];
      grouped[wi].push(...days);
    }
    const indices = Object.keys(grouped)
      .map((n) => Number(n))
      .sort((a, b) => a - b);
    return indices.map((i, idx) => {
      const days = grouped[i] || [];
      const cd = days.filter(
        (d) => d?.completed || d?.done || d?.status === "done"
      ).length;
      const td = days.length || 5;
      const dayRows = days.map((d, di) => ({
        title: d?.title || `Day ${di + 1}`,
        completed: Boolean(d?.completed || d?.done || d?.status === "done"),
      }));
      return {
        week: i + 1 || idx + 1,
        completedDays: cd,
        totalDays: td,
        days: dayRows,
      };
    });
  }
  // Fallback: duration only
  const dur = Number(programLike.duration ?? fallbackDuration ?? 0);
  if (dur > 0) {
    return Array.from({ length: dur }, (_, idx) => ({
      week: idx + 1,
      completedDays: 0,
      totalDays: 5,
      days: Array.from({ length: 5 }, (__, di) => ({
        title: `Day ${di + 1}`,
        completed: false,
      })),
    }));
  }
  return [];
};

export default function Sessions({ navigation, route }) {
  const { user } =
    useUser && typeof useUser === "function" ? useUser() : { user: null };
  const [loading, setLoading] = useState(false);
  const [noProgram, setNoProgram] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // TEMP: mock training data — this will later be driven by the selected plan
  const [weeksData, setWeeksData] = useState([]);
  const [program, setProgram] = useState(null);

  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  const nav = useNavigation();
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 25 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 80) {
          nav.navigate("Home");
        }
      },
    })
  ).current;

  const resolveBaseURL = () =>
    Platform.OS === "android"
      ? "http://10.0.2.2:3004"
      : "http://localhost:3004";

  const fetchProgram = useCallback(async () => {
    try {
      setLoading(true);
      setNoProgram(false);
      setErrorMsg("");
      // Fast path: use preloaded program/weeks passed via navigation
      if (route?.params?.weeks || route?.params?.program) {
        const rows =
          route?.params?.weeks && Array.isArray(route.params.weeks)
            ? deriveWeekRows(route.params.weeks)
            : deriveWeekRows(
                route.params.program,
                route.params.program?.duration
              );
        if (rows.length) {
          setWeeksData(rows);
          if (route?.params?.program) setProgram(route.params.program);
          setNoProgram(false);
          return;
        }
      }
      const token = await SecureStore.getItemAsync("authToken");
      // Prefer ID from context, fall back to SecureStore
      const storedId = await SecureStore.getItemAsync("userId");
      const userId = (user && (user.id || user.userId)) || storedId;
      if (!userId) {
        // If we had preloaded weeks/program, we'd have returned above. At this point, guide user to sign in.
        setNoProgram(true);
        setWeeksData([]);
        setErrorMsg("Please sign in to load your sessions.");
        try {
          navigation.navigate("Login");
        } catch {}
        return;
      }
      const url = `${resolveBaseURL()}/users/${encodeURIComponent(
        userId
      )}/training-programs`;
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.status === 404) {
        setNoProgram(true);
        setWeeksData([]);
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fetch failed (${res.status}): ${text}`);
      }
      const data = await res.json();
      // Try to find a current program object (API may return the program object directly OR an array)
      const program = Array.isArray(data)
        ? data[0] || null
        : data?.currentProgram || data?.program || data || null;
      setProgram(program);
      if (!program) {
        setNoProgram(true);
        setWeeksData([]);
        return;
      }
      // Normalize into [{ week, completedDays, totalDays }]
      const weeks = deriveWeekRows(program, program?.duration);
      if (!weeks.length) {
        setNoProgram(true);
        setWeeksData([]);
        return;
      }
      setWeeksData(weeks);
      console.log(
        "[Sessions] loaded program:",
        program?.name || program?.slug || "(unnamed)",
        "weeks:",
        weeks.length
      );
    } catch (err) {
      console.log("[Sessions] fetch error:", err);
      setErrorMsg(err?.message || "Failed to load training program.");
      setWeeksData([]);
    } finally {
      setLoading(false);
    }
  }, [user, navigation, route]);

  useFocusEffect(
    useCallback(() => {
      fetchProgram();
      return () => {};
    }, [fetchProgram])
  );

  const progressBarHeight = 16;
  const progressBarWidth = Math.min(240, Math.max(160, width * 0.55));

  // Handler to navigate to TodaysSession with the next session details
  const handleBeginToday = useCallback(() => {
    try {
      if (!Array.isArray(weeksData) || weeksData.length === 0) {
        Alert.alert("No sessions", "No training days found.");
        return;
      }
      let targetWeekIdx = 0;
      let targetDayIdx = 0;
      let targetDay = null;

      for (let wi = 0; wi < weeksData.length; wi++) {
        const w = weeksData[wi];
        const days = Array.isArray(w?.days)
          ? w.days
          : Array.from({ length: w.totalDays }, (_, i) => ({ title: `Day ${i + 1}`, completed: i < (w.completedDays || 0) }));

        let foundDayIndex = days.findIndex((d) => !d?.completed);
        if (foundDayIndex === -1) foundDayIndex = 0; // if all done, start at first day

        targetWeekIdx = wi;
        targetDayIdx = foundDayIndex;
        targetDay = days[foundDayIndex];

        // Choose first week that isn't fully complete; otherwise keep walking to last
        if ((w.completedDays || 0) < (w.totalDays || days.length || 0)) break;
      }

      navigation.navigate("TodaysSession", {
        weekIndex: targetWeekIdx,
        dayIndex: targetDayIdx,
        day: targetDay,
        weeks: weeksData,
        program: program || route?.params?.program || null,
      });
    } catch (e) {
      Alert.alert("Can't open session", String(e?.message || e));
    }
  }, [navigation, weeksData, program, route]);

  const getProgress = (completed, total) => {
    if (!total) return 0;
    const p = completed / total;
    return Math.max(0, Math.min(1, p));
  };

  const WeekRow = ({ item }) => {
    const [expanded, setExpanded] = useState(false);
    const [expandTick, setExpandTick] = useState(0);
    const caretAnim = useRef(new Animated.Value(0)).current;

    // animated values for each day row (0 = hidden, 1 = shown)
    const dayAnims = useRef(
      Array.from(
        {
          length: Array.isArray(item?.days) ? item.days.length : item.totalDays,
        },
        () => new Animated.Value(0)
      )
    ).current;

    const pct = getProgress(item.completedDays, item.totalDays);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    const shimmerTranslate = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-progressBarWidth, progressBarWidth],
    });

    useEffect(() => {
      Animated.timing(progressAnim, {
        toValue: pct,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // animating width
      }).start();
    }, [pct]);

    useEffect(() => {
      const loop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true, // translateX
        })
      );
      loop.start();
      return () => loop.stop();
    }, []);

    useEffect(() => {
      Animated.timing(caretAnim, {
        toValue: expanded ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [expanded]);

    useEffect(() => {
      // Reset values before playing when expanded or when retriggered
      if (expanded) {
        dayAnims.forEach((v) => v.setValue(0));
      }

      const show = Animated.stagger(
        100, // slower stagger between rows
        dayAnims.map((v) =>
          Animated.spring(v, {
            toValue: 1,
            useNativeDriver: true,
            // spring config (slower, smoother)
            stiffness: 120,
            damping: 18,
            mass: 0.9,
          })
        )
      );

      const hide = Animated.stagger(
        60,
        [...dayAnims].reverse().map((v) =>
          Animated.timing(v, {
            toValue: 0,
            duration: 240, // slightly slower fade out
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          })
        )
      );

      if (expanded) {
        show.start();
      } else {
        hide.start();
      }
    }, [expanded, dayAnims, expandTick]);

    return (
      <>
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          style={[
            tw`flex-row items-center justify-between mb-12`,
            { width: "100%", paddingHorizontal: 4 },
          ]}
        >
          <View style={tw`flex-row items-center`}>
            <Pressable
              onPress={() => setExpanded((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  tw`text-2xl font-bold`,
                  { color: "#0E0E0E", fontFamily: "Joan" },
                ]}
              >
                {" "}
                {`Week ${item.week}`}{" "}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setExpanded((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.Text
                style={{
                  marginLeft: 6,
                  fontSize: 16,
                  transform: [
                    {
                      rotate: caretAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "180deg"],
                      }),
                    },
                  ],
                }}
              >
                ▾
              </Animated.Text>
            </Pressable>
          </View>

          {/* progress bar with animated width + shimmer */}
          <View
            style={[
              tw`rounded-full`,
              {
                width: progressBarWidth,
                height: progressBarHeight,
                overflow: "hidden",
              },
            ]}
          >
            {/* faint full-length gradient as track */}
            <LinearGradient
              colors={["#87DAF0", "#355D73"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                opacity: 0.35,
                borderRadius: 999,
              }}
            />

            {/* animated completed portion */}
            <Animated.View
              style={{
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, progressBarWidth],
                }),
                height: "100%",
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={["#87DAF0", "#355D73"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
              />
            </Animated.View>

            {/* shimmering sweep */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 120,
                opacity: 0.6,
                transform: [{ translateX: shimmerTranslate }],
              }}
            >
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0)",
                  "rgba(255,255,255,0.65)",
                  "rgba(255,255,255,0)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </View>
        </Pressable>
        {expanded && (
          <View style={[tw`mt-3 mb-6`, { paddingLeft: 4, paddingRight: 8 }]}>
            {(Array.isArray(item?.days)
              ? item.days
              : Array.from({ length: item.totalDays }).map((_, i) => ({
                  title: `Day ${i + 1}`,
                  completed: i < item.completedDays,
                }))
            ).map((d, i) => {
              const a = dayAnims[i];
              const translateY = a.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              });
              const isDone =
                typeof d?.completed === "boolean"
                  ? d.completed
                  : i < item.completedDays;
              return (
                <Animated.View
                  key={i}
                  style={[
                    tw`flex-row items-center justify-start py-1`,
                    { opacity: a, transform: [{ translateY }] },
                  ]}
                >
                  <Text
                    style={[
                      tw`mr-2`,
                      {
                        opacity: isDone ? 1 : 0.4,
                        fontSize: 22,
                        color: "#E6B82C",
                      },
                    ]}
                  >
                    {isDone ? "✓" : "○"}
                  </Text>
                  <Text
                    style={[
                      tw`text-base`,
                      { color: "#0E0E0E", fontFamily: "Joan", fontSize: 18 },
                    ]}
                  >
                    {d?.title || `Day ${i + 1}`}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          tw`flex-1 items-center justify-center`,
          { backgroundColor: "#A4A4A4" },
        ]}
      >
        <ActivityIndicator size="large" />
        <Text style={[tw`mt-3`, { color: "#0E0E0E" }]}>
          Loading your training program…
        </Text>
      </SafeAreaView>
    );
  }

  if (noProgram || weeksData.length === 0) {
    return (
      <SafeAreaView
        style={[
          tw`flex-1 items-center justify-center px-6`,
          { backgroundColor: "#A4A4A4" },
        ]}
        {...panResponder.panHandlers}
      >
        <Text
          style={[
            tw`text-center mb-4`,
            { color: "#0E0E0E", fontSize: 18, fontFamily: "Joan" },
          ]}
        >
          You’re not enrolled in a training program yet.
        </Text>
        {Boolean(errorMsg) && (
          <Text style={[tw`text-center mb-4`, { color: "#333" }]}>
            {errorMsg}
          </Text>
        )}
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          style={{
            backgroundColor: "#E6B82C",
            paddingVertical: 10,
            paddingHorizontal: 22,
            borderRadius: 20,
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
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView
      style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}
      {...panResponder.panHandlers}
    >
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={tw`flex-grow`}
          keyboardShouldPersistTaps="handled"
        >
          {/* outer centered container with max width */}
          <View style={[tw`flex-1 items-center`, { paddingHorizontal: 16 }]}>
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
                Train
              </Text>

              {/* Weeks list with completion bars */}
              <View style={[tw`mt-2`, { width: "100%" }]}>
                {weeksData.length > 0 ? (
                  weeksData.map((w) => <WeekRow key={w.week} item={w} />)
                ) : (
                  <Text style={[tw`mt-4`, { color: "#0E0E0E" }]}>
                    No weeks to display.
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleBeginToday}
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
                    fontSize: 20,
                    fontFamily: "Joan",
                    fontWeight: "600",
                  }}
                >
                  Begin Today's Session
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
