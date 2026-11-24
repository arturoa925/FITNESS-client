import { useEffect, useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import tw from "twrnc";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolveApiBase } from "../../utils/api";
import { persistSession } from "../../lib/auth";
import { enrollBiometric, isBiometricEnrolled } from "../../lib/biometric";
import { useUser } from "../../components/UserContext";

const RESEND_SECONDS = 30;

// Two steps: 1) enter email -> we email a 6-digit code  2) enter code + new password.
export default function ForgotPassword({ navigation, route }) {
  const { setUser } = useUser();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(route?.params?.email || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const normalizedEmail = email.trim().toLowerCase();

  const sendCode = async () => {
    if (busy) return;
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter the email you signed up with.");
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(`${resolveApiBase()}/auth/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (res.status === 429) {
        setError("Too many requests. Please try again later.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setInfo("If that email has an account, we've sent a 6-digit code. It expires in 15 minutes.");
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (busy) return;
    setError("");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    try {
      setBusy(true);
      const res = await fetch(`${resolveApiBase()}/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Too many attempts. Please try again later."
            : data?.message || "That code is invalid or has expired."
        );
        return;
      }
      // Signed in with the fresh session the server returned.
      const normalized = await persistSession({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      setUser(normalized);
      // The reset signed out every Face ID device; if this phone used it, set it up again.
      try {
        if (await isBiometricEnrolled()) await enrollBiometric(data.token);
      } catch {}
      Alert.alert("Password updated", "You're signed in with your new password.", [
        { text: "OK", onPress: () => navigation.replace("Home") },
      ]);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const input = tw`bg-white rounded-xl px-4 py-3 mb-4`;
  const light = { color: "white", fontFamily: "Manrope" };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: "#A4A4A4" }]}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={tw`px-6 py-8`}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[tw`text-center text-2xl mb-2`, light]} accessibilityRole="header">
            Reset your password
          </Text>
          <Text style={[tw`text-center mb-6`, light, { fontSize: 16 }]}>
            {step === "email"
              ? "Enter your email and we'll send you a 6-digit code."
              : info}
          </Text>

          {step === "email" ? (
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(""); }}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={sendCode}
              placeholderTextColor="#9CA3AF"
              style={input}
              accessibilityLabel="Email address"
            />
          ) : (
            <>
              <TextInput
                placeholder="6-digit code"
                value={code}
                onChangeText={(v) => { setCode(v.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                placeholderTextColor="#9CA3AF"
                style={input}
                accessibilityLabel="6-digit code from your email"
              />
              <TextInput
                placeholder="New password (8+ characters)"
                value={password}
                onChangeText={(v) => { setPassword(v); setError(""); }}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                placeholderTextColor="#9CA3AF"
                style={input}
                accessibilityLabel="New password"
              />
              <TextInput
                placeholder="Confirm new password"
                value={confirm}
                onChangeText={(v) => { setConfirm(v); setError(""); }}
                secureTextEntry
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={resetPassword}
                placeholderTextColor="#9CA3AF"
                style={input}
                accessibilityLabel="Confirm new password"
              />
            </>
          )}

          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[tw`mb-3`, { color: "#FCA5A5", fontFamily: "Manrope", fontSize: 15 }]}
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={step === "email" ? sendCode : resetPassword}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={step === "email" ? "Send code" : "Reset password"}
            style={({ pressed }) => [
              tw`rounded-xl py-3`,
              { backgroundColor: busy ? "#9BB9CF" : pressed ? "#5a9cc6" : "#8CBFDF" },
            ]}
          >
            <Text style={[tw`text-center font-semibold text-xl`, light]}>
              {busy ? "Please wait…" : step === "email" ? "Send code" : "Reset password"}
            </Text>
          </Pressable>

          {step === "code" ? (
            <TouchableOpacity
              onPress={sendCode}
              disabled={busy || cooldown > 0}
              style={tw`mt-4 py-2`}
              accessibilityRole="button"
              accessibilityLabel="Send a new code"
            >
              <Text
                style={[
                  light,
                  { textAlign: "center", textDecorationLine: "underline", opacity: cooldown > 0 ? 0.6 : 1 },
                ]}
              >
                {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={tw`mt-4 py-2`}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
          >
            <Text style={[light, { textAlign: "center", textDecorationLine: "underline" }]}>
              Back to sign in
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
