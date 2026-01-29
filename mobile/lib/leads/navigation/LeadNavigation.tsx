/**
 * Lead Navigation System
 * Bottom tabs navigation for the leads system
 */

import React from 'react';
import { DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

// Import screens
import NewScreen from '../screens/NewScreen';
import VerifyScreen from '../screens/VerifyScreen';
import QualifiedScreen from '../screens/QualifiedScreen';
import PipelineScreen from '../screens/PipelineScreen';
import AutomationScreen from '../screens/AutomationScreen';
import LeadDetailScreen from '../screens/LeadDetailScreen';

// Import types
import { RootStackParamList, LeadTabParamList } from './types';

const Tab = createBottomTabNavigator<LeadTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Custom theme for the navigation
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#071626',
    card: '#0F2137',
    text: '#ffffff',
    border: '#374151',
    notification: '#49F2A8',
  },
};

function LeadTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A1A2B',
          borderTopColor: '#374151',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#49F2A8',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="New"
        component={NewScreen}
        options={{
          tabBarLabel: 'New',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="fiber-new" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Verify"
        component={VerifyScreen}
        options={{
          tabBarLabel: 'Verify',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="verified" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Qualified"
        component={QualifiedScreen}
        options={{
          tabBarLabel: 'Qualified',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="star" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Pipeline"
        component={PipelineScreen}
        options={{
          tabBarLabel: 'Pipeline',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="view-kanban" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Automation"
        component={AutomationScreen}
        options={{
          tabBarLabel: 'Automation',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="auto-awesome" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function LeadNavigation() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="LeadTabs"
        component={LeadTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LeadDetail"
        component={LeadDetailScreen}
        options={{
          presentation: 'modal',
          title: 'Lead Detail',
          headerStyle: {
            backgroundColor: '#0F2137',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '700',
          },
        }}
      />
    </Stack.Navigator>
  );
}
