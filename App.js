import React, { useEffect, useState } from "react";

import { View, ActivityIndicator, StyleSheet } from "react-native";

import { NavigationContainer } from "@react-navigation/native";

import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { signInAnonymously, onAuthStateChanged } from "firebase/auth";

import CaptureScreen from "./src/screens/CaptureScreen";

import InboxScreen from "./src/screens/InboxScreen";

import { auth } from "./src/lib/firebase";

const Tab = createBottomTabNavigator();

export default function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          await signInAnonymously(auth);
        }

        setAuthReady(true);
      } catch (error) {
        console.error("Erro ao autenticar usuário:", error);
        setAuthReady(true);
      }
    });

    return unsubscribe;
  }, []);

  if (!authReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,

            tabBarStyle: {
              backgroundColor: "#FFFFFF",
              borderTopWidth: 0,
              height: 88,
              paddingBottom: 18,
              paddingTop: 10,
            },

            tabBarActiveTintColor: "#111827",
            tabBarInactiveTintColor: "#9CA3AF",

            tabBarLabelStyle: {
              fontSize: 13,
              fontWeight: "600",
            },
          }}
        >
          <Tab.Screen name="Capturar" component={CaptureScreen} />

          <Tab.Screen name="Inbox" component={InboxScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F5F4EF",
    alignItems: "center",
    justifyContent: "center",
  },
});