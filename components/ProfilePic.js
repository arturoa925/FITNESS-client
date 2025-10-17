
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";

export default function ProfileAvatarMenu({ navigation, style }) {
  const [open, setOpen] = useState(false);

  const handleAccountSettings = () => {
    setOpen(false);
    navigation.navigate("Profile"); // or "AccountSettings"
  };

  const handleLogout = async () => {
    setOpen(false);
    try {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("refreshToken");
    } catch {}
    Alert.alert("Logged out", "You have been logged out.");
    // navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  };

  return (
    <View style={style}>
      {/* Avatar */}
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <View
          style={{
            width: 45, height: 45, borderRadius: 30, backgroundColor: "#ccc",
            justifyContent: "center", alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 8, color: "#000", textAlign: "center" }}>Profile</Text>
        </View>
      </TouchableOpacity>

      {/* Menu */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} />
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 70, right: 72, alignItems: "flex-end" }} // tweak position as you like
        >
          <View
            style={{
              backgroundColor: "#fff", borderRadius: 12, paddingVertical: 4, minWidth: 160,
              shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
              elevation: 4, borderWidth: 1, borderColor: "#eee",
            }}
          >
            <TouchableOpacity onPress={handleAccountSettings} style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={{ fontFamily: "Joan", fontSize: 16, color: "#060000" }}>Account Settings</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: "#eee", marginHorizontal: 8 }} />
            <TouchableOpacity onPress={handleLogout} style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={{ fontFamily: "Joan", fontSize: 16, color: "#B00020" }}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}