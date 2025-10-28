import React, { useEffect, useRef, useState } from "react";
import { View, Animated, Easing, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";

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
        const baseURL = Platform.OS === "android" ? "http://10.0.2.2:3004" : "http://localhost:3004";
        const res = await fetch(`${baseURL}/users/${storedId}`);
        if (!res.ok) {
          setNoProgram(true);
          setProgress(0);
          return;
        }
        const data = await res.json();
        if (!data || !Array.isArray(data.trainingPrograms) || data.trainingPrograms.length === 0) {
          setNoProgram(true);
          setProgress(0);
          return;
        }
        const current = data.trainingPrograms[0];
        const weeks = current.weeks || [];
        const totals = weeks.reduce(
          (acc, w) => {
            const td = Number(w.totalDays) || 0;
            const cd = Number(w.completedDays) || 0;
            acc.total += td;
            acc.done += Math.min(cd, td);
            return acc;
          },
          { total: 0, done: 0 }
        );
        const ratio = totals.total > 0 ? totals.done / totals.total : 0;
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