import { View, Text, TouchableOpacity } from "react-native";

export default function HelloCard({ onPress }) {
  return (
    <View className="w-full items-center">
      <View className="w-full rounded-2xl border border-gray-200 p-6 mb-4 bg-white">
        <Text className="text-2xl font-bold mb-2">Hello, FITNESS! 💪</Text>
        <Text className="text-gray-600 mb-4">
          If you can see these styles, NativeWind (Tailwind for RN) is working.
        </Text>

        <TouchableOpacity
          className="bg-black rounded-xl py-3"
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text className="text-white text-center font-semibold">
            Tap to Celebrate 🎉
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}