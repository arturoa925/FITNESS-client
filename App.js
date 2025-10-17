// App.js
import { useRef, useState } from "react";
import { View, Animated, StyleSheet } from "react-native";
import tw from "twrnc";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
// import AppLoading from "expo-app-loading";

// * phase 0 screens
import Loading from "./screens/Phase 0/Loading";
import Welcome from "./screens/Phase 0/Welcome";
import Register from "./screens/Phase 0/Register";
import OutsideAuth from "./screens/Phase 0/OutsideAuth";

// * phase 1 screens
import Home from "./screens/Phase 1/Home";

// * phase 2 screens
import Sessions from "./screens/Phase 2/Sessions";
import DailyGrind from "./screens/Phase 2/DailyGrind";

// * phase 3 screens
import TodaysSession from "./screens/Phase 3/TodaysSession";
import ProgramDetails from "./screens/Phase 3/ProgramDetails";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
const Stack = createNativeStackNavigator();

export default function App() {
  const [showLoader, setShowLoader] = useState(true);
  const loaderOpacity = useRef(new Animated.Value(1)).current;

  const [fontsLoaded] = useFonts({
    Joan: require("./assets/fonts/Joan-Regular.ttf"),
    Manrope: require("./assets/fonts/Manrope-Regular.ttf"),
    Inter: require("./assets/fonts/Inter_18pt-Regular.ttf"),
  });

  const handleLoadingFinished = () => {
    Animated.timing(loaderOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setShowLoader(false));
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={tw`flex-1 bg-white`}>
        {!showLoader && (
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{ headerShown: false }}
              initialRouteName="Welcome"
            >
              <Stack.Screen name="Welcome" component={Welcome} />
              <Stack.Screen name="Register" component={Register} />
              <Stack.Screen name="OutsideAuth" component={OutsideAuth} />
              <Stack.Screen name="Home" component={Home} />
              <Stack.Screen name="Sessions" component={Sessions} />
              <Stack.Screen name="DailyGrind" component={DailyGrind} />
              <Stack.Screen name="TodaysSession" component={TodaysSession} />
              <Stack.Screen name="ProgramDetails" component={ProgramDetails} />
            </Stack.Navigator>
          </NavigationContainer>
        )}

        {showLoader && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: loaderOpacity, backgroundColor: "#fff" },
            ]}
          >
            <Loading onFinish={handleLoadingFinished} />
          </Animated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}
