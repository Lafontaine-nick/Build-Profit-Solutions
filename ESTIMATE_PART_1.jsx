/*
 * ESTIMATE GENERATOR - PART 1 of 3
 * 
 * This part contains:
 * - All imports and dependencies
 * - Constants and configuration (Colors, VENDORS, PROJECT_TYPES, SECTIONS, etc.)
 * - Helper functions and utilities
 * - Main component definition and initial setup
 * - State management hooks
 * - Calculation logic (calc useMemo)
 * 
 * Lines: 1-4133
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  Switch,
  KeyboardAvoidingView,
  Pressable,
  Linking,
  LayoutAnimation,
  Share,
  StatusBar,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import GreyCalendar from '../../components/GreyCalendar';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialCommunityIcons, Feather, MaterialIcons } from '@expo/vector-icons';
import AttachSkuModal from '../../components/AttachSkuModal';
import SavedMaterialsScreen from '../../components/SavedMaterialsScreen';
import SubcontractorSearchModal from '../../components/SubcontractorSearchModal';
import { MessagesInbox } from '../../components/MessagesInbox';
import AIBidOptimization from '../../components/AIBidOptimization';
import ProjectAnalysis from '../../components/ProjectAnalysis';
import AIAssistantModal from '../../components/AIAssistantModal';
// New proposal system - this is the ONLY system used
import { buildProposalHtml } from '../../lib/proposals/buildProposalHtml';
import { exportProposalPdf } from '../../lib/proposals/exportPdf';
import { useProjectList } from '../../contexts/ProjectListContext';
import { unifiedLeadService } from '../../services/unifiedLeadService';
import { useFocusEffect, useRouter } from 'expo-router';
import { useRequireAuth } from '../../hooks/useRequireAuth';

const Colors = {
  bg: '#000000',
  card: '#000000',
  cardDark: '#000000',
  text: '#F9FAFB',
  sub: '#8DA0B8',
  line: '#1a1a1a',
  primary: '#22c55e',
  yellow: '#ffd166',
  blue: '#60a5fa',
  green: '#22c55e',
  orange: '#fbbf24',
  red: '#ef4444',
  purple: '#a78bfa',
  // Gradient border colors
  gradientStart: '#2DFFC4',
  gradientEnd: '#00A6FF',
};

const BID_STORAGE_KEY = 'bps.currentBid.v2';
const screenWidth = Dimensions.get('window').width;

// ============ MATERIALS CATALOG DATA ============
const VENDORS = [
  { id: "hd", name: "Home Depot" },
  { id: "lw", name: "Lowes" },
  { id: "loc", name: "Local Supplier" },
];

const PROJECT_TYPES = [
  { label: "Kitchen", value: "kitchen" },
  { label: "Bathroom", value: "bathroom" },
  { label: "Room Add.", value: "room_addition" },
  { label: "Home Add.", value: "home_addition" },
  { label: "New Build", value: "new_build" },
  { label: "Landscaping", value: "landscaping" },
  { label: "Other", value: "other" },
];

const PROJECT_CATEGORY_SLUGS = {
  kitchen: 'kitchen-remodel',
  bathroom: 'bathroom-remodel',
  room_addition: 'addition',
  home_addition: 'home-renovation',
  new_build: 'new-build',
  landscaping: 'landscaping',
  other: 'other',
};

const SECTIONS = {
  kitchen: ["Framing", "Electrical", "Plumbing", "Cabinetry & Tops", "Flooring", "Drywall & Paint", "Appliances"],
  bathroom: ["Framing", "Electrical", "Plumbing", "Waterproof & Tile", "Drywall & Paint", "Fixtures"],
  room_addition: ["Sitework", "Framing", "Sheathing", "Roofing", "Windows & Doors", "Electrical", "Insulation", "Drywall & Paint"],
  home_addition: ["Sitework", "Foundation", "Framing", "Sheathing", "Roofing", "MEP Rough", "Insulation", "Drywall & Paint", "Exterior"],
  new_build: ["Sitework", "Foundation", "Framing", "Sheathing", "Roofing", "MEP Rough", "Insulation", "Drywall", "Finishes"],
  landscaping: ["Hardscape", "Softscape & Plants", "Irrigation", "Lighting"],
  other: ["Materials", "Equipment", "Permits", "Other"],
};

const SECTION_ICONS = {
  "Framing": "construct-outline",
  "Electrical": "flash-outline",
  "Plumbing": "water-outline",
  "Cabinetry & Tops": "cube-outline",
  "Flooring": "layers-outline",
  "Drywall & Paint": "brush-outline",
  "Appliances": "hardware-chip-outline",
  "Waterproof & Tile": "shield-outline",
  "Fixtures": "bulb-outline",
  "Sitework": "earth-outline",
  "Sheathing": "square-outline",
  "Roofing": "home-outline",
  "Windows & Doors": "albums-outline",
  "Insulation": "snow-outline",
  "MEP Rough": "settings-outline",
  "Exterior": "business-outline",
  "Foundation": "layers-outline",
  "Drywall": "brush-outline",
  "Finishes": "sparkles-outline",
  "Hardscape": "map-outline",
  "Softscape & Plants": "leaf-outline",
  "Irrigation": "water-outline",
  "Lighting": "bulb-outline",
  "Materials": "cube-outline",
  "Equipment": "construct-outline",
  "Permits": "document-text-outline",
  "Other": "ellipsis-horizontal-outline",
};

const MATERIAL_CATALOG = [
  // FRAMING
  { id: "stud-2x4x8", name: "2x4x8 KD Stud", category: "Framing", keywords: ["2x4", "stud", "framing", "lumber"] },
  { id: "stud-2x6x8", name: "2x6x8 KD Stud", category: "Framing", keywords: ["2x6", "stud", "framing", "lumber"] },
  { id: "plate-2x4", name: "2x4 Plates", category: "Framing", keywords: ["2x4", "plate", "framing"] },
  { id: "joist-2x8", name: "2x8x10 Floor Joist", category: "Framing", keywords: ["2x8", "joist", "floor"] },
  { id: "beam-lvl", name: "LVL Beam", category: "Framing", keywords: ["lvl", "beam", "header"] },
  { id: "hangers", name: "Joist Hangers", category: "Framing", keywords: ["hanger", "simpson"] },
  
  // SHEATHING
  { id: "osb-716", name: "OSB 7/16\" 4x8", category: "Sheathing", keywords: ["osb", "sheathing", "sheet"] },
  { id: "ply-12", name: "Plywood 1/2\" 4x8", category: "Sheathing", keywords: ["plywood", "sheet"] },
  { id: "ply-34", name: "Plywood 3/4\" 4x8", category: "Sheathing", keywords: ["plywood", "sheet", "subfloor"] },
  { id: "zip-system", name: "Zip System Panel", category: "Sheathing", keywords: ["zip", "sheathing"] },
  
  // DRYWALL
  { id: "drywall-12", name: "Drywall 1/2\" 4x8", category: "Drywall", keywords: ["gypsum", "sheetrock", "sheet"] },
  { id: "drywall-58", name: "Drywall 5/8\" 4x8", category: "Drywall", keywords: ["gypsum", "sheetrock", "sheet"] },
  { id: "mud", name: "Joint Compound", category: "Drywall", keywords: ["mud", "compound"] },
  { id: "corner-bead", name: "Corner Bead", category: "Drywall", keywords: ["corner", "bead"] },
  { id: "tape", name: "Drywall Tape", category: "Drywall", keywords: ["tape", "mesh"] },
  
  // PAINT
  { id: "paint-int", name: "Interior Paint (gal)", category: "Paint", keywords: ["paint", "interior"] },
  { id: "primer", name: "Primer (gal)", category: "Paint", keywords: ["primer"] },
  { id: "paint-ext", name: "Exterior Paint (gal)", category: "Paint", keywords: ["paint", "exterior"] },
  { id: "caulk", name: "Paintable Caulk", category: "Paint", keywords: ["caulk", "sealant"] },
  
  // ELECTRICAL
  { id: "romex-12-2", name: "NM-B 12/2 Wire (250ft)", category: "Electrical", keywords: ["wire", "romex", "12-2"] },
  { id: "romex-14-2", name: "NM-B 14/2 Wire (250ft)", category: "Electrical", keywords: ["wire", "romex", "14-2"] },
  { id: "can-light", name: "LED Can Light", category: "Electrical", keywords: ["light", "can", "recessed"] },
  { id: "gfci", name: "GFCI Outlet", category: "Electrical", keywords: ["gfci", "outlet"] },
  { id: "switch", name: "Light Switch", category: "Electrical", keywords: ["switch"] },
  { id: "outlet", name: "Standard Outlet", category: "Electrical", keywords: ["outlet", "receptacle"] },
  { id: "breaker-20a", name: "20A Circuit Breaker", category: "Electrical", keywords: ["breaker"] },
  { id: "junction-box", name: "Junction Box", category: "Electrical", keywords: ["box", "junction"] },
  
  // PLUMBING
  { id: "pex-12", name: "PEX 1/2\" (100ft)", category: "Plumbing", keywords: ["pex", "pipe"] },
  { id: "pex-34", name: "PEX 3/4\" (100ft)", category: "Plumbing", keywords: ["pex", "pipe"] },
  { id: "pvc-3", name: "PVC 3\" (10ft)", category: "Plumbing", keywords: ["pvc", "drain"] },
  { id: "pvc-fittings", name: "PVC Fittings Kit", category: "Plumbing", keywords: ["pvc", "fitting"] },
  { id: "shutoff-valve", name: "Shutoff Valve", category: "Plumbing", keywords: ["valve", "shutoff"] },
  
  // TILE & WATERPROOFING
  { id: "thinset", name: "Thinset Mortar (50lb)", category: "Tile", keywords: ["tile", "mortar", "thinset"] },
  { id: "tile-12x24", name: "Porcelain Tile 12x24", category: "Tile", keywords: ["tile", "floor", "porcelain"] },
  { id: "grout", name: "Grout", category: "Tile", keywords: ["grout"] },
  { id: "cement-board", name: "Cement Board 1/2\"", category: "Waterproofing", keywords: ["cement", "board", "tile"] },
  { id: "membrane-kit", name: "Waterproof Membrane Kit", category: "Waterproofing", keywords: ["membrane", "kerdi", "redgard"] },
  
  // CABINETRY & COUNTERTOPS
  { id: "cab-boxes", name: "Cabinet Boxes (LF)", category: "Cabinetry", keywords: ["cabinet", "box"] },
  { id: "quartz", name: "Quartz Countertop (SF)", category: "Countertops", keywords: ["quartz", "counter"] },
  { id: "granite", name: "Granite Countertop (SF)", category: "Countertops", keywords: ["granite", "counter"] },
  
  // FIXTURES
  { id: "sink-undermount", name: "Undermount Sink", category: "Fixtures", keywords: ["sink"] },
  { id: "faucet", name: "Kitchen Faucet", category: "Fixtures", keywords: ["faucet"] },
  { id: "toilet", name: "Toilet", category: "Fixtures", keywords: ["toilet"] },
  
  // FLOORING
  { id: "lvp", name: "LVP Flooring (SF)", category: "Flooring", keywords: ["lvp", "vinyl", "floor"] },
  { id: "hardwood", name: "Hardwood Flooring (SF)", category: "Flooring", keywords: ["hardwood", "wood", "floor"] },
  { id: "tile-floor", name: "Floor Tile (SF)", category: "Flooring", keywords: ["tile", "floor"] },
  { id: "underlayment", name: "Floor Underlayment", category: "Flooring", keywords: ["underlayment", "padding"] },
  
  // FOUNDATION
  { id: "concrete-3000", name: "Concrete 3000 PSI (CY)", category: "Foundation", keywords: ["concrete"] },
  { id: "rebar-4", name: "#4 Rebar (LF)", category: "Foundation", keywords: ["rebar"] },
  { id: "anchor-bolts", name: "Anchor Bolts", category: "Foundation", keywords: ["anchor", "bolt"] },
  
  // HARDSCAPE
  { id: "pavers", name: "Pavers (SF)", category: "Hardscape", keywords: ["paver", "patio"] },
  { id: "base-rock", name: "Base Rock (CY)", category: "Hardscape", keywords: ["rock", "base"] },
  { id: "sand", name: "Sand (CY)", category: "Hardscape", keywords: ["sand"] },
  
  // APPLIANCES
  { id: "range", name: "Range/Stove", category: "Appliances", keywords: ["range", "stove", "oven"] },
  { id: "refrigerator", name: "Refrigerator", category: "Appliances", keywords: ["fridge", "refrigerator"] },
  { id: "dishwasher", name: "Dishwasher", category: "Appliances", keywords: ["dishwasher"] },
  { id: "microwave", name: "Microwave", category: "Appliances", keywords: ["microwave"] },
];

// Rental Equipment Categories
const RENTAL_CATEGORIES = [
  {
    id: 'heavy',
    name: 'Heavy Equipment',
    icon: '🚜',
    description: 'Excavators, loaders, dozers',
    color: '#38d39f',
  },
  {
    id: 'power',
    name: 'Power Tools',
    icon: '⚡',
    description: 'Drills, saws, generators',
    color: '#60a5fa',
  },
  {
    id: 'ladders',
    name: 'Ladders & Platforms',
    icon: '🪜',
    description: 'Scaffolding, lifts, ladders',
    color: '#fbbf24',
  },
  {
    id: 'concrete',
    name: 'Concrete Equipment',
    icon: '🧱',
    description: 'Mixers, saws, vibrators',
    color: '#a78bfa',
  },
  {
    id: 'landscaping',
    name: 'Landscaping',
    icon: '🌿',
    description: 'Mowers, trimmers, blowers',
    color: '#34d399',
  },
  {
    id: 'general',
    name: 'General Tools',
    icon: '🔧',
    description: 'Hand tools, compressors',
    color: '#f87171',
  },
];

const PRICE_BOOK = {
  // FRAMING
  "stud-2x4x8": [{ vendorId: "hd", price: 4.15, inStock: true }, { vendorId: "lw", price: 4.05, inStock: true }, { vendorId: "loc", price: 3.95, inStock: false }],
  "stud-2x6x8": [{ vendorId: "hd", price: 6.85, inStock: true }, { vendorId: "lw", price: 6.75, inStock: true }],
  "plate-2x4": [{ vendorId: "hd", price: 3.85, inStock: true }, { vendorId: "lw", price: 3.75, inStock: true }],
  "joist-2x8": [{ vendorId: "hd", price: 8.95, inStock: true }, { vendorId: "lw", price: 8.75, inStock: true }],
  "beam-lvl": [{ vendorId: "hd", price: 45, inStock: true }, { vendorId: "lw", price: 43, inStock: true }],
  "hangers": [{ vendorId: "hd", price: 2.2, inStock: true }, { vendorId: "lw", price: 2.1, inStock: true }],
  
  // SHEATHING
  "osb-716": [{ vendorId: "hd", price: 14.25, inStock: true }, { vendorId: "lw", price: 13.89, inStock: true }, { vendorId: "loc", price: 13.5, inStock: true }],
  "ply-12": [{ vendorId: "hd", price: 23.99, inStock: true }, { vendorId: "lw", price: 24.49, inStock: true }, { vendorId: "loc", price: 22.9, inStock: false }],
  "ply-34": [{ vendorId: "hd", price: 38.5, inStock: true }, { vendorId: "lw", price: 37.9, inStock: true }],
  "zip-system": [{ vendorId: "hd", price: 42, inStock: true }, { vendorId: "lw", price: 41, inStock: true }],
  
  // DRYWALL
  "drywall-12": [{ vendorId: "hd", price: 10.9, inStock: true }, { vendorId: "lw", price: 10.6, inStock: true }],
  "drywall-58": [{ vendorId: "hd", price: 12.5, inStock: true }, { vendorId: "lw", price: 12.2, inStock: true }],
  "mud": [{ vendorId: "hd", price: 15.5, inStock: true }, { vendorId: "lw", price: 15, inStock: true }],
  "corner-bead": [{ vendorId: "hd", price: 0.95, inStock: true }, { vendorId: "lw", price: 0.9, inStock: true }],
  "tape": [{ vendorId: "hd", price: 8.5, inStock: true }, { vendorId: "lw", price: 8.2, inStock: true }],
  
  // PAINT
  "paint-int": [{ vendorId: "hd", price: 34, inStock: true }, { vendorId: "lw", price: 32, inStock: true }],
  "primer": [{ vendorId: "hd", price: 22, inStock: true }, { vendorId: "lw", price: 21, inStock: true }],
  "paint-ext": [{ vendorId: "hd", price: 38, inStock: true }, { vendorId: "lw", price: 36, inStock: true }],
  "caulk": [{ vendorId: "hd", price: 5.5, inStock: true }, { vendorId: "lw", price: 5.2, inStock: true }],
  
  // ELECTRICAL
  "romex-12-2": [{ vendorId: "hd", price: 125, inStock: true }, { vendorId: "lw", price: 120, inStock: true }],
  "romex-14-2": [{ vendorId: "hd", price: 95, inStock: true }, { vendorId: "lw", price: 92, inStock: true }],
  "can-light": [{ vendorId: "hd", price: 42, inStock: true }, { vendorId: "lw", price: 39, inStock: true }],
  "gfci": [{ vendorId: "hd", price: 18, inStock: true }, { vendorId: "lw", price: 17.5, inStock: true }],
  "switch": [{ vendorId: "hd", price: 1.5, inStock: true }, { vendorId: "lw", price: 1.4, inStock: true }],
  "outlet": [{ vendorId: "hd", price: 0.95, inStock: true }, { vendorId: "lw", price: 0.9, inStock: true }],
  "breaker-20a": [{ vendorId: "hd", price: 12, inStock: true }, { vendorId: "lw", price: 11.5, inStock: true }],
  "junction-box": [{ vendorId: "hd", price: 2.8, inStock: true }, { vendorId: "lw", price: 2.6, inStock: true }],
  
  // PLUMBING
  "pex-12": [{ vendorId: "hd", price: 48, inStock: true }, { vendorId: "lw", price: 46, inStock: true }],
  "pex-34": [{ vendorId: "hd", price: 68, inStock: true }, { vendorId: "lw", price: 65, inStock: true }],
  "pvc-3": [{ vendorId: "hd", price: 12, inStock: true }, { vendorId: "lw", price: 11.5, inStock: true }],
  "pvc-fittings": [{ vendorId: "hd", price: 25, inStock: true }, { vendorId: "lw", price: 24, inStock: true }],
  "shutoff-valve": [{ vendorId: "hd", price: 8.5, inStock: true }, { vendorId: "lw", price: 8, inStock: true }],
  
  // TILE
  "thinset": [{ vendorId: "hd", price: 14.5, inStock: true }, { vendorId: "lw", price: 14.2, inStock: true }],
  "tile-12x24": [{ vendorId: "hd", price: 30.2, inStock: true }, { vendorId: "lw", price: 29.9, inStock: true }],
  "grout": [{ vendorId: "hd", price: 22, inStock: true }, { vendorId: "lw", price: 21, inStock: true }],
  "cement-board": [{ vendorId: "hd", price: 12.5, inStock: true }, { vendorId: "lw", price: 12.2, inStock: true }],
  "membrane-kit": [{ vendorId: "hd", price: 210, inStock: true }, { vendorId: "lw", price: 205, inStock: true }],
  
  // CABINETRY & COUNTERTOPS
  "cab-boxes": [{ vendorId: "loc", price: 165, inStock: true }],
  "quartz": [{ vendorId: "loc", price: 62, inStock: true }],
  "granite": [{ vendorId: "loc", price: 55, inStock: true }],
  
  // FIXTURES
  "sink-undermount": [{ vendorId: "hd", price: 220, inStock: true }, { vendorId: "lw", price: 210, inStock: true }],
  "faucet": [{ vendorId: "hd", price: 135, inStock: true }, { vendorId: "lw", price: 128, inStock: true }],
  "toilet": [{ vendorId: "hd", price: 225, inStock: true }, { vendorId: "lw", price: 215, inStock: true }],
  
  // FLOORING
  "lvp": [{ vendorId: "hd", price: 2.8, inStock: true }, { vendorId: "lw", price: 2.6, inStock: true }],
  "hardwood": [{ vendorId: "hd", price: 5.5, inStock: true }, { vendorId: "lw", price: 5.2, inStock: true }],
  "tile-floor": [{ vendorId: "hd", price: 3.2, inStock: true }, { vendorId: "lw", price: 3.0, inStock: true }],
  "underlayment": [{ vendorId: "hd", price: 38, inStock: true }, { vendorId: "lw", price: 36, inStock: true }],
  
  // FOUNDATION
  "concrete-3000": [{ vendorId: "loc", price: 145, inStock: true }],
  "rebar-4": [{ vendorId: "hd", price: 0.95, inStock: true }],
  "anchor-bolts": [{ vendorId: "hd", price: 1.2, inStock: true }, { vendorId: "lw", price: 1.1, inStock: true }],
  
  // HARDSCAPE
  "pavers": [{ vendorId: "hd", price: 4.25, inStock: true }, { vendorId: "loc", price: 3.95, inStock: true }],
  "base-rock": [{ vendorId: "loc", price: 44, inStock: true }],
  "sand": [{ vendorId: "loc", price: 52, inStock: true }],
  
  // APPLIANCES
  "range": [{ vendorId: "hd", price: 850, inStock: true }, { vendorId: "lw", price: 825, inStock: true }],
  "refrigerator": [{ vendorId: "hd", price: 1200, inStock: true }, { vendorId: "lw", price: 1150, inStock: true }],
  "dishwasher": [{ vendorId: "hd", price: 650, inStock: true }, { vendorId: "lw", price: 625, inStock: true }],
  "microwave": [{ vendorId: "hd", price: 250, inStock: true }, { vendorId: "lw", price: 240, inStock: true }],
};

const STEPS = [
  { id: 1, title: 'Customer Information', subtitle: 'Client contact and details' },
  { id: 2, title: 'Project Information', subtitle: 'Title, location, scope & timeline' },
  { id: 3, title: 'Materials & Supplies', subtitle: 'Live pricing and inflation' },
  { id: 4, title: 'Labor & Subs', subtitle: 'Regional wages and subcontractors' },
  { id: 5, title: 'Overhead & Markup', subtitle: 'Break down overhead, tune markup' },
  { id: 6, title: 'Project Analysis', subtitle: 'Project outcome scenarios' },
  { id: 7, title: 'Payment / Work Schedule', subtitle: 'Payment terms and work scheduling' },
  { id: 8, title: 'Final Bid & Contract', subtitle: 'Health score, contract generation & export' },
];

// ============ MODAL COMPONENTS ============
const modalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: Colors.sub,
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cardDark,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(45, 255, 196, 0.2)',
    borderColor: '#2DFFC4',
  },
  chipText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  totalBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  totalLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Material modal styles (matching AddMaterialScreen)
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    marginBottom: 0,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainerWrapper: {
    marginRight: 12,
  },
  headerIconBorder: {
    borderRadius: 12,
    padding: 1,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  headerTextBlock: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  materialSubtitle: {
    fontSize: 13,
    color: '#8DA0B8',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  materialFieldGroup: {
    marginBottom: 20,
  },
  materialLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  materialInputBorder: {
    borderRadius: 20,
    padding: 1,
  },
  materialInputWrapper: {
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
  },
  materialInputIcon: {
    marginRight: 12,
  },
  materialInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  materialChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 0,
  },
  materialChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  materialChipActive: {
    backgroundColor: 'rgba(45, 255, 196, 0.2)',
    borderColor: '#2DFFC4',
  },
  materialChipText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  materialChipTextActive: {
    color: '#2DFFC4',
    fontWeight: '600',
  },
  materialCancelBtn: {
    flex: 1,
    marginRight: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialSaveBtn: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  materialSaveButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  materialCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  materialSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#020617',
    letterSpacing: 0.3,
  },
  materialFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#000000',
  },
});

// Module-level variable to persist header top position across component remounts
let paymentMilestoneHeaderTop = null;
let weeklyPaymentHeaderTop = null;

// Payment Milestone Modal
const PaymentMilestoneModal = ({ visible, onClose, item, onSave, grandTotal }) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [amount, setAmount] = useState(item?.paymentAmount?.toString() || '');
  const [percentage, setPercentage] = useState(item?.percentage?.toString() || '');
  const [scheduledDate, setScheduledDate] = useState(item?.scheduledDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Lock header top position on first modal open - persists across remounts via module variable
  // This prevents the header from moving when navigating back
  useEffect(() => {
    if (visible && paymentMilestoneHeaderTop === null) {
      // Lock to the current safe area top value - this will persist even when navigating back
      paymentMilestoneHeaderTop = Math.max(insets.top || 0, 0);
      console.log('🔒 PaymentMilestoneModal: Locked header top to', paymentMilestoneHeaderTop, 'and will not recalculate');
    }
  }, [visible, insets.top]);
  
  // Always use the locked value - never recalculate once set, even if insets change
  // This ensures the header position remains stable when navigating back
  const headerTop = paymentMilestoneHeaderTop !== null ? paymentMilestoneHeaderTop : Math.max(insets.top || 0, 0);
  
  // Memoize header style - only recalculate if headerTop actually changes
  const headerStyle = useMemo(() => ({
    position: 'absolute',
    top: headerTop,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#000000',
    paddingTop: 12,
    paddingBottom: 16,
  }), [headerTop]);
  
  // Memoize ScrollView contentContainerStyle to prevent layout recalculation
  const scrollViewContentStyle = useMemo(() => ({
    paddingHorizontal: 20,
    paddingTop: headerTop + 110,
    paddingBottom: insets.bottom + 100,
  }), [headerTop, insets.bottom]);
  
  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setDescription(item.description || '');
      setAmount(item.paymentAmount?.toString() || '');
      setPercentage(item.percentage?.toString() || '');
      setScheduledDate(item.scheduledDate || '');
    } else {
      setName('');
      setDescription('');
      setAmount('');
      setPercentage('');
      setScheduledDate('');
    }
  }, [item]);
  
  const handleAmountChange = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    setAmount(cleaned);
    if (grandTotal > 0 && cleaned) {
      const amt = parseFloat(cleaned) || 0;
      const pct = Math.round((amt / grandTotal) * 100 * 100) / 100;
      setPercentage(pct.toString());
    }
  };
  
  const handlePercentageChange = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    setPercentage(cleaned);
    if (grandTotal > 0 && cleaned) {
      const pct = parseFloat(cleaned) || 0;
      const amt = Math.round((pct / 100) * grandTotal * 100) / 100;
      setAmount(amt.toString());
    }
  };
  
  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a milestone name');
      return;
    }
    
    const milestoneData = {
      ...(item?.id && { id: item.id }),
      name: name.trim(),
      description: description.trim() || undefined,
      paymentAmount: parseFloat(amount) || 0,
      amount: parseFloat(amount) || 0,
      percentage: parseFloat(percentage) || 0,
      scheduledDate: scheduledDate || undefined,
      dueDate: scheduledDate || undefined,
    };
    
    onSave(milestoneData);
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar barStyle="light-content" translucent={false} />
        {/* HEADER - Fixed at top, respects safe area - outside layout containers */}
        <View style={[modalStyles.materialHeader, headerStyle]} collapsable={false}>
          <View style={modalStyles.backButtonWrapper}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={modalStyles.backButtonBorder}
            >
              <Pressable
                onPress={onClose}
                style={modalStyles.backButton}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </Pressable>
            </LinearGradient>
          </View>

          <View style={modalStyles.headerTitleRow}>
            <View style={modalStyles.headerIconContainerWrapper}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={modalStyles.headerIconBorder}
              >
                <View style={modalStyles.headerIconContainer}>
                  <MaterialCommunityIcons
                    name="cash-multiple"
                    size={20}
                    color="#22c55e"
                  />
                </View>
              </LinearGradient>
            </View>
            <View style={modalStyles.headerTextBlock}>
              <Text style={modalStyles.materialTitle}>
                {item ? 'Edit' : 'Add'} Payment Milestone
              </Text>
              <Text style={modalStyles.materialSubtitle}>
                Set payment amount and schedule
              </Text>
            </View>
          </View>
        </View>
        
        <View style={{ flex: 1, backgroundColor: '#000000' }} collapsable={false}>
            {/* CONTENT */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={scrollViewContentStyle}
            >
              {/* Milestone Name */}
              <View style={modalStyles.materialFieldGroup}>
                <Text style={modalStyles.materialLabel}>Milestone Name *</Text>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={modalStyles.materialInputBorder}
                >
                  <View style={modalStyles.materialInputWrapper}>
                    <Feather
                      name="tag"
                      size={16}
                      color="#8DA0B8"
                      style={modalStyles.materialInputIcon}
                    />
                    <TextInput
                      style={modalStyles.materialInput}
                      value={name}
                      onChangeText={setName}
                      returnKeyType="next"
                      placeholder="e.g., Deposit, Framing Complete"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                </LinearGradient>
              </View>
              
              {/* Description */}
              <View style={modalStyles.materialFieldGroup}>
                <Text style={modalStyles.materialLabel}>Description (Optional)</Text>
                <View style={[modalStyles.materialInputWrapper, { alignItems: 'flex-start', paddingVertical: 12 }]}>
                  <Feather
                    name="file-text"
                    size={16}
                    color="#8DA0B8"
                    style={[modalStyles.materialInputIcon, { marginTop: 4 }]}
                  />
                  <TextInput
                    style={[modalStyles.materialInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional description"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    multiline
                  />
                </View>
              </View>
              
              {/* Amount */}
              <View style={modalStyles.materialFieldGroup}>
                <Text style={modalStyles.materialLabel}>Amount *</Text>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={modalStyles.materialInputBorder}
                >
                  <View style={modalStyles.materialInputWrapper}>
                    <Feather
                      name="dollar-sign"
                      size={16}
                      color="#22c55e"
                      style={modalStyles.materialInputIcon}
                    />
                    <TextInput
                      style={modalStyles.materialInput}
                      value={amount}
                      onChangeText={handleAmountChange}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      placeholder="$ 0.00"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                </LinearGradient>
              </View>
              
              {/* Percentage */}
              <View style={modalStyles.materialFieldGroup}>
                <Text style={modalStyles.materialLabel}>Percentage (%)</Text>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={modalStyles.materialInputBorder}
                >
                  <View style={modalStyles.materialInputWrapper}>
                    <Feather
                      name="percent"
                      size={16}
                      color="#8DA0B8"
                      style={modalStyles.materialInputIcon}
                    />
                    <TextInput
                      style={modalStyles.materialInput}
                      value={percentage}
                      onChangeText={handlePercentageChange}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                </LinearGradient>
              </View>
              
              {/* Scheduled Date */}
              <View style={[modalStyles.materialFieldGroup, { marginBottom: 20 }]}>
                <Text style={modalStyles.materialLabel}>Scheduled Date (Optional)</Text>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={modalStyles.materialInputBorder}
                >
                  <TouchableOpacity
                    style={modalStyles.materialInputWrapper}
                    onPress={() => setShowDatePicker(!showDatePicker)}
                  >
                    <Feather
                      name="calendar"
                      size={16}
                      color="#8DA0B8"
                      style={modalStyles.materialInputIcon}
                    />
                    <Text style={{ 
                      flex: 1, 
                      fontSize: 15, 
                      color: scheduledDate ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                      fontWeight: '500',
                      paddingVertical: 12,
                    }}>
                      {scheduledDate ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
                {showDatePicker && (
                  <View style={{ marginTop: 12 }}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        setScheduledDate(day.dateString);
                        setShowDatePicker(false);
                      }}
                      markedDates={{
                        [scheduledDate || '']: {
                          selected: true,
                          selectedColor: '#38d39f',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={scheduledDate}
                    />
                  </View>
                )}
              </View>
            </ScrollView>
            
            {/* BOTTOM ACTION BAR */}
            <View style={modalStyles.materialFooter}>
              <Pressable
                style={({ pressed }) => [
                  modalStyles.materialCancelBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={onClose}
              >
                <Text style={modalStyles.materialCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  modalStyles.materialSaveBtn,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                onPress={handleSave}
              >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={modalStyles.materialSaveButtonGradient}
                >
                  <Text style={modalStyles.materialSaveText}>✓ Save</Text>
                </LinearGradient>
              </Pressable>
            </View>
            </KeyboardAvoidingView>
          </View>
      </SafeAreaView>
    </Modal>
  );
};

// Weekly Payment Modal
const WeeklyPaymentModal = ({ visible, onClose, item, onSave, grandTotal }) => {
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState(item?.description || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [percentage, setPercentage] = useState(item?.percentage?.toString() || '');
  const [weekNumber, setWeekNumber] = useState(item?.weekNumber?.toString() || '');
  const [scheduledDate, setScheduledDate] = useState(item?.scheduledDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Lock header top position on first modal open - persists across remounts via module variable
  // This prevents the header from moving when navigating back
  useEffect(() => {
    if (visible && weeklyPaymentHeaderTop === null) {
      // Lock to the current safe area top value - this will persist even when navigating back
      weeklyPaymentHeaderTop = Math.max(insets.top || 0, 0);
      console.log('🔒 WeeklyPaymentModal: Locked header top to', weeklyPaymentHeaderTop, 'and will not recalculate');
    }
  }, [visible, insets.top]);
  
  // Always use the locked value - never recalculate once set, even if insets change
  // This ensures the header position remains stable when navigating back
  const headerTop = weeklyPaymentHeaderTop !== null ? weeklyPaymentHeaderTop : Math.max(insets.top || 0, 0);
  
  // Memoize header style - only recalculate if headerTop actually changes
  const headerStyle = useMemo(() => ({
    position: 'absolute',
    top: headerTop,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#000000',
    paddingTop: 12,
    paddingBottom: 16,
  }), [headerTop]);
  
  // Memoize ScrollView contentContainerStyle to prevent layout recalculation
  const scrollViewContentStyle = useMemo(() => ({
    paddingHorizontal: 20,
    paddingTop: headerTop + 110,
    paddingBottom: insets.bottom + 100,
  }), [headerTop, insets.bottom]);
  
  useEffect(() => {
    if (item) {
      setDescription(item.description || '');
      setAmount(item.amount?.toString() || '');
      setPercentage(item.percentage?.toString() || '');
      setWeekNumber(item.weekNumber?.toString() || '');
      setScheduledDate(item.scheduledDate || '');
    } else {
      setDescription('');
      setAmount('');
      setPercentage('');
      setWeekNumber('');
      setScheduledDate('');
    }
  }, [item]);
  
  const handleAmountChange = (text) => {
    setAmount(text);
    if (grandTotal > 0 && text) {
      const amt = parseFloat(text) || 0;
      const pct = Math.round((amt / grandTotal) * 100 * 100) / 100;
      setPercentage(pct.toString());
    }
  };
  
  const handlePercentageChange = (text) => {
    setPercentage(text);
    if (grandTotal > 0 && text) {
      const pct = parseFloat(text) || 0;
      const amt = Math.round((pct / 100) * grandTotal * 100) / 100;
      setAmount(amt.toString());
    }
  };
  
  const handleSave = () => {
    const paymentData = {
      ...(item?.id && { id: item.id }),
      description: description.trim() || undefined,
      amount: parseFloat(amount) || 0,
      paymentAmount: parseFloat(amount) || 0,
      percentage: parseFloat(percentage) || 0,
      weekNumber: parseInt(weekNumber) || undefined,
      scheduledDate: scheduledDate || undefined,
      dueDate: scheduledDate || undefined,
    };
    
    onSave(paymentData);
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar barStyle="light-content" translucent={false} />
        {/* HEADER - Fixed at top, respects safe area - outside layout containers */}
        <View style={[modalStyles.materialHeader, headerStyle]} collapsable={false}>
          <View style={modalStyles.backButtonWrapper}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={modalStyles.backButtonBorder}
            >
              <Pressable
                onPress={onClose}
                style={modalStyles.backButton}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </Pressable>
            </LinearGradient>
          </View>

          <View style={modalStyles.headerTitleRow}>
            <View style={modalStyles.headerIconContainerWrapper}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={modalStyles.headerIconBorder}
              >
                <View style={modalStyles.headerIconContainer}>
                  <MaterialCommunityIcons
                    name="calendar-week"
                    size={20}
                    color="#22c55e"
                  />
                </View>
              </LinearGradient>
            </View>
            <View style={modalStyles.headerTextBlock}>
              <Text style={modalStyles.materialTitle}>
                {item ? 'Edit' : 'Add'} Weekly Payment
              </Text>
              <Text style={modalStyles.materialSubtitle}>
                Set payment amount and schedule
              </Text>
            </View>
          </View>
        </View>
        
        <View style={{ flex: 1, backgroundColor: '#000000', position: 'relative' }} collapsable={false}>
          {/* CONTENT */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={scrollViewContentStyle}
            >
              <View style={modalStyles.materialFieldGroup}>
                <Text style={modalStyles.materialLabel}>Week Number *</Text>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={modalStyles.materialInputBorder}
                >
                  <View style={modalStyles.materialInputWrapper}>
                    <Feather
                      name="hash"
                      size={16}
                      color="#8DA0B8"
                      style={modalStyles.materialInputIcon}
                    />
                    <TextInput
                      style={modalStyles.materialInput}
                      value={weekNumber}
                      onChangeText={setWeekNumber}
                      keyboardType="numeric"
                      returnKeyType="next"
                      placeholder="e.g., 1, 2, 3"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                </LinearGradient>
              </View>
              
              <View style={modalStyles.materialFieldGroup}>
                <Text style={modalStyles.materialLabel}>Description (Optional)</Text>
                <View style={[modalStyles.materialInputWrapper, { alignItems: 'flex-start', paddingVertical: 12 }]}>
                  <Feather
                    name="file-text"
                    size={16}
                    color="#8DA0B8"
                    style={[modalStyles.materialInputIcon, { marginTop: 4 }]}
                  />
                  <TextInput
                    style={[modalStyles.materialInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional description"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    multiline
                  />
                </View>
              </View>
              
              <View style={modalStyles.materialFieldGroup}>
                <Text style={modalStyles.materialLabel}>Amount *</Text>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={modalStyles.materialInputBorder}
                >
                  <View style={modalStyles.materialInputWrapper}>
                    <Feather
                      name="dollar-sign"
                      size={16}
                      color="#22c55e"
                      style={modalStyles.materialInputIcon}
                    />
                    <TextInput
                      style={modalStyles.materialInput}
                      value={amount}
                      onChangeText={handleAmountChange}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      placeholder="$ 0.00"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                </LinearGradient>
              </View>
              
              <View style={modalStyles.materialFieldGroup}>
                <Text style={modalStyles.materialLabel}>Percentage (%)</Text>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={modalStyles.materialInputBorder}
                >
                  <View style={modalStyles.materialInputWrapper}>
                    <Feather
                      name="percent"
                      size={16}
                      color="#8DA0B8"
                      style={modalStyles.materialInputIcon}
                    />
                    <TextInput
                      style={modalStyles.materialInput}
                      value={percentage}
                      onChangeText={handlePercentageChange}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                </LinearGradient>
              </View>
              
              <View style={[modalStyles.materialFieldGroup, { marginBottom: 20 }]}>
                <Text style={modalStyles.materialLabel}>Scheduled Date (Optional)</Text>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={modalStyles.materialInputBorder}
                >
                  <TouchableOpacity
                    style={modalStyles.materialInputWrapper}
                    onPress={() => setShowDatePicker(!showDatePicker)}
                  >
                    <Feather
                      name="calendar"
                      size={16}
                      color="#8DA0B8"
                      style={modalStyles.materialInputIcon}
                    />
                    <Text style={{ 
                      flex: 1, 
                      fontSize: 15, 
                      color: scheduledDate ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                      fontWeight: '500',
                      paddingVertical: 12,
                    }}>
                      {scheduledDate ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
                {showDatePicker && (
                  <View style={{ marginTop: 8 }}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        setScheduledDate(day.dateString);
                        setShowDatePicker(false);
                      }}
                      markedDates={{
                        [scheduledDate || '']: {
                          selected: true,
                          selectedColor: '#38d39f',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={scheduledDate}
                    />
                  </View>
                )}
              </View>
            </ScrollView>
            
            {/* BOTTOM ACTION BAR */}
            <View style={[modalStyles.materialFooter, { paddingBottom: Math.max(insets.bottom, 20) + 30 }]}>
              <Pressable
                style={({ pressed }) => [
                  modalStyles.materialCancelBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={onClose}
              >
                <Text style={modalStyles.materialCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  modalStyles.materialSaveBtn,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                onPress={handleSave}
              >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={modalStyles.materialSaveButtonGradient}
                >
                  <Text style={modalStyles.materialSaveText}>✓ Save</Text>
                </LinearGradient>
              </Pressable>
            </View>
            </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const LineItemModal = ({ visible, onClose, item, onSave, title, laborMode }) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(item?.name || '');
  const [quantity, setQuantity] = useState(item?.quantity || 1);
  const [quantityText, setQuantityText] = useState(item?.quantity?.toString() || '');
  const [unit, setUnit] = useState(item?.unit || 'lot');
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice || 0);
  const [unitPriceText, setUnitPriceText] = useState(item?.unitPrice?.toString() || '');
  const [hours, setHours] = useState(item?.hours || '');
  const [rate, setRate] = useState(item?.rate || '');
  const [vendor, setVendor] = useState(item?.vendor || 'Home Depot');
  const [category, setCategory] = useState(item?.category || 'General');
  const [mode, setMode] = useState(item?.mode || laborMode || 'hourly');
  const [laborType, setLaborType] = useState(item?.laborType || 'inhouse');
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  const isLabor = title.includes('Labor');
  const isMaterial = title.includes('Material');
  
  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setQuantity(item.quantity || 1);
      setQuantityText(item.quantity?.toString() || '');
      setUnit(item.unit || 'lot');
      setUnitPrice(item.unitPrice || 0);
      setUnitPriceText(item.unitPrice?.toString() || '');
      setHours(item.hours || '');
      setRate(item.rate || '');
      setVendor(item.vendor || 'Home Depot');
      setCategory(item.category || 'General');
      setMode(item.mode || laborMode || 'hourly');
      setLaborType(item.laborType || 'inhouse');
    }
  }, [item, laborMode]);
  
  const handleSave = () => {
    const data = {
      name,
      ...(isLabor ? {
        mode: mode,
        laborType: laborType,
        hours: Number(hours) || 0,
        rate: Number(rate) || 0,
        total: (Number(hours) || 0) * (Number(rate) || 0)
      } : {
        quantity: isMaterial ? 1 : (Number(quantity) || 0),
        unit: isMaterial ? 'lot' : unit,
        unitPrice: Number(unitPrice) || 0,
        total: isMaterial ? (Number(unitPrice) || 0) : ((Number(quantity) || 0) * (Number(unitPrice) || 0)),
        ...(isMaterial && { vendor, category })
      })
    };
    
    if (item?.id) {
      onSave({ ...item, ...data });
    } else {
      onSave(data);
    }
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={(isMaterial || isLabor) ? "fullScreen" : "overFullScreen"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#000000' }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {(isMaterial || isLabor) ? (
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#000000' }}>
              {/* Header */}
              <View style={modalStyles.materialHeader}>
                <View style={modalStyles.backButtonWrapper}>
                  <LinearGradient
                    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                    start={{ x: 0.05, y: 0.15 }}
                    end={{ x: 0.95, y: 0.85 }}
                    style={modalStyles.backButtonBorder}
                  >
                    <TouchableOpacity
                      onPress={onClose}
                      style={modalStyles.backButton}
                    >
                      <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
                <View style={modalStyles.headerTitleRow}>
                      <View style={modalStyles.headerIconContainerWrapper}>
                    <LinearGradient
                      colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={modalStyles.headerIconBorder}
                    >
                      <View style={modalStyles.headerIconContainer}>
                        <MaterialCommunityIcons
                          name={isLabor ? "account-hard-hat" : "package-variant-closed"}
                          size={24}
                          color="#22c55e"
                        />
                      </View>
                    </LinearGradient>
                  </View>
                  <View style={modalStyles.headerTextBlock}>
                    <Text style={modalStyles.materialTitle}>
                      {isLabor ? 'Add Labor' : 'Add Materials & Equipment'}
                    </Text>
                    <Text style={modalStyles.materialSubtitle}>
                      {isLabor ? 'Log your labor expense' : 'Log your material or equipment expense'}
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Content */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingBottom: 100,
                }}
              >
                {isLabor ? (
                  <>
                    {/* Labor Name (Description) */}
                    <View style={modalStyles.materialFieldGroup}>
                      <Text style={modalStyles.materialLabel}>Item Name *</Text>
                      <View style={modalStyles.materialInputWrapper}>
                        <Feather
                          name="file-text"
                          size={16}
                          color="#8DA0B8"
                          style={modalStyles.materialInputIcon}
                        />
                        <TextInput
                          style={modalStyles.materialInput}
                          placeholder="Enter item name"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          value={name}
                          onChangeText={setName}
                          returnKeyType="next"
                          selectionColor="#22c55e"
                          underlineColorAndroid="transparent"
                          onFocus={() => setIsInputFocused(true)}
                          onBlur={() => setIsInputFocused(false)}
                        />
                      </View>
                    </View>

                    {/* Pricing Mode */}
                    <View style={modalStyles.materialFieldGroup}>
                      <Text style={modalStyles.materialLabel}>Pricing Mode *</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setMode('hourly')}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: mode === 'hourly' ? '#22c55e' : 'rgba(255, 255, 255, 0.15)',
                            backgroundColor: mode === 'hourly' ? '#22c55e' : 'rgba(255, 255, 255, 0.05)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            color: mode === 'hourly' ? '#000000' : '#FFFFFF',
                            fontWeight: '600',
                            fontSize: 14,
                          }}>⏰ Hourly</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setMode('sqft')}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: mode === 'sqft' ? '#2DFFC4' : 'rgba(255, 255, 255, 0.15)',
                            backgroundColor: mode === 'sqft' ? 'rgba(45, 255, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            color: mode === 'sqft' ? '#2DFFC4' : '#FFFFFF',
                            fontWeight: '600',
                            fontSize: 14,
                          }}>📐 Per Sq Ft</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Labor Type */}
                    <View style={modalStyles.materialFieldGroup}>
                      <Text style={modalStyles.materialLabel}>Labor Type *</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setLaborType('inhouse')}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: laborType === 'inhouse' ? '#2DFFC4' : 'rgba(255, 255, 255, 0.15)',
                            backgroundColor: laborType === 'inhouse' ? 'rgba(45, 255, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            color: laborType === 'inhouse' ? '#2DFFC4' : '#FFFFFF',
                            fontWeight: '600',
                            fontSize: 14,
                          }}>👷 In-house</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setLaborType('subcontractor')}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: laborType === 'subcontractor' ? '#22c55e' : 'rgba(255, 255, 255, 0.15)',
                            backgroundColor: laborType === 'subcontractor' ? '#22c55e' : 'rgba(255, 255, 255, 0.05)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            color: laborType === 'subcontractor' ? '#000000' : '#FFFFFF',
                            fontWeight: '600',
                            fontSize: 14,
                          }}>🔧 Subcontractor</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Hours/Rate Inputs */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[modalStyles.materialFieldGroup, { flex: 1 }]}>
                        <Text style={modalStyles.materialLabel}>{mode === 'sqft' ? 'Square Feet' : 'Hours'} *</Text>
                        <View style={modalStyles.materialInputWrapper}>
                          <Feather
                            name={mode === 'sqft' ? "maximize-2" : "clock"}
                            size={16}
                            color="#8DA0B8"
                            style={modalStyles.materialInputIcon}
                          />
                          <TextInput
                            style={modalStyles.materialInput}
                            placeholder="0"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={String(hours)}
                            onChangeText={setHours}
                            keyboardType="numeric"
                            returnKeyType="next"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            blurOnSubmit={true}
                            selectionColor="#22c55e"
                            underlineColorAndroid="transparent"
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                          />
                        </View>
                      </View>
                      <View style={[modalStyles.materialFieldGroup, { flex: 1 }]}>
                        <Text style={modalStyles.materialLabel}>{mode === 'sqft' ? 'Rate ($/sq ft)' : 'Rate ($/hr)'} *</Text>
                        <View style={modalStyles.materialInputWrapper}>
                          <Feather
                            name="dollar-sign"
                            size={16}
                            color="#22c55e"
                            style={modalStyles.materialInputIcon}
                          />
                          <TextInput
                            style={modalStyles.materialInput}
                            placeholder="$ 0.00"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={String(rate)}
                            onChangeText={setRate}
                            keyboardType="numeric"
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            blurOnSubmit={true}
                            selectionColor="#22c55e"
                            underlineColorAndroid="transparent"
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Total Display */}
                    <View style={[modalStyles.materialFieldGroup, { marginTop: 8 }]}>
                      <View style={{
                        backgroundColor: 'rgba(45, 255, 196, 0.1)',
                        borderRadius: 12,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(45, 255, 196, 0.3)',
                      }}>
                        <Text style={{
                          color: '#2DFFC4',
                          fontSize: 18,
                          fontWeight: '700',
                          textAlign: 'center',
                        }}>
                          Total: ${((Number(hours) || 0) * (Number(rate) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                      {/* Material Name (Description) */}
                      <View style={modalStyles.materialFieldGroup}>
                        <Text style={modalStyles.materialLabel}>Description *</Text>
                        <View style={modalStyles.materialInputWrapper}>
                          <Feather
                            name="file-text"
                            size={16}
                            color="#8DA0B8"
                            style={modalStyles.materialInputIcon}
                          />
                          <TextInput
                            style={modalStyles.materialInput}
                            placeholder="What was purchased or service provided?"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={name}
                            onChangeText={setName}
                            returnKeyType="next"
                            selectionColor="#22c55e"
                            underlineColorAndroid="transparent"
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                          />
                        </View>
                      </View>

                      {/* Vendor */}
                      <View style={modalStyles.materialFieldGroup}>
                        <Text style={modalStyles.materialLabel}>Vendor / Supplier *</Text>
                        <View style={modalStyles.materialInputWrapper}>
                          <Feather
                            name="store"
                            size={16}
                            color="#8DA0B8"
                            style={modalStyles.materialInputIcon}
                          />
                          <TextInput
                            style={modalStyles.materialInput}
                            placeholder="e.g., Home Depot, ABC Contractors"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={vendor}
                            onChangeText={setVendor}
                            returnKeyType="next"
                            selectionColor="#22c55e"
                            underlineColorAndroid="transparent"
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                          />
                        </View>
                      </View>

                      {/* Amount */}
                      <View style={modalStyles.materialFieldGroup}>
                        <Text style={modalStyles.materialLabel}>Amount *</Text>
                        <View style={modalStyles.materialInputWrapper}>
                          <Feather
                            name="dollar-sign"
                            size={16}
                            color="#22c55e"
                            style={modalStyles.materialInputIcon}
                          />
                          <TextInput
                            style={modalStyles.materialInput}
                            placeholder="$ 0.00"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={unitPriceText || (unitPrice > 0 ? unitPrice.toString() : '')}
                            onChangeText={(text) => {
                              const cleanText = text.replace(/[^0-9.]/g, '');
                              setUnitPriceText(cleanText);
                              setUnitPrice(parseFloat(cleanText) || 0);
                            }}
                            keyboardType="numeric"
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            blurOnSubmit={true}
                            selectionColor="#22c55e"
                            underlineColorAndroid="transparent"
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                          />
                        </View>
                      </View>

                      {/* Category (Optional) */}
                      <View style={[modalStyles.materialFieldGroup, { marginTop: 24 }]}>
                        <Text style={modalStyles.materialLabel}>Category (Optional)</Text>
                        <View style={modalStyles.materialChipRow}>
                          {['Lumber', 'Framing', 'Drywall', 'Electrical', 'Plumbing', 'Roofing', 'Flooring', 'Paint', 'Tile', 'Concrete', 'Hardware', 'Appliances', 'Fixtures', 'Insulation', 'HVAC', 'General'].map((c) => (
                            <TouchableOpacity
                              key={c}
                              onPress={() => setCategory(c)}
                              style={[modalStyles.materialChip, category === c && modalStyles.materialChipActive]}
                            >
                              <Text style={[modalStyles.materialChipText, category === c && modalStyles.materialChipTextActive]}>
                                {c}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                </>
                )}
              </ScrollView>
              
              {/* Footer */}
              {!isInputFocused && (
                <View style={modalStyles.materialFooter}>
                  <TouchableOpacity onPress={onClose} style={modalStyles.materialCancelBtn}>
                    <Text style={modalStyles.materialCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} style={modalStyles.materialSaveBtn}>
                    <LinearGradient
                      colors={["#22c55e", "#22d3ee"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={modalStyles.materialSaveButtonGradient}
                    >
                      <Text style={modalStyles.materialSaveText}>✓ Save</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ) : (
          <>
            {/* Backdrop */}
            <Pressable style={modalStyles.backdrop} onPress={onClose} />
            
            {/* Bottom Sheet */}
            <View style={modalStyles.bottomSheet}>
              <View style={modalStyles.container}>
                <View style={modalStyles.header}>
                  <Text style={modalStyles.title}>{title}</Text>
                  <TouchableOpacity onPress={onClose}>
                    <Text style={modalStyles.closeBtn}>×</Text>
                  </TouchableOpacity>
                </View>
                
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  contentInsetAdjustmentBehavior="automatic"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: insets.bottom + 80,
                  }}
                >
                  <View style={modalStyles.inputGroup}>
                    <Text style={modalStyles.label}>Item Name</Text>
                    <TextInput
                      style={modalStyles.input}
                      value={name}
                      onChangeText={setName}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      blurOnSubmit={true}
                      placeholder="Enter item name"
                      placeholderTextColor={Colors.sub}
                    />
                  </View>
                  
                  {isLabor ? (
                    <>
                      {/* Pricing Mode Toggle */}
                      <View style={modalStyles.inputGroup}>
                        <Text style={modalStyles.label}>Pricing Mode</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => setMode('hourly')}
                            style={{
                              flex: 1,
                              backgroundColor: mode === 'hourly' ? Colors.blue : Colors.cardDark,
                              paddingVertical: 12,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: mode === 'hourly' ? Colors.blue : Colors.line
                            }}>
                            <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 14, textAlign: 'center' }}>⏰ Hourly</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setMode('sqft')}
                            style={{
                              flex: 1,
                              backgroundColor: mode === 'sqft' ? '#60a5fa' : Colors.cardDark,
                              paddingVertical: 12,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: mode === 'sqft' ? '#60a5fa' : Colors.line
                            }}>
                            <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 14, textAlign: 'center' }}>📐 Per Sq Ft</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      {/* Labor Type Toggle */}
                      <View style={modalStyles.inputGroup}>
                        <Text style={modalStyles.label}>Labor Type</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => setLaborType('inhouse')}
                            style={{
                              flex: 1,
                              backgroundColor: laborType === 'inhouse' ? Colors.primary : Colors.cardDark,
                              paddingVertical: 12,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: laborType === 'inhouse' ? Colors.primary : Colors.line
                            }}>
                            <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 14, textAlign: 'center' }}>👷 In-house</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setLaborType('subcontractor')}
                            style={{
                              flex: 1,
                              backgroundColor: laborType === 'subcontractor' ? '#f59e0b' : Colors.cardDark,
                              paddingVertical: 12,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: laborType === 'subcontractor' ? '#f59e0b' : Colors.line
                            }}>
                            <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 14, textAlign: 'center' }}>🔧 Subcontractor</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View style={modalStyles.row}>
                        <View style={[modalStyles.inputGroup, { flex: 1 }]}>
                          <Text style={modalStyles.label}>{mode === 'sqft' ? 'Square Feet' : 'Hours'}</Text>
                          <TextInput
                            style={modalStyles.input}
                            value={String(hours)}
                            onChangeText={(text) => setHours(text)}
                            keyboardType="numeric"
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            blurOnSubmit={true}
                            placeholderTextColor={Colors.sub}
                            placeholder="0"
                          />
                        </View>
                        <View style={[modalStyles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                          <Text style={modalStyles.label}>{mode === 'sqft' ? 'Rate ($/sq ft)' : 'Rate ($/hr)'}</Text>
                          <TextInput
                            style={modalStyles.input}
                            value={String(rate)}
                            onChangeText={(text) => setRate(text)}
                            keyboardType="numeric"
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            blurOnSubmit={true}
                            placeholderTextColor={Colors.sub}
                            placeholder="0"
                          />
                        </View>
                      </View>
                      <View style={modalStyles.totalBox}>
                        <Text style={modalStyles.totalLabel}>Total: ${((Number(hours) || 0) * (Number(rate) || 0)).toLocaleString()}</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={modalStyles.row}>
                        <View style={[modalStyles.inputGroup, { flex: 1 }]}>
                          <Text style={modalStyles.label}>Quantity</Text>
                          <TextInput
                            style={modalStyles.input}
                            value={quantityText || (quantity > 0 ? quantity.toString() : '')}
                            onChangeText={(text) => {
                              const cleanText = text.replace(/[^0-9.]/g, '');
                              setQuantityText(cleanText);
                              setQuantity(parseFloat(cleanText) || 0);
                            }}
                            keyboardType="numeric"
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            blurOnSubmit={true}
                            placeholderTextColor={Colors.sub}
                          />
                        </View>
                        <View style={[modalStyles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                          <Text style={modalStyles.label}>Unit</Text>
                          <TextInput
                            style={modalStyles.input}
                            value={unit}
                            onChangeText={setUnit}
                            placeholder="lot, sq ft, etc"
                            placeholderTextColor={Colors.sub}
                          />
                        </View>
                      </View>
                      <View style={modalStyles.inputGroup}>
                        <Text style={modalStyles.label}>Unit Price ($)</Text>
                        <TextInput
                          style={modalStyles.input}
                          value={unitPriceText || (unitPrice > 0 ? unitPrice.toString() : '')}
                          onChangeText={(text) => {
                            const cleanText = text.replace(/[^0-9.]/g, '');
                            setUnitPriceText(cleanText);
                            setUnitPrice(parseFloat(cleanText) || 0);
                          }}
                          keyboardType="numeric"
                          returnKeyType="done"
                          onSubmitEditing={() => Keyboard.dismiss()}
                          blurOnSubmit={true}
                          placeholderTextColor={Colors.sub}
                        />
                      </View>
                      
                      <View style={modalStyles.totalBox}>
                        <Text style={modalStyles.totalLabel}>Total: ${((Number(quantity) || 0) * (Number(unitPrice) || 0)).toLocaleString()}</Text>
                      </View>
                    </>
                  )}
                </ScrollView>
                
                <View style={modalStyles.footer}>
                  <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
                    <Text style={modalStyles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} style={modalStyles.saveBtn}>
                    <Text style={modalStyles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const blankState = () => ({
  id: String(Date.now()),
  title: 'Untitled Bid',
  region: 'NV',
  template: '',
  projectType: 'kitchen',
  projectCategory: PROJECT_CATEGORY_SLUGS.kitchen,
  
  // Project Info
  sqft: 1250,
  category: 'kitchen-remodel',
  desiredStartDate: '',
  budgetRange: '',
  
  // Legal
  license: true,
  insurance: true,
  bond: false,
  osha: false,
  
  // Timeline
  startDate: '',
  endDate: '',
  
  // Scope
  scopeDescription: '',
  
  // Developer
  permitCost: 0,
  permitCostText: '',
  zoning: 'residential',
  
  // Materials - Detailed line items
  materialLineItems: [],
  
  // Labor - Detailed line items
  laborLineItems: [],
  
  // Labor (calculated from line items)
  labor: 0,
  unionToggle: false,
  zipRate: 38,
  
  // Overhead
  insuranceOverhead: 0,
  equipment: 0,
  facilities: 0,
  otherOverhead: 0,
  
  // Percentages
  contingencyPct: 7,
  markupPct: 20,
  
  // Contractor Type (1-4)
  contractorType: null, // null = not set, 1-4 = type
  
  // Communication
  clientUpdates: 'weekly',
  internalChannel: 'inapp',
  
  // Client
  clientName: '',
  clientEmail: '',
  clientTransparency: 'totals',
  esign: true,
  
  // Customer Information
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerAddress: '',
  customerCity: '',
  customerState: '',
  customerZip: '',
  customerCompany: '',
  customerNotes: '',
  
  // Unit mode
  unitMode: 'sqft',
  
  // Payment Schedule
  paymentSchedule: 'milestone-based',
  paymentMilestones: [],
  weeklyPayments: [],
});

// Money formatting helper - preserves exact decimals, shows 2 decimal places
const money = (n) => {
  const value = Number(n) || 0;
  // Don't round - preserve exact decimal precision, just format for display
  return value.toLocaleString(undefined, { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });
};

// Gradient colors for borders
const GRAD = ['#2DFFC4', '#00A6FF'];
// Premium border: same colors, lower intensity to reduce "neon"
const GRAD_SOFT = ['rgba(45,255,196,0.55)', 'rgba(0,166,255,0.55)'];

// GlassBorderCard component
const GlassBorderCard = ({
  children,
  radius = 24,
  innerRadius,
  pad = 16,
  soft = false,
  style,
}) => {
  const r = radius;
  const ir = innerRadius ?? (r - 2);
  
  // Safety check: wrap string/number children in Text component
  const safeChildren = typeof children === 'string' || typeof children === 'number' 
    ? <Text>{children}</Text>
    : children;
  
  return (
    <LinearGradient
      colors={soft ? GRAD_SOFT : GRAD}
      start={{ x: 0.05, y: 0.15 }}
      end={{ x: 0.95, y: 0.85 }}
      style={[{ borderRadius: r, padding: 1 }, style]}
    >
      <View
        style={{
          backgroundColor: '#000',
          borderRadius: ir,
          padding: pad,
        }}
      >
        {safeChildren}
      </View>
    </LinearGradient>
  );
};

// Pill component
const Pill = ({
  label,
  icon,
  tint = 'rgba(255,255,255,0.10)',
  textColor = 'rgba(229,231,235,0.85)',
}) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: tint,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    }}
  >
    {icon}
    <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>
      {label}
    </Text>
  </View>
);

