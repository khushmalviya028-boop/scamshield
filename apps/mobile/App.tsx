import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';

import Navigation from './src/navigation';
import { colors } from './src/theme';
import { queryClient } from './src/lib/queryClient';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <NavigationContainer
            theme={{
              dark: true,
              colors: {
                primary: colors.primary,
                background: colors.bg,
                card: colors.bgCard,
                text: colors.textPrimary,
                border: colors.border,
                notification: colors.primary,
              },
            }}
          >
            <StatusBar style="light" backgroundColor={colors.bg} />
            <Navigation />
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
