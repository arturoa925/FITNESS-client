// client/screens/Register.js
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

  // * name fields states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
          // * title with icon
          <View style={[tw` items-center `, { paddingHorizontal: 16 }]}>
            <View
              style={{
                width: maxWidth,
                alignSelf: "center",
                paddingVertical: isShort ? 16 : 24,
              }}
            >
              {/* Title */}
              <Text
                style={[
                  tw`mb-6 text-center`,
                  { color: "#87DAF0", fontFamily: "Joan", fontSize: h1Size },
                ]}
              >
                Create a Profile
              </Text>

              <View style={tw`items-center mb-2`}>
                <Svg
                  width={profileIconSize * 0.8}
                  height={profileIconSize * 0.8}
                  viewBox="0 0 16 16"
                  fill="#000000ff"
                >
                  <Path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
                </Svg>
              </View>
            </View>
          </View>
          // * first and last name input fields
          <View style={{ width: maxWidth, alignSelf: "center" }}>
            <View
              style={[
                tw`w-full mt-2`,
                { flexDirection: isNarrow ? "column" : "row" },
              ]}
            >
              <TextInput
                placeholder="First name"
                value={firstName}
                onChangeText={setFirstName}
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
          // * email and password input fields
          <View style={[tw` items-center `, { paddingHorizontal: 16 }]}>
            <View
              style={{
                width: maxWidth,
                alignSelf: "center",
                paddingVertical: isShort ? 16 : 24,
              }}
            >
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
                      onChangeText={setEmail}
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
                    />
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
                      onChangeText={setPassword}
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
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          // * profile photo upload placeholder circle
          <View style={[tw`items-center mt-6`]}>
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
              onPress={() => {
                // TODO: implement photo picker
                Alert.alert("Upload Photo", "Open photo library here");
              }}
            >
              <Text style={{ color: "#000", fontSize: 14, textAlign: "center" }}>
                Upload Photo
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