// Gradient Card component for consistent styling
const GradientCard = ({ children, style, innerStyle }) => (
  <LinearGradient
    colors={['#2DFFC4', '#00A6FF']}
    start={{ x: 0.05, y: 0.15 }}
    end={{ x: 0.95, y: 0.85 }}
    style={[{ borderRadius: 24, padding: 1, marginHorizontal: 16, marginVertical: 8 }, style]}
  >
    <View style={[{ backgroundColor: '#000000', borderRadius: 22, padding: 20 }, innerStyle]}>
      {children}
    </View>
  </LinearGradient>
);

// Get icon for each step
const getStepIcon = (stepNum) => {
  const icons = {
    0: 'summarize', // Bid Summary (not a numbered step)
    1: 'person', // Customer Information
    2: 'info', // Project Information
    3: 'inventory', // Materials & Supplies
    4: 'people', // Labor & Subs
    5: 'trending-up', // Overhead & Markup
    6: 'analytics', // Project Analysis
    7: 'schedule', // Payment / Work Schedule
    8: 'description', // Final Bid & Contract
  };
  return icons[stepNum] || 'check-circle';
};

const normalizeTimelineStatus = (status) => {
  const value = (status || '').toLowerCase();
  if (value.includes('complete')) return 'completed';
  if (value.includes('progress') || value.includes('in-progress')) return 'in_progress';
  return 'pending';
};

