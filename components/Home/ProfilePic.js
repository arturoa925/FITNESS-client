import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable, Alert, Image } from "react-native";
import * as SecureStore from "expo-secure-store";

export default function ProfileAvatarMenu({ navigation, style, onLogout, profilePicture }) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [storedPhoto, setStoredPhoto] = useState(null);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (!profilePicture) {
          const v = await SecureStore.getItemAsync("profilePicture");
          if (isMounted && v) setStoredPhoto(v);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { isMounted = false; };
  }, [profilePicture]);

  // Reset error when we get a new URI to try
  useEffect(() => {
    const nextUri =
      (typeof profilePicture === "string" && profilePicture.trim()) ||
      (typeof storedPhoto === "string" && storedPhoto.trim()) ||
      (profilePicture && profilePicture.uri);
    if (nextUri) setImgError(false);
  }, [profilePicture, storedPhoto]);

  const handleAccountSettings = () => {
    setOpen(false);
    navigation.navigate("Profile"); // or "AccountSettings"
  };

const handleLogout = async () => {
  setOpen(false);
  try {
    if (typeof onLogout === "function") {
      // Delegate to parent (Home) so it can call backend /users/logout and navigate
      return onLogout();
    }
    // Fallback: clear locally and navigate
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("profilePicture");
    navigation?.replace?.("Welcome");
  } catch (e) {
    console.error("[ProfilePic] Logout error:", e);
  }
};

  const resolvedPhoto = (() => {
    if (imgError) return { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAp0B2x0d2oQAAAAASUVORK5CYII=" };
    if (typeof profilePicture === "string" && profilePicture.trim().length > 0) return { uri: profilePicture.trim() };
    if (typeof storedPhoto === "string" && storedPhoto.trim().length > 0) return { uri: storedPhoto.trim() };
    if (profilePicture?.uri || profilePicture?.width || profilePicture?.height) return profilePicture;
    return { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAp0B2x0d2oQAAAAASUVORK5CYII=" };
  })();

  return (
    <View style={style}>
      {/* Avatar */}
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Image
          source={resolvedPhoto}
          key={typeof resolvedPhoto === "object" && resolvedPhoto.uri ? resolvedPhoto.uri : "avatar-fallback"}
          onError={() => {
            // Only mark error for remote URIs, not local fallbacks like SVG
            if (typeof resolvedPhoto === "object" && resolvedPhoto.uri) {
              setImgError(true);
            }
          }}
          style={{ width: 45, height: 45, borderRadius: 30, backgroundColor: "#E6E6E6" }}
          resizeMode="cover"
        />
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