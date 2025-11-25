import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { useUser } from "../../components/UserContext";
import { resolveApiBase } from "../../utils/api";

const API_BASE_URL = resolveApiBase();

export default function CalendarFoodLog({
  maxWidth,
  userId,
  authToken,
  completedWorkouts: completedWorkoutsProp = {},
}) {
  // Calendar & Food Log state
  const [selectedDate, setSelectedDate] = useState(null);
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [foodAmount, setFoodAmount] = useState("");
  const [foodUnit, setFoodUnit] = useState("g");

  // Foods keyed by date (from context)
  const { foodsByDate, setFoodsByDate, addFoodEntry, removeFoodEntry } = useUser();

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
    if (!userId || !authToken) return;

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
        });

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

  const fetchFoodsForDate = useCallback(
    async (dateStr) => {
      if (!userId || !authToken) return;
      try {
        const url = `${API_BASE_URL}/users/${userId}/calendar/foods?date=${encodeURIComponent(
          dateStr
        )}`;

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        });

        // If no calendar entry exists for this date yet, treat as "no foods"
        if (res.status === 200) {
          const foods = await res.json();
          setFoodsByDate((prev) => ({
            ...prev,
            [dateStr]: foods || [],
          }));
          return;
        }

        if (res.status === 404) {
          setFoodsByDate((prev) => ({
            ...prev,
            [dateStr]: [],
          }));
          return;
        }

        if (!res.ok) {
          console.error("fetchFoodsForDate failed, status:", res.status);
        }
      } catch (err) {
        console.error("Error fetching foods for date:", dateStr, err);
      }
    },
    [userId, authToken, setFoodsByDate]
  );

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

    if (!userId) {
      Alert.alert("Unable to save food", "Missing user id.");
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
      await addFoodEntry({
        userId,
        date: selectedDate,
        food: payload.food,
        authToken,
        baseUrl: API_BASE_URL,
      });

      setFoodName("");
      setFoodAmount("");
      setFoodUnit("g");
      setFoodModalOpen(false);
    } catch (err) {
      console.error("Error adding food to calendar:", err);
      Alert.alert(
        "Unable to save food",
        "Something went wrong locally."
      );
    }
  };

  // Delete food helper
  const deleteFood = async (dateStr, food) => {
    if (!userId) {
      Alert.alert("Unable to remove food", "Missing user id.");
      return;
    }

    if (!food?.id) {
      Alert.alert(
        "Unable to remove food",
        "This food item is missing an id. Try refreshing."
      );
      return;
    }

    Alert.alert(
      "Remove food",
      `Remove "${food.name}" from ${dateStr}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFoodEntry({
                userId,
                date: dateStr,
                foodId: food.id,
                authToken,
                baseUrl: API_BASE_URL,
              });
            } catch (err) {
              console.error("Error deleting food:", err);
              Alert.alert(
                "Unable to remove food",
                "Something went wrong locally."
              );
            }
          },
        },
      ]
    );
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
  const markedDates = useMemo(() => {
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
  }, [completedWorkouts, foodsByDate, selectedDate]);

  const formattedSelectedLabel = selectedDate
    ? `Selected: ${selectedDate}`
    : "Select a day";

  return (
    <>
      {/* Calendar & Day Log */}
      <View
        style={{
          width: maxWidth * 0.95,
          alignSelf: "center",
          backgroundColor: "#F9FAFB",
          borderRadius: 20,
          marginTop: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 2,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text
            accessibilityRole="header"
            accessibilityLabel="Calendar and log. Tap a day to see your workouts and foods for that date."
            style={{
              fontFamily: "Joan",
              fontSize: 18,
              color: "#111827",
            }}
          >
            Calendar &amp; Log
          </Text>
          <Text
            style={{
              fontFamily: "Joan",
              fontSize: 13,
              color: "#6B7280",
            }}
          >
            Tap a day to see details
          </Text>
        </View>
        <Text
          accessibilityRole="text"
          accessibilityLabel="Calendar view. Blue dots show completed workouts. Yellow dots show foods logged. Tap a day to load its summary below."
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            opacity: 0,
          }}
        >
          Calendar legend
        </Text>
        <Calendar
          style={{
            borderRadius: 16,
            backgroundColor: "#FFFFFF",
            paddingVertical: 8,
          }}
          theme={{
            calendarBackground: "#FFFFFF",

            monthTextColor: "#111827",
            textMonthFontFamily: "Joan",
            textMonthFontSize: 22,

            textDayFontFamily: "Joan",
            textDayFontSize: 18,
            dayTextColor: "#111827",
            textDisabledColor: "#9CA3AF",

            textDayHeaderFontFamily: "Joan",
            textDayHeaderFontSize: 13,
            textSectionTitleColor: "#6B7280",

            todayTextColor: "#E6B82C",
            selectedDayBackgroundColor: "#355D73",
            selectedDayTextColor: "#FFFFFF",
            arrowColor: "#355D73",
            dotColor: "#E6B82C",
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
            justifyContent: "flex-start",
            gap: 16,
            marginTop: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: "#355D73",
              }}
            />
            <Text
              style={{ fontFamily: "Joan", color: "#060000", fontSize: 14 }}
            >
              Workout
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: "#E6B82C",
              }}
            />
            <Text
              style={{ fontFamily: "Joan", color: "#060000", fontSize: 14 }}
            >
              Food
            </Text>
          </View>
        </View>

        {/* Day actions */}
        <View
          style={{
            marginTop: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Joan",
              fontSize: 16,
              color: "#4B5563",
            }}
          >
            {formattedSelectedLabel}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (!selectedDate) {
                Alert.alert("Select a date first");
                return;
              }
              openFoodModal(selectedDate);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              selectedDate
                ? `Add food for ${selectedDate}`
                : "Add food. Select a date first."
            }
            accessibilityHint="Opens a form to log food for the selected day."
            style={{
              backgroundColor: "#E6B82C",
              paddingVertical: 8,
              paddingHorizontal: 18,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: "#000",
                fontSize: 15,
                fontFamily: "Joan",
                fontWeight: "600",
              }}
            >
              Add Food
            </Text>
          </TouchableOpacity>
        </View>

        {/* Day details */}
        <View
          style={{
            marginTop: 18,
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text
            accessibilityRole="header"
            accessibilityLabel="Day summary. Workouts and foods for the selected date."
            style={{
              fontFamily: "Joan",
              fontSize: 18,
              color: "#111827",
              marginBottom: 6,
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
          <Text
            accessibilityRole="header"
            accessibilityLabel="Workouts for the selected date"
            style={{
              fontFamily: "Joan",
              fontSize: 16,
              color: "#355D73",
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            Workouts
          </Text>
          {selectedDate && completedWorkouts[selectedDate]?.length > 0 ? (
            completedWorkouts[selectedDate].map((w, idx) => (
              <Text
                key={`w-${idx}`}
                style={{ fontFamily: "Joan", fontSize: 15, color: "#111827" }}
              >
                • {w.name}
              </Text>
            ))
          ) : (
            <Text style={{ fontFamily: "Joan", fontSize: 15, color: "#9CA3AF" }}>
              No workouts logged.
            </Text>
          )}

          {/* Foods */}
          <Text
            accessibilityRole="header"
            accessibilityLabel="Foods logged for the selected date"
            style={{
              fontFamily: "Joan",
              fontSize: 16,
              color: "#355D73",
              marginTop: 12,
            }}
          >
            Foods
          </Text>
          {selectedDate && foodsByDate[selectedDate]?.length > 0 ? (
            <FlatList
              data={foodsByDate[selectedDate]}
              keyExtractor={(item, idx) =>
                item?.id ? String(item.id) : `f-${idx}`
              }
              renderItem={({ item }) => (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Joan",
                      fontSize: 15,
                      color: "#111827",
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    • {item.name} — {item.amount}
                    {item.unit}
                  </Text>
                  <TouchableOpacity
                    onPress={() => deleteFood(selectedDate, item)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectedDate
                        ? `Delete ${item.name} logged for ${selectedDate}`
                        : `Delete ${item.name} from this day`
                    }
                    accessibilityHint="Removes this food entry from your calendar."
                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text
                      style={{
                        fontFamily: "Joan",
                        fontSize: 13,
                        color: "#B91C1C",
                      }}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              scrollEnabled={false}
            />
          ) : (
            <Text style={{ fontFamily: "Joan", fontSize: 15, color: "#9CA3AF" }}>
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
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
            }}
          >
            <Text
              accessibilityRole="header"
              accessibilityLabel={
                selectedDate
                  ? `Add food for ${selectedDate}`
                  : "Add food"
              }
              style={{
                fontFamily: "Joan",
                fontSize: 20,
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
              accessibilityLabel="Food name"
              accessibilityHint="Enter the name of the food you are logging."
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
                accessibilityLabel="Amount"
                accessibilityHint="Enter the quantity for this food."
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
                    accessibilityLabel="Unit"
                    accessibilityHint="Select the measurement unit for this food amount."
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
                  accessibilityRole="button"
                  accessibilityLabel={`Unit. Currently ${
                    foodUnit === "g"
                      ? "grams"
                      : foodUnit === "oz"
                      ? "ounces"
                      : foodUnit === "ml"
                      ? "milliliters"
                      : foodUnit === "cup"
                      ? "cups"
                      : foodUnit === "tbsp"
                      ? "tablespoons"
                      : "teaspoons"
                  }.`}
                  accessibilityHint="Opens a picker to choose the measurement unit for this food amount."
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
                accessibilityRole="button"
                accessibilityLabel="Cancel adding food"
                accessibilityHint="Closes this form without saving."
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 999,
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
                accessibilityRole="button"
                accessibilityLabel="Save food"
                accessibilityHint="Saves this food entry to your calendar for the selected day."
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 999,
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

      {/* iOS Unit Picker */}
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
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 8,
              paddingBottom: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              accessibilityLabel="Select measurement unit for food amount."
              style={{
                position: "absolute",
                width: 0,
                height: 0,
                opacity: 0,
              }}
            >
              Unit picker
            </Text>
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
    </>
  );
}
