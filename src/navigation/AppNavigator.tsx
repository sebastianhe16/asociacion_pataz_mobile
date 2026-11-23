import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '../core/theme';
import { Header } from '../components/Header';
import { useSyncStatus } from '../services/sync/SyncProvider';

export default function AppNavigator() {
  const { pendingCount } = useSyncStatus();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
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
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.offline, color: colors.onPrimary },
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="sync" color={String(color)} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