const convertPaymentMilestonesToTimelineEntries = (milestones = []) => {
  if (!Array.isArray(milestones)) return [];
  return milestones.map((milestone, index) => ({
    id: milestone.id || `payment-${index}`,
    title: milestone.name || milestone.title || `Payment ${index + 1}`,
    plannedDate: milestone.scheduledDate || milestone.dueDate || milestone.plannedDate || new Date().toISOString().split('T')[0],
    progressPct: milestone.progressPct ?? (milestone.status === 'completed' ? 100 : milestone.status === 'in_progress' ? 50 : 0),
    status: normalizeTimelineStatus(milestone.status) || 'pending',
    assignee: milestone.assignee || 'Client',
    costDelta: milestone.costDelta || 0,
    costCategory: milestone.costCategory || 'materials',
    dependsOnId: milestone.dependsOnId,
    amount: milestone.paymentAmount ?? milestone.amount ?? 0,
    percentage: milestone.percentage ?? 0,
    description: milestone.description,
  }));
};

const convertWeeklyPaymentsToTimelineEntries = (payments = []) => {
  if (!Array.isArray(payments)) return [];
  return payments.map((payment, index) => ({
    id: payment.id || `week-${index}`,
    title: payment.description || payment.name || `Week ${payment.weekNumber || index + 1} Progress Payment`,
    plannedDate: payment.scheduledDate || payment.dueDate || payment.plannedDate || new Date().toISOString().split('T')[0],
    progressPct: payment.progressPct ?? (payment.status === 'completed' ? 100 : payment.status === 'in_progress' ? 50 : 0),
    status: normalizeTimelineStatus(payment.status) || 'pending',
    assignee: payment.assignee || 'Client',
    amount: payment.amount ?? payment.paymentAmount ?? 0,
    percentage: payment.percentage ?? 0,
    weekNumber: payment.weekNumber || index + 1,
    description: payment.description,
  }));
};

