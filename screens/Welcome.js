// client/screens/Welcome.js
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
  ScrollView
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Welcome({ navigation }) {

// * register route
  const handleRegisterPress = () => {
    navigation.navigate("Register");
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Biometrics state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Biometrics");
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 360;
  const isShort = height < 700;
  const maxWidth = Math.min(width - 32, 480);
  const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
  const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
  const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
  const iconSize = Math.max(18, Math.min(24, width * 0.06));

  // * face id setup
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
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        const hasFace = types?.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
        );

        console.log("Biometric debug:", {
          hasHardware,
          isEnrolled,
          types,
          hasFace,
        });

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

  // * toggle handler for face id
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

  // *login handler
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
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={tw`flex-grow`} keyboardShouldPersistTaps="handled">
          {/* outer centered container with max width */}
          <View style={[tw`flex-1 items-center`, { paddingHorizontal: 16 }]}>
            <View style={{ width: maxWidth, alignSelf: "center", paddingVertical: isShort ? 16 : 24 }}>
              {/* Title */}
              <Text
                style={[
                  tw`mb-6 text-center`,
                  { color: "#87DAF0", fontFamily: "Joan", fontSize: h1Size },
                ]}
              >
                Welcome to Fitness
              </Text>

              {/* Subheads */}
              <Text
                style={[
                  tw`my-4 text-center`,
                  { color: "white", fontFamily: "Manrope", fontSize: h2Size },
                ]}
              >
                Let's Get Moving
              </Text>
              <Text
                style={[
                  tw`my-6 text-center`,
                  { color: "white", fontFamily: "Manrope", fontSize: bodySize + 2, lineHeight: (bodySize + 2) * 1.4 },
                ]}
              >
                Log in to access your workouts and track every rep, set, and sweat!
              </Text>

              {/* input fields */}
              <View style={tw`w-full mt-6`}>
                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={tw`bg-white rounded-xl px-4 py-3 mb-4`}
                  placeholderTextColor="#9CA3AF"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="next"
                />
                <TextInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={tw`bg-white rounded-xl px-4 py-3 mb-4`}
                  placeholderTextColor="#9CA3AF"
                  textContentType="password"
                  autoComplete="password"
                  returnKeyType="done"
                />
              </View>

              {/* face id section */}
              <TouchableOpacity
                onPress={toggleBiometrics}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: useBiometrics,
                  disabled: !biometricSupported,
                }}
                disabled={!biometricSupported || authBusy}
                style={tw`flex-row items-center justify-between mb-6 mt-2`}
              >
                <Text style={tw`text-base text-gray-900 text-lg`}>
                  Use {biometricLabel} to login
                </Text>
                {/* face id checkbox */}
                <View
                  style={tw`w-6 h-6 rounded-md border bg-white items-center justify-center`}
                >
                  {useBiometrics ? <Text style={tw`text-black`}>✓</Text> : null}
                </View>
              </TouchableOpacity>

              {/* primary login button */}
             <Pressable
                style={({ pressed }) => [
                  tw`rounded-xl py-3 mt-4`,
                  {
                    width: maxWidth,
                    alignSelf: "center",
                    backgroundColor: pressed ? "#5a9cc6" : "#8CBFDF",
                  },
                ]}
                onPress={handleLogin}
              >
                <Text
                  style={[
                    tw`text-white text-center font-semibold text-xl`,
                    { fontFamily: "Manrope" },
                  ]}
                >
                  Log In
                </Text>
              </Pressable>

              {/* registration */}
              <View style={tw`mt-4`}>
                <Pressable
                  style={({ pressed }) => [
                    tw`w-full rounded-xl py-3`,
                    { backgroundColor: pressed ? "#A4DFF2" : "#EDEDED" },
                  ]}
                  onPress={handleRegisterPress}
                >
                  <Text
                    style={[
                      tw`text-black text-center font-semibold text-xl`,
                      { fontFamily: "Manrope", textDecorationLine: "underline" },
                    ]}
                  >
                    Click here to Register
                  </Text>
                </Pressable>
              </View>

              {/* Social login section */}
              <View>
                <Text
                  style={[
                    tw`text-sm mt-10 text-xl text-center`,
                    { color: "black", fontFamily: "Manrope" },
                  ]}
                >
                  Login with:
                </Text>

                <View style={[tw`flex-row justify-center mt-4`, { flexWrap: "wrap", gap: 16 }]}>
                  <TouchableOpacity
                    style={tw`bg-white rounded-full w-12 h-12 items-center justify-center shadow`}
                    activeOpacity={0.8}
                    name="google"
                  >
                    <Svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="black">
                      <Path d="M15.545 6.558a9.4 9.4 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.7 7.7 0 0 1 5.352 2.082l-2.284 2.284A4.35 4.35 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.8 4.8 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.7 3.7 0 0 0 1.599-2.431H8v-3.08z" />
                    </Svg>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={tw`bg-white rounded-full w-12 h-12 items-center justify-center shadow`}
                    activeOpacity={0.8}
                    name="github"
                  >
                    <Svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="black">
                      <Path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
                    </Svg>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={tw`bg-white rounded-full w-12 h-12 items-center justify-center shadow`}
                    activeOpacity={0.8}
                    name="apple"
                  >
                    <Svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="black">
                      <Path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282" />
                      <Path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282" />
                    </Svg>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={tw`bg-white rounded-full w-12 h-12 items-center justify-center shadow`}
                    activeOpacity={0.8}
                    name="linkedin"
                  >
                    <Svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="black">
                      <Path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z" />
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
