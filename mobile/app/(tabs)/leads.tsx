import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert, Modal, TouchableOpacity, Text, StatusBar, ScrollView, Platform, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import EnhancedLeadsPage from '@/lib/leads/components/EnhancedLeadsPage';
import LeadDetailModal from '@/lib/leads/components/LeadDetailModal';
import { Lead, LeadStage } from '@/lib/leads/types';
import { unifiedLeadService } from '@/services/unifiedLeadService';
import { testApiConnection } from '@/services/apiTest';
import { resolveBackendRestApiBaseUrl } from '@/utils/resolveBackendRestApiUrl';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReminderService from '@/services/reminderService';
import { scoreLead } from '@/lib/leads/ai';
import ContractorPreferences from '@/components/ContractorPreferences';
import { useLeadsStore, useScoredLeads, LeadRaw } from '@/store/leads';
import { usePrefsStore } from '@/store/prefs';
import { normalizeTrade, tradesMatch } from '@/lib/trades';
import { distanceMi, geocodeCity, getStateCenter } from '@/lib/geo';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { clerkAuthService } from '@/services/clerkAuth';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { ScreenLayout } from '@/constants/ScreenLayout';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import WebPageShell from '@/components/layout/WebPageShell';

// Mock data with different lead sources
const mockLeads: Lead[] = [
  // PROJECT_BASED leads
  {
    id: 'L1001',
    title: 'Framing needed for Mountain View Condos',
    trade: 'Framing',
    projectId: 'PRJ-2024-001',
    source: 'PROJECT_BASED',
    contact: {
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '555-123-4567',
      company: 'Johnson Construction',
    },
    project: {
      type: 'new_build',
      budgetMin: 45000,
      budgetMax: 65000,
      timeline: 'Soon',
    },
    location: {
      city: 'Salt Lake City',
      state: 'UT',
      zip: '84101',
      lat: 40.7608,
      lng: -111.8910,
    },
    stage: 'new',
    aiScore: 92,
    verified: true,
    description: 'Need experienced framing crew for 12-unit condo development in Mountain View. Project includes structural framing for 3-story building with concrete foundation already in place. Must be licensed and insured. Timeline is tight - need to start within 2 weeks. Previous contractor fell through. Looking for reliable team with experience in multi-unit residential construction.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-sarah-001',
    createdAt: '2025-10-17T08:30:00.000Z',
  },
  {
    id: 'L1002',
    title: 'HVAC installation for Riverside Plaza',
    trade: 'HVAC',
    projectId: 'PRJ-2024-001',
    source: 'PROJECT_BASED',
    contact: {
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '555-123-4567',
      company: 'Johnson Construction',
    },
    project: {
      type: 'hvac',
      budgetMin: 85000,
      budgetMax: 120000,
      timeline: 'Urgent',
    },
    location: {
      city: 'Salt Lake City',
      state: 'UT',
      zip: '84101',
      lat: 40.7608,
      lng: -111.8910,
    },
    stage: 'new',
    aiScore: 88,
    verified: true,
    description: 'Commercial HVAC system installation for 12-unit building at Riverside Plaza. Need complete HVAC system design and installation including ductwork, units, and controls. Building is 15,000 sq ft with mixed-use retail and office spaces. Must comply with local building codes and energy efficiency standards. Prefer contractors with commercial HVAC experience and references from similar projects.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-sarah-001',
    createdAt: '2025-10-17T08:30:00.000Z',
  },
  // BID_INVITATION leads
  {
    id: 'L1003',
    title: 'Electrical RFQ from Downtown Office Complex',
    trade: 'Electrical',
    projectId: 'PRJ-2024-045',
    source: 'BID_INVITATION',
    contact: {
      name: 'Mike Rodriguez',
      email: 'mike@rodriguezbuilds.com',
      phone: '555-987-6543',
      company: 'Rodriguez Development',
    },
    project: {
      type: 'other',
      budgetMin: 55000,
      budgetMax: 75000,
      timeline: 'Soon',
    },
    location: {
      city: 'Provo',
      state: 'UT',
      zip: '84601',
      lat: 40.2338,
      lng: -111.6585,
    },
    stage: 'contacted',
    aiScore: 95,
    verified: true,
    description: 'Invited to bid on electrical work for 5-story office building in Downtown Provo. Project includes complete electrical installation for new construction: panel upgrades, lighting systems, power distribution, fire alarm system, and data/communication wiring. Building is 45,000 sq ft with modern amenities. Must meet current electrical codes and provide 3-year warranty. Looking for licensed electrical contractor with commercial experience.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-mike-002',
    assignedTo: 'sub-current-user',
    createdAt: '2025-10-16T14:20:00.000Z',
  },
  {
    id: 'L1004',
    title: 'Plumbing RFQ from Harbor View Apartments',
    trade: 'Plumbing',
    projectId: 'PRJ-2024-067',
    source: 'BID_INVITATION',
    contact: {
      name: 'David Martinez',
      email: 'david@martinezconstruction.com',
      phone: '555-789-0123',
      company: 'Martinez Construction',
    },
    project: {
      type: 'other',
      budgetMin: 95000,
      budgetMax: 135000,
      timeline: 'Normal',
    },
    location: {
      city: 'Las Vegas',
      state: 'NV',
      zip: '89101',
      lat: 36.1699,
      lng: -115.1398,
    },
    stage: 'quoted',
    aiScore: 91,
    verified: true,
    description: 'Full plumbing system installation for 20-unit apartment complex at Harbor View Apartments in Las Vegas. Project includes complete plumbing infrastructure: main water lines, individual unit connections, drainage systems, water heaters, fixtures, and fire suppression systems. Building is 3-story with 20 units plus common areas. Must comply with Nevada building codes and provide material warranties. Looking for experienced plumbing contractor with multi-unit residential experience.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-david-003',
    assignedTo: 'sub-current-user',
    createdAt: '2025-10-15T10:45:00.000Z',
  },
  // MARKETPLACE leads
  {
    id: 'L1005',
    title: 'Stucco work needed',
    trade: 'Stucco',
    source: 'MARKETPLACE',
    contact: {
      name: 'Emily Chen',
      email: 'emily.chen@email.com',
      phone: '555-456-7890',
      company: 'Chen Properties',
    },
    project: {
      type: 'stucco',
      budgetMin: 18000,
      budgetMax: 25000,
      timeline: 'Soon',
    },
    location: {
      city: 'Henderson',
      state: 'NV',
      zip: '89052',
      lat: 36.0395,
      lng: -114.9817,
    },
    stage: 'new',
    aiScore: 78,
    verified: true,
    description: 'Stucco exterior application for residential property in Henderson, NV. Single-family home approximately 2,500 sq ft with existing drywall structure ready for stucco application. Need complete exterior stucco system including base coat, finish coat, and texture. Property has some architectural details that require careful attention. Must match existing neighborhood aesthetic and provide weather-resistant finish. Looking for experienced stucco contractor with residential references.',
    verification: {
      emailValid: true,
      phoneValid: false,
    },
    createdBy: 'owner-emily-004',
    createdAt: '2025-10-16T16:30:00.000Z',
  },
  {
    id: 'L1006',
    title: 'Roofing work needed',
    trade: 'Roofing',
    source: 'MARKETPLACE',
    contact: {
      name: 'James Wilson',
      email: 'james@wilsonhomes.com',
      phone: '555-234-5678',
      company: 'Wilson Homes',
    },
    project: {
      type: 'other',
      budgetMin: 32000,
      budgetMax: 45000,
      timeline: 'Urgent',
    },
    location: {
      city: 'Reno',
      state: 'NV',
      zip: '89501',
      lat: 39.5296,
      lng: -119.8138,
    },
    stage: 'new',
    aiScore: 85,
    verified: true,
    description: 'Complete roof replacement for residential property using high-quality asphalt shingles. Existing roof is 20+ years old and showing signs of wear. Property is 2,200 sq ft single-story home with moderate slope. Need complete tear-off of existing shingles, inspection of decking, and installation of new architectural shingles with proper ventilation. Must include gutter work and provide warranty. Looking for licensed roofing contractor with residential experience.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'owner-james-005',
    createdAt: '2025-10-17T09:15:00.000Z',
  },
  // AI_ESTIMATE leads
  {
    id: 'L1007',
    title: 'Drywall installation auto-matched',
    trade: 'Drywall',
    projectId: 'EST-2024-123',
    source: 'AI_ESTIMATE',
    contact: {
      name: 'Lisa Anderson',
      email: 'lisa@andersondev.com',
      phone: '555-345-6789',
      company: 'Anderson Development',
    },
    project: {
      type: 'other',
      budgetMin: 28000,
      budgetMax: 38000,
      timeline: 'Normal',
    },
    location: {
      city: 'Ogden',
      state: 'UT',
      zip: '84401',
      lat: 41.2230,
      lng: -111.9738,
    },
    stage: 'new',
    aiScore: 82,
    verified: true,
    description: 'AI detected missing drywall trade in estimate - matched to your profile. Commercial office renovation project requires complete drywall installation throughout 8,000 sq ft space. Includes framing, drywall hanging, taping, mudding, sanding, and texture application. Project involves multiple rooms, conference areas, and open office spaces. Must meet commercial building standards and provide smooth finish ready for painting. Timeline is flexible but quality workmanship required.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-lisa-006',
    createdAt: '2025-10-17T07:00:00.000Z',
  },
  {
    id: 'L1008',
    title: 'Painting work auto-matched',
    trade: 'Painting',
    projectId: 'EST-2024-145',
    source: 'AI_ESTIMATE',
    contact: {
      name: 'Robert Taylor',
      email: 'robert@taylorbuilds.com',
      phone: '555-456-7891',
      company: 'Taylor Builds',
    },
    project: {
      type: 'other',
      budgetMin: 15000,
      budgetMax: 22000,
      timeline: 'Soon',
    },
    location: {
      city: 'Sandy',
      state: 'UT',
      zip: '84070',
      lat: 40.5649,
      lng: -111.8389,
    },
    stage: 'new',
    aiScore: 76,
    verified: false,
    description: 'Interior and exterior painting for commercial property in downtown area. Building is 3-story office complex with approximately 12,000 sq ft of paintable surface area. Interior work includes office spaces, common areas, and restrooms. Exterior work includes main building facade, trim, and doors. Must use commercial-grade paint and comply with local building codes. Project requires coordination with ongoing tenant operations. Looking for experienced commercial painting contractor.',
    verification: {
      emailValid: true,
      phoneValid: false,
    },
    createdBy: 'gc-robert-007',
    createdAt: '2025-10-16T11:30:00.000Z',
  },
  // SHARED leads
  {
    id: 'L1009',
    title: 'Concrete work - shared by peer',
    trade: 'Concrete',
    source: 'SHARED',
    contact: {
      name: 'Maria Garcia',
      email: 'maria@garciaconstruction.com',
      phone: '555-567-8901',
      company: 'Garcia Construction',
    },
    project: {
      type: 'other',
      budgetMin: 42000,
      budgetMax: 58000,
      timeline: 'Soon',
    },
    location: {
      city: 'West Valley City',
      state: 'UT',
      zip: '84119',
      lat: 40.6916,
      lng: -112.0011,
    },
    stage: 'new',
    aiScore: 80,
    verified: true,
    description: 'Foundation and flatwork for residential addition - shared by local contractor',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'sub-maria-008',
    createdAt: '2025-10-17T06:45:00.000Z',
  },
  {
    id: 'L1010',
    title: 'Landscaping - shared by peer',
    trade: 'Landscaping',
    source: 'SHARED',
    contact: {
      name: 'Tom Brown',
      email: 'tom@brownlandscaping.com',
      phone: '555-678-9012',
      company: 'Brown Landscaping',
    },
    project: {
      type: 'landscaping',
      budgetMin: 12000,
      budgetMax: 18000,
      timeline: 'Normal',
    },
    location: {
      city: 'South Jordan',
      state: 'UT',
      zip: '84095',
      lat: 40.5622,
      lng: -111.9297,
    },
    stage: 'new',
    aiScore: 71,
    verified: true,
    description: 'Complete landscaping design and installation for new residential development in South Jordan, UT. Project includes landscape design, irrigation system installation, sod laying, tree planting, shrub installation, and decorative rock work. Development consists of 15 single-family homes with individual yards plus common areas. Must coordinate with ongoing construction and provide maintenance plan. Looking for experienced landscaping contractor with residential development experience.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'sub-tom-009',
    createdAt: '2025-10-16T13:20:00.000Z',
  },
  // St. George, Utah leads for location filtering test
  {
    id: 'L1011',
    title: 'Plumbing Installation - St. George New Home',
    trade: 'Plumbing',
    source: 'PROJECT_BASED',
    contact: {
      name: 'David Thompson',
      email: 'david.thompson@email.com',
      phone: '555-234-5678',
      company: 'Thompson Construction',
    },
    project: {
      type: 'new_build',
      budgetMin: 35000,
      budgetMax: 50000,
      timeline: 'Soon',
    },
    location: {
      city: 'St. George',
      state: 'UT',
      zip: '84790',
      lat: 37.0965,
      lng: -113.5684,
    },
    stage: 'new',
    aiScore: 85,
    verified: true,
    description: 'Complete plumbing installation for new residential home in St. George. Project includes all rough-in plumbing, fixtures, water heater installation, and connection to city utilities. Home is 2,800 sq ft with 3 bathrooms and kitchen. Must be licensed and insured. Looking for experienced plumber familiar with St. George building codes.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-david-010',
    createdAt: '2025-10-18T09:15:00.000Z',
  },
  {
    id: 'L1012',
    title: 'Electrical Panel Upgrade - St. George',
    trade: 'Electrical',
    source: 'PROJECT_BASED',
    contact: {
      name: 'Jennifer Martinez',
      email: 'jennifer.m@email.com',
      phone: '555-345-6789',
      company: 'Martinez Homes',
    },
    project: {
      type: 'other',
      budgetMin: 12000,
      budgetMax: 18000,
      timeline: 'Urgent',
    },
    location: {
      city: 'St. George',
      state: 'UT',
      zip: '84790',
      lat: 37.0965,
      lng: -113.5684,
    },
    stage: 'new',
    aiScore: 82,
    verified: true,
    description: 'Electrical panel upgrade for existing home in St. George. Current panel is 100 amp, need to upgrade to 200 amp service. Includes new panel installation, meter base upgrade, and connection to existing wiring. Home built in 1985, requires permit and inspection. Urgent timeline - need to complete before winter.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-jennifer-011',
    createdAt: '2025-10-18T10:30:00.000Z',
  },
  {
    id: 'L1013',
    title: 'Interior Painting - St. George Condo Complex',
    trade: 'Painting',
    source: 'PROJECT_BASED',
    contact: {
      name: 'Robert Chen',
      email: 'robert.chen@email.com',
      phone: '555-456-7890',
      company: 'Chen Properties',
    },
    project: {
      type: 'other',
      budgetMin: 28000,
      budgetMax: 40000,
      timeline: 'Normal',
    },
    location: {
      city: 'St. George',
      state: 'UT',
      zip: '84790',
      lat: 37.0965,
      lng: -113.5684,
    },
    stage: 'new',
    aiScore: 78,
    verified: true,
    description: 'Interior painting for 12-unit condo complex in St. George. Each unit is approximately 1,200 sq ft with 2 bedrooms. Includes walls, ceilings, trim, and doors. Some units are currently occupied, so scheduling coordination is required. Must use low-VOC paint for health concerns. Timeline is flexible.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-robert-012',
    createdAt: '2025-10-18T11:45:00.000Z',
  },
  {
    id: 'L1014',
    title: 'Roofing Replacement - St. George Residence',
    trade: 'Roofing',
    source: 'PROJECT_BASED',
    contact: {
      name: 'Amanda Foster',
      email: 'amanda.foster@email.com',
      phone: '555-567-8901',
      company: 'Foster Development',
    },
    project: {
      type: 'other',
      budgetMin: 45000,
      budgetMax: 65000,
      timeline: 'Urgent',
    },
    location: {
      city: 'St. George',
      state: 'UT',
      zip: '84790',
      lat: 37.0965,
      lng: -113.5684,
    },
    stage: 'new',
    aiScore: 88,
    verified: true,
    description: 'Complete roof replacement for residential home in St. George. Home is 3,200 sq ft with composite shingle roof that needs full replacement due to storm damage. Includes removal of old roofing, repair of any deck damage, installation of new shingles, gutters, and flashing. Must coordinate with insurance company. Urgent - active leaks.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-amanda-013',
    createdAt: '2025-10-18T14:20:00.000Z',
  },
  {
    id: 'L1015',
    title: 'Flooring Installation - St. George Office',
    trade: 'Flooring',
    source: 'PROJECT_BASED',
    contact: {
      name: 'Michael Park',
      email: 'michael.park@email.com',
      phone: '555-678-9012',
      company: 'Park Commercial',
    },
    project: {
      type: 'other',
      budgetMin: 22000,
      budgetMax: 32000,
      timeline: 'Soon',
    },
    location: {
      city: 'St. George',
      state: 'UT',
      zip: '84790',
      lat: 37.0965,
      lng: -113.5684,
    },
    stage: 'new',
    aiScore: 80,
    verified: true,
    description: 'Commercial flooring installation for office space in St. George. Space is 2,500 sq ft with existing carpet that needs replacement. Prefer luxury vinyl plank (LVP) or commercial carpet tile. Includes subfloor preparation, installation, and transition strips. Office is currently operational, so work needs to be scheduled after hours or on weekends.',
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: 'gc-michael-014',
    createdAt: '2025-10-18T15:00:00.000Z',
  },
  // Additional mock leads — varied stages & sources for pipeline / analytics testing
  {
    id: 'L1016',
    title: 'Kitchen remodel — Boulder City',
    trade: 'General',
    source: 'MARKETPLACE',
    contact: {
      name: 'Jennifer Lee',
      email: 'jlee@email.com',
      phone: '555-201-3344',
      company: 'Lee Development',
    },
    project: {
      type: 'kitchen',
      budgetMin: 12000,
      budgetMax: 18000,
      timeline: 'Soon',
    },
    location: {
      city: 'Boulder City',
      state: 'NV',
      zip: '89005',
      lat: 35.9786,
      lng: -114.8325,
    },
    stage: 'contacted',
    aiScore: 87,
    verified: true,
    description: 'Full kitchen gut and remodel in 1980s ranch. New cabinets, quartz counters, lighting, and appliance rough-in. Permit required.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'owner-jlee-016',
    createdAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'L1017',
    title: 'Commercial TI — Phoenix warehouse',
    trade: 'Electrical',
    projectId: 'PRJ-2026-088',
    source: 'BID_INVITATION',
    contact: {
      name: 'Marcus Webb',
      email: 'marcus@webbindustrial.com',
      phone: '555-202-4455',
      company: 'Webb Industrial',
    },
    project: {
      type: 'other',
      budgetMin: 110000,
      budgetMax: 155000,
      timeline: 'Urgent',
    },
    location: {
      city: 'Phoenix',
      state: 'AZ',
      zip: '85034',
      lat: 33.4484,
      lng: -112.0740,
    },
    stage: 'qualified',
    aiScore: 93,
    verified: true,
    description: 'Tenant improvement for 18k sq ft warehouse conversion to light manufacturing. Power distribution, LED high-bays, equipment drops, and panel expansion.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'gc-marcus-017',
    assignedTo: 'sub-current-user',
    createdAt: '2026-01-08T14:30:00.000Z',
  },
  {
    id: 'L1018',
    title: 'Solar + battery backup — residential',
    trade: 'Electrical',
    source: 'AI_ESTIMATE',
    projectId: 'EST-2026-201',
    contact: {
      name: 'Priya Nair',
      email: 'priya.nair@email.com',
      phone: '555-203-5566',
      company: 'Nair Residence',
    },
    project: {
      type: 'other',
      budgetMin: 42000,
      budgetMax: 62000,
      timeline: 'Normal',
    },
    location: {
      city: 'Denver',
      state: 'CO',
      zip: '80205',
      lat: 39.7392,
      lng: -104.9903,
    },
    stage: 'proposal',
    aiScore: 89,
    verified: true,
    description: '8.5 kW rooftop solar with 13.5 kWh battery backup. Main service upgrade likely required. HOA approval already obtained.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'ai-match-018',
    createdAt: '2026-01-05T09:00:00.000Z',
  },
  {
    id: 'L1019',
    title: 'ADA bathroom retrofit — medical office',
    trade: 'Plumbing',
    source: 'SHARED',
    contact: {
      name: 'Dr. Alan Reeves',
      email: 'office@reevesclinic.com',
      phone: '555-204-6677',
      company: 'Reeves Family Medicine',
    },
    project: {
      type: 'bathroom',
      budgetMin: 28000,
      budgetMax: 36000,
      timeline: 'Soon',
    },
    location: {
      city: 'Las Vegas',
      state: 'NV',
      zip: '89104',
      lat: 36.1699,
      lng: -115.1398,
    },
    stage: 'proposal-sent',
    aiScore: 84,
    verified: true,
    description: 'Two restrooms brought to current ADA standards: fixtures, grab bars, clearances, and automatic door operators on suite entry.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'sub-referral-019',
    createdAt: '2025-12-20T11:15:00.000Z',
  },
  {
    id: 'L1020',
    title: 'Custom home framing — Park City',
    trade: 'Carpenter',
    projectId: 'PRJ-2026-112',
    source: 'PROJECT_BASED',
    contact: {
      name: 'Elena Vasquez',
      email: 'elena.v@peakcustom.com',
      phone: '555-205-7788',
      company: 'Peak Custom Homes',
    },
    project: {
      type: 'new_build',
      budgetMin: 185000,
      budgetMax: 240000,
      timeline: 'Normal',
    },
    location: {
      city: 'Park City',
      state: 'UT',
      zip: '84060',
      lat: 40.6461,
      lng: -111.4980,
    },
    stage: 'won',
    aiScore: 96,
    verified: true,
    description: '4,200 sq ft mountain modern — structural framing, shear, and deck packages. Engineer-stamped plans on file; crane dates TBD.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'gc-elena-020',
    createdAt: '2025-11-01T08:00:00.000Z',
  },
  {
    id: 'L1021',
    title: 'Fence & gate — HOA community',
    trade: 'General',
    source: 'MARKETPLACE',
    contact: {
      name: 'Chris Okonkwo',
      email: 'c.okonkwo@email.com',
      phone: '555-206-8899',
      company: 'Okonkwo Family Trust',
    },
    project: {
      type: 'other',
      budgetMin: 8500,
      budgetMax: 12000,
      timeline: 'flex',
    },
    location: {
      city: 'Henderson',
      state: 'NV',
      zip: '89044',
      lat: 35.9671,
      lng: -115.0623,
    },
    stage: 'lost',
    aiScore: 62,
    verified: true,
    description: 'Perimeter vinyl privacy fence ~180 LF plus dual drive gates. Client went with another vendor on price.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'owner-chris-021',
    createdAt: '2025-12-01T16:45:00.000Z',
  },
  {
    id: 'L1022',
    title: 'Epoxy garage floor — 3-car',
    trade: 'Painting',
    source: 'MARKETPLACE',
    contact: {
      name: 'Ryan Cooper',
      email: 'ryan.cooper@email.com',
      phone: '555-207-9900',
      company: 'Cooper',
    },
    project: {
      type: 'other',
      budgetMin: 4500,
      budgetMax: 7000,
      timeline: 'Soon',
    },
    location: {
      city: 'Mesquite',
      state: 'NV',
      zip: '89027',
      lat: 36.8055,
      lng: -114.0672,
    },
    stage: 'new',
    aiScore: 74,
    verified: false,
    description: 'Grind, repair cracks, moisture test, metallic epoxy with clear topcoat. Three-car garage ~780 sq ft.',
    verification: { emailValid: true, phoneValid: false },
    createdBy: 'owner-ryan-022',
    createdAt: '2026-01-12T13:20:00.000Z',
  },
  {
    id: 'L1023',
    title: 'Restaurant hood & make-up air',
    trade: 'HVAC',
    projectId: 'PRJ-2026-145',
    source: 'BID_INVITATION',
    contact: {
      name: 'Sofia Ramirez',
      email: 'sofia@mesaazkitchen.com',
      phone: '555-208-1011',
      company: 'Mesa AZ Kitchen Group',
    },
    project: {
      type: 'other',
      budgetMin: 68000,
      budgetMax: 92000,
      timeline: 'Urgent',
    },
    location: {
      city: 'Mesa',
      state: 'AZ',
      zip: '85201',
      lat: 33.4152,
      lng: -111.8315,
    },
    stage: 'contacted',
    aiScore: 90,
    verified: true,
    description: 'New fast-casual build-out: Type I hood, make-up air, fire suppression tie-in, and exhaust riser to roof. GC coordinates MEP.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'gc-sofia-023',
    assignedTo: 'sub-current-user',
    createdAt: '2026-01-11T07:30:00.000Z',
  },
  {
    id: 'L1024',
    title: 'Sub request — commercial concrete pour',
    trade: 'Concrete',
    projectId: 'PRJ-2026-201',
    source: 'PROJECT_BASED',
    isOwnRequest: true,
    createdBy: 'contractor-demo',
    contact: {
      name: 'Build Profit Demo',
      email: 'demo@buildprofit.test',
      phone: '555-209-2022',
      company: 'BPS Demo Co',
    },
    project: {
      type: 'other',
      budgetMin: 35000,
      budgetMax: 48000,
      timeline: 'Soon',
    },
    location: {
      city: 'North Las Vegas',
      state: 'NV',
      zip: '89030',
      lat: 36.1989,
      lng: -115.1175,
    },
    stage: 'qualified',
    aiScore: 81,
    verified: true,
    description: 'Need flatwork crew for loading dock extension and 4,500 sq ft slab — vapor barrier, fiber, and F-number finish per spec sheet.',
    verification: { emailValid: true, phoneValid: true },
    createdAt: '2026-01-09T12:00:00.000Z',
  },
  {
    id: 'L1025',
    title: 'Historic brick repointing',
    trade: 'General',
    source: 'AI_ESTIMATE',
    projectId: 'EST-2026-310',
    contact: {
      name: 'Grace Whitmore',
      email: 'g.whitmore@email.com',
      phone: '555-210-3033',
      company: 'Whitmore Holdings',
    },
    project: {
      type: 'other',
      budgetMin: 52000,
      budgetMax: 78000,
      timeline: 'Normal',
    },
    location: {
      city: 'Salt Lake City',
      state: 'UT',
      zip: '84111',
      lat: 40.7608,
      lng: -111.8910,
    },
    stage: 'contacted',
    aiScore: 86,
    verified: true,
    description: 'Downtown mixed-use facade: repoint ~3,200 sq ft brick, replace failed lintels in kind, and match historic mortar analysis.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'ai-match-025',
    createdAt: '2026-01-07T15:45:00.000Z',
  },
  {
    id: 'L1026',
    title: 'EV charger pedestal — retail parking',
    trade: 'Electrical',
    source: 'MARKETPLACE',
    contact: {
      name: 'Kevin O\'Brien',
      email: 'k.obrien@retailwest.com',
      phone: '555-211-4044',
      company: 'Retail West LLC',
    },
    project: {
      type: 'other',
      budgetMin: 22000,
      budgetMax: 32000,
      timeline: 'Urgent',
    },
    location: {
      city: 'Reno',
      state: 'NV',
      zip: '89502',
      lat: 39.5261,
      lng: -119.8127,
    },
    stage: 'new',
    aiScore: 79,
    verified: true,
    description: 'Six Level 2 pedestals, load calc, service sizing memo, and coordination with utility. Grand opening target in 6 weeks.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'owner-kevin-026',
    createdAt: '2026-01-13T08:10:00.000Z',
  },
  {
    id: 'L1027',
    title: 'Pool equipment pad relocation',
    trade: 'Plumbing',
    source: 'SHARED',
    contact: {
      name: 'Dana Fisher',
      email: 'dana@fisherestates.com',
      phone: '555-212-5055',
      company: 'Fisher Estates',
    },
    project: {
      type: 'other',
      budgetMin: 14000,
      budgetMax: 20000,
      timeline: 'Soon',
    },
    location: {
      city: 'Scottsdale',
      state: 'AZ',
      zip: '85251',
      lat: 33.4942,
      lng: -111.9261,
    },
    stage: 'qualified',
    aiScore: 83,
    verified: true,
    description: 'Relocate heater, pump, and filter pad 25 feet; new PVC runs, bonding, and low-voltage for automation. Pebbletec resurface separate contract.',
    verification: { emailValid: true, phoneValid: true },
    createdBy: 'sub-dana-ref-027',
    createdAt: '2026-01-04T19:00:00.000Z',
  },
];

