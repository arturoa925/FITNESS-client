import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Pressable,
  TextInput,
  FlatList,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { Picker } from "@react-native-picker/picker";

const API_BASE_URL = "http://localhost:3004";

export default function CalendarFoodLog({
  maxWidth,
  userId,
  authToken,
  completedWorkouts: completedWorkoutsProp = {},
}) {
  // ----- Calendar & Food Log state -----
  const [selectedDate, setSelectedDate] = useState(null);
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [foodAmount, setFoodAmount] = useState("");
  const [foodUnit, setFoodUnit] = useState("g");

  // Foods keyed by date
  const [foodsByDate, setFoodsByDate] = useState({});

  // Completed workouts keyed by date fetched from the backend calendar route
  const [serverCompletedWorkouts, setServerCompletedWorkouts] = useState({});
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState(null);

  // Prefer server-fetched completed workouts when available, otherwise fall back to prop
  const completedWorkouts =
    Object.keys(serverCompletedWorkouts || {}).length > 0
      ? serverCompletedWorkouts
      : completedWorkoutsProp;

  // Fetch completed workouts (and any foods) for the current month from the backend calendar route
  useEffect(() => {
    console.log("CalendarFoodLog useEffect fired:", {
      userId,
      hasAuthToken: !!authToken,
    });
    if (!userId || !authToken) {
      console.log(
        "CalendarFoodLog: missing userId or authToken, skipping fetch"
      );
      return;
    }

    const controller = new AbortController();

    const fetchCalendar = async () => {
      try {
        setLoadingCalendar(true);
        setCalendarError(null);

        const now = new Date();
        const month = String(now.getMonth() + 1);
        const year = String(now.getFullYear());

        const params = new URLSearchParams({
          month,
          year,
          onlyCompleted: "true",
          // include flags if you want them on the server side, but this component
          // currently only uses workouts + foods
          // include: "flags",
        });

        console.log(
          "CalendarFoodLog: fetching calendar from",
          `${API_BASE_URL}/users/${userId}/calendar?${params.toString()}`
        );
        const res = await fetch(
          `${API_BASE_URL}/users/${userId}/calendar?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          throw new Error(`Calendar fetch failed with status ${res.status}`);
        }

        const data = await res.json();

        const workoutMap = {};
        const foodsMap = {};

        (data || []).forEach((entry) => {
          const dateKey = entry.date;
          if (!dateKey) return;

          if (Array.isArray(entry.workouts) && entry.workouts.length > 0) {
            // Route already supports onlyCompleted=true, but we defensively filter anyway
            const completedForDay = entry.workouts.filter(
              (w) => w && w.completed === true
            );
            if (completedForDay.length > 0) {
              workoutMap[dateKey] = completedForDay;
            }
          }

          if (Array.isArray(entry.foods) && entry.foods.length > 0) {
            foodsMap[dateKey] = entry.foods;
          }
        });

        setServerCompletedWorkouts(workoutMap);
        // Merge server foods into local foods; local additions will still work
        setFoodsByDate((prev) => ({
          ...prev,
          ...foodsMap,
        }));
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Error fetching calendar data:", err);
        console.log("CalendarFoodLog error details:", err?.message);
        setCalendarError("Unable to load your calendar right now.");
      } finally {
        setLoadingCalendar(false);
      }
    };

    fetchCalendar();

    return () => {
      controller.abort();
    };
  }, [userId, authToken]);

  const fetchFoodsForDate = async (dateStr) => {
    if (!userId || !authToken) {
      console.log("fetchFoodsForDate: missing credentials");
      return;
    }
    try {
      const url = `${API_BASE_URL}/users/${userId}/calendar/foods?date=${encodeURIComponent(
        dateStr
      )}`;
      console.log("CalendarFoodLog: fetching foods for date:", url);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 404) {
        setFoodsByDate((prev) => ({
          ...prev,
          [dateStr]: [],
        }));
        return;
      }

      if (!res.ok) {
        console.error("fetchFoodsForDate failed, status:", res.status);
        return;
      }

      const foods = await res.json();
      setFoodsByDate((prev) => ({
        ...prev,
        [dateStr]: foods || [],
      }));
    } catch (err) {
      console.error("Error fetching foods for date:", dateStr, err);
    }
  };

  const openFoodModal = (dateStr) => {
    setSelectedDate(dateStr);
    setFoodModalOpen(true);
  };

  const addFood = async () => {
    if (!selectedDate) return;
    if (!foodName.trim() || !foodAmount.trim() || !foodUnit.trim()) {
      Alert.alert("Please fill in food name, amount, and unit.");
      return;
    }

    if (!userId || !authToken) {
      Alert.alert("Unable to save food", "Missing user credentials.");
      return;
    }

    const payload = {
      date: selectedDate,
      food: {
        name: foodName.trim(),
        amount: foodAmount.trim(),
        unit: foodUnit.trim(),
      },
    };

    try {
      const res = await fetch(
        `${API_BASE_URL}/users/${userId}/calendar/foods`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        console.error("Failed to add food, status:", res.status);
        Alert.alert("Unable to save food", "Please try again.");
        return;
      }

      const updatedCalendar = await res.json();

      // Sync this date's foods from the server response
      setFoodsByDate((prev) => ({
        ...prev,
        [selectedDate]: updatedCalendar.foods || [],
      }));

      setFoodName("");
      setFoodAmount("");
      setFoodUnit("g");
      setFoodModalOpen(false);
    } catch (err) {
      console.error("Error adding food to calendar:", err);
      Alert.alert(
        "Unable to save food",
        "Please check your connection and try again."
      );
    }
  };

  // iOS unit picker flow: close food sheet → open wheel → pick → reopen food sheet
  const openUnitPicker = () => {
    setFoodModalOpen(false);
    requestAnimationFrame(() => setUnitModalOpen(true));
  };
  const finishUnitPick = (val) => {
    setFoodUnit(val);
    setUnitModalOpen(false);
    requestAnimationFrame(() => setFoodModalOpen(true));
  };

  // Build markedDates for multi-dot calendar (workouts + foods + selected)
  const markedDates = (() => {
    const marks = {};
    Object.keys(completedWorkouts || {}).forEach((d) => {
      marks[d] = {
        ...(marks[d] || {}),
        marked: true,
        dots: [{ color: "#355D73" }],
      };
    });
    Object.keys(foodsByDate || {}).forEach((d) => {
      const foods = foodsByDate[d];
      const hasFoods = Array.isArray(foods) && foods.length > 0;
      if (!hasFoods) return;

      marks[d] = {
        ...(marks[d] || {}),
        marked: true,
        dots: [...(marks[d]?.dots || []), { color: "#E6B82C" }],
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
    <>
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
            calendarBackground: "#FFFFFF",
            textDayFontSize: 22,
            textMonthFontSize: 24,
            textDayHeaderFontSize: 16,
          }}
          markingType="multi-dot"
          markedDates={markedDates}
          onDayPress={(day) => {
            const dateStr = day.dateString;
            setSelectedDate(dateStr);
            fetchFoodsForDate(dateStr);
          }}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: "#355D73",
              }}
            />
            <Text
              style={{ fontFamily: "Joan", color: "#060000", fontSize: 16 }}
            >
              Workout (blue-gray)
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: "#E6B82C",
              }}
            />
            <Text
              style={{ fontFamily: "Joan", color: "#060000", fontSize: 16 }}
            >
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
          <Text style={{ fontFamily: "Joan", fontSize: 20, color: "#060000" }}>
            {selectedDate ? `Selected: ${selectedDate}` : "Select a day"}
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

          {loadingCalendar && (
            <Text
              style={{
                fontFamily: "Joan",
                fontSize: 14,
                color: "#777",
                marginBottom: 4,
              }}
            >
              Loading calendar...
            </Text>
          )}
          {calendarError && (
            <Text
              style={{
                fontFamily: "Joan",
                fontSize: 14,
                color: "#B00020",
                marginBottom: 4,
              }}
            >
              {calendarError}
            </Text>
          )}

          {/* Workouts */}
          <Text style={{ fontFamily: "Joan", fontSize: 18, color: "#355D73" }}>
            Workouts
          </Text>
          {selectedDate && completedWorkouts[selectedDate]?.length > 0 ? (
            completedWorkouts[selectedDate].map((w, idx) => (
              <Text
                key={`w-${idx}`}
                style={{ fontFamily: "Joan", fontSize: 16, color: "#060000" }}
              >
                • {w.name}
              </Text>
            ))
          ) : (
            <Text style={{ fontFamily: "Joan", fontSize: 16, color: "#777" }}>
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
                  style={{ fontFamily: "Joan", fontSize: 16, color: "#060000" }}
                >
                  • {item.name} — {item.amount}
                  {item.unit}
                </Text>
              )}
              scrollEnabled={false}
            />
          ) : (
            <Text style={{ fontFamily: "Joan", fontSize: 16, color: "#777" }}>
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
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              {/* Amount */}
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

              {/* Unit (iOS wheel in separate modal, Android dropdown) */}
              {Platform.OS === "android" ? (
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
                    <Picker.Item label="tablespoons (tbsp)" value="tbsp" />
                    <Picker.Item label="teaspoons (tsp)" value="tsp" />
                  </Picker>
                </View>
              ) : (
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
                    {foodUnit === "g"
                      ? "grams (g)"
                      : foodUnit === "oz"
                      ? "ounces (oz)"
                      : foodUnit === "ml"
                      ? "milliliters (ml)"
                      : foodUnit === "cup"
                      ? "cups (cup)"
                      : foodUnit === "tbsp"
                      ? "tablespoons (tbsp)"
                      : "teaspoons (tsp)"}
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
                  style={{ fontFamily: "Joan", color: "#000", fontSize: 16 }}
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
              itemStyle={{ fontFamily: "Joan", fontSize: 18, color: "#060000" }}
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
    </>
  );
}
