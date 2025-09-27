// App.js
import { useRef, useState } from "react";
import { View, Animated } from "react-native";
import tw from "twrnc";
import { useFonts } from 'expo-font';
// import AppLoading from "expo-app-loading";
import Loading from "./screens/Loading";
import Welcome from "./screens/Welcome";
import Register from "./screens/Register";
import OutsideAuth from "./screens/OutsideAuth";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
const Stack = createNativeStackNavigator();

export default function App() {
  const [showLoader, setShowLoader] = useState(true);
  const loaderOpacity = useRef(new Animated.Value(1)).current;
    
  const [fontsLoaded] = useFonts({
    Joan: require("./assets/fonts/Joan-Regular.ttf"),
    Manrope: require("./assets/fonts/Manrope-Regular.ttf"),
  });
    
  const handleLoadingFinished = () => {
    Animated.timing(loaderOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setShowLoader(false));
  };

  return (
    <View style={tw`flex-1 bg-white`}>
      {!showLoader && (
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Welcome" component={Welcome} />
            <Stack.Screen name="Register" component={Register} />
            <Stack.Screen name="OutsideAuth" component={OutsideAuth} />
          </Stack.Navigator>
        </NavigationContainer>
      )}

      {showLoader && (
        <Animated.View style={[tw`absolute inset-0`, { opacity: loaderOpacity, zIndex: 50 }]}>
          <Loading onFinish={handleLoadingFinished} />
        </Animated.View>
      )}
    </View>
  );
}