/**
 * Create a test lead for any city/state to test location filtering
 * Usage: Add the returned lead to mockLeads array or allLeads in loadLeads
 * Example: createTestLead('Portland', 'OR', 'Plumbing')
 */
function createTestLead(city: string, state: string, trade: string = 'Plumbing'): Lead {
  // Try to geocode the city to get coordinates
  const coords = geocodeCity(city, state);
  const testId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: testId,
    title: `${trade} Service - ${city} Test Lead`,
    trade: trade,
    source: 'PROJECT_BASED',
    contact: {
      name: `Test Contact`,
      email: `test.${city.toLowerCase().replace(/\s+/g, '')}@email.com`,
      phone: `555-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      company: `Test Company ${city}`,
    },
    project: {
      type: 'other',
      budgetMin: 15000,
      budgetMax: 35000,
      timeline: 'Normal',
    },
    location: {
      city: city,
      state: state,
      zip: '00000',
      lat: coords?.lat,
      lng: coords?.lng,
    },
    stage: 'new',
    aiScore: 75,
    verified: true,
    description: `Test lead for ${trade} service in ${city}, ${state}. This is a dynamically generated test lead to verify location filtering is working correctly across all 50 states.`,
    verification: {
      emailValid: true,
      phoneValid: true,
    },
    createdBy: `test-${city.toLowerCase().replace(/\s+/g, '-')}`,
    createdAt: new Date().toISOString(),
  };
}

// TEST LEAD: Change the city, state, and trade below to test any location
// Add this to the mockLeads array or use it directly in loadLeads
const TEST_CITY = 'Los Angeles';  // Change this to any city
const TEST_STATE = 'CA';        // Change this to any state (2-letter code)
const TEST_TRADE = 'Electrical';  // Change this to any trade
const testLocationLead = createTestLead(TEST_CITY, TEST_STATE, TEST_TRADE);

// Add the test lead to mockLeads array for easy testing
const mockLeadsWithTest = [...mockLeads, testLocationLead];

/** In-app seed catalog IDs (`mockLeads`, e.g. L1001–L1027). Bypass Match Prefs like campaign leads when shown. */
function isEmbeddedSeedLeadId(id: string): boolean {
  return /^L10\d+$/.test(id);
}

/**
 * When the API returns leads, the app used to hide every `mockLeads` row — so new L10xx demos never appeared.
 * In __DEV__, merge the seed catalog unless EXPO_PUBLIC_INCLUDE_MOCK_LEADS=false.
 * In production, merge only if EXPO_PUBLIC_INCLUDE_MOCK_LEADS=true.
 */
function shouldMergeEmbeddedMockCatalog(): boolean {
  if (process.env.EXPO_PUBLIC_INCLUDE_MOCK_LEADS === 'true') return true;
  if (process.env.EXPO_PUBLIC_INCLUDE_MOCK_LEADS === 'false') return false;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function leadBypassesMatchPrefs(lead: Lead): boolean {
  return (
    !!lead.projectId?.startsWith('CAMPAIGN-') ||
    lead.isOwnRequest === true ||
    (lead.createdBy != null && lead.createdBy === 'contractor-demo') ||
    isEmbeddedSeedLeadId(lead.id)
  );
}

// Helper function to convert existing Lead to LeadRaw format
function convertToLeadRaw(lead: Lead): LeadRaw {
  const getTimeline = (timeline?: string): 'Urgent' | 'Soon' | 'Normal' | 'Flexible' => {
    if (!timeline) return 'Normal';
    const t = timeline.toLowerCase();
    if (t === 'urgent') return 'Urgent';
    if (t === 'soon') return 'Soon';
    if (t === 'flexible') return 'Flexible';
    return 'Normal';
  };

  return {
    // Keep all original properties first
    ...lead,
    // Override with normalized values for filtering
    name: lead.contact?.name || lead.title || 'Unknown',
    company: lead.contact?.company,
    trade: lead.trade || 'Unknown',
    city: lead.location?.city || '',
    state: lead.location?.state || '',
    lat: lead.location?.lat || 0,
    lng: lead.location?.lng || 0,
    timeline: getTimeline(lead.project?.timeline),
    budgetMin: lead.project?.budgetMin,
    budgetMax: lead.project?.budgetMax,
  };
}

export default function LeadsScreen() {
  // Require authentication to access this screen
  useRequireAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const tabScrollBottomInset = useTabScrollBottomInset();
  const styles = useMemo(
    () => getStyles(Colors, tabScrollBottomInset),
    [Colors, tabScrollBottomInset]
  );
  
  const user = {
    name: 'Nick Lafontaine',
    initials: 'NL',
  };
  
  const [leads, setLeads] = useState<Lead[]>([]);
  
  // Zustand integration
  const { setAll } = useLeadsStore();
  const { hydrated, leads: scoredLeads } = useScoredLeads();
  const { prefs, hydrated: prefsHydrated } = usePrefsStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletedLeadIds, setDeletedLeadIds] = useState<Set<string>>(new Set());
  const [deletedLeadIdsLoaded, setDeletedLeadIdsLoaded] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [contractorProfile, setContractorProfile] = useState<{
    tradeTypes?: string[];
    specificTrades?: string[];
    zipCodes?: string[];
    location?: { city?: string; state?: string; serviceRadius?: number; lat?: number; lng?: number };
    budget?: { min?: number; max?: number };
    preferredTimelines?: ('Urgent' | 'Soon' | 'Normal' | 'Flexible')[];
    filterByTrade?: boolean;
    minAIScore?: number;
  } | null>(null);
  const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  /** Ensures we always run one API-backed load after prefs hydrate (mock cache should not skip it). */
  const apiLeadsBootstrapDoneRef = useRef(false);

  const [leadsViewMeta, setLeadsViewMeta] = useState<{
    eligibleInLeadsTab: number;
    visibleInView: number;
    filtersNarrowed: boolean;
    renderedInList: number;
    hasMoreInList: boolean;
  } | null>(null);
  const handleLeadsViewMeta = useCallback(
    (meta: {
      eligibleInLeadsTab: number;
      visibleInView: number;
      filtersNarrowed: boolean;
      renderedInList: number;
      hasMoreInList: boolean;
    }) => {
      setLeadsViewMeta(meta);
    },
    []
  );

  const campaignLeadCount = useMemo(
    () => leads.filter((l) => l.projectId?.startsWith('CAMPAIGN-')).length,
    [leads]
  );

  // Debug: Track when leads are being set
  useEffect(() => {
    console.log('🔍 Leads state changed:', {
      count: leads.length,
      firstLead: leads[0]?.title,
      firstLeadScore: leads[0]?.aiScore,
      allTrades: leads.map(l => l.trade),
      allScores: leads.map(l => `${l.title}: ${l.aiScore}`),
      stackTrace: new Error().stack?.split('\n').slice(1, 6).join('\n')
    });
  }, [leads]);
  
  // Note: We no longer clear old lead data to preserve saved stages across app restarts

  // Debug: Track when modal state changes
  useEffect(() => {
    console.log('🔍 Modal state changed:', {
      showLeadDetailModal,
      selectedLead: selectedLead?.title,
      leadsCount: leads.length,
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }, [showLeadDetailModal, selectedLead, leads.length]);

  // Simple function to get personalized leads
  const getPersonalizedLeads = (baseLeads: Lead[]): Lead[] => {
    if (!contractorProfile) {
      console.log('⚠️ No contractor profile available for personalization');
      return baseLeads.map(lead => ({
        ...lead,
        aiScore: lead.aiScore || 50, // Default score if no profile
      }));
    }

    console.log('🔍 Applying personalized scoring with profile:', {
      specificTrades: contractorProfile.specificTrades,
      tradeTypes: contractorProfile.tradeTypes,
      budget: contractorProfile.budget,
      location: contractorProfile.location,
    });

    // Apply personalized scoring
    let personalizedLeads = baseLeads.map(lead => {
      const newScore = scoreLead(lead, undefined, {
        ...contractorProfile,
        specificTrades: contractorProfile.specificTrades || [],
      });
      console.log(`📊 Scoring lead "${lead.title}" (trade: "${lead.trade}"): ${lead.aiScore || 'N/A'} → ${newScore}`);
      return {
        ...lead,
        aiScore: newScore,
      };
    });

    // Apply filtering based on preferences
    const shouldFilterByTrade = contractorProfile.filterByTrade === true;
    const hasSpecificTrades = contractorProfile.specificTrades && contractorProfile.specificTrades.length > 0;
    
    // First, identify and separate campaign leads (they bypass ALL filters)
    const campaignLeads: Lead[] = [];
    const regularLeads: Lead[] = [];
    
    personalizedLeads.forEach(lead => {
      // Campaign / own requests / embedded L10xx seed — bypass ALL filters (trade, location, budget)
      if (leadBypassesMatchPrefs(lead)) {
        // Ensure campaign leads have aiScore (should already be set from earlier scoring, but ensure it)
        const campaignLeadWithScore = {
          ...lead,
          aiScore: lead.aiScore || 0,
        };
        campaignLeads.push(campaignLeadWithScore);
        console.log(
          `✅ Lead bypasses Match Prefs: "${lead.title}" (projectId: "${lead.projectId}", isOwnRequest: ${lead.isOwnRequest}, createdBy: "${lead.createdBy}", seedId: ${isEmbeddedSeedLeadId(lead.id)})`
        );
      } else {
        regularLeads.push(lead);
      }
    });
    
    console.log(`📊 Separated leads: ${campaignLeads.length} campaign leads (bypass filters) + ${regularLeads.length} regular leads (apply filters)`);
    
    // Only apply trade filtering if toggle is ON
    if (shouldFilterByTrade && hasSpecificTrades) {
      console.log(`🔍 FILTERING ENABLED - Applying trade filter to ${regularLeads.length} regular leads...`);
      console.log('🔍 Selected trades:', contractorProfile.specificTrades);
      console.log('🔍 Regular leads before filtering:', regularLeads.map(l => `${l.trade} (${l.title})`));
      
      const filteredRegularLeads = regularLeads.filter(lead => {
        // Note: Minimum AI score filter is NOT applied when "only show leads matching preferences" is ON
        // This ensures leads that match trade, location, and budget preferences are shown
        // even if their AI score is slightly below the minimum threshold
        
        
        const leadTradeNormalized = normalizeTrade(lead.trade);
        
        // Use normalized trade matching (same logic as scoring)
        const hasTradeMatch = contractorProfile.specificTrades!.some(specificTrade => {
          const prefTradeNormalized = normalizeTrade(specificTrade);
          return tradesMatch(leadTradeNormalized, prefTradeNormalized);
        });
        
        if (!hasTradeMatch) {
          console.log(`❌ No trade match: "${lead.trade}" does not match selected trades (${contractorProfile.specificTrades?.join(', ')}) for lead "${lead.title}"`);
          return false;
        }
        
        // Also filter by location if service area is configured
        // Check against ALL service areas (not just the first one)
        if (lead.location) {
          const leadLoc = lead.location;
          const prefsState = usePrefsStore.getState();
          const serviceAreas = prefsState.prefs.locations || [];
          
          // If no service areas configured, skip location filtering
          if (serviceAreas.length === 0) {
            console.log(`✅ Trade match: "${lead.trade}" matches selected trades for lead "${lead.title}" (no location filter)`);
          } else {
            // Log service areas being checked (first time only per lead)
            if (leadLoc.city && leadLoc.state) {
              const areasList = serviceAreas.map(a => `${a.city}, ${a.state} (${a.radiusMi || 25}mi)`).join('; ');
              console.log(`🔍 Checking "${lead.title}" (${leadLoc.city}, ${leadLoc.state}) against service areas: [${areasList}]`);
            }
            
            // Check if lead matches ANY service area
            let matchesServiceArea = false;
            let matchedArea = null;
            
            for (const serviceArea of serviceAreas) {
              const areaCity = serviceArea.city?.trim();
              const areaState = serviceArea.state?.trim();
              const areaRadius = serviceArea.radiusMi || 25;
              
              // Get service area coordinates - prioritize stored lat/lng, then geocode, then state center
              let areaCoords: { lat: number; lng: number } | null = null;
              
              if (serviceArea.lat && serviceArea.lng) {
                // Use stored coordinates from preferences
                areaCoords = { lat: serviceArea.lat, lng: serviceArea.lng };
                console.log(`📍 Using stored coordinates for ${areaCity}, ${areaState}:`, areaCoords);
              } else if (areaCity && areaState) {
                // Try to geocode the city/state
                areaCoords = geocodeCity(areaCity, areaState);
                if (!areaCoords) {
                  // Fallback to state center if city not found
                  areaCoords = getStateCenter(areaState);
                  console.log(`📍 City "${areaCity}" not found, using ${areaState} state center:`, areaCoords);
                } else {
                  console.log(`📍 Geocoded ${areaCity}, ${areaState}:`, areaCoords);
                }
              } else {
                // No city/state, skip this service area
                continue;
              }
              
              // Get lead coordinates - prioritize stored lat/lng, then geocode, then state center
              let leadCoords: { lat: number; lng: number } | null = null;
              
              if (leadLoc.lat && leadLoc.lng) {
                // Use stored coordinates from lead
                leadCoords = { lat: leadLoc.lat, lng: leadLoc.lng };
              } else if (leadLoc.city && leadLoc.state) {
                // Try to geocode the lead's city/state
                leadCoords = geocodeCity(leadLoc.city, leadLoc.state);
                if (!leadCoords) {
                  // Fallback to state center if city not found
                  leadCoords = getStateCenter(leadLoc.state);
                  console.log(`📍 Lead city "${leadLoc.city}" not found, using ${leadLoc.state} state center`);
                }
              }
              
              // If both have coordinates, calculate distance
              if (areaCoords && leadCoords && areaCoords.lat && areaCoords.lng && leadCoords.lat && leadCoords.lng) {
                const distance = distanceMi(areaCoords, leadCoords);
                const withinRadius = distance <= areaRadius;
                
                if (withinRadius) {
                  matchesServiceArea = true;
                  matchedArea = { city: areaCity, state: areaState, distance: distance.toFixed(1) };
                  console.log(`✅ Location match: "${lead.title}" in ${leadLoc.city}, ${leadLoc.state} is ${distance.toFixed(1)} miles from ${areaCity}, ${areaState} (within ${areaRadius} mile radius)`);
                  break;
                } else {
                  console.log(`📍 "${lead.title}" in ${leadLoc.city}, ${leadLoc.state} is ${distance.toFixed(1)} miles from ${areaCity}, ${areaState} (beyond ${areaRadius} mile radius)`);
                }
              } else {
                // Fallback to state/city matching if coordinates aren't available
                const stateMatch = areaState?.toUpperCase() === leadLoc.state?.toUpperCase();
                const cityMatch = areaCity?.toLowerCase().trim() === leadLoc.city?.toLowerCase().trim();
                
                if (stateMatch && (cityMatch || areaRadius >= 50)) {
                  matchesServiceArea = true;
                  matchedArea = { city: areaCity, state: areaState, distance: cityMatch ? '0' : 'same state' };
                  console.log(`✅ Location match (fallback): "${lead.title}" matches ${areaCity}, ${areaState} (${cityMatch ? 'same city' : 'same state'})`);
                  break;
                }
              }
            }
            
            if (!matchesServiceArea) {
              // Detailed logging for why lead was filtered
              const areaSummary = serviceAreas.map(area => {
                const dist = area.lat && area.lng && leadLoc.lat && leadLoc.lng 
                  ? distanceMi({ lat: area.lat, lng: area.lng }, { lat: leadLoc.lat, lng: leadLoc.lng }).toFixed(1)
                  : 'unknown';
                return `${area.city}, ${area.state} (${area.radiusMi || 25}mi radius, ${dist}mi away)`;
              }).join('; ');
              console.log(`❌ Location filter: "${lead.title}" in ${leadLoc.city}, ${leadLoc.state} doesn't match any service area`);
              console.log(`   📍 Service areas checked: ${areaSummary}`);
              console.log(`   📍 Lead coordinates: ${leadLoc.lat && leadLoc.lng ? `(${leadLoc.lat}, ${leadLoc.lng})` : 'NOT SET - NEEDS GEOCODING'}`);
              return false;
            } else {
              console.log(`✅ Location match: "${lead.title}" matches ${matchedArea?.city}, ${matchedArea?.state} service area (${matchedArea?.distance} miles, within ${serviceAreas.find(a => a.city === matchedArea?.city)?.radiusMi || 25} mile radius)`);
              console.log(`✅ Trade match: "${lead.trade}" matches selected trades for lead "${lead.title}"`);
            }
          }
        } else {
          console.log(`✅ Trade match: "${lead.trade}" matches selected trades for lead "${lead.title}"`);
        }
        
        // Filter by budget range if contractor has budget preferences
        if (contractorProfile.budget) {
          const leadBudgetMin = lead.project?.budgetMin || 0;
          const leadBudgetMax = lead.project?.budgetMax || leadBudgetMin;
          const contractorMin = contractorProfile.budget.min || 0;
          const contractorMax = contractorProfile.budget.max || Infinity;
          
          // Strict budget filtering: Only show leads where the ENTIRE budget range is within contractor's range
          // This means:
          // - Lead's minimum must be >= contractor's minimum
          // - Lead's maximum must be <= contractor's maximum
          // This ensures leads with budgets that extend outside the contractor's range are filtered out
          const leadMinWithinRange = leadBudgetMin >= contractorMin;
          const leadMaxWithinRange = leadBudgetMax <= contractorMax;
          const budgetMatches = leadMinWithinRange && leadMaxWithinRange;
          
          if (!budgetMatches) {
            const reasons = [];
            if (!leadMinWithinRange) reasons.push(`min ($${leadBudgetMin.toLocaleString()}) < contractor min ($${contractorMin.toLocaleString()})`);
            if (!leadMaxWithinRange) reasons.push(`max ($${leadBudgetMax.toLocaleString()}) > contractor max ($${contractorMax.toLocaleString()})`);
            console.log(`❌ Budget filter: Lead budget $${leadBudgetMin.toLocaleString()}-$${leadBudgetMax.toLocaleString()} doesn't fit within contractor range $${contractorMin.toLocaleString()}-$${contractorMax.toLocaleString()} for lead "${lead.title}"`);
            console.log(`   📊 Reasons: ${reasons.join(', ')}`);
            return false;
          } else {
            console.log(`✅ Budget match: Lead $${leadBudgetMin.toLocaleString()}-$${leadBudgetMax.toLocaleString()} fits within contractor range $${contractorMin.toLocaleString()}-$${contractorMax.toLocaleString()} for lead "${lead.title}"`);
          }
        }
        
        return true;
      });
      
      // Combine campaign leads (always show) with filtered regular leads
      // Ensure all leads have aiScore for type safety
      personalizedLeads = [
        ...campaignLeads.map(l => ({ ...l, aiScore: l.aiScore || 0 })),
        ...filteredRegularLeads.map(l => ({ ...l, aiScore: l.aiScore || 0 }))
      ];
      console.log(`✅ Filtered regular leads: ${filteredRegularLeads.length} (${campaignLeads.length} campaign leads always shown)`);
    } else {
      // Even if trade filtering is off, still apply location and budget filters to regular leads only
      if (contractorProfile.location || contractorProfile.budget) {
        console.log(`🔍 Trade filtering OFF - applying location and budget filters to ${regularLeads.length} regular leads only...`);
        
        const filteredRegularLeads = regularLeads.filter(lead => {
          // Note: When trade filtering is OFF, we still apply location/budget filters
          // Minimum AI score is only applied as a soft preference (for sorting), not hard filter
          
          // Apply location filtering if configured
          if (lead.location && contractorProfile.location) {
            const leadLoc = lead.location;
            const prefsState = usePrefsStore.getState();
            const serviceAreas = prefsState.prefs.locations || [];
            
            if (serviceAreas.length > 0) {
              let matchesServiceArea = false;
              
              for (const serviceArea of serviceAreas) {
                const areaCity = serviceArea.city?.trim();
                const areaState = serviceArea.state?.trim();
                const areaRadius = serviceArea.radiusMi || 25;
                
                let areaCoords: { lat: number; lng: number } | null = null;
                
                if (serviceArea.lat && serviceArea.lng) {
                  areaCoords = { lat: serviceArea.lat, lng: serviceArea.lng };
                } else if (areaCity && areaState) {
                  areaCoords = geocodeCity(areaCity, areaState) || getStateCenter(areaState);
                }
                
                let leadCoords: { lat: number; lng: number } | null = null;
                
                if (leadLoc.lat && leadLoc.lng) {
                  leadCoords = { lat: leadLoc.lat, lng: leadLoc.lng };
                } else if (leadLoc.city && leadLoc.state) {
                  leadCoords = geocodeCity(leadLoc.city, leadLoc.state) || getStateCenter(leadLoc.state);
                }
                
                if (areaCoords && leadCoords && areaCoords.lat && areaCoords.lng && leadCoords.lat && leadCoords.lng) {
                  const distance = distanceMi(areaCoords, leadCoords);
                  if (distance <= areaRadius) {
                    matchesServiceArea = true;
                    break;
                  }
                } else {
                  const stateMatch = areaState?.toUpperCase() === leadLoc.state?.toUpperCase();
                  const cityMatch = areaCity?.toLowerCase().trim() === leadLoc.city?.toLowerCase().trim();
                  
                  if (stateMatch && (cityMatch || areaRadius >= 50)) {
                    matchesServiceArea = true;
                    break;
                  }
                }
              }
              
              if (!matchesServiceArea) {
                return false;
              }
            }
          }
          
          // Apply budget filtering if configured
          if (contractorProfile.budget) {
            const leadBudgetMin = lead.project?.budgetMin || 0;
            const leadBudgetMax = lead.project?.budgetMax || leadBudgetMin;
            const contractorMin = contractorProfile.budget.min || 0;
            const contractorMax = contractorProfile.budget.max || Infinity;
            
            const leadMinWithinRange = leadBudgetMin >= contractorMin;
            const leadMaxWithinRange = leadBudgetMax <= contractorMax;
            const budgetMatches = leadMinWithinRange && leadMaxWithinRange;
            
            if (!budgetMatches) {
              return false;
            }
          }
          
          return true;
        });
        
        // Combine campaign leads (always show) with filtered regular leads
        // Ensure all leads have aiScore for type safety
        personalizedLeads = [
          ...campaignLeads.map(l => ({ ...l, aiScore: l.aiScore || 0 })),
          ...filteredRegularLeads.map(l => ({ ...l, aiScore: l.aiScore || 0 }))
        ];
        console.log(`✅ Filtered regular leads: ${filteredRegularLeads.length} (${campaignLeads.length} campaign leads always shown)`);
        } else {
          // No filters at all - combine campaign and regular leads as-is
          // Minimum AI score is only used for sorting/prioritization, not hard filtering
          personalizedLeads = [
            ...campaignLeads.map(l => ({ ...l, aiScore: l.aiScore || 0 })),
            ...regularLeads.map(l => ({ ...l, aiScore: l.aiScore || 0 }))
          ];
          console.log(`✅ No filters applied - showing all ${campaignLeads.length} campaign leads + ${regularLeads.length} regular leads`);
        }
    }
    
    // Log filtering results
      console.log('🔍 Leads after filtering:', personalizedLeads.map(l => `${l.trade} (${l.title})`));
    const filteredOutCount = baseLeads.length - personalizedLeads.length;
    console.log(`🔍 Filtered from ${baseLeads.length} to ${personalizedLeads.length} leads`);
    
    // Detailed summary of filtering results
    if (filteredOutCount > 0) {
      console.log(`⚠️  ${filteredOutCount} lead(s) were filtered out`);
      console.log(`✅ ${personalizedLeads.length} lead(s) match your preferences`);
    } else {
      console.log(`✅ All ${personalizedLeads.length} lead(s) match your preferences - no filtering applied`);
    }
    
    // Show which service areas and budget range are active
    const prefsState = usePrefsStore.getState();
    const activeServiceAreas = prefsState.prefs.locations || [];
    const activeBudget = contractorProfile.budget;
    
    if (activeServiceAreas.length > 0) {
      console.log(`📍 Active service areas: ${activeServiceAreas.map(a => `${a.city}, ${a.state} (${a.radiusMi || 25}mi)`).join(' | ')}`);
    }
    
    if (activeBudget) {
      console.log(`💰 Active budget range: $${activeBudget.min?.toLocaleString() || '0'} - $${activeBudget.max?.toLocaleString() || '∞'}`);
    }
    
    if (activeServiceAreas.length > 0 || activeBudget) {
      const filters = [];
      if (activeServiceAreas.length > 0) filters.push('within your service areas');
      if (activeBudget) filters.push('fit your budget range');
      if (shouldFilterByTrade && contractorProfile.specificTrades && contractorProfile.specificTrades.length > 0) filters.push('match your selected trades');
      console.log(`💡 TIP: Leads will show up if they ${filters.join(' AND ')}`);
    }

    // Sort by AI score (highest first)
    return personalizedLeads.sort((a, b) => b.aiScore - a.aiScore);
  };

  const [reminderService] = useState(() => ReminderService.getInstance());

  // Load deleted lead IDs from AsyncStorage on mount
  useEffect(() => {
    const loadDeletedLeadIds = async () => {
      try {
        const storedIds = await AsyncStorage.getItem('deletedLeadIds');
        if (storedIds) {
          const parsedIds = JSON.parse(storedIds);
          setDeletedLeadIds(new Set(parsedIds));
          console.log(`📱 Loaded ${parsedIds.length} deleted lead IDs from storage:`, parsedIds);
        } else {
          console.log('📱 No deleted lead IDs found in storage');
        }
        setDeletedLeadIdsLoaded(true); // Mark as loaded regardless
      } catch (error) {
        console.error('Failed to load deleted lead IDs:', error);
        setDeletedLeadIdsLoaded(true); // Mark as loaded even on error
      }
    };
    loadDeletedLeadIds();
  }, []);

  // Function to load contractor profile data (extracted for reuse)
  const loadContractorProfileData = async () => {
    try {
      // Try multiple storage keys for contractor profile
      // Use usePrefsStore for preferences - it's the source of truth
      const { prefs: matchPrefs, hydrated: prefsHydrated } = usePrefsStore.getState();
      
      if (prefsHydrated && matchPrefs) {
        console.log('📋 Loaded contractor preferences from usePrefsStore:', matchPrefs);
        
        // Build contractor profile from unified preferences store
        const contractorProfileData = {
          tradeTypes: matchPrefs.trades || [],
          specificTrades: matchPrefs.specificTrades || [],
          zipCodes: [], // Zip codes not stored in MatchLocation, would need separate storage
          location: matchPrefs.locations?.[0] ? {
            city: matchPrefs.locations[0].city,
            state: matchPrefs.locations[0].state,
            serviceRadius: matchPrefs.locations[0].radiusMi || 25,
          } : {
            city: 'Las Vegas', // Default fallback
            state: 'NV',
            serviceRadius: 25,
          },
          budget: matchPrefs.priceRange || { min: 5000, max: 500000 },
          preferredTimelines: matchPrefs.timelineAllowed || [],
          filterByTrade: matchPrefs.filterByTrade || false,
          minAIScore: matchPrefs.minAIScore || 50,
        };
        
        console.log('📊 Built contractor profile from preferences:', contractorProfileData);
        console.log('💰 Budget from matchPrefs.priceRange:', matchPrefs.priceRange);
        console.log('💰 Budget in contractorProfileData:', contractorProfileData.budget);
        console.log('🔍 specificTrades:', contractorProfileData.specificTrades);
        console.log('🔍 trades:', contractorProfileData.tradeTypes);
        console.log('🔍 Filter by trade:', contractorProfileData.filterByTrade);
        setContractorProfile(contractorProfileData);
      } else {
        // Fallback to AsyncStorage if preferences store not hydrated yet
      const profileData = await AsyncStorage.getItem('bps.contractorProfile');
      const preferencesData = await AsyncStorage.getItem('@contractor-preferences');
      
      if (profileData) {
        const profile = JSON.parse(profileData);
          console.log('📋 Loaded contractor profile from AsyncStorage:', profile);
        setContractorProfile({
          tradeTypes: profile.tradeTypes || profile.trades || [],
            specificTrades: profile.specificTrades || [],
          zipCodes: profile.zipCodes || [],
          location: {
              city: profile.location?.city || profile.location?.split(',')[0]?.trim() || 'Las Vegas',
              state: profile.location?.state || profile.location?.split(',')[1]?.trim() || 'NV',
            serviceRadius: profile.serviceRadius || 25,
          },
          budget: {
            min: profile.budgetMin || profile.budget?.min || 5000,
            max: profile.budgetMax || profile.budget?.max || 500000,
          },
            preferredTimelines: profile.preferredTimelines || [],
            filterByTrade: profile.filterByTrade || false,
        });
        } else if (preferencesData) {
          const prefs = JSON.parse(preferencesData);
          console.log('📋 Loaded contractor preferences from AsyncStorage:', prefs);
          
          const contractorProfileData = {
            tradeTypes: prefs.tradeTypes ? Object.keys(prefs.tradeTypes).filter((t: string) => prefs.tradeTypes[t]) : [],
            specificTrades: prefs.specificTrades || [],
            zipCodes: prefs.zipCodes || [],
            location: {
              city: prefs.serviceAreas?.[0]?.city || 'Las Vegas',
              state: prefs.serviceAreas?.[0]?.state || 'NV',
              serviceRadius: prefs.serviceAreas?.[0]?.radius || 25,
            },
            budget: prefs.priceRange || { min: 5000, max: 500000 },
            preferredTimelines: prefs.leadMatching?.preferredTimelines || [],
            filterByTrade: prefs.leadMatching?.filterByTrade || false,
          };
          
          console.log('📊 Built contractor profile from AsyncStorage:', contractorProfileData);
          setContractorProfile(contractorProfileData);
        } else {
        console.log('ℹ️ No contractor profile found, using default values');
        setContractorProfile({
          tradeTypes: [],
          specificTrades: [],
          zipCodes: [],
            location: { city: 'Las Vegas', state: 'NV', serviceRadius: 25 },
            budget: { min: 5000, max: 500000 },
            preferredTimelines: ['Urgent', 'Soon', 'Normal', 'Flexible'],
          filterByTrade: false,
        });
        }
      }
    } catch (error) {
      console.error('Failed to load contractor profile:', error);
    }
  };

  // Load contractor profile from preferences store when preferences are hydrated or change
  useEffect(() => {
    if (!prefsHydrated) {
      console.log('⏳ Waiting for preferences to hydrate...');
      return;
    }
    
    console.log('🔄 Loading contractor profile from preferences store...');
    console.log('📋 Current preferences:', {
      trades: prefs.trades,
      specificTrades: prefs.specificTrades,
      locations: prefs.locations,
      filterByTrade: prefs.filterByTrade,
      priceRange: prefs.priceRange,
    });
    
    // Build contractor profile from unified preferences store
    const contractorLoc = prefs.locations?.[0] ? {
      city: prefs.locations[0].city,
      state: prefs.locations[0].state,
      serviceRadius: prefs.locations[0].radiusMi || 25,
      lat: prefs.locations[0].lat,
      lng: prefs.locations[0].lng,
    } : {
      city: 'Las Vegas',
      state: 'NV',
      serviceRadius: 25,
      lat: undefined,
      lng: undefined,
    };
    
    // Get coordinates - prioritize stored, then geocode, then state center
    let contractorCoords: { lat: number; lng: number };
    if (contractorLoc.lat && contractorLoc.lng) {
      contractorCoords = { lat: contractorLoc.lat, lng: contractorLoc.lng };
    } else {
      const geocoded = geocodeCity(contractorLoc.city, contractorLoc.state);
      contractorCoords = geocoded || getStateCenter(contractorLoc.state);
    }
    
    const contractorProfileData = {
      tradeTypes: prefs.trades || [],
      specificTrades: prefs.specificTrades || [],
      zipCodes: [], // Zip codes not stored in MatchLocation, would need separate storage
      location: {
        ...contractorLoc,
        lat: contractorCoords.lat,
        lng: contractorCoords.lng,
      },
      budget: prefs.priceRange || { min: 5000, max: 500000 },
      preferredTimelines: prefs.timelineAllowed || [],
      filterByTrade: prefs.filterByTrade || false,
      minAIScore: prefs.minAIScore || 50,
    };
    
    console.log('📊 Built contractor profile:', contractorProfileData);
    console.log('💰 Budget range:', contractorProfileData.budget);
    console.log('💰 Budget from prefs.priceRange:', prefs.priceRange);
    console.log('🔍 specificTrades count:', contractorProfileData.specificTrades?.length || 0);
    console.log('🔍 tradeTypes count:', contractorProfileData.tradeTypes?.length || 0);
    setContractorProfile(contractorProfileData);
  }, [
    prefsHydrated, 
    // Use JSON.stringify to detect array/object changes in dependencies
    JSON.stringify(prefs.trades), 
    JSON.stringify(prefs.specificTrades), 
    JSON.stringify(prefs.locations), 
    prefs.filterByTrade, 
    JSON.stringify(prefs.timelineAllowed),
    // Use specific properties to ensure changes are detected
    prefs.priceRange?.min,
    prefs.priceRange?.max,
    prefs.priceRange?.currency,
    prefs.minAIScore,
  ]);

  // Load saved leads data (including tasks and notes) from AsyncStorage on mount
  // Only load after contractor profile is loaded
  useEffect(() => {
    if (!contractorProfile) {
      console.log('⏳ Waiting for contractor profile to load before loading leads...');
      return;
    }
    const loadSavedLeadsData = async () => {
      try {
        const leadsData = await AsyncStorage.getItem('leadsData');
        let parsedLeads: Lead[] | null = null;
        if (leadsData) {
          try {
            const parsed = JSON.parse(leadsData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsedLeads = parsed;
            } else {
              console.log(
                '📱 leadsData is empty or not a non-empty array — treating as no cache (showing mocks until API load)'
              );
            }
          } catch (parseErr) {
            console.warn('📱 Failed to parse leadsData, will use mocks:', parseErr);
          }
        }

        if (parsedLeads && parsedLeads.length > 0) {
          console.log(`📱 Loaded ${parsedLeads.length} leads from AsyncStorage`);
          
          // Log task and note counts for verification
          parsedLeads.forEach((lead: Lead) => {
            if (lead.tasks && lead.tasks.length > 0) {
              console.log(`  📋 Lead ${lead.id} has ${lead.tasks.length} task(s)`);
            }
            if (lead.notes && lead.notes.length > 0) {
              console.log(`  📝 Lead ${lead.id} has ${lead.notes.length} note(s)`);
            }
          });
          
          // Apply personalized scoring to saved leads
          let rescoredSavedLeads = parsedLeads.map((lead: Lead) => {
            const newScore = contractorProfile ? scoreLead(lead, undefined, {
              ...contractorProfile,
              specificTrades: contractorProfile.specificTrades || [],
            }) : lead.aiScore || 0;
            return {
              ...lead,
              aiScore: newScore,
            };
          });
          
          // Apply filtering if enabled
          if (contractorProfile?.filterByTrade && contractorProfile.specificTrades && contractorProfile.specificTrades.length > 0) {
            rescoredSavedLeads = rescoredSavedLeads.filter((lead: Lead) => {
              if (contractorProfile.specificTrades!.includes(lead.trade)) {
                return true;
              }
              
              const hasMatch = contractorProfile.specificTrades!.some(specificTrade => {
                const leadTradeLower = lead.trade.toLowerCase();
                const specificTradeLower = specificTrade.toLowerCase();
                
                return leadTradeLower.includes(specificTradeLower) || 
                       specificTradeLower.includes(leadTradeLower) ||
                       (specificTradeLower === 'electrician' && leadTradeLower === 'electrical') ||
                       (specificTradeLower === 'painter' && leadTradeLower === 'painting') ||
                       (specificTradeLower === 'flooring installer' && leadTradeLower === 'flooring') ||
                       (specificTradeLower === 'carpenter' && (leadTradeLower.includes('framing') || leadTradeLower.includes('carpentry'))) ||
                       (specificTradeLower === 'landscaper' && leadTradeLower === 'landscaping') ||
                       (specificTradeLower === 'hvac technician' && leadTradeLower === 'hvac');
              });
              
              return hasMatch;
            });
          }
          
          // Apply personalization and set leads (use rescored list for consistent scores)
          const personalizedLeads = getPersonalizedLeads(rescoredSavedLeads);
          if (personalizedLeads.length === 0 && rescoredSavedLeads.length > 0) {
            console.warn('⚠️ Saved leads all filtered by preferences; showing rescored list without strict filter pass');
            setLeads(rescoredSavedLeads);
          } else {
            setLeads(personalizedLeads);
          }
        } else {
          console.log('📱 No usable saved leads data found, using mock data with personalized scoring');
          // Load mock leads with personalized scoring
          if (contractorProfile) {
            let mockLeadsWithScoring = mockLeads.map(lead => {
              const newScore = scoreLead(lead, undefined, {
                ...contractorProfile,
                specificTrades: contractorProfile.specificTrades || [],
              });
              return {
                ...lead,
                aiScore: newScore,
              };
            });
            
            // Apply filtering if enabled
            if (contractorProfile.filterByTrade && contractorProfile.specificTrades && contractorProfile.specificTrades.length > 0) {
              mockLeadsWithScoring = mockLeadsWithScoring.filter(lead => {
                if (contractorProfile.specificTrades!.includes(lead.trade)) {
                  return true;
                }
                
                const hasMatch = contractorProfile.specificTrades!.some(specificTrade => {
                  const leadTradeLower = lead.trade.toLowerCase();
                  const specificTradeLower = specificTrade.toLowerCase();
                  
                  return leadTradeLower.includes(specificTradeLower) || 
                         specificTradeLower.includes(leadTradeLower) ||
                         (specificTradeLower === 'electrician' && leadTradeLower === 'electrical') ||
                         (specificTradeLower === 'painter' && leadTradeLower === 'painting') ||
                         (specificTradeLower === 'flooring installer' && leadTradeLower === 'flooring') ||
                         (specificTradeLower === 'carpenter' && (leadTradeLower.includes('framing') || leadTradeLower.includes('carpentry'))) ||
                         (specificTradeLower === 'landscaper' && leadTradeLower === 'landscaping') ||
                         (specificTradeLower === 'hvac technician' && leadTradeLower === 'hvac');
                });
                
                return hasMatch;
              });
            }
            
            let sortedMockLeads = mockLeadsWithScoring.sort((a, b) => b.aiScore - a.aiScore);
            if (sortedMockLeads.length === 0) {
              console.warn(
                '⚠️ Match prefs filtered out all demo leads; showing full demo list until API load completes — open Match Prefs to widen trades.'
              );
              sortedMockLeads = mockLeads
                .map((lead) => ({
                  ...lead,
                  aiScore: contractorProfile ? scoreLead(lead, undefined, { ...contractorProfile, specificTrades: contractorProfile.specificTrades || [] }) : lead.aiScore || 0,
                }))
                .sort((a, b) => b.aiScore - a.aiScore);
            }
            setLeads(sortedMockLeads);
          } else {
            // Load mock leads without personalized scoring as fallback
            const sortedMockLeads = mockLeads.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
            setLeads(sortedMockLeads);
          }
        }
      } catch (error) {
        console.error('Failed to load saved leads data:', error);
      }
    };

    if (contractorProfile) {
    loadSavedLeadsData();
    }
  }, [contractorProfile]);

  // Initialize reminder service
  useEffect(() => {
    reminderService.initialize();
  }, [reminderService]);

  // Re-apply personalization when contractor profile changes OR when preferences change
  // Use JSON.stringify to ensure array/object changes are detected
  useEffect(() => {
    if (contractorProfile && leads.length > 0) {
      console.log('🔄 Contractor profile or preferences changed, re-applying personalization...');
      console.log('📊 Contractor profile:', {
        specificTrades: contractorProfile.specificTrades,
        tradeTypes: contractorProfile.tradeTypes,
        budget: contractorProfile.budget,
        location: contractorProfile.location,
        preferredTimelines: contractorProfile.preferredTimelines,
      });
      setLeads((prev) => {
        const personalizedLeads = getPersonalizedLeads(prev);
        if (personalizedLeads.length === 0 && prev.length > 0) {
          console.warn(
            '⚠️ Re-apply personalization would hide all leads (strict filters). Keeping previous list — adjust Match Prefs or clear filters.'
          );
          return prev;
        }
        console.log(
          '📊 Scores after personalization:',
          personalizedLeads.slice(0, 5).map((l) => `${l.title}: ${l.aiScore} (trade: ${l.trade})`)
        );
        return personalizedLeads;
      });
    }
  }, [
    contractorProfile, 
    // Use JSON.stringify to detect array/object changes
    JSON.stringify(prefs.trades), 
    JSON.stringify(prefs.specificTrades), 
    prefs.filterByTrade,
    JSON.stringify(prefs.locations),
    // Include priceRange properties to trigger re-filtering when budget changes
    prefs.priceRange?.min,
    prefs.priceRange?.max,
    prefs.priceRange?.currency,
    prefs.minAIScore,
  ]);

  // Save deleted lead IDs to AsyncStorage whenever they change
  useEffect(() => {
    const saveDeletedLeadIds = async () => {
      try {
        await AsyncStorage.setItem('deletedLeadIds', JSON.stringify(Array.from(deletedLeadIds)));
        console.log(`💾 Saved ${deletedLeadIds.size} deleted lead IDs to storage`);
      } catch (error) {
        console.error('Failed to save deleted lead IDs:', error);
      }
    };
    if (deletedLeadIds.size > 0) {
      saveDeletedLeadIds();
    }
  }, [deletedLeadIds]);

  // Load leads from API once after deletedLeadIds + contractor profile are ready (do not skip because mock cache filled the list).
  useEffect(() => {
    console.log(
      '🔄 useEffect for loadLeads triggered - deletedLeadIdsLoaded:',
      deletedLeadIdsLoaded,
      'bootstrapDone:',
      apiLeadsBootstrapDoneRef.current,
      'contractorProfile:',
      !!contractorProfile
    );
    if (!deletedLeadIdsLoaded || !contractorProfile || apiLeadsBootstrapDoneRef.current) {
      console.log('⏳ Waiting for API bootstrap prerequisites or already bootstrapped');
      return;
    }
    apiLeadsBootstrapDoneRef.current = true;
    console.log('🔄 Initial API load of leads (unified + marketplace + invites)...');
    const timer = setTimeout(() => {
      loadLeads();
    }, 100);
    return () => clearTimeout(timer);
  }, [deletedLeadIdsLoaded, contractorProfile]);

  const loadLeads = async (opts?: { force?: boolean }) => {
    // Prevent multiple simultaneous loads
    if (isLoadingLeads && !opts?.force) {
      console.log('⏳ Already loading leads, skipping...');
      return;
    }
    
    console.log('🔄 loadLeads called - this will reset leads to original data!');
    console.log('🔍 Stack trace for loadLeads call:', new Error().stack?.split('\n').slice(1, 5).join('\n'));

    try {
      setIsLoadingLeads(true);
      setLoading(true);
      setError(null);
      
      console.log('🚀 Starting to load leads...');
      
      // Fetch user's own subcontractor requests (Sub Needs) FIRST
      // Get actual user ID from authentication
      const authState = clerkAuthService.getAuthState();
      const userId = authState.user?.id || authState.user?.email || 'contractor-demo';
      console.log(`👤 Using user ID for leads: ${userId}`);
      let userRequests: Lead[] = [];
      
      try {
        // Disable caching to always get fresh data
        const apiUrl = `${resolveBackendRestApiBaseUrl()}/project-leads/my-requests/${encodeURIComponent(userId)}`;
        console.log(`🔍 Fetching user requests from: ${apiUrl}`);
        const requestsResponse = await fetch(apiUrl, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          cache: 'no-store'
        });
        
        console.log(`📡 User requests API response status: ${requestsResponse.status}`);
        
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          console.log(`✅ Fetched ${requestsData.requests?.length || 0} user requests (Sub Needs)`);
          console.log(`📋 Full API response:`, JSON.stringify(requestsData, null, 2));
          if (requestsData.requests && requestsData.requests.length > 0) {
            console.log(`📋 Sample request titles:`, requestsData.requests.slice(0, 3).map((r: any) => r.title));
            console.log(`📋 Sample request projectIds:`, requestsData.requests.slice(0, 3).map((r: any) => r.projectId));
          } else {
            console.warn(`⚠️ API returned 0 user requests - this might be why campaign leads aren't showing`);
          }
          
          // Load campaigns from AsyncStorage to get contact info
          let campaigns: any[] = [];
          try {
            // Try both possible storage keys (in order)
            let storedCampaigns = await AsyncStorage.getItem('subcontractorCampaigns');
            if (!storedCampaigns) {
              storedCampaigns = await AsyncStorage.getItem('@subcontractor_campaigns');
            }
            if (storedCampaigns) {
              campaigns = JSON.parse(storedCampaigns);
            }
          } catch (err) {
            console.error('⚠️ Could not load campaigns:', err);
          }
          
          // Convert user requests to Lead format with PROJECT_BASED source
          // Use all requests, but extract base ID for display (remove contractor suffix)
          const baseRequests = (requestsData.requests || []).map((req: any) => ({
            ...req,
            // Extract base ID by removing contractor suffix if present
            id: req.id.includes('-contractor-') ? req.id.split('-contractor-')[0] : req.id
          }));
          
          console.log(`🔍 Processing ${baseRequests.length} user requests. Sample request data:`, baseRequests.length > 0 ? {
            id: baseRequests[0].id,
            title: baseRequests[0].title,
            projectId: baseRequests[0].projectId,
            hasProjectId: !!baseRequests[0].projectId,
            projectIdType: typeof baseRequests[0].projectId
          } : 'No requests');
          
          userRequests = baseRequests.map((req: any) => {
            // Check if this is from a campaign
            console.log(`🔍 Checking request "${req.title}": projectId="${req.projectId || 'undefined/null'}", type=${typeof req.projectId}`);
            const isFromCampaign = req.projectId?.startsWith?.('CAMPAIGN-') || false;
            console.log(`🔍 Is from campaign: ${isFromCampaign} for "${req.title}"`);
            
            // Find matching campaign by extracting campaign ID from projectId
            let campaignEmail = 'your-email@example.com';
            let campaignPhone = '555-000-0000';
            let campaignContactName = 'My Campaign';
            let campaignCompanyName = 'Self';
            
            if (isFromCampaign && req.projectId) {
              // Extract campaign ID from projectId (format: CAMPAIGN-campaign-{id})
              const campaignIdMatch = req.projectId.match(/CAMPAIGN-campaign-(.+)/);
              
              if (campaignIdMatch && campaignIdMatch[1]) {
                const campaignId = `campaign-${campaignIdMatch[1]}`;
                const matchingCampaign = campaigns.find(c => c.id === campaignId);
                
                if (matchingCampaign) {
                  campaignEmail = matchingCampaign.email || campaignEmail;
                  campaignPhone = matchingCampaign.phone || campaignPhone;
                  campaignContactName = matchingCampaign.contactName || matchingCampaign.companyName || 'My Campaign';
                  campaignCompanyName = matchingCampaign.companyName || campaignCompanyName;
                  console.log(`✅ Found matching campaign "${campaignCompanyName}" for lead "${req.title}"`);
                } else {
                  console.warn(`⚠️ Campaign lead "${req.title}" has projectId "${req.projectId}" but no matching campaign found in storage. Campaign ID looked for: "${campaignId}". Available campaigns:`, campaigns.map(c => c.id));
                  // Keep default "My Campaign" since no match found
                }
              } else {
                console.warn(`⚠️ Campaign lead "${req.title}" has projectId "${req.projectId}" but couldn't extract campaign ID`);
              }
            }
            
            const mappedLead = {
            id: req.id,
            title: req.title,
            trade: req.trade,
              projectId: req.projectId || undefined, // Preserve projectId (should have CAMPAIGN- prefix if from campaign)
            source: 'PROJECT_BASED', // This will show up in "Sub Needs" filter
            contact: {
                name: isFromCampaign ? campaignContactName : 'Your Request',
                company: isFromCampaign ? campaignCompanyName : 'Self',
                email: isFromCampaign ? campaignEmail : 'your-email@example.com',
                phone: isFromCampaign ? campaignPhone : '555-000-0000',
            },
            location: {
              city: req.city,
              state: req.state,
              zip: '00000',
              lat: 40.7608,
              lng: -111.8910,
            },
            project: {
              type: 'other',
              budgetMin: req.budgetMin,
              budgetMax: req.budgetMax,
              timeline: req.timeline,
            },
            stage: req.status === 'pending' ? 'new' : req.status === 'matched' ? 'contacted' : req.status,
            aiScore: 85,
            verified: true,
            description: req.description,
            verification: {
              emailValid: true,
              phoneValid: true,
            },
            createdBy: userId,
            createdAt: req.createdAt,
            // Mark as user's own request
            isOwnRequest: true,
            matchedContractors: req.matchedContractors,
            };
            
            console.log(`✅ Mapped lead "${mappedLead.title}": projectId="${mappedLead.projectId || 'undefined/null'}", isCampaign=${mappedLead.projectId?.startsWith('CAMPAIGN-') || false}`);
            return mappedLead;
          });
          
          console.log(`🔍 Mapped ${userRequests.length} user requests from ${baseRequests.length} base requests`);
        } else {
          console.warn(`⚠️ User requests API returned status ${requestsResponse.status}`);
          try {
            const errorText = await requestsResponse.text();
            console.warn(`⚠️ Error response:`, errorText);
          } catch (textError) {
            console.warn(`⚠️ Could not read error response`);
          }
        }
      } catch (err) {
        // Network errors are expected when backend is not running - don't crash the app
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn('⚠️ Could not fetch user requests (backend may be offline):', errorMessage);
        // Continue without user requests - don't block the app
      }

      // Fetch bid invitations (Invites)
      let inviteLeads: Lead[] = [];
      try {
        const invitesResponse = await fetch(`${resolveBackendRestApiBaseUrl()}/bid-invitations/contractor/${encodeURIComponent(userId)}`);
        if (invitesResponse.ok) {
          const invitesData = await invitesResponse.json();
          console.log(`✅ Fetched ${invitesData.invitations?.length || 0} bid invitations`);
          
          inviteLeads = (invitesData.invitations || []).map((invite: any) => ({
            id: invite.id,
            title: invite.title,
            trade: invite.trade,
            projectId: invite.projectId,
            source: 'BID_INVITATION',
            contact: {
              name: invite.contact?.name || 'GC Contact',
              company: invite.contact?.company || 'General Contractor',
              email: invite.contact?.email || 'gc@example.com',
              phone: invite.contact?.phone || '555-000-0000',
            },
            location: {
              city: invite.location?.city || 'Unknown',
              state: invite.location?.state || 'Unknown',
              zip: invite.location?.zip || '00000',
              lat: invite.location?.lat || 40.7608,
              lng: invite.location?.lng || -111.8910,
            },
            project: {
              type: invite.project?.type || 'other',
              budgetMin: invite.project?.budgetMin || 0,
              budgetMax: invite.project?.budgetMax || 0,
              timeline: invite.project?.timeline || 'Normal',
            },
            stage: invite.stage || 'new',
            aiScore: invite.aiScore || 85,
            verified: invite.verified || true,
            createdAt: invite.createdAt,
            description: invite.description,
            deadline: invite.deadline,
            invitationMessage: invite.invitationMessage,
          }));
        } else if (invitesResponse.status === 429) {
          console.log('⏳ Rate limited on bid invitations, skipping...');
        } else {
          console.warn('Failed to fetch bid invitations:', invitesResponse.status);
        }
      } catch (err) {
        console.log('⚠️ Could not fetch bid invitations:', err);
      }

      // Fetch marketplace leads
      let marketplaceLeads: Lead[] = [];
      try {
        const marketplaceResponse = await fetch(`${resolveBackendRestApiBaseUrl()}/marketplace-leads`);
        if (marketplaceResponse.ok) {
          const marketplaceData = await marketplaceResponse.json();
          console.log(`✅ Fetched ${marketplaceData.leads?.length || 0} marketplace leads`);
          
          marketplaceLeads = (marketplaceData.leads || []).map((lead: any) => ({
            id: lead.id,
            title: lead.title,
            trade: lead.trade,
            projectId: lead.projectId,
            source: 'MARKETPLACE',
            contact: {
              name: lead.contact?.name || 'Customer',
              company: lead.contact?.company || null,
              email: lead.contact?.email || 'customer@example.com',
              phone: lead.contact?.phone || '555-000-0000',
            },
            location: {
              city: lead.location?.city || 'Unknown',
              state: lead.location?.state || 'Unknown',
              zip: lead.location?.zip || '00000',
              lat: lead.location?.lat || 40.7608,
              lng: lead.location?.lng || -111.8910,
            },
            project: {
              type: lead.project?.type || 'other',
              budgetMin: lead.project?.budgetMin || 0,
              budgetMax: lead.project?.budgetMax || 0,
              timeline: lead.project?.timeline || 'Normal',
            },
            stage: lead.stage || 'new',
            aiScore: lead.aiScore || 70,
            verified: lead.verified || false,
            createdAt: lead.createdAt,
            description: lead.description,
            marketplaceData: lead.marketplaceData,
          }));
        } else if (marketplaceResponse.status === 429) {
          console.log('⏳ Rate limited on marketplace leads, skipping...');
        } else {
          console.warn('Failed to fetch marketplace leads:', marketplaceResponse.status);
        }
      } catch (err) {
        console.log('⚠️ Could not fetch marketplace leads:', err);
      }

      // Create Auto Match leads (AI-powered matching)
      // NOTE: Only use auto-match leads if we don't have API leads
      let autoMatchLeads: Lead[] = [];
      
      // Check if we'll have API leads first (we'll fetch them next)
      // For now, we'll create auto-match leads, but we'll filter them out if API leads exist
      try {
        // For now, we'll create some demo auto-match leads
        // In production, this would come from an AI matching service
        const autoMatchData = [
          {
            id: 'AUTO-001',
            title: 'Kitchen Remodel - AI Matched',
            trade: 'General',
            source: 'AI_ESTIMATE',
            contact: {
              name: 'AI Matched Customer',
              company: null,
              email: 'ai-matched@example.com',
              phone: '555-AI-MATCH',
            },
            location: {
              city: 'Las Vegas',
              state: 'NV',
              zip: '89123',
              lat: 36.1699,
              lng: -115.1398,
            },
            project: {
              type: 'remodel',
              budgetMin: 25000,
              budgetMax: 40000,
              timeline: 'Soon',
            },
            stage: 'new',
            aiScore: 92,
            verified: true,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            description: 'AI-matched lead based on your profile and past projects. Complete kitchen renovation including cabinet installation, countertop replacement, flooring, and electrical work. Homeowner is looking for experienced contractor with kitchen remodel expertise. Project includes design consultation, material selection, and full installation. Must coordinate with other trades and provide detailed timeline.',
            autoMatchReason: 'High compatibility with your kitchen remodel experience',
          },
          {
            id: 'AUTO-002',
            title: 'Bathroom Renovation - AI Matched',
            trade: 'Plumbing',
            source: 'AI_ESTIMATE',
            contact: {
              name: 'AI Matched Customer',
              company: null,
              email: 'ai-matched@example.com',
              phone: '555-AI-MATCH',
            },
            location: {
              city: 'Salt Lake City',
              state: 'UT',
              zip: '84101',
              lat: 40.7608,
              lng: -111.8910,
            },
            project: {
              type: 'renovation',
              budgetMin: 15000,
              budgetMax: 25000,
              timeline: 'Normal',
            },
            stage: 'new',
            aiScore: 88,
            verified: true,
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
            description: 'AI-matched lead based on your plumbing expertise. Complete bathroom renovation including plumbing rough-in, fixture installation, tile work, and vanity setup. Master bathroom remodel with modern fixtures and finishes. Project includes plumbing layout, water line installation, drain work, and final fixture connections. Must coordinate with electrical and tile contractors.',
            autoMatchReason: 'Perfect match for your bathroom renovation skills',
          },
          {
            id: 'AUTO-003',
            title: 'HVAC Installation - AI Matched',
            trade: 'HVAC',
            source: 'AI_ESTIMATE',
            contact: {
              name: 'Sarah Johnson',
              company: 'Johnson Properties',
              email: 'sarah@johnsonprop.com',
              phone: '555-789-0123',
            },
            location: {
              city: 'Henderson',
              state: 'NV',
              zip: '89014',
              lat: 36.0395,
              lng: -114.9817,
            },
            project: {
              type: 'other',
              budgetMin: 15000,
              budgetMax: 22000,
              timeline: 'Soon',
            },
            stage: 'new',
            aiScore: 85,
            verified: true,
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
            description: 'AI-matched lead for HVAC system replacement. Residential HVAC system upgrade including new furnace, air conditioning unit, ductwork modifications, and thermostat installation. Home is 2,500 sq ft with existing ductwork that needs updating. Must include energy efficiency improvements and proper sizing calculations. Looking for licensed HVAC contractor with residential experience.',
            autoMatchReason: 'Matches your HVAC expertise and location',
          },
          {
            id: 'AUTO-004',
            title: 'Roofing Repair - AI Matched',
            trade: 'Roofing',
            source: 'AI_ESTIMATE',
            contact: {
              name: 'Mike Rodriguez',
              company: 'Rodriguez Construction',
              email: 'mike@rodriguezbuild.com',
              phone: '555-456-7890',
            },
            location: {
              city: 'North Las Vegas',
              state: 'NV',
              zip: '89030',
              lat: 36.1989,
              lng: -115.1175,
            },
            project: {
              type: 'other',
              budgetMin: 18000,
              budgetMax: 28000,
              timeline: 'Normal',
            },
            stage: 'new',
            aiScore: 78,
            verified: false,
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
            description: 'AI-matched lead for roof repair and maintenance',
            autoMatchReason: 'Good match for your roofing experience',
          },
          {
            id: 'AUTO-005',
            title: 'Electrical Upgrade - AI Matched',
            trade: 'Electrical',
            source: 'AI_ESTIMATE',
            contact: {
              name: 'Jennifer Lee',
              company: 'Lee Development',
              email: 'jennifer@leedev.com',
              phone: '555-321-6549',
            },
            location: {
              city: 'Boulder City',
              state: 'NV',
              zip: '89005',
              lat: 35.9786,
              lng: -114.8325,
            },
            project: {
              type: 'other',
              budgetMin: 12000,
              budgetMax: 18000,
              timeline: 'Urgent',
            },
            stage: 'new',
            aiScore: 91,
            verified: true,
            createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
            description: 'AI-matched lead for electrical panel upgrade',
            autoMatchReason: 'Excellent match for your electrical expertise',
          },
          {
            id: 'AUTO-006',
            title: 'Flooring Installation - AI Matched',
            trade: 'Flooring',
            source: 'AI_ESTIMATE',
            contact: {
              name: 'David Chen',
              company: 'Chen Homes',
              email: 'david@chenhomes.com',
              phone: '555-654-3210',
            },
            location: {
              city: 'Summerlin',
              state: 'NV',
              zip: '89134',
              lat: 36.1617,
              lng: -115.3242,
            },
            project: {
              type: 'remodel',
              budgetMin: 20000,
              budgetMax: 35000,
              timeline: 'Soon',
            },
            stage: 'new',
            aiScore: 82,
            verified: true,
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
            description: 'AI-matched lead for hardwood flooring installation',
            autoMatchReason: 'Great match for your flooring installation skills',
          },
          {
            id: 'AUTO-007',
            title: 'Painting Project - AI Matched',
            trade: 'Painting',
            source: 'AI_ESTIMATE',
            contact: {
              name: 'Lisa Martinez',
              company: 'Martinez Properties',
              email: 'lisa@martinezprop.com',
              phone: '555-987-6543',
            },
            location: {
              city: 'Paradise',
              state: 'NV',
              zip: '89169',
              lat: 36.0972,
              lng: -115.1467,
            },
            project: {
              type: 'other',
              budgetMin: 8000,
              budgetMax: 15000,
              timeline: 'Normal',
            },
            stage: 'new',
            aiScore: 75,
            verified: false,
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
            description: 'AI-matched lead for interior and exterior painting',
            autoMatchReason: 'Good match for your painting services',
          },
          {
            id: 'AUTO-008',
            title: 'Landscaping Design - AI Matched',
            trade: 'Landscaping',
            source: 'AI_ESTIMATE',
            contact: {
              name: 'Robert Wilson',
              company: 'Wilson Estates',
              email: 'robert@wilsonestates.com',
              phone: '555-147-2580',
            },
            location: {
              city: 'Green Valley',
              state: 'NV',
              zip: '89014',
              lat: 36.0429,
              lng: -115.0764,
            },
            project: {
              type: 'other',
              budgetMin: 25000,
              budgetMax: 45000,
              timeline: 'Soon',
            },
            stage: 'new',
            aiScore: 88,
            verified: true,
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
            description: 'AI-matched lead for complete landscape design and installation',
            autoMatchReason: 'Perfect match for your landscaping expertise',
          },
        ];
        
        autoMatchLeads = autoMatchData.map((lead: any) => ({
          ...lead,
          verification: {
            emailValid: true,
            phoneValid: true,
          },
        }));
        
        console.log(`✅ Created ${autoMatchLeads.length} AI auto-match leads`);
      } catch (err) {
        console.log('⚠️ Could not create auto-match leads:', err);
      }
      
      // Always fetch unified leads from API (these are the main leads)
      let testLeads: Lead[] = [];
      console.log(`🔍 Fetching unified leads from API...`);
      try {
        const testLeadsResponse = await testApiConnection();
        if (testLeadsResponse && Array.isArray(testLeadsResponse)) {
          // Filter out hardcoded demo leads from unified leads API
          testLeads = testLeadsResponse.filter(lead => !lead.id.startsWith('demo-'));
          console.log(`✅ Fetched ${testLeads.length} unified leads from API`);
          if (testLeads.length > 0) {
            console.log(`📋 Sample API lead IDs: ${testLeads.slice(0, 3).map(l => l.id).join(', ')}`);
          }
        } else {
          console.warn('⚠️ API returned invalid response (not an array)');
        }
      } catch (err) {
        console.warn('⚠️ Demo leads API failed:', err);
      }
      
      // If we have user requests, we still show API leads but user requests take priority
      if (userRequests.length > 0) {
        console.log(`📋 Also have ${userRequests.length} user requests (Sub Needs)`);
      }
      
      // Merge all lead sources - PRIORITIZE API LEADS
      // Only include mock leads and auto-match leads if we have NO API leads (testLeads is empty)
      const hasApiLeads = testLeads.length > 0;
      
      let allLeads: Lead[] = [];
      let stGeorgeMockLeads: Lead[] = [];
      let testLocationLeads: Lead[] = [];
      
      if (hasApiLeads) {
        allLeads = [...testLeads, ...userRequests, ...inviteLeads, ...marketplaceLeads];
        if (shouldMergeEmbeddedMockCatalog()) {
          const existingIds = new Set(allLeads.map((l) => l.id));
          const seedExtras = mockLeads.filter((l) => !existingIds.has(l.id));
          allLeads = [...allLeads, ...seedExtras];
          console.log(
            `🧪 Embedded seed catalog: merged ${seedExtras.length} L10xx demo leads with API (${testLeads.length} from API). Production: set EXPO_PUBLIC_INCLUDE_MOCK_LEADS=true; dev: set EXPO_PUBLIC_INCLUDE_MOCK_LEADS=false to disable.`
          );
        } else {
          console.log(
            `✅ Using API leads only (${testLeads.length}) — embedded L10xx seed not merged (enable with EXPO_PUBLIC_INCLUDE_MOCK_LEADS=true or run a dev build).`
          );
        }
      } else {
        // No API leads - use mock leads as fallback for testing
        console.log(`⚠️ No API leads found - using mock leads as fallback`);
        stGeorgeMockLeads = mockLeads.filter(lead => 
          lead.location?.city === 'St. George' && lead.location?.state === 'UT'
        );
        testLocationLeads = mockLeadsWithTest.filter(lead => 
          lead.id?.startsWith('TEST-')
        );
        allLeads = [...testLeads, ...userRequests, ...inviteLeads, ...marketplaceLeads, ...autoMatchLeads, ...stGeorgeMockLeads, ...testLocationLeads];
        
        if (stGeorgeMockLeads.length > 0) {
          console.log(`🏜️ Added ${stGeorgeMockLeads.length} St. George mock leads for location testing`);
        }
        if (testLocationLeads.length > 0) {
          testLocationLeads.forEach(lead => {
            const coords = lead.location?.lat && lead.location?.lng 
              ? `(${lead.location.lat}, ${lead.location.lng})` 
              : '(⚠️ NO COORDINATES - will use state center for distance calculation)';
            console.log(`🧪 TEST LEAD: "${lead.title}"`);
            console.log(`   📍 Location: ${lead.location?.city}, ${lead.location?.state}`);
            console.log(`   📍 Coordinates: ${coords}`);
            console.log(`   🎯 Trade: ${lead.trade}`);
            console.log(`   ✅ This lead should appear if ${lead.location?.city}, ${lead.location?.state} is in your service areas with appropriate radius`);
          });
        }
      }
      
      const uniqueLeads = allLeads.filter((lead, index, self) =>
        index === self.findIndex((l) => l.id === lead.id)
      );
      
      // Filter out deleted leads
      let visibleLeads = uniqueLeads.filter(lead => !deletedLeadIds.has(lead.id));
      
      // ROOT CAUSE FIX: If no leads were loaded and we have auto-match leads, ensure they're included
      if (visibleLeads.length === 0 && autoMatchLeads.length > 0) {
        console.warn('⚠️ No visible leads found, but we have auto-match leads. This should not happen!');
        console.warn(`⚠️ Debug: uniqueLeads=${uniqueLeads.length}, autoMatchLeads=${autoMatchLeads.length}, deletedLeadIds=${deletedLeadIds.size}`);
        // Force include auto-match leads even if something went wrong
        const autoMatchVisible = autoMatchLeads.filter(lead => !deletedLeadIds.has(lead.id));
        if (autoMatchVisible.length > 0) {
          console.warn(`⚠️ Using auto-match leads as fallback: ${autoMatchVisible.length} leads`);
          visibleLeads = [...visibleLeads, ...autoMatchVisible];
        }
      }
      
      // ROOT CAUSE FIX: If still no visible leads, use mock leads as last resort (API empty, or all IDs deleted/filtered)
      if (visibleLeads.length === 0) {
        if (hasApiLeads) {
          console.warn(
            '⚠️ API returned leads but none are visible (likely all marked deleted). Using mock leads as emergency fallback.'
          );
        } else {
          console.warn('⚠️ CRITICAL: No leads found after all sources! Using mock leads as emergency fallback.');
        }
        const mockVisible = mockLeads.filter(lead => !deletedLeadIds.has(lead.id));
        if (mockVisible.length > 0) {
          console.warn(`⚠️ Emergency fallback: Using ${mockVisible.length} mock leads`);
          visibleLeads = [...visibleLeads, ...mockVisible];
        }
      }
      
      console.log(`📊 FINAL visibleLeads count: ${visibleLeads.length} (before personalization)`);
      
      // Merge with saved local data (tasks and notes) from AsyncStorage
      try {
        const savedData = await AsyncStorage.getItem('leadsData');
        if (savedData) {
          const savedLeads = JSON.parse(savedData);
          console.log(`📦 Found ${savedLeads.length} saved leads in AsyncStorage...`);
          
          // IMPORTANT: Filter out old saved leads that don't exist in current API response
          // This prevents stale cached leads from appearing
          const visibleLeadIds = new Set(visibleLeads.map(l => l.id));
          const validSavedLeads = savedLeads.filter((l: Lead) => visibleLeadIds.has(l.id));
          
          if (validSavedLeads.length < savedLeads.length) {
            const removedCount = savedLeads.length - validSavedLeads.length;
            console.log(`🧹 Removing ${removedCount} stale cached leads that no longer exist in API`);
            // Update AsyncStorage to only keep valid leads
            await AsyncStorage.setItem('leadsData', JSON.stringify(validSavedLeads));
          }
          
          // Create a map of saved leads by ID for quick lookup (only valid ones)
          const savedLeadsMap = new Map(validSavedLeads.map((l: Lead) => [l.id, l]));
          
          // Load engagement data
          const { getAllEngagementData } = await import('../../services/engagementTracking');
          const engagementData = await getAllEngagementData();
          
          // Merge visible leads with saved data and engagement data, and re-score with contractor profile
          let mergedLeads = visibleLeads.map((lead: Lead) => {
            const savedLead = savedLeadsMap.get(lead.id) as Lead | undefined;
            const leadEngagement = engagementData[lead.id];
            
            // Re-score lead with contractor profile if available
            const personalizedScore = contractorProfile 
              ? scoreLead(lead, undefined, {
                  ...contractorProfile,
                  specificTrades: contractorProfile.specificTrades || [],
                })
              : lead.aiScore || 0;
            
            // Merge engagement data
            const mergedEngagement = leadEngagement ? {
              viewCount: leadEngagement.viewCount,
              responseCount: leadEngagement.responseCount,
              lastViewedAt: leadEngagement.lastViewedAt,
              yourLastResponseAt: leadEngagement.yourLastResponseAt,
              averageResponseTime: leadEngagement.averageResponseTime,
            } : lead.engagement;
            
            if (savedLead) {
              // Preserve local tasks, notes, and stage from saved data
              // BUT preserve contact info from lead (campaign contact info), not from saved data
              // Priority: savedLead.stage > lead.stage > 'new'
              const preservedStage = savedLead.stage || lead.stage || 'new';
              return {
                ...lead, // Keep the lead's contact info (which has campaign email/phone)
                tasks: savedLead.tasks || [],
                notes: savedLead.notes || [],
                stage: preservedStage, // Preserve stage from saved data (for AUTO-* leads and manual stage changes)
                aiScore: personalizedScore,
                engagement: mergedEngagement, // Include engagement data
                // Explicitly preserve contact info to prevent saved data from overriding it
                contact: lead.contact,
              };
            }
            // For leads without saved data, preserve their stage from backend/API (may have been updated)
            return {
              ...lead,
              stage: lead.stage || 'new', // Ensure stage exists, default to 'new' if missing
              aiScore: personalizedScore,
              engagement: mergedEngagement, // Include engagement data
            };
          });
          
          // Apply filtering if enabled
          if (contractorProfile?.filterByTrade && contractorProfile.specificTrades && contractorProfile.specificTrades.length > 0) {
            console.log('🔍 Applying filtering on lead merge...');
            mergedLeads = mergedLeads.filter(lead => {
              if (leadBypassesMatchPrefs(lead)) {
                console.log(`✅ Lead bypasses merge filter: "${lead.title}"`);
                return true;
              }
              
              // Check for exact match first
              if (contractorProfile.specificTrades!.includes(lead.trade)) {
                return true;
              }
              
              // Check for partial matches
              const hasMatch = contractorProfile.specificTrades!.some(specificTrade => {
                const leadTradeLower = lead.trade.toLowerCase();
                const specificTradeLower = specificTrade.toLowerCase();
                
                return leadTradeLower.includes(specificTradeLower) || 
                       specificTradeLower.includes(leadTradeLower) ||
                       (specificTradeLower === 'electrician' && leadTradeLower === 'electrical') ||
                       (specificTradeLower === 'painter' && leadTradeLower === 'painting') ||
                       (specificTradeLower === 'flooring installer' && leadTradeLower === 'flooring') ||
                       (specificTradeLower === 'carpenter' && (leadTradeLower.includes('framing') || leadTradeLower.includes('carpentry'))) ||
                       (specificTradeLower === 'landscaper' && leadTradeLower === 'landscaping') ||
                       (specificTradeLower === 'hvac technician' && leadTradeLower === 'hvac');
              });
              
              return hasMatch;
            });
            console.log(`🔍 Filtered on merge: ${visibleLeads.length} → ${mergedLeads.length} leads`);
          }
          
          console.log(`✅ Merged leads with saved tasks/notes - applying personalization`);
          const personalizedLeads = getPersonalizedLeads(mergedLeads);
          if (personalizedLeads.length === 0 && mergedLeads.length > 0) {
            console.error('❌ CRITICAL: All leads filtered out after merge (savedData path). Showing merge list without strict personalization.');
            setLeads(mergedLeads);
          } else {
            setLeads(personalizedLeads);
          }
        } else {
          console.log(`✅ No saved data to merge`);
          // Re-score leads with contractor profile if available
          let rescoredLeads = visibleLeads.map(lead => ({
            ...lead,
            aiScore: contractorProfile ? scoreLead(lead, undefined, {
              ...contractorProfile,
              specificTrades: contractorProfile.specificTrades || [],
            }) : lead.aiScore || 0,
          }));
          
          // Apply filtering if enabled
          if (contractorProfile?.filterByTrade && contractorProfile.specificTrades && contractorProfile.specificTrades.length > 0) {
            console.log('🔍 Applying filtering on lead refresh...');
            rescoredLeads = rescoredLeads.filter(lead => {
              if (leadBypassesMatchPrefs(lead)) {
                console.log(`✅ Lead bypasses refresh filter: "${lead.title}"`);
                return true;
              }
              
              // Check for exact match first
              if (contractorProfile.specificTrades!.includes(lead.trade)) {
                return true;
              }
              
              // Check for partial matches
              const hasMatch = contractorProfile.specificTrades!.some(specificTrade => {
                const leadTradeLower = lead.trade.toLowerCase();
                const specificTradeLower = specificTrade.toLowerCase();
                
                return leadTradeLower.includes(specificTradeLower) || 
                       specificTradeLower.includes(leadTradeLower) ||
                       (specificTradeLower === 'electrician' && leadTradeLower === 'electrical') ||
                       (specificTradeLower === 'painter' && leadTradeLower === 'painting') ||
                       (specificTradeLower === 'flooring installer' && leadTradeLower === 'flooring') ||
                       (specificTradeLower === 'carpenter' && (leadTradeLower.includes('framing') || leadTradeLower.includes('carpentry'))) ||
                       (specificTradeLower === 'landscaper' && leadTradeLower === 'landscaping') ||
                       (specificTradeLower === 'hvac technician' && leadTradeLower === 'hvac');
              });
              
              return hasMatch;
            });
            console.log(`🔍 Filtered on refresh: ${visibleLeads.length} → ${rescoredLeads.length} leads`);
          }

          const personalizedLeads = getPersonalizedLeads(rescoredLeads);
          console.log(`📊 After personalization: ${personalizedLeads.length} leads (input: ${rescoredLeads.length})`);
          if (personalizedLeads.length === 0 && rescoredLeads.length > 0) {
            console.error('❌ CRITICAL: All leads were filtered out by personalization! Showing rescored leads without extra filter pass.');
            setLeads(rescoredLeads);
          } else {
            setLeads(personalizedLeads);
          }
        }
      } catch (mergeError) {
        console.error('❌ Error merging saved data:', mergeError);
        const personalizedLeads = getPersonalizedLeads(visibleLeads);
        console.log(`📊 After personalization (error path): ${personalizedLeads.length} leads (input: ${visibleLeads.length})`);
        if (personalizedLeads.length === 0 && visibleLeads.length > 0) {
          console.error('❌ CRITICAL: All leads filtered out! Showing unfiltered leads.');
          setLeads(visibleLeads);
        } else {
          setLeads(personalizedLeads);
        }
      }
      
      console.log(`📱 Current deletedLeadIds:`, Array.from(deletedLeadIds));
      console.log(`📱 All lead IDs:`, uniqueLeads.map(l => l.id));
      console.log(`📱 Filtered out:`, uniqueLeads.filter(lead => deletedLeadIds.has(lead.id)).map(l => l.id));
      console.log(`📊 Lead sources breakdown: API=${testLeads.length}, userRequests=${userRequests.length}, invites=${inviteLeads.length}, marketplace=${marketplaceLeads.length}, autoMatch=${autoMatchLeads.length}, mock=${stGeorgeMockLeads.length}, test=${testLocationLeads.length}`);
      console.log(`✅ Loaded ${visibleLeads.length} visible leads (${uniqueLeads.length} total before filtering, ${deletedLeadIds.size} hidden)`);
      
      // CRITICAL CHECK: Warn if we have no leads
      if (visibleLeads.length === 0) {
        console.error('❌ CRITICAL ERROR: No leads will be displayed!');
        console.error(`❌ Breakdown: uniqueLeads=${uniqueLeads.length}, deletedLeadIds=${deletedLeadIds.size}, autoMatchLeads=${autoMatchLeads.length}`);
      }
    } catch (err) {
      console.error('❌ Error loading leads from API:', err);
      setError('Failed to load leads from API');
      // Use mock data as fallback - but apply personalized scoring
      console.log('⚠️ API failed, using mock data with personalized scoring...');
      let fallbackLeads = mockLeads.map(lead => {
        const newScore = contractorProfile ? scoreLead(lead, undefined, {
          ...contractorProfile,
          specificTrades: contractorProfile.specificTrades || [],
        }) : lead.aiScore || 0;
        return {
          ...lead,
          aiScore: newScore,
        };
      });
      
      // Apply filtering if enabled
      if (contractorProfile?.filterByTrade && contractorProfile.specificTrades && contractorProfile.specificTrades.length > 0) {
        fallbackLeads = fallbackLeads.filter(lead => {
          if (contractorProfile.specificTrades!.includes(lead.trade)) {
            return true;
          }
          
          const hasMatch = contractorProfile.specificTrades!.some(specificTrade => {
            const leadTradeLower = lead.trade.toLowerCase();
            const specificTradeLower = specificTrade.toLowerCase();
            
            return leadTradeLower.includes(specificTradeLower) || 
                   specificTradeLower.includes(leadTradeLower) ||
                   (specificTradeLower === 'electrician' && leadTradeLower === 'electrical') ||
                   (specificTradeLower === 'painter' && leadTradeLower === 'painting') ||
                   (specificTradeLower === 'flooring installer' && leadTradeLower === 'flooring') ||
                   (specificTradeLower === 'carpenter' && (leadTradeLower.includes('framing') || leadTradeLower.includes('carpentry'))) ||
                   (specificTradeLower === 'landscaper' && leadTradeLower === 'landscaping') ||
                   (specificTradeLower === 'hvac technician' && leadTradeLower === 'hvac');
          });
          
          return hasMatch;
        });
      }
      
      // Apply personalization to fallback leads
      const personalizedLeads = getPersonalizedLeads(fallbackLeads);
      setLeads(personalizedLeads);
    } finally {
      setLoading(false);
      setIsLoadingLeads(false);
    }
  };

  // Add debouncing to prevent too many API calls
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const DEBOUNCE_DELAY = 5000; // 5 seconds between loads

  // Sync leads to Zustand store for smart filtering
      // IMPORTANT: Sync ALL leads BEFORE filtering, so Zustand has the complete set
  useEffect(() => {
    if (leads.length > 0) {
      const rawLeads = leads.map(convertToLeadRaw);
      setAll(rawLeads);
          console.log(`📦 Synced ${rawLeads.length} leads to Zustand store (all leads, before filtering)`);
    }
  }, [leads, setAll]);

  // Use Zustand-scored leads when preferences are available
  useEffect(() => {
    if (hydrated && scoredLeads.length > 0 && prefs.filterByTrade) {
      console.log(`🎯 Using Zustand-scored leads: ${scoredLeads.length} leads (filterByTrade enabled)`);
    }
  }, [hydrated, scoredLeads.length, prefs.filterByTrade]);

  // Refresh leads when the page comes into focus (e.g., after creating a subcontractor request)
  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      const timeSinceLastLoad = now - lastLoadTime;
      
      console.log('🔄 Leads page focused, checking if refresh needed...');
      console.log(`⏰ Time since last load: ${timeSinceLastLoad}ms (min: ${DEBOUNCE_DELAY}ms)`);
      
      // First, try to sync any leads from AsyncStorage (in case estimate generator updated them)
      const syncLeadsFromStorage = async () => {
        try {
          const savedData = await AsyncStorage.getItem('leadsData');
          if (savedData && leads.length > 0) {
            const savedLeads: Lead[] = JSON.parse(savedData);
            const savedLeadsMap = new Map(savedLeads.map((l: Lead) => [l.id, l]));
            
            // Check if any saved leads have newer stages than current leads
            let hasUpdates = false;
            const updatedLeads = leads.map(lead => {
              const savedLead = savedLeadsMap.get(lead.id);
              if (savedLead && savedLead.stage !== lead.stage) {
                console.log(`🔄 Syncing lead ${lead.id} stage from AsyncStorage: ${lead.stage} → ${savedLead.stage}`);
                hasUpdates = true;
                return { 
                  ...lead, 
                  stage: savedLead.stage
                };
              }
              return lead;
            });
            
            if (hasUpdates) {
              console.log('✅ Synced lead stage updates from AsyncStorage');
              setLeads(updatedLeads);
            }
          }
        } catch (err) {
          console.warn('⚠️ Could not sync leads from AsyncStorage:', err);
        }
      };
      
      // Check if we need to force refresh (e.g., after bid submission)
      const checkAndRefresh = async () => {
        try {
          const savedData = await AsyncStorage.getItem('leadsData');
          let needsRefresh = false;
          
          if (savedData && leads.length > 0) {
            const savedLeads: Lead[] = JSON.parse(savedData);
            const savedLeadsMap = new Map(savedLeads.map((l: Lead) => [l.id, l]));
            // Check if any saved lead has a different stage than current lead
            needsRefresh = leads.some(lead => {
              const savedLead = savedLeadsMap.get(lead.id);
              return savedLead && savedLead.stage !== lead.stage;
            });
          }
          
          // Only load leads if deletedLeadIds have been loaded from AsyncStorage
          // AND (enough time has passed OR we detected stage changes that need refresh) AND not already loading
          const shouldRefresh = deletedLeadIdsLoaded && 
                               (timeSinceLastLoad >= DEBOUNCE_DELAY || needsRefresh) && 
                               !isLoadingLeads;
          
          if (shouldRefresh) {
            console.log('📱 Refreshing leads...', needsRefresh ? '(forced due to stage changes)' : '');
            setLastLoadTime(Date.now());
            loadLeads();
          } else if (!deletedLeadIdsLoaded) {
            console.log('⏳ Waiting for deleted lead IDs to load...');
          } else if (isLoadingLeads) {
            console.log('⏳ Already loading leads, skipping...');
          } else {
            console.log('⏳ Debouncing: Too soon since last load, skipping refresh');
          }
        } catch (err) {
          console.warn('⚠️ Error checking for refresh:', err);
          // Fallback: refresh if enough time has passed
          if (deletedLeadIdsLoaded && timeSinceLastLoad >= DEBOUNCE_DELAY && !isLoadingLeads) {
            setLastLoadTime(Date.now());
            loadLeads();
          }
        }
      };
      
      // Sync immediately if we have leads loaded
      if (leads.length > 0 && deletedLeadIdsLoaded) {
        syncLeadsFromStorage();
      }
      
      // Check and refresh if needed
      checkAndRefresh();
    }, [deletedLeadIdsLoaded, loadLeads, lastLoadTime, isLoadingLeads, leads])
  );

  const handleStageChange = async (lead: Lead, newStage: LeadStage) => {
    try {
      // VALIDATION: Ensure lead and stage are valid
      if (!lead || !lead.id) {
        console.error('❌ Invalid lead provided to handleStageChange:', lead);
        Alert.alert('Error', 'Invalid lead data. Please try again.');
        return;
      }
      
      // VALIDATION: Ensure newStage is a valid LeadStage
      const validStages: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'proposal-sent', 'won', 'lost', 'verified', 'quoted', 'negotiation', 'closed'];
      if (!validStages.includes(newStage)) {
        console.error('❌ Invalid stage provided:', newStage);
        Alert.alert('Error', `Invalid stage: ${newStage}. Please try again.`);
        return;
      }
      
      console.log(`🔄 Stage change: Lead ${lead.id} (${lead.title}) from "${lead.stage}" to "${newStage}"`);
      
      // Update locally first for immediate feedback
      const updatedLead = { ...lead, stage: newStage };
      
      // Check if this is a frontend-only lead (mock or AUTO leads)
      const isFrontendOnlyLead = lead.id.startsWith('AUTO-') || 
                                  lead.id.match(/^L\d{4}$/) || // Mock leads like L1001, L1014
                                  lead.id.startsWith('MOCK-');
      
      // Frontend-only leads: save to AsyncStorage only (no backend update)
      if (isFrontendOnlyLead) {
        console.log(`✅ Updating frontend-only lead ${lead.id} stage to ${newStage}`);
        // Update state and save to AsyncStorage in one call
        // CRITICAL: Always create a new array to ensure React detects the change
        setLeads(prevLeads => {
          // Defensive: Ensure prevLeads is an array
          if (!Array.isArray(prevLeads)) {
            console.warn('⚠️ prevLeads is not an array, using empty array');
            return [updatedLead];
          }
          
          const updatedLeads = prevLeads.map(l => l.id === lead.id ? updatedLead : l);
          
          // Validate the update was successful
          const foundLead = updatedLeads.find(l => l.id === lead.id);
          if (!foundLead || foundLead.stage !== newStage) {
            console.error('❌ Stage update failed - lead not found or stage not updated');
            console.error('Expected:', { id: lead.id, stage: newStage });
            console.error('Found:', foundLead);
            // Still return updated array to prevent UI freeze
          }
          
          // Save to AsyncStorage asynchronously for persistence
          AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads)).then(() => {
            console.log(`💾 Saved frontend-only lead stage change to AsyncStorage`);
          }).catch(storageErr => {
            console.error('❌ Could not save frontend-only lead stage to storage:', storageErr);
          });
          return updatedLeads;
        });
        
        // Also update selectedLead if it's the same lead (so modal reflects changes immediately)
        setSelectedLead(prevSelected => 
          prevSelected && prevSelected.id === lead.id ? updatedLead : prevSelected
        );
      } else {
        // Backend-managed leads: update state, persist to backend, AND save to AsyncStorage as backup
        // CRITICAL: Always create a new array to ensure React detects the change
        setLeads(prevLeads => {
          // Defensive: Ensure prevLeads is an array
          if (!Array.isArray(prevLeads)) {
            console.warn('⚠️ prevLeads is not an array in backend lead update, using empty array');
            return [updatedLead];
          }
          
          const updatedLeads = prevLeads.map(l => 
            l.id === lead.id ? updatedLead : l
          );
          
          // Validate the update was successful
          const foundLead = updatedLeads.find(l => l.id === lead.id);
          if (!foundLead || foundLead.stage !== newStage) {
            console.error('❌ Stage update failed - lead not found or stage not updated');
            console.error('Expected:', { id: lead.id, stage: newStage });
            console.error('Found:', foundLead);
            // Still return updated array to prevent UI freeze
          }
          
          // Save to AsyncStorage as backup (so stages persist even if backend restarts)
          AsyncStorage.getItem('leadsData').then(savedData => {
            const savedLeads = savedData ? JSON.parse(savedData) : [];
            const existingIndex = savedLeads.findIndex((l: Lead) => l.id === lead.id);
            
            if (existingIndex >= 0) {
              // Update existing saved lead with new stage
              savedLeads[existingIndex] = {
                ...savedLeads[existingIndex],
                stage: newStage,
              };
            } else {
              // Add new lead to saved data
              savedLeads.push({
                ...updatedLead,
                stage: newStage,
              });
            }
            
            AsyncStorage.setItem('leadsData', JSON.stringify(savedLeads)).then(() => {
              console.log(`💾 Saved backend lead stage change to AsyncStorage (backup) for ${lead.id}`);
            }).catch(storageErr => {
              console.error('❌ Could not save backend lead stage to storage:', storageErr);
            });
          }).catch(err => {
            console.error('❌ Error loading leadsData for backup save:', err);
          });
          
          return updatedLeads;
        });
        
        // Also update selectedLead if it's the same lead (so modal reflects changes immediately)
        setSelectedLead(prevSelected => 
          prevSelected && prevSelected.id === lead.id ? updatedLead : prevSelected
        );
        
        // Update on server for backend-managed leads (this persists to disk on backend)
        try {
          await unifiedLeadService.updateLeadStage(lead.id, newStage);
          console.log(`✅ Stage change persisted to backend for lead ${lead.id}`);
        } catch (backendError: any) {
          // If backend returns 404, the lead might not exist in backend (could be frontend-only)
          // But we've already updated locally, so we'll keep the local update
          if (backendError?.message?.includes('404')) {
            console.warn(`⚠️ Backend returned 404 for lead ${lead.id} - lead may not exist in backend. Keeping local update.`);
            // Don't revert - the local update is fine for frontend-only leads
          } else {
            // For other errors, throw to be caught by outer catch
            throw backendError;
          }
        }
      }
      
      // Provide haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('Error updating lead stage:', err);
      
      // Check if this is a frontend-only lead
      const isFrontendOnlyLead = lead.id.startsWith('AUTO-') || 
                                  lead.id.match(/^L\d{4}$/) || 
                                  lead.id.startsWith('MOCK-');
      
      // Only show error alert and revert for backend leads that aren't 404s
      if (!isFrontendOnlyLead && !(err instanceof Error && err.message.includes('404'))) {
        Alert.alert('Error', 'Failed to update lead stage. Please try again.');
        
        // Revert local change
        setLeads(prevLeads =>
          prevLeads.map(l =>
            l.id === lead.id ? { ...l, stage: lead.stage } : l
          )
        );
          
        // Also revert selectedLead
        setSelectedLead(prevSelected =>
          prevSelected && prevSelected.id === lead.id ? { ...prevSelected, stage: lead.stage } : prevSelected
        );
      } else {
        // For frontend-only leads or 404s, keep the local update (it's working fine locally)
        console.log(`✅ Keeping local stage update for frontend-only lead or 404 response`);
      }
    }
  };

  const handleLeadPress = (lead: Lead) => {
    console.log('🔍 ===== LEAD PRESSED =====');
    console.log('🔍 Lead pressed:', lead.title);
    console.log('🔍 Current leads count:', leads.length);
    console.log('🔍 Current contractor profile:', contractorProfile);
    console.log('🔍 Current leads AI scores:', leads.map(l => `${l.title}: ${l.aiScore}`));
    console.log('🔍 Current leads trades:', leads.map(l => l.trade));
    console.log('🔍 Stack trace for lead press:', new Error().stack?.split('\n').slice(1, 5).join('\n'));
    
    console.log('🔍 Setting selectedLead and opening modal...');
    setSelectedLead(lead);
    setShowLeadDetailModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('🔍 ===== LEAD PRESS COMPLETE =====');
  };


  const handleRefreshLeads = async () => {
    console.log('🔄 Refreshing leads (same path as initial load: unified + marketplace + invites + prefs)...');
    try {
      setDeletedLeadIds(new Set());
      await AsyncStorage.removeItem('deletedLeadIds');
      setLastLoadTime(0);
      await loadLeads({ force: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('✅ Leads refresh complete');
    } catch (error) {
      console.error('❌ Error refreshing leads:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSetReminder = async (leadId: string, reminderDate: Date, reminderNote: string) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      await reminderService.scheduleReminder({
        leadId,
        leadTitle: lead.title || (lead.contact?.name ?? 'Lead'),
        content: reminderNote || 'Follow up on this lead',
        scheduledDate: reminderDate,
      });

      console.log(`📅 Reminder scheduled for ${lead.title} at ${reminderDate.toLocaleString()}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error setting reminder:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to set reminder. Please try again.');
    }
  };

  const handleAddTask = async (leadId: string, task: string) => {
    try {
      console.log(`📋 Adding task for lead ${leadId}: ${task}`);
      
      const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: task,
        completed: false,
        createdAt: new Date().toISOString(),
        createdBy: 'current-user'
      };

      console.log('📋 New task created:', newTask);

      // Update the lead's tasks array and save to AsyncStorage
      setLeads(prevLeads => {
        console.log(`📋 Current leads count: ${prevLeads.length}`);
        const updatedLeads = prevLeads.map(lead => {
          if (lead.id === leadId) {
            const updatedLead = {
                ...lead,
                tasks: [
                  ...(lead.tasks || []),
                  newTask
                ]
            };
            console.log(`📋 Updated lead ${leadId} with task. New task count: ${updatedLead.tasks.length}`);
            return updatedLead;
          }
          return lead;
        });
        
        console.log(`📋 Saving ${updatedLeads.length} leads to AsyncStorage...`);
        // Save to AsyncStorage for persistence
        AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads))
          .then(() => {
            console.log('✅ Task saved to AsyncStorage successfully!');
            // Verify the save
            AsyncStorage.getItem('leadsData').then(saved => {
              const savedLeads = saved ? JSON.parse(saved) : [];
              const savedLead = savedLeads.find((l: Lead) => l.id === leadId);
              console.log(`📋 Verified: Lead ${leadId} now has ${savedLead?.tasks?.length || 0} task(s) in storage`);
            });
          })
          .catch(error => console.error('❌ Error saving task to storage:', error));
        
        return updatedLeads;
      });
      
      // Also update selectedLead if it's the same lead
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prevLead => {
          const updated = prevLead ? {
            ...prevLead,
            tasks: [
              ...(prevLead.tasks || []),
              newTask
            ]
          } : prevLead;
          console.log(`📋 Updated selectedLead with task. Task count: ${updated?.tasks?.length || 0}`);
          return updated;
        });
      }
      
      console.log(`✅ Task added for lead ${leadId}: ${task}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('❌ Error adding task:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save task. Please try again.');
    }
  };

  const handleToggleTask = async (leadId: string, taskId: string, completed: boolean) => {
    try {
      console.log(`🔄 Toggling task ${taskId} for lead ${leadId} to ${completed}`);
      
      // Find the task to get its current state and toggle it
      const targetLead = leads.find(lead => lead.id === leadId);
      if (!targetLead) {
        console.log('❌ Target lead not found');
        return;
      }
      
      if (!targetLead.tasks) {
        console.log('❌ No tasks found for this lead');
        return;
      }

      const task = targetLead.tasks.find(t => t.id === taskId);
      if (!task) {
        console.log('❌ Task not found');
        return;
      }

      console.log(`📝 Task found:`, task);

      // Update the lead's tasks array
      const updatedLeads = leads.map(lead => 
        lead.id === leadId 
          ? {
              ...lead,
              tasks: (lead.tasks || []).map(t => 
                t.id === taskId ? { ...t, completed, completedAt: completed ? new Date().toISOString() : undefined } : t
              )
            }
          : lead
      );
      
      setLeads(updatedLeads);
      
      // Also update selectedLead if it's the same lead - ensure new object reference
      if (selectedLead && selectedLead.id === leadId) {
        const updatedLead = updatedLeads.find(l => l.id === leadId);
        if (updatedLead) {
          console.log(`✅ Updating selectedLead with updated task`);
          // Force new object reference by spreading
          setSelectedLead({ ...updatedLead });
        }
      }

      // Save to AsyncStorage for persistence using current state
      try {
        const storageUpdated = updatedLeads.map(lead => 
          lead.id === leadId 
            ? {
                ...lead,
                tasks: (lead.tasks || []).map(t => 
                  t.id === taskId ? { ...t, completed, completedAt: completed ? new Date().toISOString() : undefined } : t
                )
              }
            : lead
        );
        await AsyncStorage.setItem('leadsData', JSON.stringify(storageUpdated));
        console.log('💾 Task toggle saved to AsyncStorage successfully');
      } catch (storageError) {
        console.error('Error saving task toggle to storage:', storageError);
      }
      
      console.log(`✅ Task ${completed ? 'completed' : 'uncompleted'} for lead ${leadId}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('❌ Error toggling task:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDeleteTask = async (leadId: string, taskId: string) => {
    try {
      console.log(`🗑️ Deleting task ${taskId} for lead ${leadId}`);
      
      // Find the target lead
      const targetLead = leads.find(lead => lead.id === leadId);
      if (!targetLead) {
        console.log('❌ Target lead not found');
        return;
      }
      
      if (!targetLead.tasks || targetLead.tasks.length === 0) {
        console.log('❌ No tasks found for this lead');
        return;
      }

      // Update the lead's tasks array - remove the task
      const updatedLeads = leads.map(lead => 
        lead.id === leadId 
          ? {
              ...lead,
              tasks: (lead.tasks || []).filter(t => t.id !== taskId)
            }
          : lead
      );
      
      setLeads(updatedLeads);
      
      // Also update selectedLead if it's the same lead
      if (selectedLead && selectedLead.id === leadId) {
        const updatedLead = updatedLeads.find(l => l.id === leadId);
        if (updatedLead) {
          console.log(`✅ Updating selectedLead after task deletion`);
          setSelectedLead({ ...updatedLead });
        }
      }

      // Save to AsyncStorage for persistence
      try {
        await AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads));
        console.log('💾 Task deletion saved to AsyncStorage successfully');
      } catch (storageError) {
        console.error('❌ Error saving task deletion to storage:', storageError);
      }
      
      console.log(`✅ Task deleted for lead ${leadId}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('❌ Error deleting task:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to delete task. Please try again.');
    }
  };

  const handleAddNote = async (leadId: string, note: string) => {
    try {
      const newNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: note,
        createdAt: new Date().toISOString(),
        createdBy: 'current-user'
      };

      // Update the lead's notes array and save to AsyncStorage
      setLeads(prevLeads => {
        const updatedLeads = prevLeads.map(lead => 
          lead.id === leadId 
            ? {
                ...lead,
                notes: [
                  ...(lead.notes || []),
                  newNote
                ]
              }
            : lead
        );
        
        // Save to AsyncStorage for persistence
        AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads))
          .then(() => console.log('💾 Note saved to AsyncStorage successfully'))
          .catch(error => console.error('Error saving note to storage:', error));
        
        return updatedLeads;
      });
      
      // Also update selectedLead if it's the same lead
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prevLead => 
          prevLead ? {
            ...prevLead,
            notes: [
              ...(prevLead.notes || []),
              newNote
            ]
          } : prevLead
        );
      }
      
      console.log(`📝 Note added for lead ${leadId}: ${note}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error adding note:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={[]} style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent={false} />
        
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={[
            styles.scrollContent,
            styles.scrollContentGrow,
            Platform.OS === 'web' && { paddingHorizontal: 0 },
          ]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          {...KEYBOARD_SCROLL_DEFAULTS}
        >
        <WebPageShell size="leads" scroll={false} contentStyle={{ paddingBottom: 0 }}>
          {/* Header */}
          <View style={[styles.headerRow, styles.wideContainer, { paddingTop: Math.max(insets.top, 0) + 20 }]}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.screenTitle}>Leads</Text>
              <Text style={styles.screenSubtitle}>
                {leads.length} total · Manage your pipeline
              </Text>
              {leadsViewMeta?.hasMoreInList && leads.length > 0 ? (
                <Text style={styles.screenHint}>
                  Showing {leadsViewMeta.renderedInList} of {leadsViewMeta.visibleInView} matching leads — scroll to the bottom and tap Show more below.
                </Text>
              ) : null}
              {leadsViewMeta?.filtersNarrowed && leads.length > 0 ? (
                <Text style={styles.screenHint}>
                  Showing {leadsViewMeta.visibleInView} of {leadsViewMeta.eligibleInLeadsTab} here — search or list filters are hiding the rest. Use Clear filters in the list.
                </Text>
              ) : null}
              {campaignLeadCount > 0 ? (
                <Text style={styles.screenHint}>
                  {campaignLeadCount} campaign {campaignLeadCount === 1 ? 'request' : 'requests'} — open the Campaigns tab to manage them.
                </Text>
              ) : null}
              {prefs.filterByTrade && leads.length > 0 ? (
                <Text style={styles.screenHint}>
                  Match Prefs on: trades and service areas still apply before you see this list (tap Match Prefs to widen).
                </Text>
              ) : null}
            </View>
            
            {/* Profile with glow */}
            <LinearGradient
              pointerEvents="box-none"
              colors={["#22c55e", "#22d3ee"]}
              style={styles.profileOuter}
            >
              <Pressable
                style={styles.profileInner}
                onPress={() => router.push('/profile')}
                accessibilityRole="button"
                accessibilityLabel="Profile"
              >
                <Text style={styles.profileInitials}>{user.initials}</Text>
              </Pressable>
            </LinearGradient>
          </View>
          
          {/* Main Content */}
          <View style={styles.contentCard}>
          <EnhancedLeadsPage
        onLeadsViewMeta={handleLeadsViewMeta}
        leads={(() => {
          // NEVER filter out leads completely - always show all leads
          // Use Zustand scoring for AI scores and sorting, but don't use it to hide leads
          // The filtering in EnhancedLeadsPage will handle visibility based on user's source/trade filters
          
          if (scoredLeads.length > 0 && hydrated && prefs.filterByTrade && scoredLeads.length === leads.length) {
            // Only use scored leads if ALL leads were scored (same count) - this ensures no data loss
            console.log(`🎯 Using Zustand-scored leads for scoring: ${scoredLeads.length} scored from ${leads.length} total`);
            
            // Map scored leads back to Lead format, but merge with original leads to preserve all data
            const scoredMap = new Map(scoredLeads.map(l => [l.id, l]));
            return leads.map(lead => {
              const scored = scoredMap.get(lead.id);
              if (scored) {
                return {
                  ...lead,
                  aiScore: scored.aiScore, // Use scored AI score
                  // Keep all other data from original lead
                };
              }
              return lead; // If not scored, return original
            });
          } else {
            console.log(`📋 Using regular leads: ${leads.length} (scoredLeads: ${scoredLeads.length}, filterByTrade: ${prefs.filterByTrade}, hydrated: ${hydrated})`);
            return leads;
          }
        })()}
        onStageChange={handleStageChange}
        onLeadPress={handleLeadPress}
        onPreferencesPress={() => setShowPreferencesModal(true)}
        contractorProfile={contractorProfile}
        onDeleteLead={async (leadId) => {
          try {
            // Add to deleted leads set to prevent it from reappearing
            const newDeletedIds = new Set([...deletedLeadIds, leadId]);
            setDeletedLeadIds(newDeletedIds);
            
            // Save to AsyncStorage immediately
            await AsyncStorage.setItem('deletedLeadIds', JSON.stringify(Array.from(newDeletedIds)));
            
            // Remove from local state immediately
            setLeads(prevLeads => prevLeads.filter(l => l.id !== leadId));
            
            // Check if this is an API lead (starts with LEAD-) and try to delete from backend
            if (leadId.startsWith('LEAD-')) {
              // Delete from backend API for project-based leads (fire and forget)
              fetch(`${resolveBackendRestApiBaseUrl()}/project-leads/${leadId}`, {
                method: 'DELETE',
              }).catch(err => console.warn('Backend deletion failed:', err));
            }
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error('Error deleting lead:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }}
        onArchiveLead={async (leadId) => {
          try {
            // Update lead in state to mark as archived
            setLeads(prevLeads => {
              const updatedLeads = prevLeads.map(lead => 
                lead.id === leadId 
                  ? { ...lead, archived: true, archivedAt: new Date().toISOString() }
                  : lead
              );
              
              // Save updated leads to AsyncStorage
              AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads)).catch(err => 
                console.warn('Failed to save archived leads to storage:', err)
              );
              
              return updatedLeads;
            });
            
            // If it's a backend lead, update on backend (fire and forget)
            if (leadId.startsWith('LEAD-')) {
              fetch(`${resolveBackendRestApiBaseUrl()}/unified-leads/leads/${leadId}/archive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: true }),
              }).catch(err => console.warn('Backend archive update failed:', err));
            }
            
            console.log(`📦 Archived lead: ${leadId}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error('Error archiving lead:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }}
        onUnarchiveLead={async (leadId) => {
          try {
            // Update lead in state to remove archived flag
            setLeads(prevLeads => {
              const updatedLeads = prevLeads.map(lead => 
                lead.id === leadId 
                  ? { ...lead, archived: false, archivedAt: undefined }
                  : lead
              );
              
              // Save updated leads to AsyncStorage
              AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads)).catch(err => 
                console.warn('Failed to save unarchived leads to storage:', err)
              );
              
              return updatedLeads;
            });
            
            // If it's a backend lead, update on backend (fire and forget)
            if (leadId.startsWith('LEAD-')) {
              fetch(`${resolveBackendRestApiBaseUrl()}/unified-leads/leads/${leadId}/archive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: false }),
              }).catch(err => console.warn('Backend unarchive update failed:', err));
            }
            
            console.log(`📦 Unarchived lead: ${leadId}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error('Error unarchiving lead:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }}
        onAddNote={handleAddNote}
        onSetReminder={handleSetReminder}
        onRefreshLeads={handleRefreshLeads}
      />
      </View>
      
      <View style={{ height: 32 }} />
      </WebPageShell>
      </ScrollView>
      
      {/* Lead Matching Preferences Modal */}
      <Modal
        visible={showPreferencesModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPreferencesModal(false)}
      >
        <ContractorPreferences onClose={() => {
          setShowPreferencesModal(false);
          console.log('🔍 Preferences modal closed - leads should remain personalized');
          // No need to reload profile - leads are already personalized
        }} />
      </Modal>
      
      {/* Lead Detail Modal */}
      <LeadDetailModal
        visible={showLeadDetailModal}
        lead={selectedLead}
        onClose={() => {
          console.log('🔍 ===== LEAD DETAIL MODAL CLOSING =====');
          console.log('🔍 Leads count before close:', leads.length);
          console.log('🔍 Leads before close:', leads.map(l => `${l.title}: ${l.aiScore}`));
          console.log('🔍 Selected lead:', selectedLead?.title);
          console.log('🔍 Stack trace for modal close:', new Error().stack?.split('\n').slice(1, 5).join('\n'));
          
          setShowLeadDetailModal(false);
          setSelectedLead(null);
          
          console.log('🔍 Modal state updated - leads should remain unchanged');
          console.log('🔍 ===== MODAL CLOSE COMPLETE =====');
        }}
        onAddNote={handleAddNote}
        onAddTask={handleAddTask}
        onToggleTask={handleToggleTask}
        onDeleteTask={handleDeleteTask}
        onSetReminder={handleSetReminder}
        onStageChange={(leadIdOrLead: string | Lead, newStage: string) => {
          // Handle both signatures: (leadId: string) or (lead: Lead)
          let leadToUpdate: Lead | null = null;
          
          if (typeof leadIdOrLead === 'string') {
            // Legacy signature: find lead by ID
            console.log(`🔍 Looking for lead with ID: ${leadIdOrLead}`);
            console.log(`🔍 Total leads in array: ${leads.length}`);
            console.log(`🔍 Selected lead ID: ${selectedLead?.id}`);
            leadToUpdate = leads.find(l => l.id === leadIdOrLead) || selectedLead;
            
            if (!leadToUpdate) {
              // Try to find by partial match (for contractor-assigned leads)
              const baseId = leadIdOrLead.split('-').slice(0, 3).join('-');
              leadToUpdate = leads.find(l => {
                const leadBaseId = l.id.split('-').slice(0, 3).join('-');
                return leadBaseId === baseId || l.id.startsWith(baseId);
              }) || null;
              
              if (leadToUpdate) {
                console.log(`✅ Found lead by base ID match: ${leadToUpdate.id}`);
              }
            }
          } else {
            // New signature: lead object passed directly
            leadToUpdate = leadIdOrLead;
          }
          
          if (leadToUpdate) {
            console.log(`✅ Found lead to update: ${leadToUpdate.id}, current stage: ${leadToUpdate.stage}, new stage: ${newStage}`);
            handleStageChange(leadToUpdate, newStage as LeadStage);
          } else {
            console.warn(`⚠️ Cannot update stage: lead not found for ${typeof leadIdOrLead === 'string' ? leadIdOrLead : leadIdOrLead.id}`);
            console.warn(`⚠️ Available lead IDs:`, leads.slice(0, 5).map(l => l.id));
            Alert.alert('Lead Not Found', `Could not find lead to update stage. The lead may have been removed or the ID changed.`);
          }
        }}
        onDelete={async (leadId) => {
          try {
            // Add to deleted leads set to prevent it from reappearing
            const newDeletedIds = new Set([...deletedLeadIds, leadId]);
            setDeletedLeadIds(newDeletedIds);
            
            // Save to AsyncStorage immediately
            await AsyncStorage.setItem('deletedLeadIds', JSON.stringify(Array.from(newDeletedIds)));
            
            // Remove from local state immediately
            setLeads(prevLeads => prevLeads.filter(l => l.id !== leadId));
            
            // Check if this is an API lead (starts with LEAD-) and try to delete from backend
            if (leadId.startsWith('LEAD-')) {
              // Delete from backend API for project-based leads (fire and forget)
              fetch(`${resolveBackendRestApiBaseUrl()}/project-leads/${leadId}`, {
                method: 'DELETE',
              }).catch(err => console.warn('Backend deletion failed:', err));
            }
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error('Error deleting lead:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }}
      />
      </SafeAreaView>
    </View>
  );
}

const getStyles = (Colors: any, scrollBottomInset: number = 120) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  safeArea: {
    flex: 1,
  },
  mainScroll: {
    flex: 1,
  },
  scrollContentGrow: {
    flexGrow: 1,
  },
  headerTextBlock: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: ScreenLayout.header.marginTop,
    marginBottom: ScreenLayout.header.marginBottom,
  },
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 4,
  },
  profileOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  profileInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  screenTitle: {
    fontSize: ScreenLayout.header.titleSize,
    fontWeight: ScreenLayout.header.titleWeight,
    letterSpacing: ScreenLayout.header.titleLetterSpacing,
    color: Colors.text,
  },
  screenSubtitle: {
    fontSize: ScreenLayout.header.subtitleSize,
    fontWeight: ScreenLayout.header.subtitleWeight,
    color: Colors.sub,
    marginTop: ScreenLayout.header.subtitleMarginTop,
  },
  screenHint: {
    fontSize: 12,
    color: Colors.sub,
    marginTop: 6,
    lineHeight: 17,
    opacity: 0.92,
  },
  scrollContent: {
    paddingBottom: scrollBottomInset,
    paddingHorizontal: ScreenLayout.edge.horizontal,
  },
  contentCard: {
    marginBottom: ScreenLayout.card.marginBottom,
    borderRadius: ScreenLayout.card.radius,
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.cardDark,
    overflow: 'visible', // Changed from 'hidden' to allow gradient borders to extend
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Colors.bg === '#000000' ? 0.3 : 0,
    shadowRadius: Colors.bg === '#000000' ? 8 : 0,
    elevation: Colors.bg === '#000000' ? 8 : 0,
    padding: 0,
  },
});