import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import tw from "twrnc";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolveApiBase } from "../../utils/api";
import { useUser } from "../../components/UserContext";

const RESEND_SECONDS = 30;

// Confirms the account's email with the 6-digit code that was emailed at sign-up.
export default function VerifyEmail({ navigation }) {
  const { user, setUser } = useUser();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentMsg, setSentMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const authedFetch = async (path, body) => {
    const token = await SecureStore.getItemAsync("authToken");
    return fetch(`${resolveApiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    });
  };

  const resend = async () => {
    if (busy || cooldown > 0) return;
    setError("");
    try {
      setBusy(true);
      const res = await authedFetch("/auth/verify/send");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.alreadyVerified) {
        markVerified();
        return;
      }
      if (!res.ok) {
        setError(res.status === 429 ? "Please wait a while before requesting another code." : "Couldn't send the code. Try again.");
        return;
      }
      setSentMsg("New code sent. Check your inbox.");
      setCooldown(RESEND_SECONDS);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const markVerified = async () => {
    const next = { ...(user || {}), isVerified: true, raw: { ...(user?.raw || {}), isVerified: true } };
    setUser(next);
    try {
      await SecureStore.setItemAsync("cachedUserProfile", JSON.stringify(next));
    } catch {}
    Alert.alert("Email verified", "Thanks! Your email address is confirmed.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  };

  const confirm = async () => {
    if (busy) return;
    setError("");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the email.");
    try {
      setBusy(true);
      const res = await authedFetch("/auth/verify/confirm", { code });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 429 ? "Too many attempts. Try again later." : data?.message || "Invalid or expired code.");
        return;
      }
      await markVerified();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const light = { color: "white", fontFamily: "Manrope" };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}>
      <KeyboardAvoidingView
        style={tw`flex-1 px-6 py-8`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={[tw`text-center text-2xl mb-2`, light]} accessibilityRole="header">
          Verify your email
        </Text>
        <Text style={[tw`text-center mb-6`, light, { fontSize: 16 }]}>
          Enter the 6-digit code we emailed to {user?.email || "your address"}.
        </Text>

        <TextInput
          placeholder="6-digit code"
          value={code}
          onChangeText={(v) => { setCode(v.replace(/\D/g, "").slice(0, 6)); setError(""); }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={confirm}
          placeholderTextColor="#9CA3AF"
          style={tw`bg-white rounded-xl px-4 py-3 mb-4`}
          accessibilityLabel="6-digit verification code"
        />

        {error ? (
          <Text accessibilityLiveRegion="polite" style={[tw`mb-3`, { color: "#FCA5A5", fontFamily: "Manrope", fontSize: 15 }]}>
            {error}
          </Text>
        ) : sentMsg ? (
          <Text accessibilityLiveRegion="polite" style={[tw`mb-3`, light, { fontSize: 15 }]}>{sentMsg}</Text>
        ) : null}

        <Pressable
          onPress={confirm}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Verify email"
          style={({ pressed }) => [
            tw`rounded-xl py-3`,
            { backgroundColor: busy ? "#9BB9CF" : pressed ? "#5a9cc6" : "#8CBFDF" },
          ]}
        >
          <Text style={[tw`text-center font-semibold text-xl`, light]}>
            {busy ? "Please wait…" : "Verify"}
          </Text>
        </Pressable>

        <TouchableOpacity
          onPress={resend}
          disabled={busy || cooldown > 0}
          style={tw`mt-4 py-2`}
          accessibilityRole="button"
          accessibilityLabel="Send a new code"
        >
          <Text style={[light, { textAlign: "center", textDecorationLine: "underline", opacity: cooldown > 0 ? 0.6 : 1 }]}>
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send me a code"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={tw`mt-2 py-2`} accessibilityRole="button" accessibilityLabel="Do this later">
          <Text style={[light, { textAlign: "center", textDecorationLine: "underline" }]}>Do this later</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
