import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '../core/theme';
import { Header } from '../components/Header';
import { useSyncStatus } from '../services/sync/SyncProvider';
import HomeScreen from '../screens/HomeScreen';
import AlmacenesScreen from '../screens/AlmacenesScreen';
import ProyectosCampoScreen from '../screens/ProyectosCampoScreen';
import SincronizacionScreen from '../screens/SincronizacionScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function AppNavigator() {
  const { pendingCount } = useSyncStatus();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      <Tab.Navigator
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
        <Tab.Screen
          name="Home"
          component={HomeScreen}
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
        <Tab.Screen
          name="Warehouses"
          component={AlmacenesScreen}
          options={{
            title: 'Almacenes',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="warehouse" color={String(color)} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Field"
          component={ProyectosCampoScreen}
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
        <Tab.Screen
          name="Sync"
          component={SincronizacionScreen}
          options={{
            title: 'Sincronizar',
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.offline, color: colors.onPrimary },
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="sync" color={String(color)} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}