const convertTimelineEntriesToPaymentSchedule = (timeline = []) => {
  return timeline.map((milestone, index) => ({
    id: milestone.id || `payment-${index}`,
    name: milestone.title || `Payment ${index + 1}`,
    title: milestone.title || `Payment ${index + 1}`,
    description: milestone.description || '',
    scheduledDate: milestone.plannedDate,
    dueDate: milestone.plannedDate,
    status: milestone.status || 'pending',
    progressPct: milestone.progressPct ?? 0,
    paymentAmount: milestone.amount ?? 0,
    amount: milestone.amount ?? 0,
    percentage: milestone.percentage ?? 0,
  }));
};

const convertTimelineEntriesToWeeklySchedule = (timeline = []) => {
  const sorted = [...timeline].sort((a, b) => {
    const dateA = new Date(a.plannedDate || a.dueDate || Date.now()).getTime();
    const dateB = new Date(b.plannedDate || b.dueDate || Date.now()).getTime();
    return dateA - dateB;
  });
  return sorted.map((milestone, index) => ({
    id: milestone.id || `week-${index}`,
    description: milestone.title || milestone.description || `Week ${index + 1} Progress Payment`,
    scheduledDate: milestone.plannedDate,
    status: milestone.status || 'pending',
    progressPct: milestone.progressPct ?? 0,
    amount: milestone.amount ?? 0,
    paymentAmount: milestone.amount ?? 0,
    percentage: milestone.percentage ?? 0,
    weekNumber: milestone.weekNumber || index + 1,
  }));
};

