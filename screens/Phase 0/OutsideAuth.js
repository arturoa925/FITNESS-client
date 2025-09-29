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
  Image,
} from "react-native";
import tw from "twrnc";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OutsideAuth({ route, navigation }) {
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

  // * oauth params
  const params = route?.params ?? {};
  const isOAuth = !!params.isOAuth;
  const provider = params.provider || null;

  // Prefill from OAuth (name/email/photo) if provided
  useEffect(() => {
    try {
      if (params?.email) setEmail(params.email);
      if (params?.name) {
        const parts = String(params.name).trim().split(/\s+/);
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }
      if (params?.photo) setPhoto(params.photo);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

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
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        const supportsFace = types?.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
        );
        const supportsFingerprint = types?.includes(
          LocalAuthentication.AuthenticationType.FINGERPRINT
        );
        setBiometricSupported(
          !!(hasHardware && isEnrolled && types && types.length > 0)
        );
        setBiometricLabel(
          supportsFace
            ? "Face ID"
            : supportsFingerprint
            ? "Touch ID"
            : "Biometrics"
        );
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
          Alert.alert(
            "Authentication failed",
            `Could not enable ${biometricLabel}.`
          );
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
      Alert.alert(
        "Error",
        "There was a problem updating your biometric preference."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  // * Call this after your account creation succeeds (e.g., in your submit handler)
  const persistBiometricAfterSignup = async (userEmail) => {
    try {
      if (useBiometrics) {
        await SecureStore.setItemAsync("useBiometrics", "true");
        if (userEmail)
          await SecureStore.setItemAsync("biometricEmail", userEmail);
      }
    } catch {}
  };

  // * create account handler after Oauth
  const handleCreateAccount = async () => {
    // basic validation
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing info", "Please enter your first and last name.");
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
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow photo library access to upload a profile photo."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
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

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[tw`flex-grow`, { paddingVertical: 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={[tw` items-center `, { paddingHorizontal: 16 }]}>
            <View
              style={{
                width: maxWidth,
                alignSelf: "center",
                paddingVertical: isShort ? 16 : 24,
              }}
            >
              <Text
                style={[
                  tw`mb-4 text-center`,
                  { color: "#87DAF0", fontFamily: "Joan", fontSize: h1Size },
                ]}
              >
                Complete Your Profile
              </Text>
            </View>
          </View>
          {/* first and last name fields */}
          <View style={{ width: maxWidth, alignSelf: "center" }}>
            <View
              style={[tw`w-full flex-col gap-10`, { flexDirection: "column" }]}
            >
              <TextInput
                placeholder="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                keyboardType="default"
                style={[
                  tw`bg-white rounded-xl px-4 py-3 `,
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
              />
              <TextInput
                placeholder="Last name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                style={[tw`bg-white rounded-xl px-4 py-3`, { flex: 1 }]}
                placeholderTextColor="#9CA3AF"
                textContentType="familyName"
                autoComplete="family-name"
                returnKeyType="done"
              />
            </View>
          </View>
          {/* profile photo */}
          <View style={[tw`items-center mt-10`]}>
            <TouchableOpacity
              style={[
                tw`rounded-full`,
                {
                  backgroundColor: "#D9D9D9",
                  width: profileIconSize,
                  height: profileIconSize,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
              onPress={pickImage}
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
                  style={{ color: "#000", fontSize: 14, textAlign: "center" }}
                >
                  Upload Photo
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {/* face id */}
          <TouchableOpacity
            onPress={toggleBiometrics}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: useBiometrics,
              disabled: !biometricSupported,
            }}
            disabled={!biometricSupported || authBusy}
            style={[
              {
                width: maxWidth,
                alignSelf: "center",
                paddingHorizontal: isShort ? 16 : 24,
              },
              tw`flex-row items-center justify-between mt-8 mb-6`,
            ]}
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
          {/* finish creating account */}
          <Pressable
            style={({ pressed }) => [
              tw`rounded-xl py-3 mt-3 `,
              {
                width: maxWidth,
                alignSelf: "center",
                backgroundColor: pressed ? "#5a9cc6" : "#8CBFDF",
              },
            ]}
            onPress={handleCreateAccount}
            accessibilityRole="button"
            accessibilityLabel={isOAuth ? "Finish Setup" : "Create Account"}
          >
            <Text
              style={[
                tw`text-black text-center font-semibold text-xl`,
                { fontFamily: "Manrope" },
              ]}
            >
              {isOAuth ? "Finish Setup" : "Create Account"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
