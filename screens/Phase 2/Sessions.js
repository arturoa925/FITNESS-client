// ! begin at phase 2 : strength (title) -> weeks

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
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

export default function Sessions({navigation}) {

  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  // TEMP: mock training data — this will later be driven by the selected plan
  const [weeksData, setWeeksData] = useState([
    { week: 1, completedDays: 3, totalDays: 5 },
    { week: 2, completedDays: 2, totalDays: 5 },
    { week: 3, completedDays: 4, totalDays: 5 },
  ]);

  const progressBarHeight = 16;
  const progressBarWidth = Math.min(240, Math.max(160, width * 0.55));

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
    const dayAnims = useRef(Array.from({ length: item.totalDays }, () => new Animated.Value(0))).current;

    const pct = getProgress(item.completedDays, item.totalDays);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    const shimmerTranslate = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-(progressBarWidth), progressBarWidth],
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
        [...dayAnims]
          .reverse()
          .map((v) =>
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
        style={[tw`flex-row items-center justify-between mb-12`, { width: "100%", paddingHorizontal: 4 }]}
      >
        <View style={tw`flex-row items-center`}>
          <Pressable
            onPress={() => setExpanded((prev) => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[tw`text-2xl font-bold`, { color: "#0E0E0E", fontFamily: "Joan" }]}> {`Week ${item.week}`} </Text>
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
                    rotate: caretAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }),
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
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.35, borderRadius: 999 }}
          />

          {/* animated completed portion */}
          <Animated.View
            style={{ width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, progressBarWidth] }), height: "100%", overflow: "hidden" }}
          >
            <LinearGradient
              colors={["#87DAF0", "#355D73"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            />
          </Animated.View>

          {/* shimmering sweep */}
          <Animated.View
            pointerEvents="none"
            style={{ position: "absolute", top: 0, bottom: 0, width: 120, opacity: 0.6, transform: [{ translateX: shimmerTranslate }] }}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.65)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>
      </Pressable>
      {expanded && (
        <View style={[tw`mt-3 mb-6`, { paddingLeft: 8 }]}> 
          {Array.from({ length: item.totalDays }).map((_, i) => {
            const a = dayAnims[i];
            const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
            return (
              <Animated.View
                key={i}
                style={[tw`flex-row items-center justify-center py-1`, { opacity: a, transform: [{ translateY }] }]}
              >
                <Text style={[tw`mr-2`, { opacity: i < item.completedDays ? 1 : 0.4, fontSize: 22, color:"#E6B82C" }]}> 
                  {i < item.completedDays ? "✓" : "○"}
                </Text>
                <Text style={[tw`text-base text-3xl`, { color: "#0E0E0E", fontFamily: "Joan" }]}> {`Day ${i + 1}`} </Text>
              </Animated.View>
            );
          })}
        </View>
      )}
      </>
    );
  };


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
                  { color: "#87DAF0", fontFamily: "Joan"},
                ]}
              >
                Train
              </Text>

              {/* Weeks list with completion bars */}
              <View style={[tw`mt-2`, { width: "100%" }]}>
                {weeksData.map((w) => (
                  <WeekRow key={w.week} item={w} />
                ))}
              </View>

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
                  onPress={() => navigation.navigate("")}
                >
                  Begin Today's Session
                </Text>
              </TouchableOpacity>



              
              </View>
              </View>






        </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>
)

}