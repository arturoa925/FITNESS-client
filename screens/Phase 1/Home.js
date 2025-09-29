import React, { useEffect, useState, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";

export default function Home({ navigation }) {

      const { width, height, fontScale } = useWindowDimensions();
      const isNarrow = width < 360;
      const isShort = height < 700;
      const maxWidth = Math.min(width - 32, 480);
      const h1Size = isNarrow || isShort ? 26 / fontScale : 30 / fontScale;
      const h2Size = isNarrow || isShort ? 18 / fontScale : 20 / fontScale;
      const bodySize = isNarrow || isShort ? 15 / fontScale : 16 / fontScale;
      const iconSize = Math.max(18, Math.min(24, width * 0.06));


      return (
<SafeAreaView style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={tw`flex-grow`}
          keyboardShouldPersistTaps="handled"
        >
        
         <View style={[tw`flex-1 items-center`, { paddingHorizontal: 16 }]}>
            <View
              style={{
                width: maxWidth,
                alignSelf: "center",
                paddingVertical: isShort ? 16 : 24,
              }}
            >
              {/* Profile picture placeholder (top right) */}
              <View style={{ alignItems: "flex-end" }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Profile")}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "#ccc",
                    }}
                  />
                </TouchableOpacity>
              </View>

              {/* Title below, centered */}
              <Text
                style={[
                  tw`text-5xl`,
                  { color: "#87DAF0", fontFamily: "Joan", textAlign: "center", marginTop: 12 },
                ]}
              >
                Fitness
              </Text>
            </View>
          </View>


        </ScrollView>
        </KeyboardAvoidingView>
    </SafeAreaView>



      )
}