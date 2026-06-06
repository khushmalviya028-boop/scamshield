import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from '../types';
import { colors } from '../theme';

import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import ScanningScreen from '../screens/ScanningScreen';
import VerdictScreen from '../screens/VerdictScreen';
import TakeDownScreen from '../screens/TakeDownScreen';
import ReportScreen from '../screens/ReportScreen';
import EmergencyScreen from '../screens/EmergencyScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function Navigation() {
  const [initialRoute, setInitialRoute] = useState<'Onboarding' | 'Home' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_complete').then((value) => {
      setInitialRoute(value ? 'Home' : 'Onboarding');
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Scanning" component={ScanningScreen} />
      <Stack.Screen name="Verdict" component={VerdictScreen} />
      <Stack.Screen name="TakeDown" component={TakeDownScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen name="Emergency" component={EmergencyScreen} />
    </Stack.Navigator>
  );
}
