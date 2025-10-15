import React, { useEffect, useRef } from "react";
import { View, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * ProgressBar
 * Props:
 *  - progress: number between 0 and 1
 *  - width: numeric pixel width for the bar
 */
export default function ProgressBar({ progress = 0, width = 300 }) {
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
    <View style={{ width, alignSelf: "center" }}>
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