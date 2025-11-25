import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as SecureStore from "expo-secure-store"; 

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Offline / program-related state
  const [currentProgram, setCurrentProgram] = useState(null);
  const [programsCache, setProgramsCache] = useState({});
  const [progress, setProgress] = useState({});
  const [pendingOps, setPendingOps] = useState([]);
  const [foodsByDate, setFoodsByDate] = useState({});

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    const hydrate = async () => {
      try {
        const [
          storedProgramId,
          storedProgramsCache,
          storedProgress,
          storedPending,
          storedFoodsByDate,
        ] = await Promise.all([
          AsyncStorage.getItem("currentProgramId"),
          AsyncStorage.getItem("programsCache"),
          AsyncStorage.getItem("progress"),
          AsyncStorage.getItem("pendingOps"),
          AsyncStorage.getItem("foodsByDate"),
        ]);

        if (storedProgramsCache) {
          const parsedCache = JSON.parse(storedProgramsCache);
          setProgramsCache(parsedCache);

          if (storedProgramId && parsedCache[storedProgramId]) {
            setCurrentProgram(parsedCache[storedProgramId]);
          }
        }

        if (storedProgress) {
          setProgress(JSON.parse(storedProgress));
        }

        if (storedPending) {
          setPendingOps(JSON.parse(storedPending));
        }
        if (storedFoodsByDate) {
          setFoodsByDate(JSON.parse(storedFoodsByDate));
        }
      } catch (e) {
        console.error("[UserProvider] hydrate failed:", e);
      }
    };

    hydrate();
  }, []);

  // Listen for network reconnect to sync pending ops
  useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    const isOnline = state.isConnected && state.isInternetReachable;
    if (!isOnline) return;

    try {
      // you already have `user` in context
      if (!user) return;

      const baseUrl =
        process.env.EXPO_PUBLIC_API_BASE || "http://localhost:3004";
      const authToken =
        (await SecureStore.getItemAsync("authToken")) ||
        (await SecureStore.getItemAsync("accessToken")) ||
        (await SecureStore.getItemAsync("token"));

      await syncPendingOps({
        userId: user.id,
        authToken,
        baseUrl,
      });
    } catch (e) {
      console.error("[UserProvider] NetInfo sync error:", e);
    }
  });

  return () => unsubscribe();
}, [user, syncPendingOps]);

  const markWorkoutCompleteLocal = useCallback(
    async ({ programId, workoutKey, completedAt }) => {
      if (!programId || !workoutKey) return;

      setProgress((prev) => {
        const programProgress = prev[programId] || { completedWorkouts: {} };
        const updated = {
          ...prev,
          [programId]: {
            ...programProgress,
            completedWorkouts: {
              ...(programProgress.completedWorkouts || {}),
              [workoutKey]: {
                completedAt,
                synced: false,
              },
            },
          },
        };
        AsyncStorage.setItem("progress", JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  // ----- Foods: local cache + offline queue helpers -----

  const addFoodLocal = useCallback(
    async ({ date, food }) => {
      if (!date || !food) return;
      setFoodsByDate((prev) => {
        const existing = prev[date] || [];
        const updated = {
          ...prev,
          [date]: [...existing, food],
        };
        AsyncStorage.setItem("foodsByDate", JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const removeFoodLocal = useCallback(
    async ({ date, foodId }) => {
      if (!date || !foodId) return;
      setFoodsByDate((prev) => {
        const existing = prev[date] || [];
        const filtered = existing.filter(
          (item) => String(item.id) !== String(foodId)
        );
        const updated = {
          ...prev,
          [date]: filtered,
        };
        AsyncStorage.setItem("foodsByDate", JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  // Add a food entry with offline support
  const addFoodEntry = useCallback(
    async ({ userId, date, food, authToken, baseUrl }) => {
      if (!date || !food) return;

      const withId = {
        id:
          food.id ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...food,
      };

      // Always update local cache so UI reflects immediately
      await addFoodLocal({ date, food: withId });

      // If we don't have server info, just queue and return
      if (!userId || !authToken || !baseUrl) {
        const op = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "FOOD_ADD",
          date,
          food: withId,
        };
        setPendingOps((prev) => {
          const next = [...prev, op];
          AsyncStorage.setItem("pendingOps", JSON.stringify(next));
          return next;
        });
        return;
      }

      try {
        const res = await fetch(
          `${baseUrl}/users/${userId}/calendar/foods`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ date, food: withId }),
          }
        );

        if (!res.ok) {
          console.error(
            "[UserProvider] addFoodEntry failed, status:",
            res.status
          );
          const op = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: "FOOD_ADD",
            date,
            food: withId,
          };
          setPendingOps((prev) => {
            const next = [...prev, op];
            AsyncStorage.setItem("pendingOps", JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        console.error("[UserProvider] addFoodEntry network error:", err);
        const op = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "FOOD_ADD",
          date,
          food: withId,
        };
        setPendingOps((prev) => {
          const next = [...prev, op];
          AsyncStorage.setItem("pendingOps", JSON.stringify(next));
          return next;
        });
      }
    },
    [addFoodLocal]
  );

  // Remove a food entry with offline support
  const removeFoodEntry = useCallback(
    async ({ userId, date, foodId, authToken, baseUrl }) => {
      if (!date || !foodId) return;

      // Update local cache immediately
      await removeFoodLocal({ date, foodId });

      // If we don't have server info, queue a delete op
      if (!userId || !authToken || !baseUrl) {
        const op = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "FOOD_DELETE",
          date,
          foodId,
        };
        setPendingOps((prev) => {
          const next = [...prev, op];
          AsyncStorage.setItem("pendingOps", JSON.stringify(next));
          return next;
        });
        return;
      }

      try {
        const res = await fetch(
          `${baseUrl}/users/${userId}/calendar/foods`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ date, foodId }),
          }
        );

        if (!res.ok) {
          console.error(
            "[UserProvider] removeFoodEntry failed, status:",
            res.status
          );
          const op = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: "FOOD_DELETE",
            date,
            foodId,
          };
          setPendingOps((prev) => {
            const next = [...prev, op];
            AsyncStorage.setItem("pendingOps", JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        console.error(
          "[UserProvider] removeFoodEntry network error:",
          err
        );
        const op = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "FOOD_DELETE",
          date,
          foodId,
        };
        setPendingOps((prev) => {
          const next = [...prev, op];
          AsyncStorage.setItem("pendingOps", JSON.stringify(next));
          return next;
        });
      }
    },
    [removeFoodLocal]
  );

  const completeWorkout = useCallback(
    async ({ userId, programId, workoutKey, authToken, baseUrl }) => {
      if (!programId || !workoutKey) return;

      const completedAt = new Date().toISOString();

      // Always update local state so UI reflects completion immediately
      await markWorkoutCompleteLocal({ programId, workoutKey, completedAt });

      // If we don't have server info, just queue the op and return
      if (!userId || !authToken || !baseUrl) {
        const op = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "COMPLETE_WORKOUT",
          programId,
          workoutKey,
          completedAt,
        };
        setPendingOps((prev) => {
          const next = [...prev, op];
          AsyncStorage.setItem("pendingOps", JSON.stringify(next));
          return next;
        });
        return;
      }

      try {
        const res = await fetch(
          `${baseUrl}/users/${userId}/workouts/complete`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ programId, workoutKey, completedAt }),
          }
        );

        if (!res.ok) {
          console.error(
            "[UserProvider] completeWorkout failed, status:",
            res.status
          );
          // Queue the op for later retry
          const op = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: "COMPLETE_WORKOUT",
            programId,
            workoutKey,
            completedAt,
          };
          setPendingOps((prev) => {
            const next = [...prev, op];
            AsyncStorage.setItem("pendingOps", JSON.stringify(next));
            return next;
          });
          return;
        }

        // If server call succeeded, optionally mark as synced
        setProgress((prev) => {
          const programProgress = prev[programId];
          if (!programProgress?.completedWorkouts?.[workoutKey]) {
            return prev;
          }
          const updated = {
            ...prev,
            [programId]: {
              ...programProgress,
              completedWorkouts: {
                ...programProgress.completedWorkouts,
                [workoutKey]: {
                  ...programProgress.completedWorkouts[workoutKey],
                  synced: true,
                },
              },
            },
          };
          AsyncStorage.setItem("progress", JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error("[UserProvider] completeWorkout network error:", err);
        // Queue the op if network error
        const op = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "COMPLETE_WORKOUT",
          programId,
          workoutKey,
          completedAt,
        };
        setPendingOps((prev) => {
          const next = [...prev, op];
          AsyncStorage.setItem("pendingOps", JSON.stringify(next));
          return next;
        });
      }
    },
    [markWorkoutCompleteLocal]
  );

  const syncPendingOps = useCallback(
    async ({ userId, authToken, baseUrl }) => {
      if (!userId || !authToken || !baseUrl) return;
      if (!pendingOps || pendingOps.length === 0) return;

      const currentQueue = [...pendingOps];
      const stillPending = [];

      for (const op of currentQueue) {
        if (op.type === "COMPLETE_WORKOUT") {
          try {
            const res = await fetch(
              `${baseUrl}/users/${userId}/workouts/complete`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${authToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  programId: op.programId,
                  workoutKey: op.workoutKey,
                  completedAt: op.completedAt,
                }),
              }
            );

            if (!res.ok) {
              console.error(
                "[UserProvider] syncPendingOps failed, status:",
                res.status
              );
              stillPending.push(op);
              continue;
            }

            // Mark as synced in local progress
            setProgress((prev) => {
              const programProgress = prev[op.programId];
              if (
                !programProgress?.completedWorkouts ||
                !programProgress.completedWorkouts[op.workoutKey]
              ) {
                return prev;
              }
              const updated = {
                ...prev,
                [op.programId]: {
                  ...programProgress,
                  completedWorkouts: {
                    ...programProgress.completedWorkouts,
                    [op.workoutKey]: {
                      ...programProgress.completedWorkouts[op.workoutKey],
                      synced: true,
                    },
                  },
                },
              };
              AsyncStorage.setItem("progress", JSON.stringify(updated));
              return updated;
            });
          } catch (err) {
            console.error(
              "[UserProvider] syncPendingOps network error:",
              err
            );
            stillPending.push(op);
          }
          continue;
        }

        if (op.type === "FOOD_ADD") {
          try {
            const res = await fetch(
              `${baseUrl}/users/${userId}/calendar/foods`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${authToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ date: op.date, food: op.food }),
              }
            );

            if (!res.ok) {
              console.error(
                "[UserProvider] syncPendingOps FOOD_ADD failed, status:",
                res.status
              );
              stillPending.push(op);
            }
          } catch (err) {
            console.error(
              "[UserProvider] syncPendingOps FOOD_ADD network error:",
              err
            );
            stillPending.push(op);
          }
          continue;
        }

        if (op.type === "FOOD_DELETE") {
          try {
            const res = await fetch(
              `${baseUrl}/users/${userId}/calendar/foods`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${authToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  date: op.date,
                  foodId: op.foodId,
                }),
              }
            );

            if (!res.ok) {
              console.error(
                "[UserProvider] syncPendingOps FOOD_DELETE failed, status:",
                res.status
              );
              stillPending.push(op);
            }
          } catch (err) {
            console.error(
              "[UserProvider] syncPendingOps FOOD_DELETE network error:",
              err
            );
            stillPending.push(op);
          }
          continue;
        }

        // Unknown op types remain pending
        stillPending.push(op);
      }

      setPendingOps(stillPending);
      await AsyncStorage.setItem("pendingOps", JSON.stringify(stillPending));
    },
    [pendingOps]
  );

  const enrollInProgram = useCallback(
    async ({ userId, program, authToken, baseUrl }) => {
      if (!program) return false;

      try {
        // 1) Hit backend if info is provided; otherwise just do local cache
        if (userId && authToken && baseUrl) {
          try {
            const res = await fetch(`${baseUrl}/users/${userId}/program/choose`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ programId: program.id }),
            });

            if (!res.ok) {
              console.error(
                "[UserProvider] enrollInProgram failed, status:",
                res.status
              );
              // We still continue to cache locally so the app can behave offline-first,
              // but caller can choose to surface an error if needed.
            }
          } catch (networkErr) {
            console.error(
              "[UserProvider] enrollInProgram network error:",
              networkErr
            );
            // Network might be offline; fall back to local cache only.
          }
        }

        // 2) Cache locally
        setCurrentProgram(program);
        setProgramsCache((prev) => {
          const next = { ...prev, [program.id]: program };
          AsyncStorage.setItem("programsCache", JSON.stringify(next));
          AsyncStorage.setItem("currentProgramId", program.id);
          return next;
        });

        return true;
      } catch (e) {
        console.error("[UserProvider] enrollInProgram error:", e);
        return false;
      }
    },
    []
  );

  const value = {
    user,
    setUser,

    currentProgram,
    setCurrentProgram,
    programsCache,
    setProgramsCache,

    progress,
    setProgress,
    pendingOps,
    setPendingOps,

    foodsByDate,
    setFoodsByDate,

    enrollInProgram,
    markWorkoutCompleteLocal,
    completeWorkout,
    syncPendingOps,
    addFoodEntry,
    removeFoodEntry,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);