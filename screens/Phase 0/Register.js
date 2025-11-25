// client/screens/Register.js
import { useEffect, useState, useRef } from "react";
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
  Linking,
} from "react-native";
import { PanResponder } from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { resolveApiBase } from "../../utils/api";
import { useNavigation } from "@react-navigation/native";

export default function Register() {
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

  const navigation = useNavigation();

  // * name fields states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState(null);
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // * biometrics (Face ID / Touch ID)
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Face ID");
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const pickerBusyRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const supportsFace = types?.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const supportsFingerprint = types?.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
        setBiometricSupported(!!(hasHardware && isEnrolled && types && types.length > 0));
        setBiometricLabel(
          supportsFace ? "Face ID" : supportsFingerprint ? "Touch ID" : "Biometrics"
        );
        // restore saved preference (support both legacy and new keys)
        const savedUnderscore = await SecureStore.getItemAsync("use_biometrics");
        const savedCamel = await SecureStore.getItemAsync("useBiometrics");
        const saved = savedUnderscore ?? savedCamel;
        setUseBiometrics(saved === "true");
        if (!savedUnderscore && savedCamel) {
          await SecureStore.setItemAsync("use_biometrics", savedCamel);
        }
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
      await SecureStore.setItemAsync("use_biometrics", next ? "true" : "false");
      if (next && email) {
        await SecureStore.setItemAsync("biometricEmail", email.trim().toLowerCase());
      }
    } catch (err) {
      Alert.alert("Error", "There was a problem updating your biometric preference.");
    } finally {
      setAuthBusy(false);
    }
  };



  const handleCreateAccount = async () => {
    if (submitBusy) return;

    // normalize and validate inputs
    const normalizedFirst = firstName.trim();
    const normalizedLast = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    let hasError = false;

    if (!normalizedFirst) {
      setFirstNameError("First name is required.");
      hasError = true;
    }

    if (!normalizedLast) {
      setLastNameError("Last name is required.");
      hasError = true;
    }

    if (!normalizedEmail) {
      setEmailError("Email is required.");
      hasError = true;
    }

    if (!password) {
      setPasswordError("Password is required.");
      hasError = true;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setSubmitBusy(true);

      const baseURL = resolveApiBase();
      const url = `${baseURL}/users/register`;

      // Build multipart form data to support optional avatar upload
      const form = new FormData();
      form.append("firstName", normalizedFirst);
      form.append("lastName", normalizedLast);
      form.append("email", normalizedEmail);
      form.append("password", password);

      if (photo) {
        // best-effort mime type detection from extension
        const nameFromUri = photo.split("/").pop() || `avatar-${Date.now()}.jpg`;
        const ext = (nameFromUri.split(".").pop() || "jpg").toLowerCase();
        const mimeByExt = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
          heic: "image/heic",
          heif: "image/heif",
        };
        const mime = mimeByExt[ext] || "image/jpeg";
        form.append("avatar", { uri: photo, name: nameFromUri, type: mime });
      }

      const res = await fetch(url, {
        method: "POST",
        // Do NOT set Content-Type for multipart; let fetch/XHR set the boundary
        headers: { Accept: "application/json" },
        body: form,
      });

      if (!res.ok) {
        let message = "Sign up failed.";
        try {
          const err = await res.json();
          message = err?.message || message;
        } catch (_) {
          try { message = await res.text(); } catch (_) {}
        }
        Alert.alert("Error", message);
        return;
      }

      let data = {};
      try { data = await res.json(); } catch (_) {}
      console.log("[Register] /users/register response:", data);

      // If backend returns a token, persist it so the user is signed in
      const token = data.token || data.accessToken || data.jwt;
      if (token) {
        await SecureStore.setItemAsync("authToken", token);
      }

      // Persist Face ID preference & email if user opted in
      try {
        if (useBiometrics) {
          await SecureStore.setItemAsync("use_biometrics", "true");
          await SecureStore.setItemAsync("biometricEmail", normalizedEmail);
        }
      } catch {}

      const goNext = () => {
        if (token) {
          if (navigation?.replace) {
            navigation.replace("Home");
          } else if (navigation?.reset) {
            navigation.reset({ index: 0, routes: [{ name: "Home" }] });
          } else if (navigation?.navigate) {
            navigation.navigate("Home");
          }
        } else {
          if (navigation?.replace) {
            navigation.replace("Welcome");
          } else if (navigation?.reset) {
            navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
          } else if (navigation?.navigate) {
            navigation.navigate("Welcome");
          }
        }
      };

      // Show an alert and navigate on confirmation to avoid race conditions with the native Alert
      Alert.alert(
        "Welcome!",
        "Your account has been created.",
        [
          { text: "OK", onPress: goNext },
        ],
        { cancelable: true }
      );
    } catch (e) {
      console.log("/users/register error:", e);
      Alert.alert("Network error", "Could not reach the server on port 3004.");
    } finally {
      setSubmitBusy(false);
    }
  };

  // Photo picker helper
  const pickImage = async () => {
    if (pickerBusyRef.current) return;
    pickerBusyRef.current = true;
    try {
      // Check current permission first
      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      let status = current.status;

      if (status !== "granted" && status !== "limited") {
        const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = requested.status;
        // Give iOS a breath so the next modal (picker) doesn't instantly auto-cancel
        if (Platform.OS === "ios" && (status === "granted" || status === "limited")) {
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      if (status !== "granted" && status !== "limited") {
        Alert.alert(
          "Permission needed",
          "Please allow photo library access to upload a profile photo.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings?.() },
          ]
        );
        return;
      }

      // Use the new API when available; otherwise, omit mediaTypes to use the default (Images)
      const hasNewEnum = !!ImagePicker.MediaType && !!ImagePicker.MediaType.Images;
      const options = {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        selectionLimit: 1,
      };
      if (hasNewEnum) {
        options.mediaTypes = [ImagePicker.MediaType.Images];
      }

      const result = await ImagePicker.launchImageLibraryAsync(options);

      console.log("[Register] ImagePicker result:", result);

      if (!result.canceled && result.assets?.length) {
        setPhoto(result.assets[0].uri);
      }
    } catch (e) {
      console.log("[Register] ImagePicker error:", e);
      Alert.alert("Error", e?.message || "Could not open photo library.");
    } finally {
      pickerBusyRef.current = false;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      // Try to capture on touch start if a horizontal intent is detected quickly
      onStartShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 10 && Math.abs(dy) < 10,
      onStartShouldSetPanResponderCapture: (_, { dx, dy }) => Math.abs(dx) > 10 && Math.abs(dy) < 10,
      // Fallback: capture once the finger has moved horizontally enough
      onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 14 && Math.abs(dy) < 12,
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => Math.abs(dx) > 14 && Math.abs(dy) < 12,

      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_, { dx }) => {
        // Log to Metro for debugging if needed
        // console.log('Swipe dx:', dx);
        if (dx < -50) {
          navigation.navigate("Welcome");
        }
      },
    })
  ).current;

  return (
    <LinearGradient
      colors={["#E0F2FE", "#F3F4F6"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={tw`flex-1`}
    >
      <SafeAreaView style={tw`flex-1`}>
        <KeyboardAvoidingView
          style={tw`flex-1`}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
          contentContainerStyle={[
            tw`flex-grow items-center`,
            { paddingVertical: 28, paddingHorizontal: 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          {...panResponder.panHandlers}
        >
          <View
            style={[
              {
                width: maxWidth,
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                paddingVertical: isShort ? 20 : 28,
                paddingHorizontal: isShort ? 18 : 24,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                shadowColor: "#000",
                shadowOpacity: 0.04,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1,
              },
            ]}
          >
          {/* header */}
          <View style={tw`items-center mb-4`}>
            <Text
              style={[
                tw`text-center`,
                { color: "#0F172A", fontFamily: "Joan", fontSize: h1Size },
              ]}
            >
              Create your Fitness profile
            </Text>
            <Text
              style={[
                tw`mt-1 text-center`,
                { color: "#6B7280", fontSize: bodySize },
              ]}
            >
              We’ll use this to personalize your training experience.
            </Text>
          </View>
          {/* first and last name input fields */}
          <View style={{ width: "100%", marginTop: 12 }}>
            <Text
              style={[
                tw`mb-1`,
                { color: "#6B7280", fontSize: bodySize - 1 },
              ]}
            >
              Basic info
            </Text>
            <View
              style={[
                tw`w-full`,
                { flexDirection: isNarrow ? "column" : "row" },
              ]}
            >
              <TextInput
                placeholder="First name"
                value={firstName}
                onChangeText={(val) => {
                  setFirstName(val);
                  if (firstNameError) setFirstNameError("");
                }}
                autoCapitalize="words"
                keyboardType="default"
                style={[
                  tw`bg-white rounded-xl px-4 py-3`,
                  {
                    flex: 1,
                    marginRight: isNarrow ? 0 : 8,
                    marginBottom: isNarrow ? 12 : 0,
                  },
                ]}
                placeholderTextColor="#9CA3AF"
                textContentType="givenName"
                autoComplete="given-name"
                returnKeyType="next"
                accessibilityLabel="First name"
                accessibilityHint="Enter your first name."
                accessibilityState={{ invalid: !!firstNameError }}
              />
              <TextInput
                placeholder="Last name"
                value={lastName}
                onChangeText={(val) => {
                  setLastName(val);
                  if (lastNameError) setLastNameError("");
                }}
                autoCapitalize="words"
                style={[tw`bg-white rounded-xl px-4 py-3`, { flex: 1 }]}
                placeholderTextColor="#9CA3AF"
                textContentType="familyName"
                autoComplete="family-name"
                returnKeyType="done"
                accessibilityLabel="Last name"
                accessibilityHint="Enter your last name."
                accessibilityState={{ invalid: !!lastNameError }}
              />
            </View>
            {firstNameError || lastNameError ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  tw`mt-2`,
                  {
                    color: "#F87171",
                    fontSize: 14,
                  },
                ]}
              >
                {firstNameError || lastNameError}
              </Text>
            ) : null}
          </View>
          {/* email and password input fields */}
          <View style={{ width: "100%", marginTop: 20 }}>
            <View
              style={{
                width: "100%",
                alignSelf: "center",
                paddingVertical: isShort ? 14 : 20,
              }}
            >
              <Text
                style={[
                  tw`mb-1`,
                  { color: "#6B7280", fontSize: bodySize - 1 },
                ]}
              >
                Account details
              </Text>
              <View style={tw`items-center mb-2`}>
                <Svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={profileIconSize * 0.8}
                  height={profileIconSize * 0.8}
                  fill="currentColor"
                  class="bi bi-envelope-at"
                  viewBox="0 0 16 16"
                >
                  <Path d="M2 2a2 2 0 0 0-2 2v8.01A2 2 0 0 0 2 14h5.5a.5.5 0 0 0 0-1H2a1 1 0 0 1-.966-.741l5.64-3.471L8 9.583l7-4.2V8.5a.5.5 0 0 0 1 0V4a2 2 0 0 0-2-2zm3.708 6.208L1 11.105V5.383zM1 4.217V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v.217l-7 4.2z" />
                  <Path d="M14.247 14.269c1.01 0 1.587-.857 1.587-2.025v-.21C15.834 10.43 14.64 9 12.52 9h-.035C10.42 9 9 10.36 9 12.432v.214C9 14.82 10.438 16 12.358 16h.044c.594 0 1.018-.074 1.237-.175v-.73c-.245.11-.673.18-1.18.18h-.044c-1.334 0-2.571-.788-2.571-2.655v-.157c0-1.657 1.058-2.724 2.64-2.724h.04c1.535 0 2.484 1.05 2.484 2.326v.118c0 .975-.324 1.39-.639 1.39-.232 0-.41-.148-.41-.42v-2.19h-.906v.569h-.03c-.084-.298-.368-.63-.954-.63-.778 0-1.259.555-1.259 1.4v.528c0 .892.49 1.434 1.26 1.434.471 0 .896-.227 1.014-.643h.043c.118.42.617.648 1.12.648m-2.453-1.588v-.227c0-.546.227-.791.573-.791.297 0 .572.192.572.708v.367c0 .573-.253.744-.564.744-.354 0-.581-.215-.581-.8Z" />
                </Svg>
                <View style={{ width: maxWidth, alignSelf: "center" }}>
                  <View
                    style={[
                      tw`w-full mt-2`,
                      { flexDirection: isNarrow ? "column" : "row" },
                    ]}
                  >
                    <TextInput
                      placeholder="Your email"
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        if (emailError) setEmailError("");
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={[
                        tw`bg-white mt-4 rounded-xl px-4 py-3`,
                        {
                          flex: 1,
                          marginRight: isNarrow ? 0 : 8,
                          marginBottom: isNarrow ? 12 : 0,
                        },
                      ]}
                      placeholderTextColor="#9CA3AF"
                      textContentType="emailAddress"
                      autoComplete="email"
                      returnKeyType="next"
                      accessibilityLabel="Email address"
                      accessibilityHint="Enter the email you want to use for your Fitness account."
                      accessibilityState={{ invalid: !!emailError }}
                    />
                    {emailError ? (
                      <Text
                        accessibilityLiveRegion="polite"
                        style={[
                          tw`mt-1`,
                          {
                            color: "#F87171",
                            fontSize: 14,
                            marginLeft: 4,
                          },
                        ]}
                      >
                        {emailError}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={tw`items-center mb-2 mt-4`}>
                <Svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={profileIconSize * 0.8}
                  height={profileIconSize * 0.8}
                  fill="currentColor"
                  class="bi bi-shield-lock"
                  viewBox="0 0 16 16"
                >
                  <Path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56" />
                  <Path d="M9.5 6.5a1.5 1.5 0 0 1-1 1.415l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99a1.5 1.5 0 1 1 2-1.415" />
                </Svg>
                <View style={{ width: maxWidth, alignSelf: "center" }}>
                  <View
                    style={[
                      tw`w-full mt-2`,
                      { flexDirection: isNarrow ? "column" : "row" },
                    ]}
                  >
                    <TextInput
                      placeholder="Your password"
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        if (passwordError) setPasswordError("");
                      }}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="default"
                      style={[
                        tw`bg-white mt-4 rounded-xl px-4 py-3`,
                        {
                          flex: 1,
                          marginRight: isNarrow ? 0 : 8,
                          marginBottom: isNarrow ? 12 : 0,
                        },
                      ]}
                      placeholderTextColor="#9CA3AF"
                      textContentType="password"
                      autoComplete="password"
                      returnKeyType="done"
                      accessibilityLabel="Password"
                      accessibilityHint="Create a password with at least 8 characters."
                      accessibilityState={{ invalid: !!passwordError }}
                    />
                    {passwordError ? (
                      <Text
                        accessibilityLiveRegion="polite"
                        style={[
                          tw`mt-1`,
                          {
                            color: "#F87171",
                            fontSize: 14,
                            marginLeft: 4,
                          },
                        ]}
                      >
                        {passwordError}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* profile photo upload */}
          <View style={[tw`items-center mt-4 mb-6`]}>
            <TouchableOpacity
              style={[
                tw`rounded-full`,
                {
                  backgroundColor: "#E5E7EB",
                  width: profileIconSize,
                  height: profileIconSize,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel={photo ? "Change profile photo" : "Upload profile photo"}
              accessibilityHint="Opens your photo library so you can set a profile picture."
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={{
                    width: profileIconSize * 0.9,
                    height: profileIconSize * 0.9,
                    borderRadius: (profileIconSize * 0.9) / 2,
                    resizeMode: "cover",
                  }}
                />
              ) : (
                <Text
                  style={{ color: "#4B5563", fontSize: 13, textAlign: "center" }}
                >
                  Add a profile photo
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* face id section */}
          <TouchableOpacity
            onPress={toggleBiometrics}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityLabel={`Use ${biometricLabel} to login`}
            accessibilityHint={
              biometricSupported
                ? `Double tap to ${useBiometrics ? "disable" : "enable"} ${biometricLabel} for faster login.`
                : `${biometricLabel} is not available on this device.`
            }
            accessibilityState={{
              checked: useBiometrics,
              disabled: !biometricSupported,
            }}
            disabled={!biometricSupported || authBusy}
            style={[
              { width: "100%", alignSelf: "center" },
              tw`flex-row items-center justify-between mt-3 mb-6`,
            ]}
          >
            <Text style={tw`text-lg text-gray-900`}>
              Use {biometricLabel} to login
            </Text>
            {/* face id checkbox */}
            <View
              style={tw`w-6 h-6 rounded-md border bg-white items-center justify-center`}
            >
              {useBiometrics ? <Text style={tw`text-black`}>✓</Text> : null}
            </View>
          </TouchableOpacity>

          <Pressable
            style={({ pressed }) => [
              tw`rounded-xl py-3 mt-2`,
              {
                width: "100%",
                alignSelf: "center",
                backgroundColor: submitBusy
                  ? "#9BB9CF"
                  : pressed
                  ? "#5a9cc6"
                  : "#8CBFDF",
                opacity: submitBusy ? 0.9 : 1,
              },
            ]}
            onPress={handleCreateAccount}
            accessibilityRole="button"
            accessibilityLabel="Create your Fitness account"
            accessibilityHint="Submits your details to create a new account."
            disabled={submitBusy}
          >
            <Text
              style={[
                tw`text-white text-center font-semibold text-xl`,
                { fontFamily: "Manrope" },
              ]}
            >
              {submitBusy ? "Creating account…" : "Start Sweating"}
            </Text>
          </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </LinearGradient>
  );
}
