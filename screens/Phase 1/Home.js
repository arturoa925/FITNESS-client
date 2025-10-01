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
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

export default function Home({ navigation }) {
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  // progress for training plan (mock values for now)
  // ! replace with user data
  const weekCurrent = 8; // e.g., Week 3
  const weekTotal = 12; // e.g., out of 12
  const progress = Math.max(
    0,
    Math.min(1, weekCurrent / Math.max(1, weekTotal))
  );
  const completedWidth = progress * (maxWidth * 0.8); // matches marathon image & stats row width

  // animated progress (animate on view)
  const progressAnim = useRef(new Animated.Value(0)).current;
  const completedAnimatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxWidth * 0.8],
  });

  // continuous shimmer across the bar
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-(maxWidth * 0.8), maxWidth * 0.8],
  });

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation needs layout, not transform
    }).start();
  }, [progress, maxWidth]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true, // translateX can use native driver
      })
    );
    loop.start();
    return () => loop.stop();
  }, [maxWidth]);

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
          {/* title with profile */}
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
                <TouchableOpacity
                  onPress={() => navigation.navigate("Profile")}
                >
                  <View
                    style={{
                      width: 45,
                      height: 45,
                      borderRadius: 30,
                      backgroundColor: "#ccc",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8,
                        color: "#000",
                        textAlign: "center",
                      }}
                    >
                      Profile
                    </Text>
                  </View>
                </TouchableOpacity>
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
                    source={require("../../assets/marathon.jpeg")}
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
                  style={[tw`text-3xl`, { color: "black", fontFamily: "Joan" }]}
                >
                  Week #/#
                </Text>

                {/* see sweat button on the right */}
                <TouchableOpacity
                  onPress={() => Alert.alert("Button pressed")}
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
                    onPress={() => navigation.navigate("Sessions")}
                  >
                    See Sweat
                  </Text>
                </TouchableOpacity>
              </View>

              {/* gradient progress bar */}
              <View
                style={{
                  width: maxWidth * 0.8,
                  alignSelf: "center",
                  marginTop: 6,
                }}
              >
                <View
                  style={{ height: 16, borderRadius: 8, overflow: "hidden" }}
                >
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

                  {/* solid completed portion (clear section) */}
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

              {/* New section: Start a New Training Program */}
              <View
                style={{
                  backgroundColor: "#5492DA", // blue background
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
                    fontFamily: "Joan",
                    fontWeight: "600",
                  }}
                >
                  Start a New Training Program
                </Text>
              </View>

              <Pressable
                onPress={() => navigation.navigate("", { program: "Marathon" })}
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }], // scale down when pressed
                    opacity: pressed ? 0.9 : 1, // slight fade
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

              <Pressable
                onPress={() => navigation.navigate("", { program: "Hybrid" })}
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }], // scale down when pressed
                    opacity: pressed ? 0.9 : 1, // slight fade
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
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