const buildTimelineFromProject = (project) => {
  if (!project) return [];
  const scheduleType = project.paymentSchedule || project.projectData?.paymentSchedule || 'milestone-based';
  let timeline = [];

  if (scheduleType === 'weekly' && Array.isArray(project.weeklyPayments) && project.weeklyPayments.length > 0) {
    timeline = convertWeeklyPaymentsToTimelineEntries(project.weeklyPayments);
  }

  if (timeline.length === 0 && Array.isArray(project.milestones) && project.milestones.length > 0) {
    timeline = convertPaymentMilestonesToTimelineEntries(project.milestones);
  }

  if (timeline.length === 0 && Array.isArray(project?.estimateData?.weeklyPayments) && project.estimateData.weeklyPayments.length > 0) {
    timeline = convertWeeklyPaymentsToTimelineEntries(project.estimateData.weeklyPayments);
  }

  if (timeline.length === 0 && Array.isArray(project?.estimateData?.paymentMilestones) && project.estimateData.paymentMilestones.length > 0) {
    timeline = convertPaymentMilestonesToTimelineEntries(project.estimateData.paymentMilestones);
  }

  return timeline;
};

// ============ STYLES ============
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  // Gradient border wrapper for cards
  cardBorderWrapper: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 24,
    padding: 1,
  },
  stepCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  // For inline stepCard usage without gradient wrapper
  stepCardWithBorder: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.5)',
  },
  stepSub: {
    color: Colors.sub,
    fontSize: 14,
    marginBottom: 16,
  },
  customerInfoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: Colors.sub,
    fontSize: 14,
    marginTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.line,
    marginVertical: 16,
  },
  inputGroupCompact: {
    marginBottom: 16,
  },
  label: {
    color: Colors.sub,
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputGradientWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  inputGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modernInputGradient: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(45, 255, 196, 0.2)',
    borderColor: '#2DFFC4',
  },
  chipMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cardDark,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chipRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chipText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  outlineBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  outlineBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  labelValue: {
    color: Colors.text,
    fontSize: 14,
  },
  infoBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  infoText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  editBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.cardDark,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  cancelBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 8,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  // HEADER WRAP
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f9fafb',
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  // + New pill (Dashboard profile glow style)
  newPillOuter: {
    borderRadius: 999,
    padding: 2,
    shadowColor: '#22c55e',
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  newPillInner: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  newPillText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '800',
  },
  // NAV PILL (Segmented)
  navWide: {
    marginHorizontal: 0,
  },
  navPill: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#19E180',
  },
  navInner: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  navTab: {
    flex: 1,
    borderRadius: 999,
  },
  navTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E5F7FF',
  },
  navTabActive: {
    flex: 1,
    borderRadius: 999,
    shadowColor: '#19E180',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  navTabActiveInner: {
    borderRadius: 999,
  },
  navLabelActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#050B13',
  },
  // same idea as Dashboard wideContainer
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 8,
  },
  gradBorder: {
    borderRadius: 20,
    padding: 1,
  },
  cardInner: {
    backgroundColor: '#000000',
    borderRadius: 18,
  },
  // Bid Summary (stepper) panel - match Total Bid width
  stepperPanelInner: {
    backgroundColor: '#000000',
    borderRadius: 18,
    padding: 14,
  },
  // Thinner nav pill - matches dashboard segmented control
  navPillBorder: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#19E180',
  },
  navPillInner: {
    flexDirection: 'row',
    padding: 3,
  },
  navBtn: {
    flex: 1,
    borderRadius: 999,
  },
  navBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  navCenterBtn: {
    flex: 1,
    borderRadius: 999,
  },
  navCenterBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  navNextWrap: {
    flex: 1,
    borderRadius: 999,
  },
  navNextActive: {
    shadowColor: '#22c55e',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  navNextInner: {
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
});

