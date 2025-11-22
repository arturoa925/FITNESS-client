import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";

export default function ProfileAvatarMenu({
  navigation,
  style,
  onLogout,
  profilePicture,
  user, // { firstName, lastName, email, password? }
}) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [storedPhoto, setStoredPhoto] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || "");
  const [editLastName, setEditLastName] = useState(user?.lastName || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [editPassword, setEditPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  // Pick and upload new avatar image
  const handlePickAvatar = async () => {
    if (!user || !user.id) {
      Alert.alert("Unable to update", "Missing user information.");
      return;
    }

    try {
      // Request permission
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "We need access to your photos to update your profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          (ImagePicker.MediaType && ImagePicker.MediaType.Images) ||
          ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) {
        Alert.alert("Unable to use photo", "No image was selected.");
        return;
      }

      const uri = asset.uri;
      const mimeType =
        asset.mimeType ||
        (uri.endsWith(".png")
          ? "image/png"
          : uri.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");

      const formData = new FormData();
      formData.append("avatar", {
        uri,
        name: "avatar.jpg",
        type: mimeType,
      });

      setAvatarUploading(true);

      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert(
          "Not signed in",
          "We couldn't find your session. Please log in again."
        );
        setAvatarUploading(false);
        return;
      }

      const url = `http://localhost:3004/users/${user.id}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          // NOTE: do not set Content-Type here; let fetch/form-data handle it
        },
        body: formData,
      });

      if (!res.ok) {
        console.error(
          "[ProfilePic] Failed to upload avatar, status:",
          res.status
        );
        Alert.alert(
          "Update failed",
          "We couldn't update your profile picture. Please try again."
        );
        setAvatarUploading(false);
        return;
      }

      const updatedUser = await res.json();

      // If backend returns the updated profilePicture URL, persist it
      if (updatedUser && updatedUser.profilePicture) {
        try {
          await SecureStore.setItemAsync(
            "profilePicture",
            updatedUser.profilePicture
          );
          setStoredPhoto(updatedUser.profilePicture);
        } catch (e) {
          // Non-fatal: UI will still use updated URL from props on next refresh
        }
      }

      // Clear any previous error and rely on resolvedPhoto recomputation
      setImgError(false);
    } catch (e) {
      console.error("[ProfilePic] Avatar update error:", e);
      Alert.alert(
        "Update failed",
        "Something went wrong while updating your picture. Please try again."
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    setEditFirstName(user?.firstName || "");
    setEditLastName(user?.lastName || "");
    setEditEmail(user?.email || "");
    setEditPassword("");
    setCurrentPassword("");
    setConfirmPassword("");
  }, [user]);
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
    setEditFirstName(user?.firstName || "");
    setEditLastName(user?.lastName || "");
    setEditEmail(user?.email || "");
    setEditPassword("");
    setCurrentPassword("");
    setConfirmPassword("");
    setAccountOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!user || !user.id) {
      Alert.alert("Unable to update", "Missing user information.");
      return;
    }

    const payload = {
      firstName: editFirstName,
      lastName: editLastName,
      email: editEmail,
    };

    try {
      setSavingAccount(true);

      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert(
          "Not signed in",
          "We couldn't find your session. Please log in again."
        );
        setSavingAccount(false);
        return;
      }

      const url = `http://localhost:3004/users/${user.id}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(
          "[ProfilePic] Failed to update user, status:",
          res.status
        );
        Alert.alert(
          "Update failed",
          "We couldn't save your changes. Please try again."
        );
        setSavingAccount(false);
        return;
      }

      await res.json();
      setAccountOpen(false);
    } catch (e) {
      console.error("[ProfilePic] Account update error:", e);
      Alert.alert(
        "Update failed",
        "Something went wrong while saving. Please try again."
      );
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSavePassword = async () => {
    if (!user || !user.id) {
      Alert.alert("Unable to update", "Missing user information.");
      return;
    }

    if (!currentPassword || currentPassword.trim().length === 0) {
      Alert.alert(
        "Current password required",
        "Please enter your current password to change it."
      );
      return;
    }

    if (!editPassword || editPassword.trim().length === 0) {
      Alert.alert(
        "New password required",
        "Please enter a new password."
      );
      return;
    }

    if (editPassword.length < 8) {
      Alert.alert(
        "Password too short",
        "Password must be at least 8 characters long."
      );
      return;
    }

    if (editPassword !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "New password and confirmation must match."
      );
      return;
    }

    const payload = {
      currentPassword: currentPassword,
      password: editPassword,
    };

    try {
      setSavingPassword(true);

      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert(
          "Not signed in",
          "We couldn't find your session. Please log in again."
        );
        setSavingPassword(false);
        return;
      }

      const url = `http://localhost:3004/users/${user.id}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(
          "[ProfilePic] Failed to update password, status:",
          res.status
        );
        Alert.alert(
          "Update failed",
          "We couldn't change your password. Please try again."
        );
        setSavingPassword(false);
        return;
      }

      await res.json();
      setPasswordOpen(false);
      setEditPassword("");
      setCurrentPassword("");
      setConfirmPassword("");
      Alert.alert("Password updated", "Your password has been changed.");
    } catch (e) {
      console.error("[ProfilePic] Password update error:", e);
      Alert.alert(
        "Update failed",
        "Something went wrong while changing your password. Please try again."
      );
    } finally {
      setSavingPassword(false);
    }
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
    const fallback = {
      uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAp0B2x0d2oQAAAAASUVORK5CYII=",
    };

    if (imgError) return fallback;

    // Prefer the most recently stored / updated photo first
    if (typeof storedPhoto === "string" && storedPhoto.trim().length > 0) {
      return { uri: storedPhoto.trim() };
    }

    // Then fall back to the profilePicture prop from parent / backend
    if (
      typeof profilePicture === "string" &&
      profilePicture.trim().length > 0
    ) {
      return { uri: profilePicture.trim() };
    }

    // Or an object-style source (e.g., { uri, width, height })
    if (
      profilePicture?.uri ||
      profilePicture?.width ||
      profilePicture?.height
    ) {
      return profilePicture;
    }

    // Final fallback
    return fallback;
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

      {/* Account Settings Modal */}
      <Modal
        visible={accountOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          onPress={() => setAccountOpen(false)}
        />
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: "20%",
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "85%",
              maxWidth: 360,
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              paddingVertical: 20,
              paddingHorizontal: 16,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            {/* Header */}
            <Text
              style={{
                fontFamily: "Joan",
                fontSize: 20,
                textAlign: "center",
                color: "#060000",
                marginBottom: 12,
              }}
            >
              Account Settings
            </Text>

            {/* Profile picture + name */}
            <View
              style={{
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <TouchableOpacity
                onPress={handlePickAvatar}
                disabled={avatarUploading}
                style={{ marginBottom: 4 }}
              >
                <Image
                  source={resolvedPhoto}
                  key={
                    typeof resolvedPhoto === "object" && resolvedPhoto.uri
                      ? `${resolvedPhoto.uri}-account`
                      : "avatar-fallback-account"
                  }
                  onError={() => {
                    if (
                      typeof resolvedPhoto === "object" &&
                      resolvedPhoto.uri
                    ) {
                      setImgError(true);
                    }
                  }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: "#E6E6E6",
                    opacity: avatarUploading ? 0.7 : 1,
                  }}
                  resizeMode="cover"
                />
                {avatarUploading && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 0,
                      right: 0,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator size="small" color="#000" />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePickAvatar}
                disabled={avatarUploading}
              >
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 12,
                    color: "#355D73",
                    textDecorationLine: "underline",
                    marginBottom: 4,
                  }}
                >
                  {avatarUploading ? "Updating photo..." : "Change photo"}
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: "Joan",
                  fontSize: 18,
                  color: "#060000",
                  marginTop: 4,
                }}
              >
                {(editFirstName || "") +
                  (editLastName ? ` ${editLastName}` : "") ||
                  "Your Name"}
              </Text>
            </View>

            {/* Editable details */}
            <View style={{ gap: 10 }}>
              <View>
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 14,
                    color: "#555",
                    marginBottom: 2,
                  }}
                >
                  Email
                </Text>
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontFamily: "Joan",
                    fontSize: 15,
                    color: "#060000",
                  }}
                  placeholder="Email"
                />
              </View>

              <View>
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 14,
                    color: "#555",
                    marginBottom: 2,
                  }}
                >
                  First name
                </Text>
                <TextInput
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  style={{
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontFamily: "Joan",
                    fontSize: 15,
                    color: "#060000",
                  }}
                  placeholder="First name"
                />
              </View>

              <View>
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 14,
                    color: "#555",
                    marginBottom: 2,
                  }}
                >
                  Last name
                </Text>
                <TextInput
                  value={editLastName}
                  onChangeText={setEditLastName}
                  style={{
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontFamily: "Joan",
                    fontSize: 15,
                    color: "#060000",
                  }}
                  placeholder="Last name"
                />
              </View>

              <View
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: "#eee",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 14,
                    color: "#555",
                  }}
                >
                  Password
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setAccountOpen(false);
                    setCurrentPassword("");
                    setEditPassword("");
                    setConfirmPassword("");
                    setPasswordOpen(true);
                  }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: "#E6B82C",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Joan",
                      fontSize: 14,
                      color: "#000",
                      fontWeight: "600",
                    }}
                  >
                    Change
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Actions */}
            <View
              style={{
                marginTop: 18,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  setAccountOpen(false);
                  setEditPassword("");
                  setCurrentPassword("");
                  setConfirmPassword("");
                }}
                disabled={savingAccount}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 999,
                  backgroundColor: "#A4A4A4",
                  opacity: savingAccount ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 16,
                    color: "#000",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveAccount}
                disabled={savingAccount}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 999,
                  backgroundColor: "#E6B82C",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  opacity: savingAccount ? 0.7 : 1,
                }}
              >
                {savingAccount && (
                  <ActivityIndicator size="small" color="#000" />
                )}
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 16,
                    color: "#000",
                    fontWeight: "600",
                  }}
                >
                  {savingAccount ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        visible={passwordOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          onPress={() => setPasswordOpen(false)}
        />
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: "20%",
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "85%",
              maxWidth: 360,
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              paddingVertical: 20,
              paddingHorizontal: 16,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <Text
              style={{
                fontFamily: "Joan",
                fontSize: 20,
                textAlign: "center",
                color: "#060000",
                marginBottom: 12,
              }}
            >
              Change Password
            </Text>

            <View style={{ gap: 10 }}>
              <View>
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 14,
                    color: "#555",
                    marginBottom: 2,
                  }}
                >
                  Current password
                </Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontFamily: "Joan",
                    fontSize: 15,
                    color: "#060000",
                  }}
                  placeholder="Enter your current password"
                />
              </View>

              <View>
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 14,
                    color: "#555",
                    marginBottom: 2,
                  }}
                >
                  New password
                </Text>
                <TextInput
                  value={editPassword}
                  onChangeText={setEditPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontFamily: "Joan",
                    fontSize: 15,
                    color: "#060000",
                  }}
                  placeholder="Enter a new password"
                />
                {editPassword.length > 0 && editPassword.length < 8 && (
                  <Text
                    style={{
                      fontFamily: "Joan",
                      fontSize: 12,
                      color: "#B00020",
                      marginTop: 4,
                    }}
                  >
                    Password must be at least 8 characters long.
                  </Text>
                )}
              </View>

              <View>
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 14,
                    color: "#555",
                    marginBottom: 2,
                  }}
                >
                  Confirm new password
                </Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontFamily: "Joan",
                    fontSize: 15,
                    color: "#060000",
                  }}
                  placeholder="Re-enter the new password"
                />
                {confirmPassword.length > 0 &&
                  editPassword.length > 0 &&
                  confirmPassword !== editPassword && (
                    <Text
                      style={{
                        fontFamily: "Joan",
                        fontSize: 12,
                        color: "#B00020",
                        marginTop: 4,
                      }}
                    >
                      New password and confirmation do not match.
                    </Text>
                  )}
              </View>
            </View>

            {/* Forgot password hint */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Forgot password",
                  "To reset your password, please use the \"Forgot password\" option on the login screen."
                );
              }}
              style={{ marginTop: 12 }}
            >
              <Text
                style={{
                  fontFamily: "Joan",
                  fontSize: 14,
                  color: "#355D73",
                  textAlign: "center",
                  textDecorationLine: "underline",
                }}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>

            {/* Actions */}
            <View
              style={{
                marginTop: 18,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  setPasswordOpen(false);
                  setEditPassword("");
                  setCurrentPassword("");
                  setConfirmPassword("");
                }}
                disabled={savingPassword}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 999,
                  backgroundColor: "#A4A4A4",
                  opacity: savingPassword ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 16,
                    color: "#000",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSavePassword}
                disabled={savingPassword}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 999,
                  backgroundColor: "#E6B82C",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  opacity: savingPassword ? 0.7 : 1,
                }}
              >
                {savingPassword && (
                  <ActivityIndicator size="small" color="#000" />
                )}
                <Text
                  style={{
                    fontFamily: "Joan",
                    fontSize: 16,
                    color: "#000",
                    fontWeight: "600",
                  }}
                >
                  {savingPassword ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}