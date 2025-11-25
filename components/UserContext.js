import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Offline / program-related state
  const [currentProgram, setCurrentProgram] = useState(null);
  const [programsCache, setProgramsCache] = useState({});
  const [progress, setProgress] = useState({});
  const [pendingOps, setPendingOps] = useState([]);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    const hydrate = async () => {
      try {
        const [
          storedProgramId,
          storedProgramsCache,
          storedProgress,
          storedPending,
        ] = await Promise.all([
          AsyncStorage.getItem("currentProgramId"),
          AsyncStorage.getItem("programsCache"),
          AsyncStorage.getItem("progress"),
          AsyncStorage.getItem("pendingOps"),
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
      } catch (e) {
        console.error("[UserProvider] hydrate failed:", e);
      }
    };

    hydrate();
  }, []);

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

    enrollInProgram,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);