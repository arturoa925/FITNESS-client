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

// Reusable exercise card
function ExerciseCard({ exercise, maxWidth }) {
  return (
    <View style={{ width: maxWidth, alignSelf: "center", paddingVertical: 16 }}>
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
      ) : null}

      {/* Reps bullet list */}
      <View style={{ width: maxWidth * 0.9, marginTop: 12, marginBottom: 32, alignSelf: "center" }}>
        {Array.isArray(exercise.reps) && exercise.reps.length ? (
          exercise.reps.map((line, idx) => (
            <View
              key={`rep-${exercise.id || exercise.name}-${idx}`}
              style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }}
            >
              <Text style={{ fontFamily: "Joan", fontSize: 20, color: "#000", marginRight: 8 }}>•</Text>
              <Text style={{ fontFamily: "Joan", fontSize: 22, color: "#000", lineHeight: 24 }}>
                {line}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ fontFamily: "Joan", fontSize: 20, color: "#000" }}>No exercises listed.</Text>
        )}
      </View>
    </View>
  );
}

export default function TodaysSession({ navigation, route }) {
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  // Data driven by Sessions route params
  const [exercises, setExercises] = useState([]);
  const [weekNumber, setWeekNumber] = useState(null); // 1-based
  const [dayNumber, setDayNumber] = useState(null);   // 1-based
  const [dayTitle, setDayTitle] = useState("");

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

  const fmt = (ex) => {
    if (!ex || typeof ex !== "object") return "";
    const parts = [ex.name].filter(Boolean);
    if (ex.distanceKm) parts.push(`${ex.distanceKm} km`);
    if (ex.distanceM) parts.push(`${ex.distanceM} m`);
    if (ex.durationSec) parts.push(`${Math.round(ex.durationSec / 60)} min`);
    if (ex.sets && ex.reps) parts.push(`${ex.sets}×${ex.reps}`);
    else if (ex.sets && ex.durationSec) parts.push(`${ex.sets}×${Math.round(ex.durationSec / 60)} min`);
    if (ex.restSec) parts.push(`rest ${Math.round(ex.restSec / 60)} min`);
    return parts.join(" — ");
  };

  useEffect(() => {
    try {
      const p = route?.params || {};
      const wi = Number.isInteger(p.weekIndex) ? p.weekIndex : 0;
      const di = Number.isInteger(p.dayIndex) ? p.dayIndex : 0;
      setWeekNumber(wi + 1);
      setDayNumber(di + 1);

      // Prefer the full weeks structure if provided
      const weeks = Array.isArray(p.weeks) ? p.weeks : [];
      let dayObj = p.day || null;
      if (!dayObj && weeks[wi]) {
        // weeksData rows may contain a raw days array
        if (Array.isArray(weeks[wi].days)) {
          dayObj = weeks[wi].days[di] || null;
        }
      }

      // If the day object came from the Sessions summary it may only have title/completed.
      // If full program is present on params.program, use it to resolve the real day's workouts.
      const program = p.program;
      let workouts = [];
      if (program && Array.isArray(program.workouts)) {
        // workouts grouped by weekIndex
        const wk = program.workouts.find((w) => Number(w.weekIndex ?? w.week ?? -1) === wi);
        if (wk && Array.isArray(wk.days)) {
          // prefer full day from program
          const fullDay = wk.days[di] || null;
          if (fullDay) {
            dayObj = { ...(dayObj || {}), ...fullDay };
            workouts = Array.isArray(fullDay.workouts) ? fullDay.workouts : [];
          }
        }
      }

      setDayTitle(dayObj?.title || (p.day && p.day.title) || "");

      // Flatten workouts → ExerciseCards
      const cards = [];
      if (Array.isArray(workouts) && workouts.length) {
        workouts.forEach((w, idx) => {
          const lines = Array.isArray(w.exercises) ? w.exercises.map(fmt).filter(Boolean) : [];
          cards.push({
            id: `w-${idx}`,
            name: w.name || `Workout ${idx + 1}`,
            imageUri: "",
            description: dayObj?.title || "",
            reps: lines.length ? lines : ["Follow the workout as described."],
          });
        });
      } else if (Array.isArray(dayObj?.workouts)) {
        dayObj.workouts.forEach((w, idx) => {
          const lines = Array.isArray(w.exercises) ? w.exercises.map(fmt).filter(Boolean) : [];
          cards.push({
            id: `d-${idx}`,
            name: w.name || `Workout ${idx + 1}`,
            imageUri: "",
            description: dayObj?.title || "",
            reps: lines.length ? lines : ["Follow the workout as described."],
          });
        });
      }

      // Fallback: if no workouts, at least show the day title
      if (!cards.length && dayObj) {
        cards.push({ id: "only", name: dayObj.title || "Today's Session", imageUri: "", description: "", reps: [] });
      }

      setExercises(cards);
    } catch (e) {
      console.log("[TodaysSession] parse params error:", e);
    }
  }, [route?.params]);

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
              {dayTitle ? (
                <Text
                  style={[
                    tw`mb-6 text-center`,
                    { color: "#0E0E0E", fontFamily: "Joan", fontSize: 32 },
                  ]}
                >
                  {dayTitle}
                </Text>
              ) : null}
              {/* Subheader: Week/Day */}
              {(weekNumber && dayNumber) ? (
                <Text
                  style={[
                    tw`mb-4 text-center`,
                    { color: "#87DAF0", fontFamily: "Joan", fontSize: 28 },
                  ]}
                >
                  {`Week ${weekNumber} • Day ${dayNumber}`}
                </Text>
              ) : null}
            </View>

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
                               {dayNumber ? `Day ${dayNumber} Complete` : 'Mark Complete'}
                              </Text>
                            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
