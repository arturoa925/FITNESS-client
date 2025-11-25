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
import { useUser } from "../../components/UserContext";
import { resolveApiBase } from "../../utils/api";

// Reusable exercise card

function ExerciseCard({ exercise, maxWidth }) {
  const accessibleLabel = (() => {
    if (!exercise) return "Exercise details";
    const title = exercise.name || "Exercise";
    const hasReps = Array.isArray(exercise.reps) && exercise.reps.length > 0;
    if (!hasReps) return title;
    const repsSummary = exercise.reps.join(". ");
    return `${title}. ${repsSummary}`;
  })();

  return (
    <View
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={accessibleLabel}
      style={{ width: maxWidth, alignSelf: "center", paddingVertical: 16 }}
    >
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

  const { completeWorkout } = useUser();

  // Data driven by Sessions route params
  const [exercises, setExercises] = useState([]);
  const [weekNumber, setWeekNumber] = useState(null); // 1-based
  const [dayNumber, setDayNumber] = useState(null);   // 1-based
  const [dayTitle, setDayTitle] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const autoAdvanceRef = useRef(false);

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

  // A day is considered completed if it has an explicit flag OR all workouts are completed.
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

      // If current day is already complete, auto-advance once to the next incomplete day
      if (program && !autoAdvanceRef.current) {
        const wkCheck = program.workouts?.[wi];
        const dayCheck = wkCheck?.days?.[di];
        if (isDayCompleted(dayCheck)) {
          // start searching after the current day's last workout
          const lastIdx = Array.isArray(dayCheck?.workouts) ? Math.max(0, dayCheck.workouts.length - 1) : 0;
          const nextPtr = computeNextPointer(program, wi, di, lastIdx);
          if (nextPtr && (nextPtr.weekIndex !== wi || nextPtr.dayIndex !== di)) {
            autoAdvanceRef.current = true;
            navigation.replace("TodaysSession", {
              ...route.params,
              weekIndex: nextPtr.weekIndex,
              dayIndex: nextPtr.dayIndex,
              program, // pass along full program for immediate render
            });
            return; // stop rendering stale day
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

  // Mark the workout as completed in the in-memory program (route.params.program) if present.
  const markLocalCompleted = (program, wi, di, woi) => {
    try {
      if (!program || !Array.isArray(program.workouts)) return;
      const week = program.workouts[wi];
      if (!week || !Array.isArray(week.days)) return;
      const day = week.days[di];
      if (!day || !Array.isArray(day.workouts)) return;
      const workout = day.workouts[woi];
      if (!workout) return;
      day.workouts[woi] = { ...workout, completed: true };
    } catch {}
  };

  // Compute the next (weekIndex, dayIndex, workoutIndex) that is NOT completed.
  // Iterates within day -> next day in week -> next week.
  const computeNextPointer = (program, wi, di, woi) => {
    if (!program || !Array.isArray(program.workouts)) return null;
    const weeks = program.workouts;
    for (let wIndex = wi; wIndex < weeks.length; wIndex++) {
      const week = weeks[wIndex];
      if (!week || !Array.isArray(week.days)) continue;
      const startDay = (wIndex === wi) ? di : 0;
      for (let dIndex = startDay; dIndex < week.days.length; dIndex++) {
        const day = week.days[dIndex];
        if (!day || !Array.isArray(day.workouts)) continue;
        const startWorkout = (wIndex === wi && dIndex === di) ? (woi + 1) : 0;
        for (let wrk = startWorkout; wrk < day.workouts.length; wrk++) {
          const workout = day.workouts[wrk];
          if (workout && !workout.completed) {
            return { weekIndex: wIndex, dayIndex: dIndex, workoutIndex: wrk };
          }
        }
      }
    }
    return null;
  };

  // Resolve userId and programId from params, SecureStore, or API fallbacks
  const resolveAuthAndProgramIds = async (p, API_BASE, token) => {
    // Try params first
    let userId = p?.userId || p?.user?.id || null;
    let programId = p?.programId || p?.program?.id || null;

    // Try SecureStore (you should be setting these at login)
    try {
      if (!userId) {
        const storedUserId = await SecureStore.getItemAsync("userId");
        if (storedUserId) userId = storedUserId;
      }
      if (!programId) {
        const storedProgramId = await SecureStore.getItemAsync("programId");
        if (storedProgramId) programId = storedProgramId;
      }
    } catch (_) {}

    // As a last resort, query API for /users/me and /users/:id/training-programs
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    if (!userId) {
      try {
        const meRes = await fetch(`${API_BASE}/users/me`, { headers });
        if (meRes.ok) {
          const me = await meRes.json();
          if (me?.id) userId = me.id;
        }
      } catch {}
    }

    if (!programId && userId) {
      try {
        const progRes = await fetch(`${API_BASE}/users/${userId}/training-programs`, { headers });
        if (progRes.ok) {
          const list = await progRes.json();
          // accept a single object or array; take the first
          if (Array.isArray(list) && list.length && list[0]?.id) {
            programId = list[0].id;
          } else if (list?.id) {
            programId = list.id;
          }
          // Store for next time
          try {
            if (programId) await SecureStore.setItemAsync("programId", String(programId));
          } catch {}
        }
      } catch {}
    }

    return { userId, programId };
  };

  const completeCurrentWorkout = async () => {
    try {
      if (isCompleting) return;
      setIsCompleting(true);

      // Pull what we need from route params
      const p = route?.params || {};
      const wi = Number.isInteger(p.weekIndex) ? p.weekIndex : 0;
      const di = Number.isInteger(p.dayIndex) ? p.dayIndex : 0;
      // Default to first workout if not specified by Sessions
      const woi = Number.isInteger(p.workoutIndex) ? p.workoutIndex : 0;

      // Temporary debug log for pointers and program presence
      console.log("[TodaysSession] completing", { wi, di, woi, hasProgram: !!p.program, programWeeks: Array.isArray(p.program?.workouts) ? p.program.workouts.length : null });

      // Program + user (robust resolution)
      // Token (if you store it in SecureStore)
      let token = null;
      try {
        token = await SecureStore.getItemAsync("authToken");
      } catch (_) {}
      // Use shared API base so URLs are consistent across Home/Sessions/TodaysSession
      const API_BASE = resolveApiBase();
      const { userId, programId } = await resolveAuthAndProgramIds(p, API_BASE, token);
      console.log("[TodaysSession] resolved IDs", { userId, programId });

      if (!programId || !userId) {
        Alert.alert("Missing info", "Can't complete workout: missing userId or programId.");
        setIsCompleting(false);
        return;
      }

      // Optionally compute a synthetic workoutKey (w:week-day-workout)
      const syntheticId = `w:${wi}-${di}-${woi}`;

      // For user feedback, compute a local-effective date string
      const todayLocal = new Date();
      const yyyy = todayLocal.getFullYear();
      const mm = String(todayLocal.getMonth() + 1).padStart(2, "0");
      const dd = String(todayLocal.getDate()).padStart(2, "0");
      const effectiveDate = `${yyyy}-${mm}-${dd}`;

      // Use the offline-aware queue system from UserContext
      await completeWorkout({
        userId,
        programId,
        workoutKey: syntheticId,
        authToken: token,
        baseUrl: API_BASE,
      });

      // Update local in-memory program to reflect completion (so UI can advance without a refetch)
      markLocalCompleted(p.program, wi, di, woi);

      // Go Home after completion, regardless of online/offline
      Alert.alert("Workout Complete", `Saved for ${effectiveDate}`);
      navigation.replace("Home");
    } catch (e) {
      console.log("[TodaysSession] completeCurrentWorkout error:", e);
      Alert.alert("Error", String(e.message || e));
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <SafeAreaView
      style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}
      accessible={false}
      accessibilityLabel="Today's training session screen showing your current workout and completion button."
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
                  accessibilityRole="header"
                  accessibilityLabel={`${dayTitle}. Today's training session.`}
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
                  accessibilityLabel={`Week ${weekNumber}, Day ${dayNumber}`}
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
              onPress={completeCurrentWorkout}
              disabled={isCompleting}
              accessibilityRole="button"
              accessibilityLabel={
                isCompleting
                  ? "Saving your workout as complete"
                  : dayNumber
                  ? `Mark day ${dayNumber} as complete`
                  : "Mark this workout as complete"
              }
              accessibilityHint="Marks today's session as completed and saves your progress."
              style={{
                backgroundColor: "#E6B82C",
                paddingVertical: 10,
                paddingHorizontal: 22,
                borderRadius: 20,
                minWidth: 110,
                alignItems: "center",
                justifyContent: "center",
                opacity: isCompleting ? 0.6 : 1,
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
                {isCompleting
                  ? "Saving..."
                  : dayNumber
                  ? `Day ${dayNumber} Complete`
                  : "Mark Complete"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