export default function EstimateGeneratorScreen() {
  // Require authentication to access this screen
  useRequireAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // Start at step 0 (Bid Summary) - default first page
  const [activeNavButton, setActiveNavButton] = useState('summary'); // 'back', 'summary', or 'next'
  const [bid, setBid] = useState(blankState());
  const [isLoaded, setIsLoaded] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [savedEstimates, setSavedEstimates] = useState([]);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  
  // Local state for markup percentage input to prevent glitching while typing
  const [markupPctText, setMarkupPctText] = useState('');
  const markupInputRef = useRef(null);
  const isMarkupFocused = useRef(false);
  const { addEstimate, convertBidToProject, updateProject, activeProjects, estimates, deleteProject } = useProjectList();
  const cleanupRanRef = useRef(false);

  // Load saved estimates on component mount
  useEffect(() => {
    loadSavedEstimates();
  }, []);

  // Sync markup percentage text with bid state (only when not focused to prevent glitching)
  useEffect(() => {
    if (!isMarkupFocused.current) {
      const markupValue = bid.markupPct !== undefined && bid.markupPct !== null ? String(bid.markupPct) : '';
      setMarkupPctText(markupValue);
    }
  }, [bid.markupPct]);

  // Clean up duplicate "Untitled Bid" entries - keep only the most recent one
  useEffect(() => {
    const cleanupDuplicates = async () => {
      try {
        // Get all estimates with "Untitled Bid" title
        const untitledBids = estimates.filter(e => {
          const titleMatch = (e.title === 'Untitled Bid' || e.title === '' || !e.title);
          const statusMatch = e.status === 'estimate';
          return titleMatch && statusMatch;
        });
        
        console.log(`🔍 [CLEANUP] Checking for duplicate "Untitled Bid" entries...`);
        console.log(`🔍 [CLEANUP] Total estimates: ${estimates.length}`);
        console.log(`🔍 [CLEANUP] Untitled bids found: ${untitledBids.length}`);
        
        if (untitledBids.length > 1) {
          console.log(`🧹 [CLEANUP] Found ${untitledBids.length} duplicate "Untitled Bid" entries, cleaning up...`);
          
          // Sort by updatedAt (most recent first) or createdAt as fallback
          const sorted = [...untitledBids].sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return bTime - aTime; // Most recent first
          });
          
          // Keep the most recent one
          const keepId = sorted[0].id;
          console.log(`✅ [CLEANUP] Keeping most recent "Untitled Bid": ${keepId}`);
          
          // Delete all others - delete in reverse order to avoid index issues
          const toDelete = sorted.slice(1);
          console.log(`🗑️ [CLEANUP] Deleting ${toDelete.length} duplicate(s)...`);
          
          for (const duplicate of toDelete) {
            console.log(`🗑️ [CLEANUP] Deleting: ${duplicate.id}`);
            deleteProject(duplicate.id);
          }
          
          console.log(`✅ [CLEANUP] Cleanup initiated for ${toDelete.length} duplicate(s)`);
          cleanupRanRef.current = true;
        } else if (untitledBids.length === 1) {
          console.log(`✅ [CLEANUP] Only one "Untitled Bid" found, no cleanup needed`);
          cleanupRanRef.current = true;
        } else {
          cleanupRanRef.current = true;
        }
      } catch (error) {
        console.error('❌ [CLEANUP] Error cleaning up duplicates:', error);
      }
    };
    
    // Run cleanup when estimates are available (only once)
    if (estimates.length > 0 && !cleanupRanRef.current) {
      // Small delay to ensure state is ready
      const timeoutId = setTimeout(() => {
        cleanupDuplicates();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [estimates.length]); // Only depend on length to avoid re-running unnecessarily

  const loadSavedEstimates = async () => {
    try {
      const saved = await AsyncStorage.getItem('savedEstimates');
      if (saved) {
        const estimates = JSON.parse(saved);
        setSavedEstimates(estimates);
        console.log(`📋 Loaded ${estimates.length} saved estimates`);
      }
    } catch (error) {
      console.error('Error loading saved estimates:', error);
    }
  };

  const saveCurrentEstimate = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const estimateData = {
        id: bid.id,
        title: bid.title || 'Untitled Bid',
        timestamp: new Date().toISOString(),
        data: { ...bid }, // Full bid data
        total: calc?.total || 0,
        customer: bid.customerName || 'Unknown Customer',
      };

      const updatedEstimates = [estimateData, ...savedEstimates.filter(e => e.id !== bid.id)];
      setSavedEstimates(updatedEstimates);
      
      await AsyncStorage.setItem('savedEstimates', JSON.stringify(updatedEstimates));
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Estimate Saved', `"${estimateData.title}" has been saved for recovery.`);
      console.log(`💾 Saved estimate: ${estimateData.title} ($${estimateData.total})`);

      try {
        const snapshot = {
          ...bid,
          paymentMilestones: Array.isArray(bid.paymentMilestones)
            ? bid.paymentMilestones.map((milestone, index) => ({
                ...milestone,
                id: milestone.id || `payment-${index}`,
              }))
            : [],
          weeklyPayments: Array.isArray(bid.weeklyPayments)
            ? bid.weeklyPayments.map((payment, index) => ({
                ...payment,
                id: payment.id || `week-${index}`,
              }))
            : [],
        };
        await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(snapshot));
        console.log('💾 Saved current bid snapshot (including payment schedule) to storage.');
        lastSavedBidRef.current = null;
      } catch (snapshotError) {
        console.error('Error saving bid snapshot after Save Estimate:', snapshotError);
      }
    } catch (error) {
      console.error('Error saving estimate:', error);
      Alert.alert('Error', 'Failed to save estimate');
    }
  };

  const backupCurrentEstimateSilently = async () => {
    try {
      const estimateData = {
        id: bid.id,
        title: bid.title || 'Untitled Bid',
        timestamp: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(bid)),
        total: calc?.grandTotal || 0,
        customer: bid.customerName || 'Unknown Customer',
      };

      const updatedEstimates = [estimateData, ...savedEstimates.filter(e => e.id !== bid.id)];
      setSavedEstimates(updatedEstimates);
      await AsyncStorage.setItem('savedEstimates', JSON.stringify(updatedEstimates));
      console.log(`📦 Auto-backed up estimate "${estimateData.title}" before creating a new one.`);
    } catch (error) {
      console.error('Error backing up estimate before clearing:', error);
    }
  };

  const findProjectForAIAction = (projectId, projectName) => {
    let targetProjectId = projectId;
    let targetProject = null;

    if (targetProjectId) {
      targetProject =
        activeProjects.find((p) => p.id === targetProjectId) ||
        estimates.find((p) => p.id === targetProjectId);
    }

    if (!targetProject) {
      const searchName = (projectName || "").toLowerCase().trim();
      if (searchName) {
        targetProject =
          activeProjects.find((p) => {
            const title = (p.title || "").toLowerCase().trim();
            const customer = (p.client || p.customerName || "").toLowerCase().trim();
            return (
              title.includes(searchName) ||
              searchName.includes(title) ||
              customer.includes(searchName) ||
              searchName.includes(customer)
            );
          }) ||
          estimates.find((p) => {
            const title = (p.title || "").toLowerCase().trim();
            const customer = (p.client || p.customerName || "").toLowerCase().trim();
            return (
              title.includes(searchName) ||
              searchName.includes(title) ||
              customer.includes(searchName) ||
              searchName.includes(customer)
            );
          });
        if (targetProject) {
          targetProjectId = targetProject.id;
        }
      }
    }

    if (!targetProject) {
      const searchName = (projectName || "").toLowerCase().trim();
      const bidTitle = (bid.title || "").toLowerCase().trim();
      const bidCustomer = (bid.customerName || "").toLowerCase().trim();

      if (
        bidTitle.includes(searchName) ||
        searchName.includes(bidTitle) ||
        bidCustomer.includes(searchName) ||
        searchName.includes(bidCustomer)
      ) {
        targetProject =
          activeProjects.find((p) => p.id === bid.id) ||
          estimates.find((p) => p.id === bid.id);
        targetProjectId = bid.id;
      }
    }

    return { targetProject, targetProjectId };
  };

  const loadEstimate = async (estimate) => {
    try {
      // Set flag to prevent other effects from interfering during load
      isInitialLoadRef.current = true;
      
      const estimateData = estimate.data;
      
      // Restore materials from estimate if they exist
      if (estimateData.materialLineItems && Array.isArray(estimateData.materialLineItems) && estimateData.materialLineItems.length > 0) {
        const restoredMaterials = estimateData.materialLineItems.map(item => ({
          id: item.id || String(Date.now()),
          name: item.name || item.description || 'Material',
          description: item.description || item.name || 'Material',
          qty: item.quantity || item.qty || 1,
          quantity: item.quantity || item.qty || 1,
          unit: item.unit || 'ea',
          unitPrice: item.unitPrice || item.unitCost || (item.total / (item.quantity || 1)),
          cost: item.cost || item.unitCost || (item.total / (item.quantity || 1)),
          total: Number(item.total) || 0,
          section: item.section || 'General Materials',
          scope: item.scope || activeScope,
          sku: item.sku || '',
          vendorId: item.vendorId || item.vendor || '',
          isManual: item.source === 'manual' || item.isManual || false,
        }));
        
        setMaterialsCart(restoredMaterials);
        await AsyncStorage.setItem('bps.materialsCart', JSON.stringify(restoredMaterials));
        console.log(`📦 Restored ${restoredMaterials.length} materials from estimate`);
      } else {
        // Clear materials if estimate has none
        setMaterialsCart([]);
        await AsyncStorage.setItem('bps.materialsCart', JSON.stringify([]));
      }
      
      // Update the bid with materialLineItems synced
      const updatedBid = {
        ...estimateData,
        materialLineItems: estimateData.materialLineItems || [],
      };
      
      // Save to AsyncStorage immediately to prevent conflicts
      await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updatedBid));
      
      // Set bid state
      setBid(updatedBid);
      
      // Reset refs to prevent save conflicts
      lastSavedBidRef.current = null;
      pendingSaveRef.current = null;
      
      // Clear initial load flag after a short delay to allow state to settle
      setTimeout(() => {
        isInitialLoadRef.current = false;
        console.log('✅ Estimate loaded and state settled');
      }, 500);
      
      setShowRecoveryModal(false);
      Alert.alert('✅ Estimate Loaded', `"${estimate.title}" has been loaded.`);
      console.log(`🔄 Loaded estimate: ${estimate.title}`);
    } catch (error) {
      console.error('Error loading estimate:', error);
      Alert.alert('Error', 'Failed to load estimate');
      // Clear flag on error
      isInitialLoadRef.current = false;
    }
  };

  const deleteEstimate = async (estimateId) => {
    try {
      const updatedEstimates = savedEstimates.filter(e => e.id !== estimateId);
      setSavedEstimates(updatedEstimates);
      await AsyncStorage.setItem('savedEstimates', JSON.stringify(updatedEstimates));
      Alert.alert('✅ Deleted', 'Estimate has been deleted.');
    } catch (error) {
      console.error('Error deleting estimate:', error);
      Alert.alert('Error', 'Failed to delete estimate');
    }
  };
  
  // Profile state for contractor info
  const [contractorProfile, setContractorProfile] = useState({
    name: 'John Smith',
    company: 'Smith Construction Co.',
    avatar: null,
  });
  
  // Modal states
  const [materialModal, setMaterialModal] = useState({ visible: false, item: null });
  const [laborModal, setLaborModal] = useState({ visible: false, item: null });
  const [laborPricingMode, setLaborPricingMode] = useState('hourly');
  const [overheadModal, setOverheadModal] = useState(false);
  const [projectInfoModal, setProjectInfoModal] = useState(false);
  const [clientInfoModal, setClientInfoModal] = useState(false);
  const [titleModal, setTitleModal] = useState(false);
  const [bidsListModal, setBidsListModal] = useState(false);
  const [savedBids, setSavedBids] = useState([]);
  const [skuModalVisible, setSkuModalVisible] = useState(false);
  const [savedMaterialsVisible, setSavedMaterialsVisible] = useState(false);
  const [calendarClickModal, setCalendarClickModal] = useState({ visible: false, date: null });
  const [customDepositModal, setCustomDepositModal] = useState({ visible: false, value: '' });
  const [customFinalModal, setCustomFinalModal] = useState({ visible: false, value: '' });
  const [subcontractorModalVisible, setSubcontractorModalVisible] = useState(false);
  const [showMessagesInbox, setShowMessagesInbox] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState({ visible: false, item: null });
  const [weeklyPaymentModal, setWeeklyPaymentModal] = useState({ visible: false, item: null });
  const [scoreExplanationExpanded, setScoreExplanationExpanded] = useState(false);
  const [healthScoreBreakdownExpanded, setHealthScoreBreakdownExpanded] = useState(false);
  
  // Enhanced materials state
  const [activeScope, setActiveScope] = useState('kitchen');

  const normalizeScope = useCallback((value) => {
    if (!value) return 'other';
    const slug = value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/\s+/g, '_');

    if (slug.includes('kitchen')) return 'kitchen';
    if (slug.includes('bathroom')) return 'bathroom';
    if (slug.includes('room_add')) return 'room_addition';
    if (slug.includes('home_add') || slug.includes('home-renov')) return 'home_addition';
    if (slug.includes('new_build') || slug.includes('new-build') || slug.includes('newhome') || slug.includes('custom')) return 'new_build';
    if (slug.includes('landscape')) return 'landscaping';
    return 'other';
  }, []);

  const handleScopeChange = useCallback(
    (scope) => {
      setActiveScope(scope);
      const categorySlug = PROJECT_CATEGORY_SLUGS[scope] || 'other';
      setBid(prev => ({
        ...prev,
        projectType: scope,
        projectCategory: categorySlug,
        category: categorySlug,
        template: scope,
      }));
    },
    []
  );
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialNeedQty, setMaterialNeedQty] = useState({});
  const [materialSelectedVendor, setMaterialSelectedVendor] = useState({});
  const [materialsCart, setMaterialsCart] = useState([]);
  const [isCartExpanded, setIsCartExpanded] = useState(true);
  const [isLaborCartExpanded, setIsLaborCartExpanded] = useState(true);
  const [editingCartItem, setEditingCartItem] = useState(null);

  // Rental equipment state
  const [rentalCart, setRentalCart] = useState([]);
  const [rentalSearch, setRentalSearch] = useState('');
  const [rentalSelectedStore, setRentalSelectedStore] = useState('hd');
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);
  const [expandedMilestones, setExpandedMilestones] = useState({});
  const [activeMilestoneForScheduling, setActiveMilestoneForScheduling] = useState(null);
  const [showMilestoneDatePicker, setShowMilestoneDatePicker] = useState(null);
  const [showCostBreakdownModal, setShowCostBreakdownModal] = useState(false);
  const [costAnalysis, setCostAnalysis] = useState(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [showAiSheet, setShowAiSheet] = useState(false);

  // Load bid from storage
  useEffect(() => {
    const loadBid = async () => {
      try {
        // Try to load current bid
        const saved = await AsyncStorage.getItem(BID_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log(`📝 Loaded bid: ${parsed.title}`);
          
          // If this bid comes from a lead proposal, clear all materials, rentals, and line items
          const isFromLead = parsed.leadId && parsed.leadSource === 'qualified_lead';
          
          if (isFromLead && !parsed._leadInitialized) {
            console.log(`🧹 Clearing materials, rentals, and line items for lead proposal`);
            console.log(`👤 Customer info from lead:`, {
              name: parsed.customerName,
              email: parsed.customerEmail,
              phone: parsed.customerPhone,
              city: parsed.customerCity,
              state: parsed.customerState,
              zip: parsed.customerZip
            });
            
            // Clear materials and rentals from AsyncStorage FIRST (before setting state)
            await AsyncStorage.setItem('bps.materialsCart', JSON.stringify([]));
            await AsyncStorage.setItem('bps.rentalCart', JSON.stringify([]));
            // Clear materials and rentals from state
            setMaterialsCart([]);
            setRentalCart([]);
            // Ensure line items are empty
            parsed.materialLineItems = [];
            parsed.laborLineItems = [];
            parsed.labor = 0;
            parsed._leadInitialized = true;
            // IMPORTANT: Preserve customer info fields when clearing materials
            // These should already be set from LeadDetailModal, but ensure they're not lost
            // Save the updated bid back to storage with cleared line items but preserved customer info
            await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(parsed));
          }
          
          // If it's a blank/untitled bid, try to find the Haim bid in other storage keys
          if (parsed.title === 'Untitled Bid' || !parsed.title || parsed.title === '') {
            console.log('🔍 Current bid is blank, searching for Haim bid...');
            
            // Try different possible storage keys
            const possibleKeys = [
              'bps.currentBid',
              'bps.currentBid.v1', 
              'bps.haimBid',
              'bps.backupBid'
            ];
            
            for (const key of possibleKeys) {
              try {
                const backup = await AsyncStorage.getItem(key);
                if (backup) {
                  const backupParsed = JSON.parse(backup);
                  if (backupParsed.title && backupParsed.title.toLowerCase().includes('haim')) {
                    console.log(`🎉 Found Haim bid in ${key}: ${backupParsed.title}`);
                    setBid(backupParsed);
                    return;
                  }
                }
              } catch (e) {
                // Continue searching
              }
            }
            
            console.log('⚠️ No Haim bid found in backup storage');
          }
          
          const scopeFromBid = normalizeScope(parsed.projectType || parsed.category || parsed.template || 'kitchen');
          parsed.projectType = scopeFromBid;
          setActiveScope(scopeFromBid);
          
          // Log customer info before setting bid to verify it's present
          if (parsed.customerName || parsed.customerEmail || parsed.customerPhone) {
            console.log(`✅ Customer info found in bid data:`, {
              name: parsed.customerName || '(empty)',
              email: parsed.customerEmail || '(empty)',
              phone: parsed.customerPhone || '(empty)',
              city: parsed.customerCity || '(empty)',
              state: parsed.customerState || '(empty)',
              zip: parsed.customerZip || '(empty)'
            });
          } else {
            console.log(`⚠️ No customer info found in bid data`);
          }
          
          // Ensure default markup is 20% if not set, is 0, or is an invalid low value (< 5%)
          // This catches cases where markup might have been accidentally set to a very low value like 2%
          if (!parsed.markupPct || parsed.markupPct === 0 || parsed.markupPct < 5) {
            if (parsed.markupPct && parsed.markupPct < 5) {
              console.log(`🔄 Resetting markup from ${parsed.markupPct}% to 20% (value too low, using default)`);
            }
            parsed.markupPct = 20;
          }
          
          // Reset markup to 20% if it matches any contractor type default (18, 22, or 27)
          // These were likely auto-applied before we removed that feature
          // The user wants 20% to be the default for all contractor types
          const contractorTypeDefaults = [18, 22, 27];
          const currentMarkup = parsed.markupPct;
          
          // If markup is one of the contractor type defaults, reset to 20%
          if (currentMarkup && contractorTypeDefaults.includes(currentMarkup)) {
            console.log(`🔄 Resetting markup from ${currentMarkup}% to 20% (was auto-applied, now using default)`);
            parsed.markupPct = 20;
          }
          
          setBid(parsed);
        }
      } catch (error) {
        console.error('Failed to load bid:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    
    const loadProfile = async () => {
      try {
        const saved = await AsyncStorage.getItem('bps.contractorProfile');
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log(`👤 Loaded contractor profile: ${parsed.name} - ${parsed.company}`);
          setContractorProfile(parsed);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };
    
    const loadMaterials = async () => {
      try {
        // Check if the current bid is from a lead first
        const savedBid = await AsyncStorage.getItem(BID_STORAGE_KEY);
        if (savedBid) {
          const bidParsed = JSON.parse(savedBid);
          if (bidParsed.leadId && bidParsed.leadSource === 'qualified_lead') {
            // Don't load materials for lead proposals - they should be empty
            console.log(`📦 Skipping materials load for lead proposal - clearing cart`);
            // Ensure AsyncStorage is also cleared
            await AsyncStorage.setItem('bps.materialsCart', JSON.stringify([]));
            setMaterialsCart([]);
            return;
          }
        }
        
        // CRITICAL: Try to load from materialsCart first, then restore from bid.materialLineItems if empty
        const saved = await AsyncStorage.getItem('bps.materialsCart');
        let materials = [];
        
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            materials = parsed;
            console.log(`📦 Loaded ${materials.length} materials from materialsCart`);
          }
        }
        
        // If materialsCart is empty but bid has materialLineItems, restore from bid
        if (materials.length === 0 && savedBid) {
          try {
            const bidParsed = JSON.parse(savedBid);
            if (bidParsed.materialLineItems && Array.isArray(bidParsed.materialLineItems) && bidParsed.materialLineItems.length > 0) {
              // Restore materials from bid.materialLineItems
              materials = bidParsed.materialLineItems.map(item => ({
                id: item.id || String(Date.now()),
                name: item.name || item.description || 'Material',
                description: item.description || item.name || 'Material',
                qty: item.quantity || item.qty || 1,
                quantity: item.quantity || item.qty || 1,
                unit: item.unit || 'ea',
                unitPrice: item.unitPrice || item.cost || (item.total / (item.quantity || 1)),
                cost: item.cost || item.unitPrice || (item.total / (item.quantity || 1)),
                total: Number(item.total) || 0,
                section: item.section || 'General Materials',
                scope: item.scope || activeScope,
                sku: item.sku || '',
                vendorId: item.vendorId || item.vendor || '',
                isManual: item.source === 'manual' || item.isManual || false,
              }));
              
              // Save restored materials to materialsCart
              await AsyncStorage.setItem('bps.materialsCart', JSON.stringify(materials));
              console.log(`📦 Restored ${materials.length} materials from bid.materialLineItems`);
            }
          } catch (error) {
            console.error('Failed to restore materials from bid:', error);
          }
        }
        
        if (materials.length > 0) {
          setMaterialsCart(materials);
          console.log(`📦 Set ${materials.length} materials in cart`);
        } else {
          console.log(`📦 No materials to load`);
        }
        
        // Clear initial load flag after everything is loaded
        setTimeout(() => {
          isInitialLoadRef.current = false;
          console.log('✅ Initial load complete after materials/rentals loaded');
        }, 500);
      } catch (error) {
        console.error('Failed to load materials:', error);
        // Clear initial load flag even on error
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 500);
      }
    };
    
    const loadRentals = async () => {
      try {
        // Check if the current bid is from a lead first
        const savedBid = await AsyncStorage.getItem(BID_STORAGE_KEY);
        if (savedBid) {
          const bidParsed = JSON.parse(savedBid);
          if (bidParsed.leadId && bidParsed.leadSource === 'qualified_lead') {
            // Don't load rentals for lead proposals - they should be empty
            console.log(`🚜 Skipping rentals load for lead proposal - clearing cart`);
            // Ensure AsyncStorage is also cleared
            await AsyncStorage.setItem('bps.rentalCart', JSON.stringify([]));
            setRentalCart([]);
            return;
          }
        }
        
        const saved = await AsyncStorage.getItem('bps.rentalCart');
        if (saved) {
          const parsed = JSON.parse(saved);
          setRentalCart(parsed);
          console.log(`🚜 Loaded ${parsed.length} rentals`);
        }
      } catch (error) {
        console.error('Failed to load rentals:', error);
      }
    };
    
    // Load bid first, then load materials/rentals based on bid source
    loadBid().then(() => {
      console.log('📱 Estimate generator mounted, bid loaded');
      loadProfile();
      loadMaterials();
      loadRentals();
      
      // Clear initial load flag after everything is loaded
      setTimeout(() => {
        isInitialLoadRef.current = false;
        console.log('✅ Initial load complete - all data loaded');
      }, 1500);
    });
  }, []);

  // Reload bid when screen comes into focus (in case it was just saved from lead detail modal)
  // This ensures customer info from "Send Proposal" is always loaded
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 Estimate generator focused - checking for updated bid data');
      const reloadBid = async () => {
        try {
          const saved = await AsyncStorage.getItem(BID_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            // Check if this is a new bid from a lead (has leadId and leadSource)
            const isFromLead = parsed.leadId && parsed.leadSource === 'qualified_lead';
            
            if (isFromLead) {
              // Always reload bid data from lead to ensure customer info is populated
              console.log(`✅ Reloading bid from lead ${parsed.leadId} with customer info:`, {
                name: parsed.customerName || '(empty)',
                email: parsed.customerEmail || '(empty)',
                phone: parsed.customerPhone || '(empty)',
                city: parsed.customerCity || '(empty)',
                state: parsed.customerState || '(empty)',
                zip: parsed.customerZip || '(empty)'
              });
              setBid(parsed);
            } else if (parsed.customerName && !bid.customerName && parsed.customerName !== bid.customerName) {
              // Only reload if bid has no customer name and parsed has one (from external source)
              // Don't reload if user is currently typing
              console.log(`✅ Customer info found in storage, reloading bid:`, {
                name: parsed.customerName,
                email: parsed.customerEmail,
                phone: parsed.customerPhone
              });
              setBid(parsed);
            }
            
            // CRITICAL: Check if this bid matches a saved project/estimate and sync if updated
            if (!isFromLead && parsed.id) {
              const matchingProject = activeProjects.find(p => p.id === parsed.id) || estimates.find(p => p.id === parsed.id);
              if (matchingProject && matchingProject.estimateData) {
                const projectEstimate = matchingProject.estimateData;
                const currentLaborTotal = (parsed.laborLineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);
                const projectLaborTotal = (projectEstimate.laborLineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);
                
                // Skip sync if AI just updated labor (within last 2 seconds) to prevent sync loops
                const timeSinceAILaborUpdate = Date.now() - lastAIMaterialUpdateRef.current;
                const shouldSkipLaborSync = timeSinceAILaborUpdate < 2000; // Skip sync for 2 seconds after AI action
                
                // If labor totals don't match, update the bid from the project
                if (!shouldSkipLaborSync && Math.abs(currentLaborTotal - projectLaborTotal) > 0.01) {
                  console.log('🔄 Syncing bid with updated project estimate on focus:', {
                    currentLabor: currentLaborTotal,
                    projectLabor: projectLaborTotal,
                    projectId: matchingProject.id,
                  });
                  
                  // Update bid with latest estimate data
                  const updatedBid = {
                    ...parsed,
                    laborLineItems: projectEstimate.laborLineItems || parsed.laborLineItems,
                  };
                  setBid(updatedBid);
                  await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updatedBid));
                }
              }
            }
            
            // CRITICAL: Restore materials from bid.materialLineItems if materialsCart is empty
            // This prevents materials from being lost when the app reopens
            if (!isFromLead && parsed.materialLineItems && Array.isArray(parsed.materialLineItems) && parsed.materialLineItems.length > 0) {
              const savedMaterials = await AsyncStorage.getItem('bps.materialsCart');
              const currentMaterials = savedMaterials ? JSON.parse(savedMaterials) : [];
              
              // Also check if project has updated materials
              const matchingProject = activeProjects.find(p => p.id === parsed.id) || estimates.find(p => p.id === parsed.id);
              if (matchingProject && matchingProject.estimateData && matchingProject.estimateData.materialLineItems) {
                const projectMaterials = matchingProject.estimateData.materialLineItems;
                const currentMaterialsTotal = currentMaterials.reduce((sum, item) => sum + (item.total || 0), 0);
                const projectMaterialsTotal = projectMaterials.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
                
                // Skip sync if AI just updated materials (within last 2 seconds) to prevent sync loops
                const timeSinceAIAction = Date.now() - lastAIMaterialUpdateRef.current;
                const shouldSkipSync = timeSinceAIAction < 2000; // Skip sync for 2 seconds after AI action
                
                // If materials differ, update from project
                if (!shouldSkipSync && Math.abs(currentMaterialsTotal - projectMaterialsTotal) > 0.01) {
                  console.log('🔄 Syncing materials from updated project estimate:', {
                    currentMaterials: currentMaterialsTotal,
                    projectMaterials: projectMaterialsTotal,
                  });
                  const updatedMaterials = projectMaterials.map(item => ({
                    id: item.id || String(Date.now()),
                    name: item.name || item.description || 'Material',
                    description: item.description || item.name || 'Material',
                    qty: item.quantity || item.qty || 1,
                    quantity: item.quantity || item.qty || 1,
                    unit: item.unit || 'ea',
                    unitPrice: item.unitCost || item.cost || (item.total / (item.quantity || 1)),
                    cost: item.cost || item.unitCost || (item.total / (item.quantity || 1)),
                    total: Number(item.total) || 0,
                    section: item.section || 'General Materials',
                    scope: item.scope || activeScope,
                    sku: item.sku || '',
                    vendorId: item.vendorId || item.vendor || '',
                    isManual: item.source === 'manual' || item.isManual || false,
                  }));
                  await AsyncStorage.setItem('bps.materialsCart', JSON.stringify(updatedMaterials));
                  setMaterialsCart(updatedMaterials);
                } else if ((!currentMaterials || currentMaterials.length === 0) && parsed.materialLineItems.length > 0) {
                  // Only restore if materialsCart is empty but bid has materialLineItems
                  const restoredMaterials = parsed.materialLineItems.map(item => ({
                    id: item.id || String(Date.now()),
                    name: item.name || item.description || 'Material',
                    description: item.description || item.name || 'Material',
                    qty: item.quantity || item.qty || 1,
                    quantity: item.quantity || item.qty || 1,
                    unit: item.unit || 'ea',
                    unitPrice: item.unitPrice || item.cost || (item.total / (item.quantity || 1)),
                    cost: item.cost || item.unitPrice || (item.total / (item.quantity || 1)),
                    total: Number(item.total) || 0,
                    section: item.section || 'General Materials',
                    scope: item.scope || activeScope,
                    sku: item.sku || '',
                    vendorId: item.vendorId || item.vendor || '',
                    isManual: item.source === 'manual' || item.isManual || false,
                  }));
                  
                  await AsyncStorage.setItem('bps.materialsCart', JSON.stringify(restoredMaterials));
                  setMaterialsCart(restoredMaterials);
                  console.log(`📦 Restored ${restoredMaterials.length} materials from bid.materialLineItems on focus`);
                }
              } else if ((!currentMaterials || currentMaterials.length === 0) && parsed.materialLineItems.length > 0) {
                // Fallback: restore from bid if no project match
                const restoredMaterials = parsed.materialLineItems.map(item => ({
                  id: item.id || String(Date.now()),
                  name: item.name || item.description || 'Material',
                  description: item.description || item.name || 'Material',
                  qty: item.quantity || item.qty || 1,
                  quantity: item.quantity || item.qty || 1,
                  unit: item.unit || 'ea',
                  unitPrice: item.unitPrice || item.cost || (item.total / (item.quantity || 1)),
                  cost: item.cost || item.unitPrice || (item.total / (item.quantity || 1)),
                  total: Number(item.total) || 0,
                  section: item.section || 'General Materials',
                  scope: item.scope || activeScope,
                  sku: item.sku || '',
                  vendorId: item.vendorId || item.vendor || '',
                  isManual: item.source === 'manual' || item.isManual || false,
                }));
                
                await AsyncStorage.setItem('bps.materialsCart', JSON.stringify(restoredMaterials));
                setMaterialsCart(restoredMaterials);
                console.log(`📦 Restored ${restoredMaterials.length} materials from bid.materialLineItems on focus`);
              }
            }
          }
        } catch (error) {
          console.error('Error reloading bid on focus:', error);
        }
      };
      reloadBid();
    }, [activeScope, activeProjects, estimates]) // Removed bid.customerName to prevent reloading while user is typing
  );

  // Save materials cart whenever it changes
  useEffect(() => {
    // Skip saving during initial load to prevent glitching
    if (isInitialLoadRef.current) return;
    
    const saveMaterials = async () => {
      try {
        await AsyncStorage.setItem('bps.materialsCart', JSON.stringify(materialsCart));
        console.log(`💾 Saved ${materialsCart.length} materials to AsyncStorage`);
      } catch (error) {
        console.error('Failed to save materials:', error);
      }
    };
    saveMaterials();
  }, [materialsCart]);

  // Keep bid.materialLineItems synced with the materials cart so backend/project data stays accurate
  useEffect(() => {
    // Skip updating during initial load to prevent glitching
    if (isInitialLoadRef.current) return;
    
    setBid((prev) => {
      const nextLineItems = (materialsCart || []).map((item) => ({
        id: item.id || `material-${Date.now()}`,
        name: item.name || 'Material',
        description: item.description || item.name || 'Material',
        quantity: Number(item.quantity) || 0,
        unit: item.unit || item.section || 'unit',
        unitPrice: Number(item.unitPrice) || 0,
        total:
          Number(item.total) ||
          (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        vendor: item.vendorId || '',
        section: item.section || '',
        scope: item.scope || activeScope,
        sku: item.sku || '',
        source: item.isManual ? 'manual' : 'catalog',
      }));

      const currentSerialized = JSON.stringify(prev.materialLineItems || []);
      const nextSerialized = JSON.stringify(nextLineItems);
      if (currentSerialized === nextSerialized) {
        return prev;
      }

      return {
        ...prev,
        materialLineItems: nextLineItems,
      };
    });
  }, [materialsCart, activeScope]);

  // Save bid whenever it changes (with debounce to prevent excessive re-renders)
  const lastSavedBidRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const initialLoadTimeoutRef = useRef(null);
  const lastAIMaterialUpdateRef = useRef(0); // Track when AI last updated materials

  const normalizeStatus = React.useCallback((status) => {
    return (status || '')
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .trim();
  }, []);
  
  useEffect(() => {
    console.log('🔄 Bid useEffect triggered - isLoaded:', isLoaded);
    if (!isLoaded) return;
    
    // Safety check - don't save if bid is empty or invalid
    if (!bid || !bid.id) {
      console.log('⚠️ Skipping bid save - bid is empty or invalid');
      return;
    }
    
    // Prevent saving during initial load to avoid glitching
    if (isInitialLoadRef.current) {
      // Clear the initial load flag after a short delay
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
      }
      initialLoadTimeoutRef.current = setTimeout(() => {
        isInitialLoadRef.current = false;
        console.log('✅ Initial load complete, normal saves enabled');
      }, 1000); // Wait 1 second after mount before allowing saves
      return;
    }
    
    // Prevent saving the same bid multiple times
    // Include customer information fields and dates in the key to trigger saves when they change
    const customerInfoKey = JSON.stringify({
      customerName: bid.customerName,
      customerEmail: bid.customerEmail,
      customerPhone: bid.customerPhone,
      customerAddress: bid.customerAddress,
      customerCity: bid.customerCity,
      customerState: bid.customerState,
      customerZip: bid.customerZip,
      customerCompany: bid.customerCompany,
      customerNotes: bid.customerNotes,
      startDate: bid.startDate,
      endDate: bid.endDate,
      projectStartDate: bid.projectStartDate,
      projectEndDate: bid.projectEndDate,
    });
    const bidKey = `${bid.id}-${bid.title}-${JSON.stringify(bid.laborLineItems)}-${JSON.stringify(materialsCart)}-${customerInfoKey}`;
    if (lastSavedBidRef.current === bidKey) {
      console.log('⚠️ Same bid already saved, skipping...');
      return;
    }
    
    lastSavedBidRef.current = bidKey;
    
    // CRITICAL: Sync materialsCart to bid.materialLineItems before creating snapshot
    // This ensures materials are preserved when the bid is saved
    const syncedMaterialLineItems = materialsCart.map(item => ({
      id: item.id || String(Date.now()),
      name: item.name || item.description || 'Material',
      description: item.description || item.name || 'Material',
      quantity: item.qty || item.quantity || 1,
      unit: item.unit || 'ea',
      total: Number(item.total) || 0,
      cost: Number(item.cost) || Number(item.total) || 0,
      section: item.section || 'General Materials',
      scope: item.scope || activeScope,
      sku: item.sku || '',
      vendorId: item.vendorId || '',
      isManual: item.isManual || false,
    }));
    
    const normalizedPaymentMilestones = Array.isArray(bid.paymentMilestones)
      ? bid.paymentMilestones.map((milestone, index) => ({
          ...milestone,
          id: milestone.id || `payment-${index}`,
        }))
      : [];
    const normalizedWeeklyPayments = Array.isArray(bid.weeklyPayments)
      ? bid.weeklyPayments.map((payment, index) => ({
          ...payment,
          id: payment.id || `week-${index}`,
        }))
      : [];

    // Calculate values with exact decimal precision for estimateContext
    const materials = materialsCart.reduce((sum, r) => sum + (r.total || 0), 0);
    const labor = (bid.laborLineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const overhead =
      (bid.insuranceOverhead || 0) +
      (bid.equipment || 0) +
      (bid.facilities || 0) +
      (bid.otherOverhead || 0);
    const permitCosts = bid.permitCost || 0;
    const calculatedSubtotal = materials + labor + overhead + permitCosts;
    const markup = Number(bid.markupPct) || 0;
    const profit = (calculatedSubtotal * markup) / 100;
    const total = calculatedSubtotal + profit; // Preserve exact decimal precision, don't round

    const bidSnapshot = {
      ...bid,
      leadId: bid.leadId,
      leadSource: bid.leadSource,
      grandTotal: total,
      subtotal: calculatedSubtotal,
      total: total,
      margin: calc?.marginPercent || 0,
      marginPercent: calc?.marginPercent || 0,
      marginRatio: calc?.marginRatio || 0,
      calculatedTotal: total,
      // CRITICAL: Include synced materialLineItems so materials are preserved
      materialLineItems: syncedMaterialLineItems,
      paymentMilestones: normalizedPaymentMilestones,
      weeklyPayments: normalizedWeeklyPayments,
    };

    pendingSaveRef.current = {
      bidSnapshot,
      estimateContext: {
        materials,
        labor,
        overhead,
        permitCosts,
        subtotal: calculatedSubtotal,
        markup,
        profit,
        total,
      },
    };

    const persistSnapshot = async (snapshot) => {
      if (!snapshot) return;
      const { bidSnapshot: snapshotBid, estimateContext } = snapshot;
      try {
        console.log('💾 Persisting bid snapshot to AsyncStorage...');
        await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(snapshotBid));
        console.log(
          `💾 Saved bid: ${snapshotBid.title} with grandTotal: $${(snapshotBid.total || 0).toLocaleString()}, leadId: ${
            snapshotBid.leadId || 'none'
          }, leadSource: ${snapshotBid.leadSource || 'none'}`
        );

        // Note: Auto-save only saves to AsyncStorage (BID_STORAGE_KEY)
        // To add to restore bids list, user must click "Save Bid" button
        // This keeps the restore bids list clean and intentional

        const matchingEstimate = estimates.find(p => p.id === snapshotBid.id);
        const existingWonProject = activeProjects.find(
          p => p.id === snapshotBid.id && normalizeStatus(p.status) === 'won'
        );
        const existingInProgress = activeProjects.find(
          p => p.id === snapshotBid.id && normalizeStatus(p.status) !== 'won'
        );

        const existingProject = existingWonProject || matchingEstimate || existingInProgress;
          const location = `${snapshotBid.customerCity || 'Unknown'}, ${snapshotBid.customerState || 'Unknown'}`;

          console.log(
            `💰 Auto-sync calculation: materials=${estimateContext.materials}, labor=${estimateContext.labor}, overhead=${estimateContext.overhead}, permit=${estimateContext.permitCosts}, subtotal=${estimateContext.subtotal}, markup=${estimateContext.markup}%, total=${estimateContext.total}`
          );

        // Calculate labor and materials budgets from estimateContext (which uses CURRENT materialsCart and laborLineItems)
        // CRITICAL: estimateContext.materials and estimateContext.labor are calculated from current state in the useEffect
        // These are the source of truth, not snapshotBid.materialLineItems which might be stale
        const materialsBudget = estimateContext.materials || 0;
        const laborBudget = estimateContext.labor || 0;
        
        console.log(`💰 Updating buckets: Materials=$${materialsBudget}, Labor=$${laborBudget}`);
        console.log(`💰 From estimateContext: materials=${estimateContext.materials}, labor=${estimateContext.labor}`);
        console.log(`💰 MaterialsCart count: ${materialsCart.length}, LaborLineItems count: ${bid.laborLineItems?.length || 0}`);
        
        // CRITICAL: Also update snapshotBid.materialLineItems to match materialsCart so it's saved correctly
        // This ensures materials don't get deleted when the bid is reloaded
        if (materialsCart.length > 0) {
          snapshotBid.materialLineItems = materialsCart.map(item => ({
            id: item.id || String(Date.now()),
            name: item.name || item.description || 'Material',
            description: item.description || item.name || 'Material',
            quantity: item.qty || item.quantity || 1,
            unit: item.unit || 'ea',
            total: Number(item.total) || 0,
            cost: Number(item.cost) || Number(item.total) || 0,
            section: item.section || 'General Materials',
          }));
          console.log(`💾 Synced ${materialsCart.length} materials to materialLineItems`);
        } else {
          snapshotBid.materialLineItems = [];
        }
        
        // Ensure laborLineItems is also synced
        if (bid.laborLineItems && bid.laborLineItems.length > 0) {
          snapshotBid.laborLineItems = bid.laborLineItems;
        }
        
        // Re-save the bid snapshot with updated materialLineItems
        await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(snapshotBid));

          const estimateData = {
            id: snapshotBid.id,
            title: snapshotBid.title || 'Untitled Bid',
          status: existingProject?.status || snapshotBid.status || 'estimate',
            estimatedCost: estimateContext.subtotal,
            bidPrice: estimateContext.total,
          actualCost: existingProject?.actualCost || 0,
            margin:
              estimateContext.subtotal > 0
                ? Math.round((estimateContext.profit / estimateContext.subtotal) * 100)
                : 0,
            markup: estimateContext.markup,
            location,
            city: snapshotBid.customerCity,
            state: snapshotBid.customerState,
            zip: snapshotBid.customerZip,
            startDate:
              snapshotBid.startDate ||
              snapshotBid.projectStartDate ||
            existingProject?.startDate ||
              new Date().toISOString().split('T')[0],
            endDate:
              snapshotBid.endDate ||
              snapshotBid.projectEndDate ||
            existingProject?.endDate ||
              new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          progress: existingProject?.progress || 0,
            client: snapshotBid.customerName || snapshotBid.clientName || 'Unknown Client',
            clientEmail: snapshotBid.customerEmail || snapshotBid.clientEmail,
            clientPhone: snapshotBid.customerPhone,
          createdAt: existingProject?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          projectType: snapshotBid.projectType || existingProject?.projectType,
            projectCategory:
              snapshotBid.projectCategory ||
              snapshotBid.category ||
            existingProject?.projectCategory ||
            existingProject?.category,
          category: snapshotBid.category || existingProject?.category,
          paymentSchedule: snapshotBid.paymentSchedule || bid.paymentSchedule || 'milestone-based',
          milestones: normalizedPaymentMilestones,
          weeklyPayments: normalizedWeeklyPayments,
            estimateData: snapshotBid,
          };

          addEstimate(estimateData);
        
        // Update projectData buckets with the correct labor and materials budgets
        // This ensures the Budget tab shows the correct BID amounts
        try {
          const projectDataKey = `bps.project.${snapshotBid.id}`;
          const existingProjectData = await AsyncStorage.getItem(projectDataKey);
          let projectData = existingProjectData ? JSON.parse(existingProjectData) : null;
          
          // Get current spent amounts from existing buckets
          const laborSpent = projectData?.buckets?.find(b => b.name === 'Labor')?.spent || 0;
          const materialsSpent = projectData?.buckets?.find(b => 
            b.name === 'Materials/Equipment' || b.name === 'Materials'
          )?.spent || 0;
          
          // Update or create projectData with correct buckets
          const updatedProjectData = {
            ...projectData,
            id: snapshotBid.id,
            title: snapshotBid.title || 'Untitled Bid',
            budgeted: estimateContext.total,
            spent: projectData?.spent || 0,
            buckets: [
              {
                id: '1',
                name: 'Labor',
                spent: laborSpent,
                budget: laborBudget,
                bidBudget: laborBudget,
              },
              {
                id: '2',
                name: 'Materials/Equipment',
                spent: materialsSpent,
                budget: materialsBudget,
                bidBudget: materialsBudget,
              },
              ...(projectData?.buckets?.filter(b => 
                b.name !== 'Labor' && 
                b.name !== 'Materials/Equipment' && 
                b.name !== 'Materials'
              ) || []),
            ],
            expenses: projectData?.expenses || [],
            changeOrders: projectData?.changeOrders || [],
            purchaseOrders: projectData?.purchaseOrders || [],
            committedPOs: projectData?.committedPOs || 0,
            currency: 'USD',
            lastUpdated: new Date().toISOString(),
          };
          
          await AsyncStorage.setItem(projectDataKey, JSON.stringify(updatedProjectData));
          console.log(`💾 Updated projectData buckets: Labor=$${laborBudget}, Materials=$${materialsBudget}`);
          console.log(`💾 Saved projectData to AsyncStorage for project ${snapshotBid.title} (${snapshotBid.id})`);
          
        // CRITICAL: Merge estimate payment milestones with existing timeline milestones
        // Timeline edits (status, progress) should be preserved, but amounts/dates from estimate should update
        let mergedMilestones = normalizedPaymentMilestones;
        try {
          // Check existing project from activeProjects or estimates
          const existingProject = existingWonProject || matchingEstimate || existingInProgress;
          if (existingProject?.milestones && existingProject.milestones.length > 0) {
            // Merge: use estimate amounts/dates, but preserve timeline status/progress
            const timelineMilestonesMap = new Map(
              existingProject.milestones.map((m) => [m.id || m.name || m.title, m])
            );
            
            mergedMilestones = normalizedPaymentMilestones.map((estimateMilestone) => {
              const milestoneKey = estimateMilestone.id || estimateMilestone.name || estimateMilestone.title;
              const timelineMilestone = timelineMilestonesMap.get(milestoneKey);
              if (timelineMilestone) {
                // Preserve timeline edits (status, progress, assignee) but update amounts/dates from estimate
                return {
                  ...estimateMilestone,
                  status: timelineMilestone.status || estimateMilestone.status,
                  progressPct: timelineMilestone.progressPct ?? estimateMilestone.progressPct ?? 0,
                  assignee: timelineMilestone.assignee || estimateMilestone.assignee,
                  // Keep timeline's costDelta and costCategory if they exist
                  costDelta: timelineMilestone.costDelta,
                  costCategory: timelineMilestone.costCategory,
                };
              }
              return estimateMilestone;
            });
            
            console.log(`🔄 Merged ${mergedMilestones.length} milestones: preserved timeline edits, updated amounts from estimate`);
          }
        } catch (error) {
          console.error('Error merging milestones:', error);
          // Fall back to estimate milestones if merge fails
        }
        
        // Also update the project in ProjectListContext to sync the buckets and milestone data
        // This will trigger auto-save to AsyncStorage via ProjectListContext useEffect
        updateProject(snapshotBid.id, {
          projectData: updatedProjectData,
          milestones: mergedMilestones,
          weeklyPayments: normalizedWeeklyPayments,
          paymentSchedule: snapshotBid.paymentSchedule || bid.paymentSchedule,
          estimateData: snapshotBid,
        });
          console.log(`✅ Synced projectData buckets to ProjectListContext for ${snapshotBid.title}`);
        } catch (error) {
          console.error('Error updating projectData buckets:', error);
        }
        if (existingProject) {
          console.log(
            `✅ Auto-synced estimate/project (${existingProject.status}) for ${snapshotBid.title} ($${estimateContext.total.toLocaleString()})`
          );
        } else {
          console.log(
            `✅ Auto-created estimate entry for ${snapshotBid.title} ($${estimateContext.total.toLocaleString()})`
          );
        }
      } catch (error) {
        console.error('❌ Failed to persist bid snapshot:', error);
      }
    };

    const timeoutId = setTimeout(async () => {
      await persistSnapshot(pendingSaveRef.current);
      pendingSaveRef.current = null;
      console.log('✅ Bid useEffect completed successfully');
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      if (pendingSaveRef.current) {
        persistSnapshot(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, [bid, isLoaded, materialsCart, activeProjects, estimates, addEstimate]);

  // Save materials cart whenever it changes
  useEffect(() => {
    // Skip saving during initial load to prevent glitching
    if (isInitialLoadRef.current) return;
    
    const saveMaterials = async () => {
      try {
        await AsyncStorage.setItem('bps.materialsCart', JSON.stringify(materialsCart));
        console.log(`💾 Saved ${materialsCart.length} materials`);
      } catch (error) {
        console.error('Failed to save materials:', error);
      }
    };
    saveMaterials();
  }, [materialsCart]);

  // Keep bid.materialLineItems synced with the materials cart so backend/project data stays accurate
  useEffect(() => {
    // Skip updating during initial load to prevent glitching
    if (isInitialLoadRef.current) return;
    
    setBid((prev) => {
      const nextLineItems = (materialsCart || []).map((item) => ({
        id: item.id || `material-${Date.now()}`,
        name: item.name || 'Material',
        description: item.description || item.name || 'Material',
        quantity: Number(item.quantity) || 0,
        unit: item.unit || item.section || 'unit',
        unitPrice: Number(item.unitPrice) || 0,
        total:
          Number(item.total) ||
          (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        vendor: item.vendorId || '',
        section: item.section || '',
        scope: item.scope || activeScope,
        sku: item.sku || '',
        source: item.isManual ? 'manual' : 'catalog',
      }));

      const currentSerialized = JSON.stringify(prev.materialLineItems || []);
      const nextSerialized = JSON.stringify(nextLineItems);
      if (currentSerialized === nextSerialized) {
        return prev;
      }

      return {
        ...prev,
        materialLineItems: nextLineItems,
      };
    });
  }, [materialsCart, activeScope]);

  // Save rental cart whenever it changes
  useEffect(() => {
    const saveRentals = async () => {
      try {
        await AsyncStorage.setItem('bps.rentalCart', JSON.stringify(rentalCart));
        console.log(`💾 Saved ${rentalCart.length} rentals`);
      } catch (error) {
        console.error('Failed to save rentals:', error);
      }
    };
    saveRentals();
  }, [rentalCart]);

  // Calculations - MUST be before auto-adjustment useEffect
  const calc = useMemo(() => {
    // Calculate materials from materials cart
    const materials = materialsCart.reduce((sum, r) => sum + (r.total || 0), 0);
    
    
    // Calculate labor from line items
    const laborFromItems = bid.laborLineItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    const labor = laborFromItems;
    
    // Calculate rental equipment costs (note: rentals don't have fixed pricing, just duration tracking)
    const rentals = rentalCart.length; // Count of rental items for tracking
    
    const overhead = bid.insuranceOverhead + bid.equipment + bid.facilities + bid.otherOverhead;
    const permitCosts = bid.permitCost || 0;
    const subtotal = materials + labor + overhead + permitCosts;
    const contingency = Math.round((subtotal * bid.contingencyPct) / 100);
    const profit = (subtotal * bid.markupPct) / 100;
    const total = subtotal + profit; // Preserve exact decimal precision, don't round
    const marginRatio = total > 0 ? profit / total : 0;
    const marginPercent = marginRatio * 100;
    
    const denom = bid.unitMode === 'sqft' ? Math.max(1, bid.sqft) : bid.unitMode === 'lf' ? 480 : 30;
    const unitPrice = total / denom;
    
    return { materials, labor, rentals, overhead, permitCosts, contingency, profit, total, subtotal, unitPrice, marginRatio, marginPercent };
  }, [bid, rentalCart, materialsCart]);
