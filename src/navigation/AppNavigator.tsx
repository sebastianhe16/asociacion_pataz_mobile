import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '../core/theme';
import { ConnectionStatusBar } from './ConnectionStatusBar';

export default function AppNavigator() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ConnectionStatusBar />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            minHeight: 62,
            paddingTop: 6,
            paddingBottom: 6,
            backgroundColor: colors.surface,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="view-dashboard-outline"
                color={String(color)}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="warehouses"
          options={{
            title: 'Almacenes',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="warehouse" color={String(color)} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="field"
          options={{
            title: 'Campo',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                color={String(color)}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="sync"
          options={{
            title: 'Sincronizar',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="sync" color={String(color)} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
