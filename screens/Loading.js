
import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import tw from "twrnc";

export default function Loading({ onFinish, durationMs = 3000 }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(() => onFinish?.());
  }, [durationMs]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={tw`flex-1 bg-white items-center justify-center`}>
       
         <Image
        source={require("../assets/newfitlogo.png")} 
        style={tw`w-40 h-40 mb-6`} // 96x96px with some bottom margin
        resizeMode="contain"
      />
       
        
      <Text style={tw`text-2xl font-bold mb-6`}>FITNESS</Text>
      <View style={tw`w-72 h-3 bg-gray-200 rounded-full overflow-hidden`}>
        <Animated.View style={{ width, height: "100%" }}>
          <LinearGradient
            colors={["#5492DA", "#2C4E74"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}