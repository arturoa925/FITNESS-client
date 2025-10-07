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

  //calendar component
  // ----- Calendar & Food Log state -----
  const [selectedDate, setSelectedDate] = useState(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleAccountSettings = () => {
    setProfileMenuOpen(false);
    navigation.navigate("Profile"); // change to "AccountSettings" if you add that route
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    // Optional: clear any secure tokens if you store them
    try {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("refreshToken");
    } catch (e) {
      // ignore if keys don't exist
    }
    Alert.alert("Logged out", "You have been logged out.");
    // TODO: Navigate to your auth screen if applicable, e.g.:
    // navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  };

  // Hard-coded workout completions for display (YYYY-MM-DD)
  const completedWorkouts = {
    "2025-10-01": [{ name: "5K Run" }],
    "2025-10-02": [{ name: "Upper Body Lift" }],
    "2025-10-04": [{ name: "Mobility + Core" }],
    "2025-10-06": [{ name: "Long Run 8mi" }],
  };

  // Foods keyed by date
  const [foodsByDate, setFoodsByDate] = useState({
    "2025-10-02": [{ name: "Greek Yogurt", amount: "170", unit: "g" }],
  });

  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [foodAmount, setFoodAmount] = useState("");
  const [foodUnit, setFoodUnit] = useState("g");

  const openFoodModal = (dateStr) => {
    setSelectedDate(dateStr);
    setFoodModalOpen(true);
  };

  const addFood = () => {
    if (!selectedDate) return;
    if (!foodName.trim() || !foodAmount.trim() || !foodUnit.trim()) {
      Alert.alert("Please fill in food name, amount, and unit.");
      return;
    }
    setFoodsByDate((prev) => {
      const existing = prev[selectedDate] || [];
      return {
        ...prev,
        [selectedDate]: [
          ...existing,
          {
            name: foodName.trim(),
            amount: foodAmount.trim(),
            unit: foodUnit.trim(),
          },
        ],
      };
    });
    setFoodName("");
    setFoodAmount("");
    setFoodUnit("g");
    setFoodModalOpen(false);
  };

  // unit picker wheel helpers
  const openUnitPicker = () => {
    // close food sheet first so the unit modal isn't hidden behind it
    setFoodModalOpen(false);
    requestAnimationFrame(() => setUnitModalOpen(true));
  };

  const finishUnitPick = (val) => {
    setFoodUnit(val);
    setUnitModalOpen(false);
    // re-open the food sheet after the unit wheel closes
    requestAnimationFrame(() => setFoodModalOpen(true));
  };

  // Build markedDates for multi-dot calendar (workouts + foods + selected)
  const markedDates = (() => {
    const marks = {};
    Object.keys(completedWorkouts).forEach((d) => {
      marks[d] = {
        ...(marks[d] || {}),
        marked: true,
        dots: [{ color: "#355D73" }], // workout
      };
    });
    Object.keys(foodsByDate).forEach((d) => {
      marks[d] = {
        ...(marks[d] || {}),
        marked: true,
        dots: [...(marks[d]?.dots || []), { color: "#E6B82C" }], // food
      };
    });
    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: "#87DAF0",
      };
    }
    return marks;
  })();

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
                  onPress={() => setProfileMenuOpen(true)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
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

              <Pressable
                onPress={() => navigation.navigate("", { program: "Marathon" })}
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

              <Pressable
                onPress={() => navigation.navigate("", { program: "Hybrid" })}
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
                onPress={() => Alert.alert("Button pressed")}
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
                  onPress={() => navigation.navigate("DailyGrind")}
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
              <View
                style={{
                  width: maxWidth * 0.95,
                  alignSelf: "center",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  overflow: "hidden",
                  marginTop: 16,
                  padding: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <Calendar
                  style={{ borderRadius: 12 }}
                  theme={{
                    todayTextColor: "#5492DA",
                    arrowColor: "#355D73",
                    textDayFontFamily: "Joan",
                    textMonthFontFamily: "Joan",
                    textDayHeaderFontFamily: "Joan",
                    monthTextColor: "#060000",
                  }}
                  markingType="multi-dot"
                  markedDates={markedDates}
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                />

                {/* Legend */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 16,
                    marginTop: 8,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#355D73",
                      }}
                    />
                    <Text style={{ fontFamily: "Joan", color: "#060000" }}>
                      Workout (blue-gray)
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#E6B82C",
                      }}
                    />
                    <Text style={{ fontFamily: "Joan", color: "#060000" }}>
                      Food (yellow)
                    </Text>
                  </View>
                </View>

                {/* Day actions */}
                <View
                  style={{
                    marginTop: 12,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Joan",
                      fontSize: 20,
                      color: "#060000",
                    }}
                  >
                    {selectedDate
                      ? `Selected: ${selectedDate}`
                      : "Select a day"}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      if (!selectedDate) {
                        Alert.alert("Select a date first");
                        return;
                      }
                      openFoodModal(selectedDate);
                    }}
                    style={{
                      backgroundColor: "#E6B82C",
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: "#000",
                        fontSize: 16,
                        fontFamily: "Joan",
                        fontWeight: "600",
                      }}
                    >
                      Add Food
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Day details */}
                <View style={{ marginTop: 16 }}>
                  <Text
                    style={{
                      fontFamily: "Joan",
                      fontSize: 22,
                      color: "#060000",
                      marginBottom: 8,
                    }}
                  >
                    Day Summary
                  </Text>
                  {/* Workouts */}
                  <Text
                    style={{
                      fontFamily: "Joan",
                      fontSize: 18,
                      color: "#355D73",
                    }}
                  >
                    Workouts
                  </Text>
                  {selectedDate &&
                  completedWorkouts[selectedDate]?.length > 0 ? (
                    completedWorkouts[selectedDate].map((w, idx) => (
                      <Text
                        key={`w-${idx}`}
                        style={{
                          fontFamily: "Joan",
                          fontSize: 16,
                          color: "#060000",
                        }}
                      >
                        • {w.name}
                      </Text>
                    ))
                  ) : (
                    <Text
                      style={{
                        fontFamily: "Joan",
                        fontSize: 16,
                        color: "#777",
                      }}
                    >
                      No workouts logged.
                    </Text>
                  )}
                  {/* Foods */}

                  <Text
                    style={{
                      fontFamily: "Joan",
                      fontSize: 18,
                      color: "#355D73",
                      marginTop: 10,
                    }}
                  >
                    Foods
                  </Text>
                  {selectedDate && foodsByDate[selectedDate]?.length > 0 ? (
                    <FlatList
                      data={foodsByDate[selectedDate]}
                      keyExtractor={(_, idx) => `f-${idx}`}
                      renderItem={({ item }) => (
                        <Text
                          style={{
                            fontFamily: "Joan",
                            fontSize: 16,
                            color: "#060000",
                          }}
                        >
                          • {item.name} — {item.amount}
                          {item.unit}
                        </Text>
                      )}
                      scrollEnabled={false}
                    />
                  ) : (
                    <Text
                      style={{
                        fontFamily: "Joan",
                        fontSize: 16,
                        color: "#777",
                      }}
                    >
                      No foods logged. Tap “Add Food”.
                    </Text>
                  )}
                </View>
              </View>

              {/* Add Food Modal */}
              <Modal
                animationType="slide"
                transparent
                visible={foodModalOpen}
                onRequestClose={() => setFoodModalOpen(false)}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.35)",
                    justifyContent: "flex-end",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "#FFF",
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                      padding: 16,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Joan",
                        fontSize: 22,
                        color: "#060000",
                        textAlign: "center",
                        marginBottom: 12,
                      }}
                    >
                      Add Food — {selectedDate || ""}
                    </Text>

                    <TextInput
                      placeholder="Food name (e.g., Chicken Breast)"
                      value={foodName}
                      onChangeText={setFoodName}
                      style={{
                        borderWidth: 1,
                        borderColor: "#ddd",
                        padding: 12,
                        borderRadius: 10,
                        marginBottom: 10,
                        fontFamily: "Joan",
                      }}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      {/* Compact numeric amount */}
                      <TextInput
                        placeholder="Amt"
                        keyboardType="number-pad"
                        inputMode="numeric"
                        maxLength={5}
                        value={foodAmount}
                        onChangeText={setFoodAmount}
                        style={{
                          width: 90,
                          height: 44,
                          borderWidth: 1,
                          borderColor: "#ddd",
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          fontFamily: "Joan",
                          fontSize: 16,
                          textAlign: "center",
                        }}
                      />

                      {/* Unit selector */}
                      {Platform.OS === "android" ? (
                        // Android: compact dropdown
                        <View
                          style={{
                            flex: 1,
                            height: 44,
                            borderWidth: 1,
                            borderColor: "#ddd",
                            borderRadius: 10,
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          <Picker
                            selectedValue={foodUnit}
                            onValueChange={(val) => setFoodUnit(val)}
                            mode="dropdown"
                            style={{ height: 44, width: "100%" }}
                            dropdownIconColor="#060000"
                          >
                            <Picker.Item label="grams (g)" value="g" />
                            <Picker.Item label="ounces (oz)" value="oz" />
                            <Picker.Item label="milliliters (ml)" value="ml" />
                            <Picker.Item label="cups (cup)" value="cup" />
                            <Picker.Item
                              label="tablespoons (tbsp)"
                              value="tbsp"
                            />
                            <Picker.Item label="teaspoons (tsp)" value="tsp" />
                          </Picker>
                        </View>
                      ) : (
                        // iOS: show only the selected unit; open wheel in a separate modal
                        <TouchableOpacity
                          onPress={openUnitPicker}
                          style={{
                            flex: 1,
                            height: 44,
                            borderWidth: 1,
                            borderColor: "#ddd",
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Joan",
                              fontSize: 16,
                              color: "#060000",
                            }}
                          >
                            {(() => {
                              switch (foodUnit) {
                                case "g":
                                  return "grams (g)";
                                case "oz":
                                  return "ounces (oz)";
                                case "ml":
                                  return "milliliters (ml)";
                                case "cup":
                                  return "cups (cup)";
                                case "tbsp":
                                  return "tablespoons (tbsp)";
                                case "tsp":
                                  return "teaspoons (tsp)";
                                default:
                                  return foodUnit;
                              }
                            })()}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View
                      style={{
                        marginTop: 16,
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setFoodModalOpen(false)}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 18,
                          borderRadius: 12,
                          backgroundColor: "#A4A4A4",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Joan",
                            color: "#000",
                            fontSize: 16,
                          }}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={addFood}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 18,
                          borderRadius: 12,
                          backgroundColor: "#E6B82C",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Joan",
                            color: "#000",
                            fontSize: 16,
                            fontWeight: "600",
                          }}
                        >
                          Save
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              {/* iOS Unit Picker (simple + reliable) */}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Profile menu modal */}
      <Modal
        visible={profileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuOpen(false)}
      >
        <Pressable
          onPress={() => setProfileMenuOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }}
        >
          {/* Empty Pressable to catch backdrop taps */}
        </Pressable>

        {/* Anchored menu container */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 70,
            right: 12,
            alignItems: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              paddingVertical: 4,
              minWidth: 160,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              borderWidth: 1,
              borderColor: "#eee",
            }}
          >
            <TouchableOpacity
              onPress={handleAccountSettings}
              style={{ paddingVertical: 12, paddingHorizontal: 14 }}
            >
              <Text
                style={{ fontFamily: "Joan", fontSize: 16, color: "#060000" }}
              >
                Account Settings
              </Text>
            </TouchableOpacity>

            <View
              style={{
                height: 1,
                backgroundColor: "#eee",
                marginHorizontal: 8,
              }}
            />

            <TouchableOpacity
              onPress={handleLogout}
              style={{ paddingVertical: 12, paddingHorizontal: 14 }}
            >
              <Text
                style={{ fontFamily: "Joan", fontSize: 16, color: "#B00020" }}
              >
                Log out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={unitModalOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setUnitModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          {/* Backdrop to close on tap */}
          <Pressable
            onPress={() => setUnitModalOpen(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          {/* Bottom sheet (NO touchables here so the wheel gets gestures) */}
          <View
            style={{
              backgroundColor: "#FFF",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingTop: 8,
              paddingBottom: 12,
            }}
          >
            <Picker
              selectedValue={foodUnit}
              onValueChange={(val) => finishUnitPick(val)}
              style={{ height: 216, width: "100%" }}
              itemStyle={{
                fontFamily: "Joan",
                fontSize: 18,
                color: "#060000",
              }}
            >
              <Picker.Item label="grams (g)" value="g" />
              <Picker.Item label="ounces (oz)" value="oz" />
              <Picker.Item label="milliliters (ml)" value="ml" />
              <Picker.Item label="cups (cup)" value="cup" />
              <Picker.Item label="tablespoons (tbsp)" value="tbsp" />
              <Picker.Item label="teaspoons (tsp)" value="tsp" />
            </Picker>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
