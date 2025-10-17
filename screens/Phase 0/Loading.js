import React, { useEffect, useRef } from "react";
import { Animated, View, Image, Text } from "react-native";


export default function LoadingScreen({ onFinish }) {
  const colorAnim = useRef(new Animated.Value(0)).current;

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#687f8bff", "#1884a2ff"], // shift between two of your brand colors
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(colorAnim, { toValue: 1, duration: 4000, useNativeDriver: false }),
        Animated.timing(colorAnim, { toValue: 0, duration: 4000, useNativeDriver: false }),
      ])
    );
    loop.start();

    const timer = setTimeout(() => {
      try { loop.stop(); } catch (_) {}
      if (typeof onFinish === "function") {
        onFinish();
      }
    }, 4000);

    return () => {
      try { loop.stop(); } catch (_) {}
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <Animated.View style={{ flex: 1, backgroundColor, alignItems: "center", justifyContent: "center" }}>
      <Image source={require("../../assets/newfitlogo.png")} style={{ width: 160, height: 160, marginBottom: 24 }} />
      <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>FITNESS</Text>
    </Animated.View>
  );
}