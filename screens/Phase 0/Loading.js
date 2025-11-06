import React, { useEffect, useRef } from "react";
import { Animated, View, Image, Text, StatusBar, Easing, Dimensions } from "react-native";

let LinearGradient = null;
try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch (e) {
  LinearGradient = null;
}
let Haptics = null;
try {
  Haptics = require("expo-haptics");
} catch (e) {
  Haptics = null;
}

// --- Minimal, modern loading screen (no extra deps) ---
// - Animated background (brand color shift)
// - Subtle logo pulse
// - Three-dot progress indicator
// - Clean typographic lockup

export default function LoadingScreen({ onFinish }) {
  // Background color lerp
  const bgAnim = useRef(new Animated.Value(0)).current;
  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#DCE6F2", "#C7DDF5"], // balanced light blue-gray tones
  });

  // Accent shimmer strip color
  const accentAnim = useRef(new Animated.Value(0)).current;
  const accentTranslate = accentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-120%", "120%"],
  });

  // Logo pulse
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Radial glow behind logo
  const glowAnim = useRef(new Animated.Value(0)).current;
  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  // Three dots use individual animated values for proper staggered phase
  const dotA = useRef(new Animated.Value(0)).current;
  const dotB = useRef(new Animated.Value(0)).current;
  const dotC = useRef(new Animated.Value(0)).current;
  const dotScale = (v) =>
    v.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.8, 1.35, 0.8],
      extrapolate: "clamp",
    });
  const dotOpacity = (v) =>
    v.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.65, 1, 0.65],
      extrapolate: "clamp",
    });

  // Gradient motion layer (drifting linear gradient)
  const gradAnim = useRef(new Animated.Value(0)).current;
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
  const LAYER_W = SCREEN_W * 1.6; // oversize so edges don't show
  const drift = gradAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-LAYER_W * 0.3, LAYER_W * 0.3],
  });

  // Second gradient layer for parallax depth
  const grad2Anim = useRef(new Animated.Value(0)).current;
  const LAYER_W2 = SCREEN_W * 1.8;
  const drift2 = grad2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [LAYER_W2 * 0.25, -LAYER_W2 * 0.25],
  });

  // Fade to white overlay for exit transition
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Background loop
    const bgLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    bgLoop.start();

    // Accent shimmer loop
    const accentLoop = Animated.loop(
      Animated.timing(accentAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    );
    accentLoop.start();

    // Logo pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.06, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    // Radial glow loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    glowLoop.start();

    // Gradient drift loop
    const gradLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(gradAnim, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(gradAnim, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ])
    );
    gradLoop.start();

    const grad2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(grad2Anim, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(grad2Anim, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ])
    );
    grad2Loop.start();

    // Three-dot loops (independent values for true stagger)
    let dotMounted = true;
    const loopDot = (v, delay) => {
      if (!dotMounted) return;
      v.setValue(0);
      setTimeout(() => {
        if (!dotMounted) return;
        Animated.loop(
          Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false })
        ).start();
      }, delay);
    };
    loopDot(dotA, 0);
    loopDot(dotB, 160);
    loopDot(dotC, 320);

    // Auto-finish with fade + haptic
    const timer = setTimeout(() => {
      // Light haptic just before transition
      try {
        if (Haptics?.impactAsync && Haptics?.ImpactFeedbackStyle?.Light) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (Haptics?.selectionAsync) {
          Haptics.selectionAsync();
        }
      } catch {}
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        try {
          bgLoop.stop();
          accentLoop.stop();
          pulseLoop.stop();
          glowLoop.stop();
          gradLoop.stop();
          grad2Loop.stop();
        } catch {}
        if (typeof onFinish === "function") onFinish();
      });
    }, 2400);

    return () => {
      try {
        bgLoop.stop();
        accentLoop.stop();
        pulseLoop.stop();
        glowLoop.stop();
        gradLoop.stop();
        grad2Loop.stop();
      } catch {}
      dotMounted = false;
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <StatusBar barStyle="light-content" />

      {/* Gradient motion layer (over base color) */}
      {LinearGradient ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: LAYER_W,
            height: "100%",
            transform: [
              { translateX: drift },
              { rotate: "12deg" },
            ],
            opacity: 0.55, // subtle blend over base
          }}
        >
          <LinearGradient
            colors={["#D4E3F5", "#E2EEFA", "#C8DBF3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}

      {/* Secondary parallax gradient layer */}
      {LinearGradient ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: LAYER_W2,
            height: "100%",
            transform: [
              { translateX: drift2 },
              { rotate: "-8deg" },
            ],
            opacity: 0.35,
          }}
        >
          <LinearGradient
            colors={["#BBD3EF", "#CFE0F4", "#E3EDFA"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}

      {/* Subtle angled accent shimmer */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: "25%",
          width: "140%",
          height: 8,
          borderRadius: 8,
          backgroundColor: "rgba(255, 255, 255, 0.3)", // subtle white shimmer
          transform: [
            { translateX: accentTranslate },
            { rotate: "-12deg" },
          ],
        }}
      />

      {/* Logo and text centered */}
      <Animated.View
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: scaleAnim }],
        }}
      >
        {/* Radial glow behind logo */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: "rgba(115, 170, 230, 0.9)", // light sky blue glow
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
            filter: undefined, // (noop on RN; placeholder to indicate no blur)
          }}
        />

        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.5)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.65)",
            marginBottom: 18,
          }}
        >
          <Image
            source={require("../../assets/newfitlogo.png")}
            style={{ width: 86, height: 86 }}
            resizeMode="contain"
          />
        </View>

        <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1 }}>
          FITNESS
        </Text>
        <Text style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
          Preparing your session…
        </Text>

        {/* Three dot loader (morphing) */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {[dotA, dotB, dotC].map((v, idx) => (
            <Animated.View
              key={idx}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#3E8FE3",
                opacity: dotOpacity(v),
                transform: [{ scale: dotScale(v) }],
              }}
            />
          ))}
        </View>
      </Animated.View>

      {/* Fade-to-white overlay on exit */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#FFFFFF",
          opacity: fadeAnim,
        }}
      />
    </Animated.View>
  );
}