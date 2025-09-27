import { useEffect, useState } from "react";
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
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";


export default function OutsideAuth() {

// * responsive design
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));
  const profileIconSize = Math.max(50, Math.min(80, width * 0.28));

  // * name fields states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState(null); 

    // * biometrics (Face ID / Touch ID)
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Face ID");
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
      (async () => {
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          const supportsFace = types?.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
          const supportsFingerprint = types?.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
          setBiometricSupported(!!(hasHardware && isEnrolled && types && types.length > 0));
          setBiometricLabel(supportsFace ? "Face ID" : supportsFingerprint ? "Touch ID" : "Biometrics");
          // restore saved preference
          const saved = await SecureStore.getItemAsync("useBiometrics");
          setUseBiometrics(saved === "true");
        } catch (e) {
          setBiometricSupported(false);
        }
      })();
    }, []);

    const toggleBiometrics = async () => {
        if (!biometricSupported || authBusy) return;
        try {
          setAuthBusy(true);
          if (!useBiometrics) {
            // User is turning ON biometrics: authenticate once to opt-in
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: `Enable ${biometricLabel}`,
              cancelLabel: "Cancel",
              disableDeviceFallback: false,
            });
            if (!result.success) {
              Alert.alert("Authentication failed", `Could not enable ${biometricLabel}.`);
              return;
            }
          }
          const next = !useBiometrics;
          setUseBiometrics(next);
          await SecureStore.setItemAsync("useBiometrics", next ? "true" : "false");
          if (next && email) {
            await SecureStore.setItemAsync("biometricEmail", email);
          }
        } catch (err) {
          Alert.alert("Error", "There was a problem updating your biometric preference.");
        } finally {
          setAuthBusy(false);
        }
      };

       // * Call this after your account creation succeeds (e.g., in your submit handler)
        const persistBiometricAfterSignup = async (userEmail) => {
          try {
            if (useBiometrics) {
              await SecureStore.setItemAsync("useBiometrics", "true");
              if (userEmail) await SecureStore.setItemAsync("biometricEmail", userEmail);
            }
          } catch {}
        };

        // * create account handler
          const handleCreateAccount = async () => {
            // basic validation
            if (!firstName.trim() || !lastName.trim()) {
              Alert.alert("Missing info", "Please enter your first and last name.");
              return;
            }
            if (!email.trim()) {
              Alert.alert("Missing email", "Please enter your email address.");
              return;
            }
            if (!password || password.length < 6) {
              Alert.alert("Password too short", "Use at least 6 characters.");
              return;
            }
          
            try {
              // TODO: Replace this with your real API call
              // Example:
              // const res = await fetch(`${API_BASE}/auth/register`, {
              //   method: "POST",
              //   headers: { "Content-Type": "application/json" },
              //   body: JSON.stringify({ firstName, lastName, email, password, photo }),
              // });
              // if (!res.ok) throw new Error("Signup failed");
              // const data = await res.json();
          
              // Persist biometric preference alongside the newly created account
              await persistBiometricAfterSignup(email);
          
              Alert.alert("Welcome!", "Your account has been created.");
              // TODO: navigate to your app's home screen here if using a navigator
              // navigation.navigate("Home");
            } catch (e) {
              Alert.alert("Sign up failed", e?.message || "Please try again.");
            }
          };
        
          // Photo picker helper
          const pickImage = async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== "granted") {
                Alert.alert("Permission needed", "Please allow photo library access to upload a profile photo.");
                return;
              }
        
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9,
              });
        
              if (!result.canceled && result.assets?.length) {
                setPhoto(result.assets[0].uri);
              }
            } catch (e) {
              Alert.alert("Error", "Could not open photo library.");
            }
          };



          // ! begin to create screen UI
}