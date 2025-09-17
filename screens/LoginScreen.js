import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { api } from "../lib/api";
import { setToken } from "../lib/auth";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    try {
      // match this route to your backend (e.g., /auth/login)
      const { data } = await api.post("/auth/login", { email, password });
      await setToken(data?.token);
      navigation.replace("Home");
    } catch (e) {
      console.log(e?.response?.data || e.message);
      Alert.alert("Login failed", "Check your credentials and try again.");
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-3xl font-bold mb-8">Welcome back 👋</Text>
      <TextInput
        className="w-full border rounded-lg px-4 py-3 mb-3"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="w-full border rounded-lg px-4 py-3 mb-6"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity onPress={handleLogin} className="w-full bg-black rounded-lg py-3">
        <Text className="text-white text-center font-semibold">Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}