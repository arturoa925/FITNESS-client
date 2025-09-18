

// client/screens/Welcome.js
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

export default function Welcome({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Biometrics state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Biometrics");
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync("use_biometrics");
      if (saved === "true") setUseBiometrics(true);
    })();
  }, []);

  // Check device biometric capabilities
  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const hasFace = types?.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
        );

        console.log("Biometric debug:", { hasHardware, isEnrolled, types, hasFace });

        setBiometricSupported(hasHardware && isEnrolled);
        setBiometricLabel(
          Platform.OS === "ios" && hasFace ? "Face ID" : "Biometrics"
        );
      } catch (e) {
        console.log("Biometric check failed", e);
        setBiometricSupported(false);
      }
    })();
  }, []);

  // toggle handler for face id
  const toggleBiometrics = async () => {
    if (authBusy) return;
    if (!useBiometrics) {
      if (!biometricSupported) return;
      try {
        setAuthBusy(true);
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Enable ${biometricLabel}`,
          cancelLabel: "Cancel",
          disableDeviceFallback: true,
        });
        if (result.success) {
          setUseBiometrics(true);
          await SecureStore.setItemAsync("use_biometrics", "true");
        }
        // do nothing on cancel/failure
      } finally {
        setAuthBusy(false);
      }
    } else {
      setUseBiometrics(false);
      await SecureStore.setItemAsync("use_biometrics", "false");
    }
  };

  // login handler
  const handleLogin = async () => {
    if (authBusy) return;
    try {
      if (useBiometrics) {
        setAuthBusy(true);
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: `Authenticate with ${biometricLabel}`,
          cancelLabel: "Cancel",
          disableDeviceFallback: true,
        });
        if (!res.success) return; // user canceled or failed
      }

      // TODO: call your backend here with email/password
      // const { data } = await api.post('/auth/login', { email, password })
      // save token, navigate, etc.
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <View
      style={[tw`flex-1 justify-center px-6`, { backgroundColor: "#A4A4A4" }]}
    >
      <Text
        style={[
          tw`text-3xl mb-8 text-center`,
          { color: "#87DAF0", fontFamily: "Joan" },
        ]}
      >
        Welcome to Fitness
      </Text>

      <Text
        style={[
          tw`text-xl mb-8 text-center`,
          { color: "white", fontFamily: "Manrope" },
        ]}
      >
        Let's Get Moving
      </Text>

      <Text
        style={[
          tw`text-xl mb-8 text-center`,
          { color: "white", fontFamily: "Manrope" },
        ]}
      >
        Log in to access your workouts and track every rep, set, and sweat!
      </Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={tw`bg-white rounded-xl px-4 py-3 mb-4`}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={tw`bg-white rounded-xl px-4 py-3 mb-4`}
      />

      {/* Checkbox row – above the login button */}
      <TouchableOpacity
        onPress={toggleBiometrics}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: useBiometrics, disabled: !biometricSupported }}
        disabled={!biometricSupported}
        style={tw`flex-row items-center justify-between mb-6`}
      >
        <Text style={tw`text-base text-gray-900`}>
          Use {biometricLabel} to login
        </Text>

        {/* Simple checkbox UI */}
        <View
          style={tw`w-6 h-6 rounded-md border ${
            biometricSupported ? "border-gray-500" : "border-gray-300"
          } bg-white items-center justify-center`}
        >
          {useBiometrics ? (
            <Text style={tw`text-black`}>✓</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={tw`bg-black rounded-xl py-3`}
        onPress={handleLogin}
        activeOpacity={0.8}
      >
        <Text style={tw`text-white text-center font-semibold`}>Log In</Text>
      </TouchableOpacity>
    </View>
  );
}
