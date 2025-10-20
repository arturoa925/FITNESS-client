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
  Modal,
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar } from "react-native-calendars";
import { Picker } from "@react-native-picker/picker";
import { TouchableWithoutFeedback } from "react-native";
import { FlatList } from "react-native";

// * components
import ProfileAvatarMenu from "../../components/Home/ProfilePic";
import ProgressBar from "../../components/Home/CurrentWeekBar";
import CalendarFoodLog from "../../components/Home/Calendar";


export default function Home({ navigation }) {
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  // * log out user
  const handleLogout = async () => {
    try {
      // Get the stored token (optional)
      const token = await SecureStore.getItemAsync("authToken");

      const baseURL =
        Platform.OS === "android" ? "http://10.0.2.2:3004" : "http://localhost:3004";
      const logoutUrl = `${baseURL}/users/logout`;

      await fetch(logoutUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      // Clear all auth-related data
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("refreshToken");
      
      // Navigate back to Welcome
      navigation.replace("Welcome");
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Unable to log out. Please try again.");
    }
  };

  // progress for training plan (mock values for now)
  // ! replace with user data
  const weekCurrent = 8; // e.g., Week 3
  const weekTotal = 12; // e.g., out of 12
  const progress = Math.max(
    0,
    Math.min(1, weekCurrent / Math.max(1, weekTotal))
  );
  const completedWidth = progress * (maxWidth * 0.8); // matches marathon image & stats row width

  // Hard-coded workout completions for display (YYYY-MM-DD)
  const completedWorkouts = {
    "2025-10-01": [{ name: "5K Run" }],
    "2025-10-02": [{ name: "Upper Body Lift" }],
    "2025-10-04": [{ name: "Mobility + Core" }],
    "2025-10-06": [{ name: "Long Run 8mi" }],
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}>
      {/* Formatting */}
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={tw`flex-grow`}
          keyboardShouldPersistTaps="handled"
        >
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
                <ProfileAvatarMenu navigation={navigation} onLogout={handleLogout} />
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
                   onPress={() => navigation.navigate("Sessions")}
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
              <ProgressBar progress={progress} width={maxWidth * 0.8} />

              {/* New section: Start a New Training Program */}
              <View
                style={{
                  backgroundColor: "#5492DA",
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
                    fontFamily: "Manrope",
                    fontWeight: "400",
                    textAlign: "center",
                  }}
                >
                  Start a New Training Program
                </Text>
              </View>
              {/* marathon */}
              <Pressable
                onPress={() => navigation.navigate("ProgramDetails", { program: "Marathon" })}
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    opacity: pressed ? 0.9 : 1,
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

              {/* hybrid */}
              <Pressable
                onPress={() => navigation.navigate("ProgramDetails")}
                style={({ pressed }) => [
                  {
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    opacity: pressed ? 0.9 : 1,
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

              <View
                style={{
                  backgroundColor: "#5492DA",
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
                    fontFamily: "Manrope",
                    fontWeight: "600",
                  }}
                >
                  Daily Reps
                </Text>
              </View>

              <Text
                style={{
                  color: "#000000ff",
                  fontSize: 28,
                  fontFamily: "Joan",
                  fontWeight: "600",
                  textAlign: "center",
                  marginTop: 80,
                }}
              >
                For Movement and Momentum is the key
              </Text>

              <TouchableOpacity
                 onPress={() => navigation.navigate("DailyGrind")}
                style={{
                  backgroundColor: "#E6B82C",
                  paddingVertical: 10,
                  paddingHorizontal: 22,
                  borderRadius: 20,
                  minWidth: 110,
                  marginTop: 100,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#000",
                    fontSize: 28,
                    fontFamily: "Joan",
                    fontWeight: "600",
                  }}
                 
                >
                  Generate Workout
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  backgroundColor: "#5492DA",
                  paddingVertical: 20,
                  paddingHorizontal: 16,
                  marginTop: 360,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 28,
                    fontFamily: "Manrope",
                    fontWeight: "600",
                  }}
                >
                  View Your Consistency
                </Text>
              </View>

              {/* Calendar & Day Log */}

              <CalendarFoodLog
                maxWidth={maxWidth}
                completedWorkouts={completedWorkouts}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
