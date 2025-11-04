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
  const { programName, program, noProgram, message } = (route && route.params) || {};
  const [title, setTitle] = useState(programName || "Program Details");

  // Normalized weeks → days → workouts for centered column display
  const [weeks, setWeeks] = useState([]);

  const formatWorkoutLabel = (w) => {
    // Build a concise label from known fields; fall back to name
    if (!w) return "";
    if (w.distanceKm) return `${w.name || "Run"} · ${w.distanceKm} km`;
    if (w.distanceM) return `${w.name || "Run"} · ${w.distanceM} m`;
    if (w.durationSec && w.sets) return `${w.name || "Intervals"} · ${w.sets}×${Math.round(w.durationSec/60)} min`;
    if (w.durationSec) return `${w.name || "Session"} · ${Math.round(w.durationSec/60)} min`;
    if (w.sets && w.reps) return `${w.name || "Strength"} · ${w.sets}×${w.reps}`;
    return w.name || "Workout";
  };

  const formatExerciseLabel = (ex) => {
    if (!ex) return "";
    const n = ex.name || "Exercise";
    if (ex.distanceKm) return `${n} — ${ex.distanceKm} km`;
    if (ex.distanceM) return `${n} — ${ex.distanceM} m`;
    if (ex.durationSec && ex.sets) return `${n} — ${ex.sets}×${Math.round(ex.durationSec/60)} min`;
    if (ex.durationSec) return `${n} — ${Math.round(ex.durationSec/60)} min`;
    if (ex.sets && ex.reps) return `${n} — ${ex.sets}×${ex.reps}`;
    return n;
  };

  const normalizeWeeks = useCallback((p) => {
    if (!p) return [];
    const src = Array.isArray(p.weeks) ? p.weeks : Array.isArray(p.workouts) ? p.workouts : [];
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
              const wName = dw.name || (Array.isArray(dw.exercises) && dw.exercises[0] ? formatWorkoutLabel(dw.exercises[0]) : formatWorkoutLabel(dw));
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
              <View style={{ width: maxWidth, alignSelf: "center", marginBottom: 24 }}>
                <Text style={{ color: "#000", fontFamily: "Joan", fontSize: 18, textAlign: "center", marginBottom: 12 }}>
                  {message || "You’re not enrolled in a training program yet."}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Home")}
                  style={{ backgroundColor: "#E6B82C", paddingVertical: 10, paddingHorizontal: 22, borderRadius: 20, alignSelf: "center" }}
                >
                  <Text style={{ color: "#000", fontSize: 18, fontFamily: "Joan", fontWeight: "600" }}>
                    Go Home and Enroll
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Weeks → Days → Workouts (centered column) */}
            {weeks.length > 0 && !noProgram ? (
              <View style={{ width: maxWidth, alignSelf: "center", marginBottom: 24 }}>
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
                    <View style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: "#EEE" }}>
                      <Text style={{ color: "#0E0E0E", fontFamily: "Joan", fontSize: 20, textAlign: "center" }}>
                        {`Week ${wk.week}`}
                      </Text>
                    </View>

                    <View style={{ paddingVertical: 8 }}>
                      {wk.days.map((day) => (
                        <View key={`w${wk.week}-d${day.dayIndex}`} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                          <Text style={{ color: "#0E0E0E", fontFamily: "Joan", fontSize: 18, textAlign: "center" }}>
                            {day.title}
                          </Text>
                          {Array.isArray(day.workouts) && day.workouts.length > 0 ? (
                            <View style={{ marginTop: 6 }}>
                              {day.workouts.map((w, wi) => (
                                <View key={`w${wk.week}-d${day.dayIndex}-workout-${wi}`} style={{ marginTop: wi === 0 ? 0 : 6 }}>
                                  <Text style={{ color: "#333", fontFamily: "Joan", fontSize: 16, textAlign: "center" }}>
                                    {w.name}
                                  </Text>
                                  {Array.isArray(w.exercises) && w.exercises.length > 0 ? (
                                    <View style={{ marginTop: 4 }}>
                                      {w.exercises.map((label, ei) => (
                                        <Text
                                          key={`w${wk.week}-d${day.dayIndex}-ex-${ei}`}
                                          style={{ color: "#444", fontFamily: "Manrope", fontSize: 14, textAlign: "center", marginTop: 2 }}
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
              <Text style={{ color: "#000", fontFamily: "Joan", fontSize: 18, textAlign: "center", marginVertical: 24 }}>
                No program structure to display.
              </Text>
            ) : null}


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
                              Begin Prep
                              </Text>
                            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
