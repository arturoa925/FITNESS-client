import React, { useEffect, useRef, useState } from "react";
import { View, Animated, Easing, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import * as SecureStore from "expo-secure-store";

// --- helpers: normalize a program into weeks with days and compute counts ---
const deriveWeeksFromProgram = (programLike, fallbackDuration) => {
  if (!programLike) return [];
  // 1) direct weeks
  if (Array.isArray(programLike.weeks)) {
    return programLike.weeks.map((w) => ({
      days: Array.isArray(w?.days) ? w.days : [],
      totalDays: Number(w?.totalDays) || (Array.isArray(w?.days) ? w.days.length : 0),
      completedDays:
        Number(w?.completedDays) ||
        (Array.isArray(w?.days) ? w.days.filter((d) => d?.completed || d?.done || d?.status === "done").length : 0),
    }));
  }
  // 2) workouts grouped by weekIndex → build weeks with days
  if (Array.isArray(programLike.workouts)) {
    const grouped = {};
    for (const wk of programLike.workouts) {
      const wi = Number(wk.weekIndex ?? wk.week ?? 0);
      const days = Array.isArray(wk.days) ? wk.days : [];
      if (!grouped[wi]) grouped[wi] = [];
      grouped[wi].push(...days);
    }
    const indexes = Object.keys(grouped).map((n) => Number(n)).sort((a, b) => a - b);
    return indexes.map((i) => {
      const days = grouped[i] || [];
      return {
        days,
        totalDays: days.length,
        completedDays: days.filter((d) => d?.completed || d?.done || d?.status === "done").length,
      };
    });
  }
  // 3) duration fallback
  const dur = Number(programLike.duration ?? fallbackDuration ?? 0);
  if (dur > 0) {
    return Array.from({ length: dur }, () => ({ days: [], totalDays: 0, completedDays: 0 }));
  }
  return [];
};

/**
 * ProgressBar
 * Props:
 *  - width: numeric pixel width for the bar
 */
export default function ProgressBar({ width = 300 }) {
  const [progress, setProgress] = useState(0);
  const [noProgram, setNoProgram] = useState(false);

  // animated progress (animate on mount/change)
  const progressAnim = useRef(new Animated.Value(0)).current;
  const completedAnimatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });

  // continuous shimmer across the bar
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const storedId = await SecureStore.getItemAsync("userId");
        if (!storedId) {
          setNoProgram(true);
          setProgress(0);
          return;
        }
        const token = await SecureStore.getItemAsync("authToken");
        const baseURL = Platform.OS === "android" ? "http://10.0.2.2:3004" : "http://localhost:3004";
        const res = await fetch(`${baseURL}/users/${storedId}/training-programs`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          setNoProgram(true);
          setProgress(0);
          return;
        }
        const data = await res.json();
        // API may return a single program object OR an array
        const program = Array.isArray(data) ? data[0] : data;
        if (!program) {
          setNoProgram(true);
          setProgress(0);
          return;
        }
        const weeks = deriveWeeksFromProgram(program, program?.duration);
        if (!weeks.length) {
          setNoProgram(true);
          setProgress(0);
          return;
        }
        // Find current week: first week that's not fully complete; otherwise last week
        let currentIndex = 0;
        for (let i = 0; i < weeks.length; i++) {
          const w = weeks[i];
          const td = Number(w.totalDays) || (Array.isArray(w.days) ? w.days.length : 0);
          const cd = Number(w.completedDays) || 0;
          if (td === 0) { currentIndex = i; break; }
          if (cd < td) { currentIndex = i; break; }
          if (i === weeks.length - 1) currentIndex = i;
        }
        const current = weeks[currentIndex];
        const totalDays = Number(current.totalDays) || (Array.isArray(current.days) ? current.days.length : 0);
        const completedDays = Number(current.completedDays) || 0;
        const ratio = totalDays > 0 ? Math.max(0, Math.min(1, completedDays / totalDays)) : 0;
        setNoProgram(false);
        setProgress(ratio);
      } catch (e) {
        console.log("[ProgressBar] fetch error:", e);
        setNoProgram(true);
        setProgress(0);
      }
    };
    fetchProgress();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim,
      {
        toValue: Math.max(0, Math.min(1, progress)),
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // width animation needs layout
      }
    ).start();
  }, [progress, width]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true, // translateX can be native
      })
    );
    loop.start();
    return () => loop.stop();
  }, [width]);

  return (
    <View style={{ width, alignSelf: "center", opacity: noProgram ? 0.3 : 1 }}>
      <View style={{ height: 16, borderRadius: 8, overflow: "hidden" }}>
        {/* faint full-length gradient (remaining/blurred portion) */}
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
          }}
        />

        {/* solid completed portion */}
        <Animated.View
          style={{
            width: completedAnimatedWidth,
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

        {/* moving shimmer overlay */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 120,
            transform: [{ translateX: shimmerTranslate }],
            opacity: 0.6,
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
    </View>
  );
}