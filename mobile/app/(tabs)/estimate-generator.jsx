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
import { useTheme } from '../../contexts/ThemeContext';
import { getColors } from '../../theme/getColors';

// Colors will be defined inside the component using theme

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
const getModalStyles = (Colors: any) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
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
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
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
    color: Colors.onPrimary,
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
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.card,
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
    color: Colors.text,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  materialSubtitle: {
    fontSize: 13,
    color: Colors.sub,
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
    color: Colors.text,
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
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingVertical: 12,
  },
  materialInputIcon: {
    marginRight: 12,
  },
  materialInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
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
    borderColor: Colors.line,
    backgroundColor: Colors.surface2,
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
    borderColor: Colors.line,
    backgroundColor: Colors.surface2,
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
    color: Colors.text,
  },
  materialSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.onPrimary,
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
    borderTopColor: Colors.line,
    backgroundColor: Colors.bg,
  },
});

// Module-level variable to persist header top position across component remounts
let paymentMilestoneHeaderTop = null;
let weeklyPaymentHeaderTop = null;

// Payment Milestone Modal
const PaymentMilestoneModal = ({ visible, onClose, item, onSave, grandTotal }) => {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const modalStyles = useMemo(() => getModalStyles(Colors), [Colors]);
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
    backgroundColor: Colors.bg,
    paddingTop: 12,
    paddingBottom: 16,
  }), [headerTop, Colors.bg]);
  
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
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: Colors.bg }}>
        <StatusBar barStyle={Colors.bg === '#000000' ? "light-content" : "dark-content"} translucent={false} />
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
                <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
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
        
        <View style={{ flex: 1, backgroundColor: Colors.bg }} collapsable={false}>
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
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.text}
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
                      placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
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
                      color: scheduledDate
                        ? (darkMode ? '#FFFFFF' : Colors.text)
                        : (darkMode ? 'rgba(255,255,255,0.4)' : Colors.text),
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
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const modalStyles = useMemo(() => getModalStyles(Colors), [Colors]);
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
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: Colors.bg }}>
        <StatusBar barStyle={Colors.bg === '#000000' ? "light-content" : "dark-content"} translucent={false} />
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
                <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
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
        
        <View style={{ flex: 1, backgroundColor: Colors.bg, position: 'relative' }} collapsable={false}>
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
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.text}
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
                      placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
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
                      color: scheduledDate
                        ? (darkMode ? '#FFFFFF' : Colors.text)
                        : (darkMode ? 'rgba(255,255,255,0.4)' : Colors.text),
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
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = Colors.bg === '#000000';
  const modalStyles = useMemo(() => getModalStyles(Colors), [Colors]);
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
        style={{ flex: 1, backgroundColor: Colors.bg }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {(isMaterial || isLabor) ? (
          <View style={{ flex: 1, backgroundColor: Colors.bg }}>
            <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: Colors.bg }}>
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
                      <MaterialIcons
                        name="arrow-back"
                        size={24}
                        color={darkMode ? "#FFFFFF" : "#000000"}
                      />
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
                          style={[
                            modalStyles.materialInput,
                            { color: darkMode ? '#e9f1ff' : '#000000' },
                          ]}
                          placeholder="Enter item name"
                          placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
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
                            borderColor: mode === 'hourly'
                              ? '#38d39f'
                              : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                            backgroundColor: mode === 'hourly'
                              ? '#38d39f'
                              : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            color: mode === 'hourly' ? '#000000' : (darkMode ? '#FFFFFF' : '#000000'),
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
                            borderColor: mode === 'sqft'
                              ? '#38d39f'
                              : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                            backgroundColor: mode === 'sqft'
                              ? '#38d39f'
                              : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            color: mode === 'sqft' ? '#000000' : (darkMode ? '#FFFFFF' : '#000000'),
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
                            borderColor: laborType === 'inhouse'
                              ? '#38d39f'
                              : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                            backgroundColor: laborType === 'inhouse'
                              ? '#38d39f'
                              : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            color: laborType === 'inhouse' ? '#000000' : (darkMode ? '#FFFFFF' : '#000000'),
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
                            borderColor: laborType === 'subcontractor'
                              ? '#38d39f'
                              : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                            backgroundColor: laborType === 'subcontractor'
                              ? '#38d39f'
                              : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            color: laborType === 'subcontractor' ? '#000000' : (darkMode ? '#FFFFFF' : '#000000'),
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
                            style={[
                              modalStyles.materialInput,
                              { color: darkMode ? '#e9f1ff' : '#000000' },
                            ]}
                            placeholder="0"
                            placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
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
                            placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
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
                            placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
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
                            style={[
                              modalStyles.materialInput,
                              { color: darkMode ? '#e9f1ff' : '#000000' },
                            ]}
                            placeholder="$ 0.00"
                            placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
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
  useSurface = false, // optional: true makes it more "glass"
  lightBg = false,
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => {
    return {
      bg: theme.bg,
      card: theme.card,
      cardDark: theme.cardDark,
      text: theme.text,
      sub: theme.subtext,
      line: theme.hairline,
      overlay: theme.overlay,
      surface: theme.surface,
      surface2: theme.surface2,
      primary: theme.accent,
      onPrimary: theme.onAccent,
      iconBg: theme.iconBg,
    };
  }, [theme]);
  const darkMode = Colors.bg === '#000000';
  
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
          backgroundColor: useSurface
            ? Colors.surface
            : (lightBg && !darkMode ? Colors.bg : Colors.card),
          borderRadius: ir,
          padding: pad,
          borderWidth: 1,
          borderColor: Colors.line,
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
const getStyles = (Colors: any) => StyleSheet.create({
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
    backgroundColor: Colors.surface2,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.line,
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
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  input: {
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
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
    borderColor: Colors.line,
    backgroundColor: Colors.surface2,
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
    backgroundColor: Colors.surface2,
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
  const { theme } = useTheme();
  const darkMode = theme.bg === '#000000';
  const Colors = useMemo(() => {
    const baseColors = getColors(theme);
    return {
      ...baseColors,
      // Keep additional color constants
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
  }, [theme]);
  
  const modalStyles = useMemo(() => getModalStyles(Colors), [Colors]);
  const s = useMemo(() => getStyles(Colors), [Colors]);
  
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

  // Auto-adjust payment amounts when total bid price changes
  useEffect(() => {
    if (!isLoaded || !calc) return;
    
    // Skip auto-adjustment during initial load to prevent glitching
    if (isInitialLoadRef.current) {
      if (!bid.previousTotal && calc.total) {
        const silentBid = { ...bid, previousTotal: calc.total };
        AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(silentBid)).catch(() => {});
      }
      return;
    }

    // Get current total from calc (most up-to-date)
    const currentTotal = calc.total || calc.grandTotal || 0;
    if (currentTotal <= 0) return;
    
    // Initialize previousTotal only if it doesn't exist
    if (!bid.previousTotal) {
      console.log(`🔧 Initializing previousTotal to ${currentTotal}`);
      updateBid('previousTotal', currentTotal);
      return; // Skip adjustment on first load
    }
    
    const previousTotal = bid.previousTotal || currentTotal;
    
    // Only adjust if total changed significantly (more than $1)
    if (Math.abs(currentTotal - previousTotal) > 1) {
      console.log(`💰 Total bid changed from $${previousTotal} to $${currentTotal}, adjusting payment amounts...`);
      
      // Get current payment schedule and payments (use latest from bid state)
      const scheduleType = bid.paymentSchedule;
      const currentMilestones = bid.paymentMilestones || [];
      const currentWeeklyPayments = bid.weeklyPayments || [];
      
      // Handle milestone-based payments - recalculate from percentages
      if (scheduleType === 'milestone-based' && currentMilestones.length > 0) {
        const updatedMilestones = currentMilestones.map(milestone => {
          // Get percentage (prioritize stored percentage, fallback to calculating from old amount)
          let percentage = milestone.percentage;
          if (!percentage && milestone.paymentAmount && previousTotal > 0) {
            percentage = (milestone.paymentAmount / previousTotal) * 100;
          }
          
          // Recalculate amount from percentage
          const newAmount = roundPayment((percentage / 100) * currentTotal);
          
          return {
            ...milestone,
            paymentAmount: newAmount,
            amount: newAmount,
            percentage: percentage || 0
          };
        });
        
        // Normalize to ensure exact total match
        const normalizedMilestones = normalizePaymentsToExactTotal(updatedMilestones, currentTotal, true);
        updateBid('paymentMilestones', normalizedMilestones);
        console.log(`✅ Payment amounts adjusted for ${normalizedMilestones.length} milestones`);
      }
      
      // Handle weekly payments - recalculate from percentages
      if (scheduleType === 'weekly' && currentWeeklyPayments.length > 0) {
        const updatedWeeklyPayments = currentWeeklyPayments.map(payment => {
          // Get percentage (prioritize stored percentage, fallback to calculating from old amount)
          let percentage = payment.percentage;
          if (!percentage && payment.amount && previousTotal > 0) {
            percentage = (payment.amount / previousTotal) * 100;
          }
          
          // Recalculate amount from percentage
          const newAmount = roundPayment((percentage / 100) * currentTotal);
          
          return {
            ...payment,
            amount: newAmount,
            percentage: percentage || 0
          };
        });
        
        // Normalize to ensure exact total match
        const normalizedWeekly = normalizePaymentsToExactTotal(updatedWeeklyPayments, currentTotal, false);
        updateBid('weeklyPayments', normalizedWeekly);
        console.log(`✅ Weekly payment amounts adjusted for ${normalizedWeekly.length} payments`);
      }
      
      // Handle hybrid payments - recalculate both milestones and weekly from percentages
      if (scheduleType === 'hybrid' && (currentMilestones.length > 0 || currentWeeklyPayments.length > 0)) {
        // Recalculate milestone amounts from percentages
        let updatedMilestones = [];
        if (currentMilestones.length > 0) {
          updatedMilestones = currentMilestones.map(milestone => {
            let percentage = milestone.percentage;
            if (!percentage && milestone.paymentAmount && previousTotal > 0) {
              percentage = (milestone.paymentAmount / previousTotal) * 100;
            }
            const newAmount = roundPayment((percentage / 100) * currentTotal);
            return {
              ...milestone,
              paymentAmount: newAmount,
              amount: newAmount,
              percentage: percentage || 0
            };
          });
        }
        
        // Recalculate weekly amounts from percentages
        let updatedWeekly = [];
        if (currentWeeklyPayments.length > 0) {
          updatedWeekly = currentWeeklyPayments.map(payment => {
            let percentage = payment.percentage;
            if (!percentage && payment.amount && previousTotal > 0) {
              percentage = (payment.amount / previousTotal) * 100;
            }
            const newAmount = roundPayment((percentage / 100) * currentTotal);
            return {
              ...payment,
              amount: newAmount,
              percentage: percentage || 0
            };
          });
        }
        
        // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
        const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, updatedWeekly, currentTotal);
        
        // Update both in single state update
        setBid(prev => {
          const updated = {
            ...prev,
            paymentMilestones: normalized.milestones,
            weeklyPayments: normalized.weeklyPayments,
            previousTotal: currentTotal
          };
          AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
        console.log(`✅ Hybrid payment amounts adjusted: ${normalized.milestones.length} milestones, ${normalized.weeklyPayments.length} weekly`);
      }
      
      // Store current total for next comparison (if not already updated in hybrid)
      if (scheduleType !== 'hybrid') {
        updateBid('previousTotal', currentTotal);
      }
      
      console.log(`🎯 Auto-adjusted payment amounts based on new total: $${currentTotal}`);
    }
  }, [calc?.total, calc?.grandTotal, isLoaded, bid.paymentSchedule]);


  // Shared health score calculation
  const healthScore = useMemo(() => {
    let points = 0;
    
    // Project Information (15 points)
    if (bid.title) points += 5;
    if (bid.projectDescription) points += 5;
    if (bid.customerCity || bid.location) points += 5;
    
    // Customer Information (16 points)
    if (bid.customerEmail) points += 2;
    if (bid.customerPhone) points += 2;
    if (bid.customerAddress) points += 2;
    if (bid.customerCity) points += 1.5;
    if (bid.customerState) points += 1.5;
    if (bid.customerZip) points += 1.5;
    if (bid.customerCompany) points += 1.5;
    if (bid.customerNotes) points += 1;
    if (bid.customerName) points += 3;
    
    // Project Dates (10 points)
    const startDate = bid.startDate || bid.projectStartDate;
    const endDate = bid.endDate || bid.projectEndDate;
    if (startDate) points += 5;
    if (endDate) points += 5;
    
    // Materials & Labor (20 points)
    if ((materialsCart?.length || 0) > 0) points += 10;
    if ((bid.laborLineItems?.length || 0) > 0) points += 10;
    
    // Overhead & Markup (15 points)
    if (bid.overheadPct && bid.overheadPct > 0) points += 8;
    if (bid.markupPct && bid.markupPct > 0) points += 7;
    
    // Payment Schedule (25 points)
    if (bid.paymentSchedule === 'milestone-based') {
      const totalPct = bid.paymentMilestones?.reduce((sum, m) => sum + (m.percentage || 0), 0) || 0;
      if (Math.abs(totalPct - 100) < 0.1) {
        points += 25;
      } else if (totalPct > 0) {
        points += 15;
      }
    } else if (bid.paymentSchedule === 'weekly') {
      const totalScheduled = bid.weeklyPayments?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
      if (calc.total > 0 && Math.abs(calc.total - totalScheduled) < 1) {
        points += 25;
      } else if (totalScheduled > 0) {
        points += 15;
      }
    }
    
    // Legal & Compliance (10 points)
    if (bid.licenseNumber) points += 5;
    if (bid.insuranceCoverage) points += 5;
    
    // Work Schedule (5 points)
    if (bid.workSchedule) points += 5;
    
    return Math.min(100, Math.round(points));
  }, [bid, materialsCart, calc]);

  const healthColor = healthScore >= 80 ? '#38d39f' : healthScore >= 60 ? '#ffcc66' : '#ff7a7a';

  // Helper function to round payment amounts to 2 decimal places
  const roundPayment = (amount) => {
    return Math.round((amount || 0) * 100) / 100;
  };
  
  // Helper function to normalize payment amounts so they sum to exactly grandTotal
  // Also recalculates all percentages from amounts to ensure they sum to exactly 100%
  const normalizePaymentsToExactTotal = (payments, grandTotal, isMilestone = false) => {
    if (!payments || payments.length === 0 || grandTotal <= 0) return payments;
    
    // Calculate sum of all payments except the last one
    let sum = 0;
    const normalized = payments.map((p) => {
      const amount = isMilestone ? (p.paymentAmount || p.amount || 0) : (p.amount || 0);
      sum += amount;
      return { ...p };
    });
    
    // Make the last payment equal to grandTotal - sum of all others
    if (normalized.length > 0) {
      const lastIndex = normalized.length - 1;
      const lastCurrentAmount = isMilestone ? (normalized[lastIndex].paymentAmount || normalized[lastIndex].amount || 0) : (normalized[lastIndex].amount || 0);
      const lastAmount = roundPayment(grandTotal - (sum - lastCurrentAmount));
      
      if (isMilestone) {
        normalized[lastIndex].paymentAmount = lastAmount;
        normalized[lastIndex].amount = lastAmount;
      } else {
        normalized[lastIndex].amount = lastAmount;
      }
    }
    
    // Recalculate ALL percentages from amounts to ensure they sum to exactly 100%
    // This eliminates rounding errors from stored percentages
    if (grandTotal > 0) {
      let percentageSum = 0;
      normalized.forEach((p, index) => {
        const amount = isMilestone ? (p.paymentAmount || p.amount || 0) : (p.amount || 0);
        // Calculate percentage with high precision
        const pct = (amount / grandTotal) * 100;
        
        // For all but the last payment, round to 2 decimal places
        // The last payment will absorb any rounding differences
        if (index < normalized.length - 1) {
          const roundedPct = Math.round(pct * 100) / 100;
          p.percentage = roundedPct;
          percentageSum += roundedPct;
        } else {
          // Last payment: ensure total is exactly 100%
          p.percentage = Math.round((100 - percentageSum) * 100) / 100;
        }
      });
    }
    
    return normalized;
  };

  // Helper function to normalize hybrid payments (milestones + weekly) to ensure combined total equals exactly grandTotal
  const normalizeHybridPaymentsToExactTotal = (milestones, weeklyPayments, grandTotal) => {
    if (grandTotal <= 0) return { milestones, weeklyPayments };
    
    // First normalize each separately
    const normalizedMilestones = milestones.length > 0 ? normalizePaymentsToExactTotal(milestones, grandTotal, true) : [];
    const normalizedWeekly = weeklyPayments.length > 0 ? normalizePaymentsToExactTotal(weeklyPayments, grandTotal, false) : [];
    
    // Calculate combined total
    const milestoneTotal = normalizedMilestones.reduce((sum, m) => sum + (m.paymentAmount || m.amount || 0), 0);
    const weeklyTotal = normalizedWeekly.reduce((sum, w) => sum + (w.amount || 0), 0);
    const combinedTotal = milestoneTotal + weeklyTotal;
    const difference = grandTotal - combinedTotal;
    
    // If there's a difference, adjust the final payment to maintain 100% total
    // In hybrid mode, prefer adjusting final milestone, then last weekly payment
    if (Math.abs(difference) > 0.01) {
      // Find final milestone first (for hybrid mode)
      const finalMilestoneIndex = normalizedMilestones.findIndex(m => 
        m.type === 'final' || (m.name && (m.name.toLowerCase().includes('final') || m.name.toLowerCase().includes('completion')))
      );
      
      if (finalMilestoneIndex >= 0) {
        // Adjust final milestone
        const currentAmount = normalizedMilestones[finalMilestoneIndex].paymentAmount || normalizedMilestones[finalMilestoneIndex].amount || 0;
        const adjustedAmount = roundPayment(currentAmount + difference);
        normalizedMilestones[finalMilestoneIndex].paymentAmount = adjustedAmount;
        normalizedMilestones[finalMilestoneIndex].amount = adjustedAmount;
        // Recalculate percentage
        if (grandTotal > 0) {
          normalizedMilestones[finalMilestoneIndex].percentage = (adjustedAmount / grandTotal) * 100;
        }
      } else if (normalizedWeekly.length > 0) {
        // If no final milestone, adjust last weekly payment
        const lastIndex = normalizedWeekly.length - 1;
        const currentAmount = normalizedWeekly[lastIndex].amount || 0;
        const adjustedAmount = roundPayment(currentAmount + difference);
        normalizedWeekly[lastIndex].amount = adjustedAmount;
        // Recalculate percentage
        if (grandTotal > 0) {
          normalizedWeekly[lastIndex].percentage = (adjustedAmount / grandTotal) * 100;
        }
      } else if (normalizedMilestones.length > 0) {
        // Fallback: adjust last milestone
        const lastIndex = normalizedMilestones.length - 1;
        const currentAmount = normalizedMilestones[lastIndex].paymentAmount || normalizedMilestones[lastIndex].amount || 0;
        const adjustedAmount = roundPayment(currentAmount + difference);
        normalizedMilestones[lastIndex].paymentAmount = adjustedAmount;
        normalizedMilestones[lastIndex].amount = adjustedAmount;
        // Recalculate percentage
        if (grandTotal > 0) {
          normalizedMilestones[lastIndex].percentage = (adjustedAmount / grandTotal) * 100;
        }
      }
    }
    
    // Recalculate all percentages from final amounts to ensure accuracy
    if (grandTotal > 0) {
      // Recalculate milestone percentages
      normalizedMilestones.forEach(m => {
        const amount = m.paymentAmount || m.amount || 0;
        m.percentage = (amount / grandTotal) * 100;
      });
      
      // Recalculate weekly percentages
      normalizedWeekly.forEach(w => {
        const amount = w.amount || 0;
        w.percentage = (amount / grandTotal) * 100;
      });
      
      // Ensure combined percentages sum to exactly 100% by adjusting the final payment
      // In hybrid mode, prefer adjusting final milestone, then last weekly payment
      const milestonePctSum = normalizedMilestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
      const weeklyPctSum = normalizedWeekly.reduce((sum, w) => sum + (w.percentage || 0), 0);
      const combinedPctSum = milestonePctSum + weeklyPctSum;
      const pctDifference = 100 - combinedPctSum;
      
      if (Math.abs(pctDifference) > 0.01) {
        // Find final milestone first (for hybrid mode)
        const finalMilestoneIndex = normalizedMilestones.findIndex(m => 
          m.type === 'final' || (m.name && (m.name.toLowerCase().includes('final') || m.name.toLowerCase().includes('completion')))
        );
        
        if (finalMilestoneIndex >= 0) {
          // Adjust final milestone percentage
          normalizedMilestones[finalMilestoneIndex].percentage = Math.round((normalizedMilestones[finalMilestoneIndex].percentage + pctDifference) * 100) / 100;
          // Recalculate amount from percentage
          const newFinalAmount = roundPayment((grandTotal * normalizedMilestones[finalMilestoneIndex].percentage) / 100);
          normalizedMilestones[finalMilestoneIndex].paymentAmount = newFinalAmount;
          normalizedMilestones[finalMilestoneIndex].amount = newFinalAmount;
        } else if (normalizedWeekly.length > 0) {
          // If no final milestone, adjust last weekly payment
          const lastIndex = normalizedWeekly.length - 1;
          normalizedWeekly[lastIndex].percentage = Math.round((normalizedWeekly[lastIndex].percentage + pctDifference) * 100) / 100;
          // Recalculate amount from percentage
          const newWeeklyAmount = roundPayment((grandTotal * normalizedWeekly[lastIndex].percentage) / 100);
          normalizedWeekly[lastIndex].amount = newWeeklyAmount;
        } else if (normalizedMilestones.length > 0) {
          // Fallback: adjust last milestone
          const lastIndex = normalizedMilestones.length - 1;
          normalizedMilestones[lastIndex].percentage = Math.round((normalizedMilestones[lastIndex].percentage + pctDifference) * 100) / 100;
          // Recalculate amount from percentage
          const newMilestoneAmount = roundPayment((grandTotal * normalizedMilestones[lastIndex].percentage) / 100);
          normalizedMilestones[lastIndex].paymentAmount = newMilestoneAmount;
          normalizedMilestones[lastIndex].amount = newMilestoneAmount;
        }
      }
    }
    
    return { milestones: normalizedMilestones, weeklyPayments: normalizedWeekly };
  };

  const updateBid = async (key, value) => {
    let normalizedValue = value;
    
    // For payment updates, calculate current total and recalculate amounts from percentages
    if (key === 'paymentMilestones' || key === 'weeklyPayments') {
      // Calculate current total from materials, labor, overhead, markup
      const materials = materialsCart.reduce((sum, r) => sum + (r.total || 0), 0);
      const labor = (bid.laborLineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);
      const overhead = (bid.insuranceOverhead || 0) + (bid.equipment || 0) + (bid.facilities || 0) + (bid.otherOverhead || 0);
      const permitCosts = bid.permitCost || 0;
      const subtotal = materials + labor + overhead + permitCosts;
      const profit = (subtotal * (bid.markupPct || 0)) / 100;
      const grandTotal = Math.round(subtotal + profit) || calc?.total || calc?.grandTotal || bid.grandTotal || bid.total || 0;
      
      if (grandTotal > 0 && Array.isArray(value) && value.length > 0) {
        if (key === 'paymentMilestones') {
          // First, recalculate all amounts from percentages
          normalizedValue = value.map(m => {
            const percentage = m.percentage || 0;
            const newAmount = roundPayment((percentage / 100) * grandTotal);
            return {
              ...m,
              paymentAmount: newAmount,
              amount: newAmount
            };
          });
          // Then normalize to ensure exact total match
          normalizedValue = normalizePaymentsToExactTotal(normalizedValue, grandTotal, true);
        } else if (key === 'weeklyPayments') {
          // First, recalculate all amounts from percentages
          normalizedValue = value.map(p => {
            const percentage = p.percentage || 0;
            const newAmount = roundPayment((percentage / 100) * grandTotal);
            return {
              ...p,
              amount: newAmount
            };
          });
          // Then normalize to ensure exact total match
          normalizedValue = normalizePaymentsToExactTotal(normalizedValue, grandTotal, false);
        }
      }
    }
    
    const updatedBid = { ...bid, [key]: normalizedValue };
    setBid(updatedBid);
    
    // Auto-save payment schedule changes immediately
    if (key === 'paymentSchedule' || key === 'paymentMilestones' || key === 'weeklyPayments') {
      try {
        await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updatedBid));
        console.log(`💾 Auto-saved payment schedule change: ${key}`);
      } catch (error) {
        console.error('Error auto-saving payment schedule:', error);
      }
    }
  };

  // Payment Milestone Management
  const handleAddMilestone = () => {
    setMilestoneModal({ visible: true, item: null });
  };

  const handleEditMilestone = (milestone) => {
    setMilestoneModal({ visible: true, item: milestone });
  };

  const handleSaveMilestone = (milestoneData) => {
    const currentMilestones = bid.paymentMilestones || [];
    const grandTotal = bid.grandTotal || bid.total || 0;
    let updatedMilestones;
    
    if (milestoneData.id) {
      // Edit existing milestone - apply smart recalculation
      const editedMilestone = currentMilestones.find(m => m.id === milestoneData.id);
      const isDeposit = editedMilestone?.type === 'deposit' || (editedMilestone?.name && editedMilestone.name.toLowerCase().includes('deposit'));
      const isFinal = editedMilestone?.type === 'final' || (editedMilestone?.name && editedMilestone.name.toLowerCase().includes('final')) || (editedMilestone?.name && editedMilestone.name.toLowerCase().includes('completion'));
      
      // Get the new percentage from the edited milestone
      const newPct = milestoneData.percentage || (milestoneData.paymentAmount && grandTotal > 0 ? (milestoneData.paymentAmount / grandTotal) * 100 : 0);
      
      // Get all other milestones (excluding the one being edited)
      const otherMilestones = currentMilestones.filter(m => m.id !== milestoneData.id);
      
      // Calculate total percentage of other milestones
      const otherMilestonesPct = otherMilestones.reduce((sum, m) => {
        const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
        return sum + pct;
      }, 0);
      
      // Calculate remaining percentage after the edited milestone
      const remainingPct = 100 - newPct;
      
      // If remaining is negative or zero, adjust the edited milestone down
      if (remainingPct <= 0) {
        const adjustedPct = Math.max(0, 100 - otherMilestonesPct);
        const adjustedAmount = roundPayment((grandTotal * adjustedPct) / 100);
        milestoneData.percentage = adjustedPct;
        milestoneData.paymentAmount = adjustedAmount;
        milestoneData.amount = adjustedAmount;
        updatedMilestones = currentMilestones.map(m => 
          m.id === milestoneData.id ? milestoneData : m
        );
      } else if (otherMilestonesPct > remainingPct && otherMilestones.length > 0) {
        // Recalculate other milestones proportionally
        const scaleFactor = remainingPct / otherMilestonesPct;
        const adjustedOtherMilestones = otherMilestones.map(m => {
          const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
          const newPct = currentPct * scaleFactor;
          return {
            ...m,
            percentage: newPct,
            paymentAmount: roundPayment((grandTotal * newPct) / 100),
            amount: roundPayment((grandTotal * newPct) / 100)
          };
        });
        
        // Update the edited milestone with correct amount
        const newAmount = roundPayment((grandTotal * newPct) / 100);
        milestoneData.paymentAmount = newAmount;
        milestoneData.amount = newAmount;
        
        updatedMilestones = [milestoneData, ...adjustedOtherMilestones].sort((a, b) => {
          // Keep deposit first, final last, others in between
          const aIsDeposit = a.type === 'deposit' || (a.name && a.name.toLowerCase().includes('deposit'));
          const bIsDeposit = b.type === 'deposit' || (b.name && b.name.toLowerCase().includes('deposit'));
          const aIsFinal = a.type === 'final' || (a.name && a.name.toLowerCase().includes('final')) || (a.name && a.name.toLowerCase().includes('completion'));
          const bIsFinal = b.type === 'final' || (b.name && b.name.toLowerCase().includes('final')) || (b.name && b.name.toLowerCase().includes('completion'));
          
          if (aIsDeposit) return -1;
          if (bIsDeposit) return 1;
          if (aIsFinal) return 1;
          if (bIsFinal) return -1;
          return 0;
        });
      } else {
        // No adjustment needed, just update the edited milestone
        const newAmount = roundPayment((grandTotal * newPct) / 100);
        milestoneData.paymentAmount = newAmount;
        milestoneData.amount = newAmount;
        updatedMilestones = currentMilestones.map(m => 
          m.id === milestoneData.id ? milestoneData : m
        );
      }
    } else {
      // Add new milestone - check if total would exceed 100%
      const newPct = milestoneData.percentage || (milestoneData.paymentAmount && grandTotal > 0 ? (milestoneData.paymentAmount / grandTotal) * 100 : 0);
      const currentTotalPct = currentMilestones.reduce((sum, m) => {
        const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
        return sum + pct;
      }, 0);
      
      if (currentTotalPct + newPct > 100) {
        // Adjust all milestones proportionally
        const totalPct = currentTotalPct + newPct;
        const scaleFactor = 100 / totalPct;
        
        const adjustedMilestones = currentMilestones.map(m => {
          const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
          const adjustedPct = currentPct * scaleFactor;
          return {
            ...m,
            percentage: adjustedPct,
            paymentAmount: roundPayment((grandTotal * adjustedPct) / 100),
            amount: roundPayment((grandTotal * adjustedPct) / 100)
          };
        });
        
        const adjustedNewPct = newPct * scaleFactor;
        const newMilestone = {
          ...milestoneData,
          id: milestoneData.id || `milestone-${Date.now()}`,
          percentage: adjustedNewPct,
          paymentAmount: roundPayment((grandTotal * adjustedNewPct) / 100),
          amount: roundPayment((grandTotal * adjustedNewPct) / 100)
        };
        
        updatedMilestones = [...adjustedMilestones, newMilestone];
      } else {
        // No adjustment needed
        const newMilestone = {
          ...milestoneData,
          id: milestoneData.id || `milestone-${Date.now()}`,
        };
        updatedMilestones = [...currentMilestones, newMilestone];
      }
    }
    
    // Normalize to ensure exact total match (grandTotal already declared at function start)
    if (grandTotal > 0 && updatedMilestones.length > 0) {
      updatedMilestones = normalizePaymentsToExactTotal(updatedMilestones, grandTotal, true);
    }
    
    updateBid('paymentMilestones', updatedMilestones);
    setMilestoneModal({ visible: false, item: null });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteMilestone = (milestoneId) => {
    Alert.alert(
      'Delete Milestone',
      'Are you sure you want to delete this payment milestone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedMilestones = (bid.paymentMilestones || []).filter(m => m.id !== milestoneId);
            updateBid('paymentMilestones', updatedMilestones);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  // Weekly Payment Management
  const handleAddWeeklyPayment = () => {
    setWeeklyPaymentModal({ visible: true, item: null });
  };

  const handleEditWeeklyPayment = (payment) => {
    setWeeklyPaymentModal({ visible: true, item: payment });
  };

  const handleSaveWeeklyPayment = (paymentData) => {
    const currentPayments = bid.weeklyPayments || [];
    const grandTotal = bid.grandTotal || bid.total || 0;
    let updatedPayments;
    
    if (paymentData.id) {
      // Edit existing payment - apply smart recalculation for time-based
      const editedPayment = currentPayments.find(p => p.id === paymentData.id);
      const isDeposit = editedPayment?.weekNumber === 0 || (editedPayment?.description && editedPayment.description.toLowerCase().includes('deposit'));
      
      // Get the new percentage from the edited payment
      const newPct = paymentData.percentage || (paymentData.amount && grandTotal > 0 ? (paymentData.amount / grandTotal) * 100 : 0);
      
      // Get all other payments (excluding the one being edited)
      const otherPayments = currentPayments.filter(p => p.id !== paymentData.id);
      
      // Calculate total percentage of other payments
      const otherPaymentsPct = otherPayments.reduce((sum, p) => {
        const pct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
        return sum + pct;
      }, 0);
      
      // Calculate remaining percentage after the edited payment
      const remainingPct = 100 - newPct;
      
      // If remaining is negative or zero, adjust the edited payment down
      if (remainingPct <= 0) {
        const adjustedPct = Math.max(0, 100 - otherPaymentsPct);
        const adjustedAmount = roundPayment((grandTotal * adjustedPct) / 100);
        paymentData.percentage = adjustedPct;
        paymentData.amount = adjustedAmount;
        updatedPayments = currentPayments.map(p => 
          p.id === paymentData.id ? paymentData : p
        );
      } else if (otherPaymentsPct > remainingPct && otherPayments.length > 0) {
        // Recalculate other payments proportionally
        const scaleFactor = remainingPct / otherPaymentsPct;
        const adjustedOtherPayments = otherPayments.map(p => {
          const currentPct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
          const newPct = currentPct * scaleFactor;
          return {
            ...p,
            percentage: newPct,
            amount: roundPayment((grandTotal * newPct) / 100)
          };
        });
        
        // Update the edited payment with correct amount
        const newAmount = roundPayment((grandTotal * newPct) / 100);
        paymentData.amount = newAmount;
        
        updatedPayments = [paymentData, ...adjustedOtherPayments].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
      } else {
        // No adjustment needed, just update the edited payment
        const newAmount = roundPayment((grandTotal * newPct) / 100);
        paymentData.amount = newAmount;
        updatedPayments = currentPayments.map(p => 
          p.id === paymentData.id ? paymentData : p
        );
      }
    } else {
      // Add new payment - check if total would exceed 100%
      const newPct = paymentData.percentage || (paymentData.amount && grandTotal > 0 ? (paymentData.amount / grandTotal) * 100 : 0);
      const currentTotalPct = currentPayments.reduce((sum, p) => {
        const pct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
        return sum + pct;
      }, 0);
      
      if (currentTotalPct + newPct > 100) {
        // Adjust all payments proportionally
        const totalPct = currentTotalPct + newPct;
        const scaleFactor = 100 / totalPct;
        
        const adjustedPayments = currentPayments.map(p => {
          const currentPct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
          const adjustedPct = currentPct * scaleFactor;
          return {
            ...p,
            percentage: adjustedPct,
            amount: roundPayment((grandTotal * adjustedPct) / 100)
          };
        });
        
        const maxWeekNumber = currentPayments.length > 0 
          ? Math.max(...currentPayments.map(p => p.weekNumber || 0))
          : 0;
        const adjustedNewPct = newPct * scaleFactor;
        const newPayment = {
          ...paymentData,
          id: paymentData.id || `week-${Date.now()}`,
          weekNumber: paymentData.weekNumber || maxWeekNumber + 1,
          percentage: adjustedNewPct,
          amount: roundPayment((grandTotal * adjustedNewPct) / 100)
        };
        
        updatedPayments = [...adjustedPayments, newPayment];
      } else {
        // No adjustment needed
        const maxWeekNumber = currentPayments.length > 0 
          ? Math.max(...currentPayments.map(p => p.weekNumber || 0))
          : 0;
        const newPayment = {
          ...paymentData,
          id: paymentData.id || `week-${Date.now()}`,
          weekNumber: paymentData.weekNumber || maxWeekNumber + 1,
        };
        updatedPayments = [...currentPayments, newPayment];
      }
    }
    
    // Sort by week number
    updatedPayments.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
    
    // Normalize to ensure exact total match (grandTotal already declared at function start)
    if (grandTotal > 0 && updatedPayments.length > 0) {
      updatedPayments = normalizePaymentsToExactTotal(updatedPayments, grandTotal, false);
    }
    
    updateBid('weeklyPayments', updatedPayments);
    setWeeklyPaymentModal({ visible: false, item: null });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteWeeklyPayment = (paymentId) => {
    Alert.alert(
      'Delete Weekly Payment',
      'Are you sure you want to delete this weekly payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedPayments = (bid.weeklyPayments || []).filter(p => p.id !== paymentId);
            updateBid('weeklyPayments', updatedPayments);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  useEffect(() => {
    const sourceType =
      bid?.projectType ||
      bid?.projectCategory ||
      bid?.category ||
      bid?.template;
    if (!sourceType) return;
    const normalized = normalizeScope(sourceType);
    if (normalized !== activeScope) {
      setActiveScope(normalized);
    }
  }, [bid?.projectType, bid?.projectCategory, bid?.category, bid?.template, activeScope, normalizeScope]);

  // Build Contract Document from Bid Data
  const buildDocFromBid = (bidData, calcData) => {
    const scopeBullets = bidData.scopeDescription 
      ? bidData.scopeDescription.split('\n').filter(line => line.trim())
      : ['Complete renovation as specified'];

    // Build detailed line items from materials cart
    const materialLineItems = materialsCart && materialsCart.length > 0
      ? materialsCart.map(item => ({
          description: item.name || item.description || 'Material',
          unit: item.unit || 'ea',
          quantity: item.qty || item.quantity || 1,
          materials: item.total || 0,
          labor: 0,
          category: 'Materials',
          section: item.section || 'General Materials'
        }))
      : ((calcData?.materials || 0) > 0 ? [{
          description: 'Materials & Supplies',
          unit: 'total',
          quantity: 1,
          materials: calcData.materials,
          labor: 0,
          category: 'Materials'
        }] : []);

    // Calculate total overhead
    const totalOverhead = Number(bidData.insuranceOverhead || 0) + 
                         Number(bidData.equipment || 0) + 
                         Number(bidData.facilities || 0) + 
                         Number(bidData.otherOverhead || 0);

    return {
      summary: {
        contractId: bidData.id || `BPS-${Date.now()}`,
        projectName: bidData.title || 'Untitled Project',
        siteAddress: `${bidData.customerAddress || ''} ${bidData.customerCity || ''}, ${bidData.customerState || ''} ${bidData.customerZip || ''}`.trim() || 'N/A',
        unitPrice: bidData.sqft ? (() => {
          const materials = calcData?.materials || 0;
          const labor = calcData?.labor || 0;
          const overhead = totalOverhead;
          const permitCosts = bidData.permitCost || 0;
          const subtotal = materials + labor + overhead + permitCosts;
          const markup = subtotal * ((bidData.markupPct || 0) / 100);
          return Math.round(subtotal + markup) / bidData.sqft;
        })() : undefined,
        totalBid: (() => {
          const materials = calcData?.materials || 0;
          const labor = calcData?.labor || 0;
          const overhead = totalOverhead;
          const permitCosts = bidData.permitCost || 0;
          const subtotal = materials + labor + overhead + permitCosts;
          const markup = subtotal * ((bidData.markupPct || 0) / 100);
          return Math.round(subtotal + markup);
        })(),
        durationDays: bidData.projectDuration || 30,
        estimatedStartDate: bidData.projectStartDate || undefined,
        estimatedEndDate: bidData.projectEndDate || (bidData.projectStartDate ? 
          new Date(new Date(bidData.projectStartDate).getTime() + (bidData.projectDuration || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
          : undefined),
        startDate: bidData.projectStartDate ? new Date(bidData.projectStartDate + 'T00:00:00').toLocaleDateString() : 'TBD',
        expiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        retainagePct: 10,
        version: bidData.revision ? `Rev ${bidData.revision}` : 'Final',
      },
      contractor: {
        contactName: contractorProfile.name || undefined,
        legalName: contractorProfile.company || 'AMERICAN HOME RESTORATION',
        licenseNo: bidData.licenseNumber || undefined,
        phone: undefined,
        email: undefined,
        insurer: bidData.insuranceCoverage || undefined,
        glLimit: undefined,
        wcActive: bidData.insurance || false,
        logoUrl: contractorProfile.avatar || undefined,
      },
      owner: {
        legalName: bidData.customerName || 'N/A',
        phone: bidData.customerPhone || undefined,
        email: bidData.customerEmail || undefined,
        address: `${bidData.customerAddress || ''} ${bidData.customerCity || ''}, ${bidData.customerState || ''} ${bidData.customerZip || ''}`.trim() || undefined,
      },
      scope: {
        bullets: scopeBullets,
        inclusions: [],
        exclusions: [],
        ownerResponsibilities: [],
        materialLineItems: materialLineItems,
        laborLineItems: (bidData.laborLineItems || []).map(item => ({
          description: item.description || 'Labor',
          labor: item.total || 0,
          materials: 0,
          category: 'Labor'
        })),
      },
      allowances: [],
      milestones: bidData.paymentSchedule === 'milestone-based' && bidData.paymentMilestones
        ? bidData.paymentMilestones.map(m => ({
            id: m.id,
            name: m.name || 'Payment Milestone',
            percentage: m.percentage || 0,
            percent: m.percentage || 0,
            paymentAmount: m.paymentAmount || 0,
            amount: m.paymentAmount || 0,
            description: m.description || undefined,
            scheduledDate: m.scheduledDate || undefined,
            dueDate: m.scheduledDate || undefined,
            status: 'Pending',
          }))
        : bidData.paymentSchedule === 'weekly' && bidData.weeklyPayments
        ? bidData.weeklyPayments.map((w, i) => ({
            id: w.id,
            name: `Week ${i + 1} Payment`,
            percentage: calcData?.materials && calcData?.labor ? Math.round((w.amount / ((calcData.materials || 0) + (calcData.labor || 0) + (bidData.insuranceOverhead || 0) + (bidData.equipment || 0) + (bidData.facilities || 0) + (bidData.otherOverhead || 0))) * 100) : 0,
            percent: calcData?.materials && calcData?.labor ? Math.round((w.amount / ((calcData.materials || 0) + (calcData.labor || 0) + (bidData.insuranceOverhead || 0) + (bidData.equipment || 0) + (bidData.facilities || 0) + (bidData.otherOverhead || 0))) * 100) : 0,
            paymentAmount: w.amount || 0,
            amount: w.amount || 0,
            description: w.description || undefined,
            scheduledDate: w.scheduledDate || undefined,
            dueDate: w.scheduledDate || undefined,
            status: 'Pending',
          }))
        : [],
      terms: {
        lateInterestPct: 1.5,
        suspendDays: 7,
        cureDays: 7,
        convDays: 7,
        convFeePct: 5,
        escalationThresholdPct: 8,
        warrantyYears: bidData.warrantyYears || 1,
        stateLaw: bidData.customerState || 'Nevada',
        workHours: bidData.workSchedule === 'weekdays' ? 'Mon–Fri, 8:00a–5:00p' : 'Flexible',
        permitsBy: 'Contractor',
        permitFeesPaidBy: 'Owner',
      },
      labor: calcData?.labor || 0,
      materials: calcData?.materials || 0,
      overhead: totalOverhead,
      profitMarginPct: bidData.markupPct || 0,
    };
  };

  // Generate and Share Contract - Goes straight to PDF sharing
  const generateContract = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      console.log('🔨 Building and sharing contract from bid:', bid.title || 'Untitled');
      console.log('👤 Using contractor profile:', contractorProfile);
      
      // Convert logo to base64 if it exists
      let logoBase64 = null;
      if (contractorProfile.avatar && contractorProfile.avatar.startsWith('file://')) {
        try {
          console.log('🖼️ Converting logo to base64...');
          const base64 = await FileSystem.readAsStringAsync(contractorProfile.avatar, {
            encoding: 'base64',
          });
          // Determine image type from file extension
          const extension = contractorProfile.avatar.split('.').pop().toLowerCase();
          const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
          logoBase64 = `data:${mimeType};base64,${base64}`;
          console.log('✅ Logo converted to base64 data URI');
        } catch (error) {
          console.error('Failed to convert logo:', error);
        }
      }
      
      // Build contract document from bid data with real-time calculations
      const doc = buildDocFromBid(bid, calc);
      // Override logo with base64 version
      if (logoBase64) {
        doc.contractor.logoUrl = logoBase64;
      }
      console.log('📄 Built contract doc:', {
        contractorName: doc.contractor.legalName,
        contractorLogo: doc.contractor.logoUrl ? 'base64 data URI' : 'none'
      });
      
      // Generate HTML and immediately export as PDF
      const html = buildProposalHtml(doc);
      console.log('🌐 Generated proposal HTML (' + html.length + ' chars)');
      
      // Export and share the PDF directly
      await exportProposalPdf(html, `${bid.title || 'contract'}-${bid.id}`);
      
      console.log('✅ Contract PDF generated and shared successfully');
    } catch (error) {
      console.error('❌ Error generating contract:', error);
      console.error('Error stack:', error.stack);
      Alert.alert(
        '❌ Error',
        `Failed to generate contract: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  // Manual recovery function for Haim bid
  const handleRecoverHaimBid = async () => {
    try {
      console.log('🔍 COMPREHENSIVE Haim bid search starting...');
      
      // Get ALL AsyncStorage keys first
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('📋 ALL storage keys found:', allKeys);
      
      // Check every single storage key for any data containing "haim"
      let foundData = null;
      let foundInKey = null;
      
      for (const key of allKeys) {
        try {
          console.log(`🔍 Checking key: ${key}`);
          const data = await AsyncStorage.getItem(key);
          if (data) {
            // Try to parse as JSON
            try {
              const parsed = JSON.parse(data);
              console.log(`📄 Key ${key} contains:`, typeof parsed, Array.isArray(parsed) ? `Array(${parsed.length})` : 'Object');
              
              // Check if it's an array of projects
              if (Array.isArray(parsed)) {
                for (let i = 0; i < parsed.length; i++) {
                  const item = parsed[i];
                  if (item && typeof item === 'object') {
                    // Check all string properties for "haim"
                    for (const prop in item) {
                      if (typeof item[prop] === 'string' && item[prop].toLowerCase().includes('haim')) {
                        console.log(`🎉 Found "haim" in ${key}[${i}].${prop}: "${item[prop]}"`);
                        foundData = item;
                        foundInKey = `${key}[${i}]`;
                        break;
                      }
                    }
                  }
                }
              } else if (parsed && typeof parsed === 'object') {
                // Check all string properties for "haim"
                for (const prop in parsed) {
                  if (typeof parsed[prop] === 'string' && parsed[prop].toLowerCase().includes('haim')) {
                    console.log(`🎉 Found "haim" in ${key}.${prop}: "${parsed[prop]}"`);
                    foundData = parsed;
                    foundInKey = key;
                    break;
                  }
                }
              }
            } catch (parseError) {
              // Not JSON, check if it's a string containing "haim"
              if (data.toLowerCase().includes('haim')) {
                console.log(`🎉 Found "haim" in raw data of ${key}: "${data.substring(0, 100)}..."`);
                foundData = data;
                foundInKey = key;
              }
            }
          }
        } catch (e) {
          console.log(`⚠️ Error reading ${key}:`, e.message);
        }
      }
      
      if (foundData) {
        console.log(`✅ Found Haim data in ${foundInKey}:`, foundData);
        
        // If it's a project with estimateData, use that
        if (foundData.estimateData) {
          console.log('🔄 Converting project estimateData back to bid...');
          setBid(foundData.estimateData);
          Alert.alert(
            '✅ Haim Bid Recovered!',
            `Found your Haim bid in ${foundInKey}`,
            [{ 
              text: 'OK',
              onPress: () => {
                console.log('✅ Bid should now be loaded:', foundData.estimateData);
              }
            }]
          );
          return;
        }
        
        // If it's a bid object, use it directly
        if (foundData.title || foundData.id) {
          console.log('🔄 Using found bid data directly...');
          console.log('📋 Setting bid to:', foundData);
          setBid(foundData);
          
          // Force a small delay to ensure state update
          setTimeout(() => {
            console.log('🔄 Forcing bid state refresh...');
            setBid(prevBid => ({ ...prevBid, ...foundData }));
          }, 100);
          
          Alert.alert(
            '✅ Haim Bid Recovered!',
            `Found your Haim bid in ${foundInKey}`,
            [{ 
              text: 'OK',
              onPress: () => {
                console.log('✅ Bid should now be loaded:', foundData);
                // Force another refresh after alert
                setTimeout(() => {
                  setBid(foundData);
                }, 50);
              }
            }]
          );
          return;
        }
        
        // If it's raw data, try to parse it as a bid
        if (typeof foundData === 'string') {
          try {
            const parsedData = JSON.parse(foundData);
            console.log('🔄 Parsing raw data as bid...');
            setBid(parsedData);
            Alert.alert(
              '✅ Haim Bid Recovered!',
              `Found your Haim bid in ${foundInKey}`,
              [{ 
                text: 'OK',
                onPress: () => {
                  console.log('✅ Bid should now be loaded:', parsedData);
                }
              }]
            );
            return;
          } catch (e) {
            console.log('⚠️ Could not parse raw data as JSON');
          }
        }
      }
      
      // If we get here, show detailed failure info
      console.log('❌ No Haim data found in any storage key');
      Alert.alert(
        '❌ Haim Bid Not Found',
        `Searched ${allKeys.length} storage keys but couldn't find any data containing "haim". The bid may have been permanently overwritten.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Error in comprehensive recovery:', error);
      Alert.alert('Error', `Recovery failed: ${error.message}`);
    }
  };

  // Save estimate to unified context
  const handleSaveEstimate = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      console.log('🔍 Debug - calc object:', calc);
      console.log('🔍 Debug - bid object:', bid);
      
      const location = `${bid.customerCity || 'Unknown'}, ${bid.customerState || 'Unknown'}`;
      
      // Add safety checks for calc values
      const estimatedCost = Number(calc?.subtotal) || 0;
      const bidPrice = Number(calc?.grandTotal) || 0;
      const margin = Number(calc?.marginPercent) || 0;
      const markup = Number(bid.markupPct) || 0;
      
      console.log('🔍 Debug - calculated values:', {
        estimatedCost,
        bidPrice,
        margin,
        markup,
        calcSubtotal: calc?.subtotal,
        calcGrandTotal: calc?.grandTotal,
        calcMargin: calc?.marginPercent
      });
      
      // Preserve existing status if bid was already submitted
      const existingProject = [...activeProjects, ...estimates].find(p => p.id === bid.id);
      const preservedStatus = existingProject?.status || 'estimate';
      
      const estimateData = {
        id: bid.id,
        title: bid.title || 'Untitled Bid',
        status: preservedStatus, // Preserve existing status (estimate, bid_submitted, won, etc.)
        estimatedCost,
        bidPrice,
        actualCost: 0,
        margin,
        markup,
        location,
        city: bid.customerCity,
        state: bid.customerState,
        zip: bid.customerZip,
        startDate: bid.startDate || new Date().toISOString().split('T')[0],
        endDate: bid.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        progress: 0,
        client: bid.customerName || bid.clientName || 'Unknown Client',
        clientEmail: bid.customerEmail || bid.clientEmail,
        clientPhone: bid.customerPhone,
        projectType: bid.projectType,
        projectCategory: bid.projectCategory || PROJECT_CATEGORY_SLUGS[bid.projectType] || bid.category,
        category: bid.category || PROJECT_CATEGORY_SLUGS[bid.projectType] || 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        estimateData: bid,
      };
      
      console.log('🔍 Debug - estimate data to save:', estimateData);
      
      addEstimate(estimateData);
      
      Alert.alert(
        '✅ Estimate Saved!',
        'Your estimate has been saved and will appear in Dashboard and Projects.',
        [{ text: 'OK' }]
      );
      console.log(`✅ Saved estimate: ${bid.title} ($${bidPrice.toLocaleString()})`);
    } catch (error) {
      console.error('❌ Error saving estimate:', error);
      console.error('❌ Error stack:', error.stack);
      Alert.alert('Error', `Failed to save estimate: ${error.message}`);
    }
  };

  // Submit bid to client (changes status to bid_submitted)
  const handleSubmitBid = () => {
    console.log('🔍 handleSubmitBid called');
    console.log('🔍 calc object:', calc);
    console.log('🔍 bid object:', bid);
    
    Alert.alert(
      'Submit Bid to Client?',
      'This will mark the estimate as submitted and track it as a pending bid.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            console.log('🔍 Submit button pressed');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            
            // First ensure the estimate is saved, then update status
            try {
              // Save the estimate first if it doesn't exist
              const location = `${bid.customerCity || 'Unknown'}, ${bid.customerState || 'Unknown'}`;
              const estimatedCost = Number(calc?.subtotal || 0);
              const bidPrice = Number(calc?.total || 0);
              const margin = Number(calc?.marginPercent || 0);
              const markup = Number(bid.markupPct || 0);
              
              console.log('🔍 Calculated values:', { estimatedCost, bidPrice, margin, markup });
              
              const estimateData = {
                id: bid.id,
                title: bid.title || 'Untitled Bid',
                status: 'bid_submitted', // Set status to bid_submitted so it shows as "Submitted" in projects
                estimatedCost,
                bidPrice,
                actualCost: 0,
                margin,
                markup,
                location,
                city: bid.customerCity,
                state: bid.customerState,
                zip: bid.customerZip,
                startDate: bid.startDate || new Date().toISOString().split('T')[0],
                endDate: bid.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress: 0,
                client: bid.customerName || bid.clientName || 'Unknown Client',
                clientEmail: bid.customerEmail || bid.clientEmail,
                clientPhone: bid.customerPhone,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                estimateData: bid,
              };
              
              console.log('🔍 Debug - submitting bid with data:', estimateData);
              addEstimate(estimateData);
              
              // Update lead stage to "proposal" if this bid came from a qualified lead
              if (bid.leadId && bid.leadSource === 'qualified_lead') {
                try {
                  const leadId = bid.leadId;
                  console.log(`🔄 Updating lead ${leadId} stage to proposal after submitting bid`);
                  console.log(`🔄 Lead source: ${bid.leadSource}, Lead ID: ${leadId}`);
                  
                  // Track that bid was submitted
                  const { trackBidSubmitted } = await import('../../services/engagementTracking');
                  await trackBidSubmitted(leadId);
                  
                  // Update backend lead (including MOCK- leads which are backend-managed)
                  try {
                    await unifiedLeadService.updateLeadStage(leadId, 'proposal');
                    console.log(`✅ Updated backend lead ${leadId} stage to proposal`);
                    
                    // Also update AsyncStorage as backup so leads screen picks up the change
                    const leadsData = await AsyncStorage.getItem('leadsData');
                    if (leadsData) {
                      const leads = JSON.parse(leadsData);
                      const existingIndex = leads.findIndex((l) => l.id === leadId);
                      if (existingIndex >= 0) {
                        leads[existingIndex] = {
                          ...leads[existingIndex],
                          stage: 'proposal',
                          updatedAt: new Date().toISOString()
                        };
                        await AsyncStorage.setItem('leadsData', JSON.stringify(leads));
                        console.log(`✅ Also updated AsyncStorage backup for backend lead ${leadId}`);
                      }
                    }
                  } catch (updateError) {
                    // If backend update fails (e.g., 404 for frontend-only leads), update AsyncStorage only
                    console.warn(`⚠️ Backend update failed for ${leadId}, updating AsyncStorage only:`, updateError);
                    const leadsData = await AsyncStorage.getItem('leadsData');
                    if (leadsData) {
                      const leads = JSON.parse(leadsData);
                      const updatedLeads = leads.map((l) => 
                        l.id === leadId ? { ...l, stage: 'proposal', updatedAt: new Date().toISOString() } : l
                      );
                      await AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads));
                      console.log(`✅ Updated frontend lead ${leadId} stage to proposal in AsyncStorage`);
                    }
                  }
                } catch (leadUpdateError) {
                  console.warn('⚠️ Failed to update lead stage after proposal submission:', leadUpdateError);
                  // Don't block the submission if lead update fails
                }
              }
              
              Alert.alert('✅ Bid Submitted!', 'Your bid is now being tracked as pending and will appear in Dashboard and Projects.');
              console.log(`📤 Submitted bid: ${bid.title} ($${bidPrice.toLocaleString()})`);
              
              // If this came from a lead, navigate back to leads screen to see the updated stage
              if (bid.leadId && bid.leadSource === 'qualified_lead') {
                console.log('🔄 Navigating back to leads screen to show updated stage');
                // Small delay to ensure backend update completes
                setTimeout(() => {
                  router.push('/(tabs)/leads');
                }, 500);
              }
            } catch (error) {
              console.error('❌ Error submitting bid:', error);
              Alert.alert('Error', `Failed to submit bid: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  // Mark bid as won (converts to project)
  const handleMarkAsWon = () => {
    Alert.alert(
      '🎉 Mark Bid as Won?',
      'This will convert your bid into an active project.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Won',
          style: 'default',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // First, ensure the bid/estimate is saved to the projects list
            // Check if it already exists
            const allProjects = [...activeProjects, ...estimates];
            console.log(`🔍 Checking for bid ${bid.id} in ${allProjects.length} projects`);
            console.log(`🔍 Available project IDs:`, allProjects.map(p => `${p.id} (${p.status})`));
            
            const existingProject = allProjects.find(p => p.id === bid.id);
            
            if (!existingProject) {
              console.log(`📝 Bid ${bid.id} not found in projects, saving it first...`);
              // Save the estimate with 'in_progress' status directly (since we're marking it as won)
              const location = `${bid.customerCity || 'Unknown'}, ${bid.customerState || 'Unknown'}`;
              const estimatedCost = Number(calc?.subtotal) || 0;
              const bidPrice = Number(calc?.grandTotal) || 0;
              const margin = Number(calc?.marginPercent) || 0;
              const markup = Number(bid.markupPct) || 0;
              
              const estimateData = {
                id: bid.id,
                title: bid.title || 'Untitled Bid',
                status: 'won', // Set status to 'won' so it shows as "Active" in projects
                estimatedCost,
                bidPrice,
                actualCost: 0,
                margin,
                markup,
                location,
                city: bid.customerCity,
                state: bid.customerState,
                zip: bid.customerZip,
                startDate: bid.startDate || new Date().toISOString().split('T')[0],
                endDate: bid.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress: 0,
                client: bid.customerName || bid.clientName || 'Unknown Client',
                clientEmail: bid.customerEmail || bid.clientEmail,
                clientPhone: bid.customerPhone,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                estimateData: bid,
              };
              
              console.log(`💾 Saving bid as active project with status 'won':`, {
                id: estimateData.id,
                title: estimateData.title,
                status: estimateData.status,
                bidPrice: estimateData.bidPrice
              });
              addEstimate(estimateData);
              console.log(`✅ Bid saved! It should now appear in Projects tab with 'Active' status.`);
            } else {
              // Bid exists, convert it to won (Active)
              console.log(`🔄 Converting existing bid ${bid.id} from status '${existingProject.status}' to 'won'`);
              // Update the project status to 'won' so it shows as "Active"
              updateProject(bid.id, { status: 'won' });
              
              // Verify the update happened
              setTimeout(() => {
                const updatedProjects = [...activeProjects, ...estimates];
                const updated = updatedProjects.find(p => p.id === bid.id);
                if (updated) {
                  console.log(`✅ Verified: Bid ${bid.id} now has status '${updated.status}' (should display as 'Active')`);
                } else {
                  console.log(`⚠️ Warning: Could not find bid ${bid.id} after conversion`);
                }
              }, 500);
            }
            
            // Update lead stage to "won" if this bid came from a qualified lead
            if (bid.leadId && bid.leadSource === 'qualified_lead') {
              try {
                const leadId = bid.leadId;
                console.log(`🔄 Updating lead ${leadId} stage to won after marking bid as won`);
                
                // Track that bid was won
                const { trackBidWon } = await import('../../services/engagementTracking');
                await trackBidWon(leadId);
                
                // Update backend lead (including MOCK- leads which are backend-managed)
                try {
                  await unifiedLeadService.updateLeadStage(leadId, 'won');
                  console.log(`✅ Updated backend lead ${leadId} stage to won`);
                  
                  // Also update AsyncStorage as backup
                  const leadsData = await AsyncStorage.getItem('leadsData');
                  if (leadsData) {
                    const leads = JSON.parse(leadsData);
                    const existingIndex = leads.findIndex((l) => l.id === leadId);
                    if (existingIndex >= 0) {
                      leads[existingIndex] = {
                        ...leads[existingIndex],
                        stage: 'won',
                        updatedAt: new Date().toISOString()
                      };
                      await AsyncStorage.setItem('leadsData', JSON.stringify(leads));
                      console.log(`✅ Also updated AsyncStorage backup for backend lead ${leadId}`);
                    }
                  }
                } catch (updateError) {
                  // If backend update fails (e.g., 404 for frontend-only leads), update AsyncStorage only
                  console.warn(`⚠️ Backend update failed for ${leadId}, updating AsyncStorage only:`, updateError);
                  const leadsData = await AsyncStorage.getItem('leadsData');
                  if (leadsData) {
                    const leads = JSON.parse(leadsData);
                    const updatedLeads = leads.map((l) => 
                      l.id === leadId ? { ...l, stage: 'won', updatedAt: new Date().toISOString() } : l
                    );
                    await AsyncStorage.setItem('leadsData', JSON.stringify(updatedLeads));
                    console.log(`✅ Updated frontend lead ${leadId} stage to won in AsyncStorage`);
                  }
                }
              } catch (leadUpdateError) {
                console.warn('⚠️ Failed to update lead stage after marking bid as won:', leadUpdateError);
                // Don't block the action if lead update fails
              }
            }
            
            Alert.alert(
              '🎉 Congratulations!',
              `${bid.title} is now an active project! View it in the Projects tab.`,
              [{ text: 'OK' }]
            );
            console.log(`🎉 Won bid converted to project: ${bid.title}`);
          }
        }
      ]
    );
  };


  // Clear payment terms and schedule notes
  useEffect(() => {
    setBid(prev => ({
      ...prev,
      additionalPaymentTerms: '',
      scheduleNotes: ''
    }));
  }, []);

  // Calculate and save overhead percentage
  useEffect(() => {
    const totalOverhead = Number(bid.insuranceOverhead || 0) + Number(bid.equipment || 0) + Number(bid.facilities || 0) + Number(bid.otherOverhead || 0);
    const totalMaterials = Number(calc.materials || 0);
    const totalLabor = Number(calc.labor || 0);
    const totalPermitCosts = Number(bid.permitCost || 0);
    const subtotal = totalMaterials + totalLabor + totalPermitCosts;
    const overheadPct = subtotal > 0 ? Math.round((totalOverhead / subtotal) * 100) : 0;
    
    if (bid.overheadPct !== overheadPct) {
      setBid(prev => ({
        ...prev,
        overheadPct: overheadPct
      }));
    }
  }, [bid.insuranceOverhead, bid.equipment, bid.facilities, bid.otherOverhead, calc.materials, calc.labor]);

  
  // Enhanced materials helpers
  const filteredCatalog = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    if (!q) return MATERIAL_CATALOG;
    return MATERIAL_CATALOG.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.keywords || []).some(k => k.toLowerCase().includes(q))
    );
  }, [materialSearch]);
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev => ({ ...prev, [categoryKey]: !prev[categoryKey] }));
  };
  
  const addMaterialToCart = (item, scope, section) => {
    const vendorId = materialSelectedVendor[item.id] || PRICE_BOOK[item.id][0].vendorId;
    const vendor = PRICE_BOOK[item.id].find(v => v.vendorId === vendorId);
    const qty = Number(materialNeedQty[item.id] || 0);
    if (!qty || qty <= 0 || !vendor) return;
    
    const row = {
      id: String(Date.now()),
      itemId: item.id,
      name: item.name,
      scope,
      section,
      vendorId,
      quantity: qty,
      unitPrice: vendor.price,
      total: qty * vendor.price,
    };
    
    setMaterialsCart(prev => [...prev, row]);
    Alert.alert('Added', `${item.name} added to ${section}`);
  };
  
  // Handle SKU attachment from live search
  const handleSubcontractorSelect = (subData) => {
    console.log('🔄 handleSubcontractorSelect called with:', subData);
    try {
      const newLaborItem = {
        id: String(Date.now()),
        name: `${subData.name} - ${subData.trade}`,
        mode: 'hourly',
        laborType: 'subcontractor',
        hours: 0,
        rate: subData.rate,
        total: 0,
        metadata: subData.metadata,
      };
      
      console.log('📝 Creating new labor item:', newLaborItem);
      
      setBid(prev => {
        console.log('🔄 Updating bid state...');
        const updated = {
          ...prev,
          laborLineItems: [...(prev.laborLineItems || []), newLaborItem]
        };
        console.log('✅ Bid state updated, new labor items count:', updated.laborLineItems.length);
        return updated;
      });
      
      // Simple success feedback without Alert to prevent freezing
      console.log('✅ Added subcontractor:', subData.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('✅ handleSubcontractorSelect completed successfully');
    } catch (error) {
      console.error('❌ Error in handleSubcontractorSelect:', error);
    }
  };

  // Auto-categorize materials based on name/keywords
  const autoCategorizeMaterial = (itemName, availableSections) => {
    const name = itemName.toLowerCase();
    
    // Shower & Plumbing (priority check - must be before general plumbing)
    if (name.includes('shower') || name.includes('showerhead') || name.includes('shower pan') || 
        name.includes('shower base') || name.includes('handheld shower') || name.includes('rain shower') ||
        name.includes('shower kit') || name.includes('shower door') || name.includes('shower surround')) {
      return availableSections.find(s => s.toLowerCase().includes('shower')) || 
             availableSections.find(s => s.toLowerCase().includes('plumb')) || 
             availableSections[0];
    }
    
    // Tile & Waterproofing
    if (name.includes('tile') || name.includes('grout') || name.includes('mortar') || 
        name.includes('thinset') || name.includes('redgard') || name.includes('kerdi') || 
        name.includes('waterproof') || name.includes('schluter') || name.includes('membrane')) {
      return availableSections.find(s => s.toLowerCase().includes('tile') || s.toLowerCase().includes('waterproof')) || availableSections[0];
    }
    
    // Framing & Structure
    if (name.includes('lumber') || name.includes('stud') || name.includes('2x4') || 
        name.includes('2x6') || name.includes('2x8') || name.includes('plywood') || 
        name.includes('osb') || name.includes('joist') || name.includes('beam') || 
        name.includes('sheathing') || name.includes('framing')) {
      return availableSections.find(s => s.toLowerCase().includes('fram')) || availableSections[0];
    }
    
    // Concrete & Masonry
    if (name.includes('concrete') || name.includes('cement') || name.includes('mortar') || 
        name.includes('brick') || name.includes('block') || name.includes('masonry') || 
        name.includes('rebar') || name.includes('foundation')) {
      return availableSections.find(s => s.toLowerCase().includes('concrete') || s.toLowerCase().includes('masonry')) || availableSections[0];
    }
    
    // Plumbing (general)
    if (name.includes('pipe') || name.includes('pvc') || name.includes('plumb') || 
        name.includes('drain') || name.includes('faucet') || name.includes('valve') || 
        name.includes('fitting') || name.includes('toilet') || name.includes('sink')) {
      return availableSections.find(s => s.toLowerCase().includes('plumb')) || availableSections[0];
    }
    
    // Electrical
    if (name.includes('wire') || name.includes('electric') || name.includes('cable') || 
        name.includes('outlet') || name.includes('switch') || name.includes('breaker') || 
        name.includes('conduit') || name.includes('panel') || name.includes('lighting')) {
      return availableSections.find(s => s.toLowerCase().includes('electric')) || availableSections[0];
    }
    
    // Drywall & Finishing
    if (name.includes('drywall') || name.includes('sheetrock') || name.includes('gypsum') || 
        name.includes('joint compound') || name.includes('mud') || name.includes('tape') || 
        name.includes('sanding')) {
      return availableSections.find(s => s.toLowerCase().includes('drywall') || s.toLowerCase().includes('finish')) || availableSections[0];
    }
    
    // Paint & Coatings
    if (name.includes('paint') || name.includes('primer') || name.includes('stain') || 
        name.includes('sealer') || name.includes('coating') || name.includes('caulk')) {
      return availableSections.find(s => s.toLowerCase().includes('paint')) || availableSections[0];
    }
    
    // Flooring
    if (name.includes('floor') || name.includes('laminate') || name.includes('vinyl') || 
        name.includes('hardwood') || name.includes('carpet') || name.includes('underlayment')) {
      return availableSections.find(s => s.toLowerCase().includes('floor')) || availableSections[0];
    }
    
    // HVAC
    if (name.includes('hvac') || name.includes('duct') || name.includes('vent') || 
        name.includes('furnace') || name.includes('ac ') || name.includes('air condition')) {
      return availableSections.find(s => s.toLowerCase().includes('hvac') || s.toLowerCase().includes('mechanical')) || availableSections[0];
    }
    
    // Roofing
    if (name.includes('roof') || name.includes('shingle') || name.includes('flashing') || 
        name.includes('gutter') || name.includes('soffit') || name.includes('fascia')) {
      return availableSections.find(s => s.toLowerCase().includes('roof')) || availableSections[0];
    }
    
    // Default to first section if no match
    return availableSections[0];
  };

  const handleSkuAttach = (skuItem) => {
    const quantity = skuItem.quantity || 1; // Get quantity from item, default to 1
    
    setMaterialsCart(prev => {
      // Check if this exact item already exists (same SKU + store)
      const existingIndex = prev.findIndex(item => 
        item.sku === skuItem.sku && 
        item.vendorId === (skuItem.store === 'hd' ? 'hd' : 'lw') &&
        item.scope === activeScope
      );
      
      if (existingIndex >= 0) {
        // Item exists - add to existing quantity
        const updated = [...prev];
        const newQuantity = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQuantity,
          total: newQuantity * updated[existingIndex].unitPrice
        };
        
        Alert.alert('Updated!', `Quantity increased to ${newQuantity}`);
        return updated;
      } else {
        // New item - auto-categorize and add to cart
        const autoSection = autoCategorizeMaterial(skuItem.title, SECTIONS[activeScope]);
        
        const row = {
          id: String(Date.now()),
          itemId: skuItem.sku,
          name: skuItem.title,
          scope: activeScope,
          section: autoSection,
          vendorId: skuItem.store === 'hd' ? 'hd' : 'lw',
          quantity: quantity, // Use quantity from selector
          unitPrice: skuItem.price,
          total: (skuItem.price || 0) * quantity, // Calculate total based on quantity
          sku: skuItem.sku,
          url: skuItem.url,
          store: skuItem.store,
        };
        
        Alert.alert('Added!', `${skuItem.title} added to ${autoSection}`);
        return [...prev, row];
      }
    });
  };

  // Handle manual material & labor entries from full-page screens
  useFocusEffect(
    useCallback(() => {
      const checkForManualEntries = async () => {
        try {
          const [materialDataStr, laborDataStr] = await Promise.all([
            AsyncStorage.getItem('manualMaterialEntry'),
            AsyncStorage.getItem('manualLaborEntry'),
          ]);

          if (materialDataStr) {
            const materialData = JSON.parse(materialDataStr);
            await AsyncStorage.removeItem('manualMaterialEntry');
            
            const { name, quantity, unitPrice, vendorId, section } = materialData;
            const qty = Number(quantity);
            const price = Number(unitPrice);
            
            const autoSection = section || autoCategorizeMaterial(name, SECTIONS[activeScope]);
            const finalVendorId = vendorId || 'loc';
            
            const row = {
              id: String(Date.now()),
              itemId: `manual_${Date.now()}`,
              name: name.trim(),
              scope: activeScope,
              section: autoSection,
              vendorId: finalVendorId,
              quantity: qty,
              unitPrice: price,
              total: qty * price,
              isManual: true,
            };
            
            setMaterialsCart(prev => [...prev, row]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          if (laborDataStr) {
            const laborData = JSON.parse(laborDataStr);
            await AsyncStorage.removeItem('manualLaborEntry');

            const laborName = laborData.name?.trim() || 'Labor Item';
            const mode = laborData.mode === 'sqft' ? 'sqft' : 'hourly';
            const laborType = laborData.laborType === 'subcontractor' ? 'subcontractor' : 'inhouse';
            const hours = Number(laborData.hours) || Number(laborData.quantity) || 0;
            const rate = Number(laborData.rate) || 0;

            const laborRow = {
              id: String(Date.now()),
              name: laborName,
              mode,
              laborType,
              hours,
              rate,
              total: hours * rate,
            };

            setBid(prev => ({
              ...prev,
              laborLineItems: [...(prev.laborLineItems || []), laborRow],
            }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } catch (error) {
          console.error('Error processing manual entries:', error);
        }
      };
      
      checkForManualEntries();
    }, [activeScope])
  );
  
  const totalBySection = (section) => {
    return materialsCart
      .filter(r => r.scope === activeScope && r.section === section)
      .reduce((sum, r) => sum + r.total, 0);
  };
  
  const totalByScope = (scope) => {
    return materialsCart
      .filter(r => r.scope === scope)
      .reduce((sum, r) => sum + r.total, 0);
  };
  
  const grandMaterialsTotal = materialsCart.reduce((sum, r) => sum + r.total, 0);
  
  // Rental equipment helpers
  const handleRentalAttach = (rentalItem) => {
    const row = {
      id: Date.now(),
      scope: activeScope,
      section: 'Equipment',
      title: rentalItem.title,
      sku: rentalItem.sku,
      store: rentalItem.store,
      unit: rentalItem.unit || 'day',
      qty: 1,
      duration: 1, // days
      url: rentalItem.url,
    };
    
    setRentalCart(prev => [...prev, row]);
    Alert.alert('Added!', `${rentalItem.title} added to Equipment section`);
  };

  const updateRentalDuration = (id, duration) => {
    setRentalCart(prev => prev.map(item => 
      item.id === id ? { ...item, duration } : item
    ));
  };

  const removeRentalItem = (id) => {
    setRentalCart(prev => prev.filter(item => item.id !== id));
  };

  const grandRentalsTotal = rentalCart.reduce((sum, r) => sum + (r.duration || 1), 0);
  
  // Group materials by category for better organization
  const materialsByCategory = useMemo(() => {
    const groups = {};
    filteredCatalog.forEach(item => {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredCatalog]);

  // Line item management
  const addMaterial = () => setMaterialModal({ visible: true, item: null });
  const editMaterial = (item) => setMaterialModal({ visible: true, item });
  const saveMaterial = (item) => {
    if (item.id) {
      // Update existing
      setBid(prev => ({
        ...prev,
        materialLineItems: prev.materialLineItems.map(m => m.id === item.id ? item : m)
      }));
    } else {
      // Add new
      const newItem = { ...item, id: String(Date.now()) };
      setBid(prev => ({
        ...prev,
        materialLineItems: [...(prev.materialLineItems || []), newItem]
      }));
    }
    setMaterialModal({ visible: false, item: null });
  };
  const deleteMaterial = (id) => {
    setBid(prev => ({
      ...prev,
      materialLineItems: prev.materialLineItems.filter(m => m.id !== id)
    }));
  };

  const addLabor = () => setLaborModal({ visible: true, item: null });
  const editLabor = (item) => setLaborModal({ visible: true, item });
  const saveLabor = (item) => {
    if (item.id) {
      // Update existing
      setBid(prev => ({
        ...prev,
        laborLineItems: prev.laborLineItems.map(l => l.id === item.id ? item : l)
      }));
    } else {
      // Add new
      const newItem = { ...item, id: String(Date.now()) };
      setBid(prev => ({
        ...prev,
        laborLineItems: [...(prev.laborLineItems || []), newItem]
      }));
    }
    setLaborModal({ visible: false, item: null });
  };
  const deleteLabor = (id) => {
    setBid(prev => ({
      ...prev,
      laborLineItems: prev.laborLineItems.filter(l => l.id !== id)
    }));
  };

  const createNewBid = () => {
    Alert.alert('New Bid', 'Start a new bid? Current bid will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'New Bid',
        onPress: async () => {
          await backupCurrentEstimateSilently();
          try {
            await AsyncStorage.multiRemove([
              'bps.materialsCart',
              'bps.rentalCart',
              'manualMaterialEntry',
              'manualLaborEntry',
            ]);
          } catch (error) {
            console.warn('Failed to clear previous bid carts:', error);
          }

          const nextBid = blankState();
          lastSavedBidRef.current = null;
          pendingSaveRef.current = null;

          setMaterialsCart([]);
          setRentalCart([]);
          setBid(nextBid);
          setStep(1);
          setActiveScope('kitchen');

          try {
            await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(nextBid));
            console.log('🆕 Started new bid and saved blank state to storage');
          } catch (error) {
            console.warn('Failed to save new blank bid to storage:', error);
          }
        },
      },
    ]);
  };

  const applyTemplate = (template) => {
    const templates = {
      residential: { materials: 4200, labor: 3500, markupPct: 20, contingencyPct: 7, template: 'residential' },
      commercial: { materials: 8500, labor: 7200, markupPct: 18, contingencyPct: 5, template: 'commercial' },
      multifamily: { materials: 12000, labor: 10500, markupPct: 20, contingencyPct: 6, template: 'multifamily' },
    };
    setBid(prev => ({ ...prev, ...templates[template] }));
    Alert.alert('Template Applied', `${template} template loaded successfully!`);
  };


  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 0: {
        // Bid Summary - not a numbered step, accessible via Summary button
        // Calculate AI level and confidence from health score
        const aiLevel = healthScore >= 75 ? 'good' : healthScore >= 55 ? 'warn' : 'risk';
        const aiConfidence = aiLevel === 'good' ? 'High' : aiLevel === 'warn' ? 'Medium' : 'Low';
        const aiSummary = aiLevel === 'good'
          ? 'No major issues detected. Estimate looks on track.'
          : aiLevel === 'warn'
          ? 'Some items may need review. Consider verifying labor and scope.'
          : 'Risk detected. Labor-heavy bid and low health score—review before sending.';
        
        const maxBarHeight = 120;
        const maxValue = Math.max(calc.materials, calc.labor, calc.overhead, calc.profit, 1);
        const materialsHeight = (calc.materials / maxValue) * maxBarHeight;
        const laborHeight = (calc.labor / maxValue) * maxBarHeight;
        const overheadHeight = (calc.overhead / maxValue) * maxBarHeight;
        const markupHeight = (calc.profit / maxValue) * maxBarHeight;
        
        return (
          <View style={[s.wideContainer, {
            paddingVertical: 20,
            backgroundColor: darkMode ? Colors.card : Colors.bg,
            marginBottom: 16,
            marginTop: 16,
          }]}>
                {/* Total Bid Section - green to blue gradient border */}
              <LinearGradient
                colors={['#2DFFC4', '#00A6FF']}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={{
                  borderRadius: 20,
                  padding: 1,
                  marginBottom: 12,
                }}
              >
              <View style={{
                backgroundColor: darkMode ? '#000000' : Colors.bg,
                borderRadius: 18,
                padding: 20,
                borderWidth: darkMode ? 0 : 1,
                borderColor: darkMode ? 'transparent' : Colors.line,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="heart" size={20} color="#22c55e" />
                    <Text style={{ color: Colors.text, fontSize: 14, marginLeft: 8, fontWeight: '600' }}>{healthScore}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="trending-up" size={16} color="#22d3ee" />
                    <Text style={{ color: '#22d3ee', fontSize: 12, marginLeft: 4 }}>+4.9%</Text>
                  </View>
                </View>
                
                <Text style={{ color: Colors.sub, fontSize: 12, textAlign: 'center', marginBottom: 8, fontWeight: '600', letterSpacing: 1 }}>
                  TOTAL BID
                </Text>
                
                <Text style={{ color: Colors.text, fontSize: 36, textAlign: 'center', fontWeight: '700', marginBottom: 12 }}>
                  {money(calc.total)}
                </Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                  <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 8 }}>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>{money(calc.unitPrice)} / sqft</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>Markup {bid.markupPct || 0}%</Text>
                  </View>
                </View>
                
                {/* Bar Chart */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: maxBarHeight + 40, marginBottom: 8 }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{money(calc.materials)}</Text>
                    <LinearGradient
                      colors={['#3b82f6', '#60a5fa']}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 0, y: 0 }}
                      style={{
                        width: '80%',
                        height: Math.max(materialsHeight, 8),
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4 }}>Materi</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{money(calc.labor)}</Text>
                    <LinearGradient
                      colors={['#22c55e', '#4ade80']}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 0, y: 0 }}
                      style={{
                        width: '80%',
                        height: Math.max(laborHeight, 8),
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4 }}>Labor</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{money(calc.overhead)}</Text>
                    <View
                      style={{
                        width: '80%',
                        height: Math.max(overheadHeight, 8),
                        backgroundColor: '#f59e0b',
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4 }}>Overhe</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{money(calc.profit)}</Text>
                    <View
                      style={{
                        width: '80%',
                        height: Math.max(markupHeight, 8),
                        backgroundColor: '#a78bfa',
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                      }}
                    />
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4 }}>Markup</Text>
                  </View>
                </View>
              </View>
              </LinearGradient>
              
              {/* Cost Breakdown - green to blue gradient border */}
              <LinearGradient
                colors={['#2DFFC4', '#00A6FF']}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={{
                  borderRadius: 20,
                  padding: 1,
                  marginBottom: 12,
                  marginTop: 12,
                }}
              >
                <View style={{
                  backgroundColor: darkMode ? '#000000' : Colors.bg,
                  borderRadius: 18,
                  padding: 20,
                  borderWidth: darkMode ? 0 : 1,
                  borderColor: darkMode ? 'transparent' : Colors.line,
                }}>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
                      Cost Breakdown
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 13 }}>
                      Materials, labor, overhead & markup
                    </Text>
                  </View>
                  {/* Full width cards with grey border and background */}
                  <View style={{ gap: 12 }}>
                    <View style={{ 
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2, 
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Materials</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.materials)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2, 
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Labor</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.labor)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2, 
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Overhead</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.overhead)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2, 
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#a78bfa', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Markup ({bid.markupPct || 0}%)</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.profit)}</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
              
              {/* Project Actions - no border */}
              <View style={{
                paddingTop: 24,
                paddingBottom: 24,
                backgroundColor: darkMode ? Colors.card : Colors.bg,
                marginBottom: 0,
              }}>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 2 }}>
                    Project Actions
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 13 }}>
                    Save, submit or mark as won • Estimates save automatically
                  </Text>
                </View>
                
                  {/* Action Buttons Grid - grey buttons, Mark as Won has green-to-blue background */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {/* Save Bid - grey button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{ 
                        flex: 1, 
                        minWidth: '47%', 
                        backgroundColor: Colors.bg === '#000000' ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2, 
                        borderWidth: 1,
                        borderColor: Colors.bg === '#000000' ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                        borderRadius: 18, 
                        paddingVertical: 10, 
                        paddingHorizontal: 12 
                      }}
                      onPress={saveCurrentEstimate}
                    >
                      <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                        <Ionicons name="save-outline" size={16} color={Colors.bg === '#000000' ? '#fff' : Colors.text} />
                        <Text style={{ color: Colors.bg === '#000000' ? '#fff' : Colors.text, fontSize: 13, fontWeight: '700' }}>Save Bid</Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Restore Bids - only show if there are saved bids */}
                    {savedEstimates.length > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={{ 
                          flex: 1, 
                          minWidth: '47%', 
                          backgroundColor: Colors.bg === '#000000' ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2, 
                          borderWidth: 1,
                          borderColor: Colors.bg === '#000000' ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                          borderRadius: 18, 
                          paddingVertical: 10, 
                          paddingHorizontal: 12 
                        }}
                        onPress={() => setShowRecoveryModal(true)}
                      >
                        <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                          <Ionicons name="refresh-outline" size={16} color={Colors.bg === '#000000' ? '#fff' : Colors.text} />
                          <Text style={{ color: Colors.bg === '#000000' ? '#fff' : Colors.text, fontSize: 13, fontWeight: '700' }}>
                            Restore Bids {savedEstimates.length > 0 && `(${savedEstimates.length})`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {/* Submit Bid */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{ 
                        flex: 1, 
                        minWidth: '47%', 
                        backgroundColor: Colors.bg === '#000000' ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2, 
                        borderWidth: 1,
                        borderColor: Colors.bg === '#000000' ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                        borderRadius: 18, 
                        paddingVertical: 10, 
                        paddingHorizontal: 12 
                      }}
                      onPress={handleSubmitBid}
                    >
                      <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                        <Ionicons name="send-outline" size={16} color={Colors.bg === '#000000' ? '#fff' : Colors.text} />
                        <Text style={{ color: Colors.bg === '#000000' ? '#fff' : Colors.text, fontSize: 13, fontWeight: '700' }}>Submit Bid</Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Mark as Won - green to blue background */}
                    <LinearGradient
                      colors={['#2DFFC4', '#00A6FF']}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={{ flex: 1, minWidth: '47%', borderRadius: 18 }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={{ 
                          borderRadius: 18, 
                          paddingVertical: 10, 
                          paddingHorizontal: 12 
                        }}
                        onPress={handleMarkAsWon}
                      >
                        <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                          <Ionicons name="trophy-outline" size={16} color="#000" />
                          <Text style={{ color: '#000', fontSize: 13, fontWeight: '700' }}>Mark as Won</Text>
                        </View>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
              </View>
            </View>
        );
      }
      
      case 1: {
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="person" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Customer Information</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Client contact details and preferences</Text>
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Customer Name *</Text>
                <TextInput
                  key="customerName"
                  style={s.input}
                  placeholder="Enter customer name"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerName || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerName: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Email</Text>
                <TextInput
                  key="customerEmail"
                  style={s.input}
                  placeholder="customer@example.com"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerEmail || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerEmail: text }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Phone</Text>
                <TextInput
                  key="customerPhone"
                  style={s.input}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerPhone || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerPhone: text }));
                  }}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Address</Text>
                <TextInput
                  key="customerAddress"
                  style={s.input}
                  placeholder="Street address"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerAddress || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerAddress: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={[s.inputGroup, { width: '48%' }]}>
                  <Text style={s.label}>City</Text>
                  <TextInput
                    key="customerCity"
                    style={s.input}
                    placeholder="City"
                    placeholderTextColor={Colors.sub}
                    value={bid.customerCity || ''}
                    onChangeText={(text) => {
                      setBid(prev => ({ ...prev, customerCity: text }));
                    }}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit={true}
                  />
                </View>
                
                <View style={[s.inputGroup, { width: '48%' }]}>
                  <Text style={s.label}>State</Text>
                  <TextInput
                    key="customerState"
                    style={s.input}
                    placeholder="State"
                    placeholderTextColor={Colors.sub}
                    value={bid.customerState || ''}
                    onChangeText={(text) => {
                      setBid(prev => ({ ...prev, customerState: text }));
                    }}
                    maxLength={2}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit={true}
                  />
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>ZIP Code</Text>
                <TextInput
                  key="customerZip"
                  style={s.input}
                  placeholder="12345"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerZip || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerZip: text }));
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Company (Optional)</Text>
                <TextInput
                  key="customerCompany"
                  style={[s.input, { color: Colors.text }]}
                  placeholder="Company name"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerCompany || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerCompany: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Notes</Text>
                <TextInput
                  key="customerNotes"
                  style={[s.input, { minHeight: 100, textAlignVertical: 'top', color: Colors.text }]}
                  placeholder="Additional notes about the customer..."
                  placeholderTextColor={Colors.sub}
                  value={bid.customerNotes || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerNotes: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </GlassBorderCard>
          </View>
        );
      }
      
      case 2: {
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="information-circle" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Project Information</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Core details drive unit pricing and regional adjustments</Text>
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Title *</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="e.g., Kitchen Renovation"
                  placeholderTextColor={Colors.sub}
                  value={bid.title || ''}
                  onChangeText={(text) => updateBid('title', text)}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Type</Text>
                <View style={s.chipRow}>
                  {PROJECT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[s.chip, bid.projectType === type.value && s.chipActive]}
                      onPress={() => updateBid('projectType', type.value)}
                    >
                      <Text style={[s.chipText, bid.projectType === type.value && { color: '#2DFFC4' }]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Square Footage</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="1250"
                  placeholderTextColor={Colors.sub}
                  value={bid.sqft?.toString() || ''}
                  onChangeText={(text) => updateBid('sqft', parseInt(text) || 0)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Description</Text>
                <TextInput
                  style={[s.input, { minHeight: 120, textAlignVertical: 'top', color: Colors.text }]}
                  placeholder="Describe the project scope, requirements, and special considerations..."
                  placeholderTextColor={Colors.sub}
                  value={bid.scopeDescription || ''}
                  onChangeText={(text) => updateBid('scopeDescription', text)}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                  multiline
                  numberOfLines={6}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Start Date</Text>
                <TouchableOpacity
                  style={s.input}
                  onPress={() => setShowStartDateCalendar(!showStartDateCalendar)}
                >
                  <Text style={{ color: bid.startDate ? Colors.text : Colors.sub }}>
                    {bid.startDate ? new Date(bid.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select start date'}
                  </Text>
                </TouchableOpacity>
                {showStartDateCalendar && (
                  <View style={{ marginTop: 8 }}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        updateBid('startDate', day.dateString);
                        setShowStartDateCalendar(false);
                      }}
                      markedDates={{
                        [bid.startDate || '']: {
                          selected: true,
                          selectedColor: '#38d39f',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={bid.startDate}
                    />
                  </View>
                )}
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>End Date</Text>
                <TouchableOpacity
                  style={s.input}
                  onPress={() => setShowEndDateCalendar(!showEndDateCalendar)}
                >
                  <Text style={{ color: bid.endDate ? Colors.text : Colors.sub }}>
                    {bid.endDate ? new Date(bid.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select end date'}
                  </Text>
                </TouchableOpacity>
                {showEndDateCalendar && (
                  <View style={{ marginTop: 8 }}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        updateBid('endDate', day.dateString);
                        setShowEndDateCalendar(false);
                      }}
                      markedDates={{
                        [bid.endDate || '']: {
                          selected: true,
                          selectedColor: '#38d39f',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={bid.endDate}
                    />
                  </View>
                )}
              </View>
            </GlassBorderCard>
          </View>
        );
      }
      
      case 3: {
        const sections = SECTIONS[activeScope] || SECTIONS.other;
        
        return (
          <>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
                {/* Header */}
                <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="cube-outline" size={20} color="#2DFFC4" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Materials & Supplies</Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Live pricing and inflation tracking</Text>
                    </View>
                  </View>
                  
                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: materialModal.visible
                          ? Colors.primary
                          : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: materialModal.visible
                          ? Colors.primary
                          : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                      onPress={() => setMaterialModal({ visible: true, item: null })}
                    >
                      <Ionicons name="add" size={18} color={materialModal.visible ? '#fff' : Colors.text} style={{ marginRight: 6 }} />
                      <Text style={{ color: materialModal.visible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }}>Add Material</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: skuModalVisible
                          ? Colors.primary
                          : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: skuModalVisible
                          ? Colors.primary
                          : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                      onPress={() => {
                        console.log('🔍 SKU Search button pressed');
                        console.log('🔍 Current skuModalVisible state:', skuModalVisible);
                        console.log('🔍 Setting skuModalVisible to true');
                        setSkuModalVisible(true);
                        // Force a re-render check
                        setTimeout(() => {
                          console.log('🔍 After setState - skuModalVisible should be true');
                        }, 100);
                      }}
                    >
                      <Ionicons name="barcode-outline" size={18} color={skuModalVisible ? '#fff' : Colors.primary} style={{ marginRight: 8 }} />
                      <Text style={{ color: skuModalVisible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }}>SKU Search</Text>
                    </TouchableOpacity>
                  </View>
                </GlassBorderCard>
                
                {/* Materials Cart Summary */}
                <View style={{ marginTop: 16 }}>
                  <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
                    <TouchableOpacity
                      onPress={() => setIsCartExpanded(!isCartExpanded)}
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isCartExpanded ? 16 : 0 }}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="cart-outline" size={16} color="#22c55e" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                        Materials Cart
                      </Text>
                      {materialsCart.length > 0 && (
                        <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                          <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>
                            {materialsCart.length}
                          </Text>
                        </View>
                      )}
                      <Ionicons
                        name={isCartExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={Colors.sub}
                      />
                    </TouchableOpacity>
                    
                    {isCartExpanded && (
                      <>
                        {materialsCart.length === 0 ? (
                          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                              <Ionicons name="cart-outline" size={28} color={Colors.sub} />
                            </View>
                            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                              Your cart is empty
                            </Text>
                            <Text style={{ color: Colors.sub, fontSize: 13, textAlign: 'center' }}>
                              Add materials from the catalog below
                            </Text>
                          </View>
                        ) : (
                          <>
                            {materialsCart.map((item, index) => {
                              const isEditing = editingCartItem === index;
                              
                              return (
                                <View key={item.id || index} style={{
                                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                                  borderRadius: 12,
                                  padding: 14,
                                  marginBottom: 10,
                                  borderWidth: 1,
                                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                                }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                                        {item.name || item.description || 'Material'}
                                      </Text>
                                      {!isEditing ? (
                                        <>
                                          <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 2 }}>
                                            {item.quantity || item.qty || 0} {item.unit || 'ea'} × {money(item.unitPrice || item.cost || 0)}
                                          </Text>
                                          {item.vendorId && (
                                            <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                              {VENDORS.find(v => v.id === item.vendorId)?.name || item.vendorId}
                                            </Text>
                                          )}
                                          {item.sku && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                              <Ionicons name="barcode-outline" size={12} color="#22d3ee" />
                                              <Text style={{ color: '#22d3ee', fontSize: 11, marginLeft: 4 }}>
                                                {item.sku}
                                              </Text>
                                            </View>
                                          )}
                                        </>
                                      ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                                            <TouchableOpacity
                                              onPress={() => {
                                                const newQty = Math.max(1, (item.quantity || item.qty || 1) - 1);
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty, qty: newQty, total: (it.unitPrice || it.cost || 0) * newQty } : it));
                                              }}
                                              style={{ padding: 8 }}
                                            >
                                              <Ionicons name="remove" size={14} color={Colors.text} />
                                            </TouchableOpacity>
                                            <TextInput
                                              style={{ flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 6 }}
                                              value={String(item.quantity || item.qty || 1)}
                                              onChangeText={(text) => {
                                                const num = parseInt(text) || 1;
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: num, qty: num, total: (it.unitPrice || it.cost || 0) * num } : it));
                                              }}
                                              keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                                            />
                                            <TouchableOpacity
                                              onPress={() => {
                                                const newQty = (item.quantity || item.qty || 1) + 1;
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty, qty: newQty, total: (it.unitPrice || it.cost || 0) * newQty } : it));
                                              }}
                                              style={{ padding: 8 }}
                                            >
                                              <Ionicons name="add" size={14} color={Colors.text} />
                                            </TouchableOpacity>
                                          </View>
                                          <TouchableOpacity
                                            onPress={() => setEditingCartItem(null)}
                                            style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primary, borderRadius: 8 }}
                                          >
                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Done</Text>
                                          </TouchableOpacity>
                                        </View>
                                      )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                      <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
                                        {money(item.total || 0)}
                                      </Text>
                                      <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {!isEditing && (
                                          <TouchableOpacity
                                            onPress={() => setEditingCartItem(index)}
                                            style={{
                                              width: 28,
                                              height: 28,
                                              borderRadius: 14,
                                              backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                            }}
                                          >
                                            <Ionicons name="create-outline" size={14} color="#22c55e" />
                                          </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                          onPress={() => {
                                            setMaterialsCart(prev => prev.filter((_, i) => i !== index));
                                            if (editingCartItem === index) setEditingCartItem(null);
                                          }}
                                          style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 14,
                                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                            
                            {materialsCart.length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  Alert.alert('Clear Cart?', 'This will remove all items from your cart.', [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Clear', style: 'destructive', onPress: () => setMaterialsCart([]) },
                                  ]);
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  paddingVertical: 10,
                                  marginTop: 8,
                                  marginBottom: 12,
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(239, 68, 68, 0.35)',
                                }}
                              >
                                <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Clear Cart</Text>
                              </TouchableOpacity>
                            )}
                            
                            <View style={{
                              backgroundColor: 'rgba(45, 255, 196, 0.1)',
                              borderRadius: 12,
                              padding: 16,
                              borderWidth: 1,
                              borderColor: 'rgba(45, 255, 196, 0.3)',
                              marginTop: 8,
                            }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={{ color: Colors.sub, fontSize: 12 }}>Items</Text>
                                <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600' }}>
                                  {materialsCart.length}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>
                                  Total Materials
                                </Text>
                                <Text style={{ color: '#2DFFC4', fontSize: 22, fontWeight: '700' }}>
                                  {money(materialsCart.reduce((sum, item) => sum + (item.total || 0), 0))}
                                </Text>
                              </View>
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </GlassBorderCard>
                </View>
            </View>
            
            {/* SKU Search Modal */}
            <AttachSkuModal
              visible={skuModalVisible}
              defaultZip={bid.customerZip || ''}
              onClose={() => setSkuModalVisible(false)}
              onAttach={handleSkuAttach}
              onOpenSaved={() => {
                setSkuModalVisible(false);
                setTimeout(() => setSavedMaterialsVisible(true), 300); // Small delay for smooth transition
              }}
            />

            {/* Saved Materials Modal */}
            <Modal
              visible={savedMaterialsVisible}
              animationType="slide"
              onRequestClose={() => setSavedMaterialsVisible(false)}
            >
              <SavedMaterialsScreen
                onClose={() => setSavedMaterialsVisible(false)}
                onAddToBid={(item) => {
                  // Convert saved material format to SKU item format
                  const skuItem = {
                    sku: item.sku,
                    title: item.title,
                    price: item.price,
                    store: (item.store === 'hd' || item.store === 'lowes') ? item.store : 'hd',
                    zip: item.zip || '',
                    url: item.url || '',
                    image: item.image || null,
                    unit: item.unit || null,
                    quantity: item.quantity || 1,
                  };
                  handleSkuAttach(skuItem);
                  setSavedMaterialsVisible(false);
                }}
              />
            </Modal>

            {/* Custom Deposit Input Modal (Android fallback) */}
            <Modal
              visible={customDepositModal.visible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setCustomDepositModal({ visible: false, value: '' })}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(45, 255, 196, 0.3)' }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Custom Deposit</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20 }}>Enter deposit percentage (0-50)</Text>
                  
                  <TextInput
                    value={customDepositModal.value}
                    onChangeText={(text) => setCustomDepositModal({ ...customDepositModal, value: text })}
                    placeholder="Enter percentage"
                    placeholderTextColor={Colors.sub}
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      color: Colors.text,
                      fontSize: 16,
                      marginBottom: 20,
                    }}
                    autoFocus={true}
                  />
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setCustomDepositModal({ visible: false, value: '' })}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const numPct = parseInt(customDepositModal.value);
                        if (customDepositModal.value && numPct >= 0 && numPct <= 50) {
                          // Get current state from bid
                          const currentMilestones = bid.paymentMilestones || [];
                          const currentWeeklyPayments = bid.weeklyPayments || [];
                          const currentGrandTotal = calc?.grandTotal || calc?.total || 0;
                          
                          // Get current final milestone
                          const finalMilestone = currentMilestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                          const currentFinalPct = finalMilestone?.percentage || 0;
                          
                          // Validate and adjust percentages to prevent exceeding 100%
                          const totalPct = numPct + currentFinalPct;
                          let adjustedFinalPct = currentFinalPct;
                          let remainingPct = 100 - numPct - currentFinalPct;
                          let warning = null;
                          
                          if (totalPct > 100) {
                            adjustedFinalPct = Math.max(0, 100 - numPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          } else if (remainingPct < 0) {
                            adjustedFinalPct = Math.max(0, 100 - numPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          }
                          
                          // Show warning if adjustment was needed
                          if (warning) {
                            Alert.alert('⚠️ Payment Adjustment', warning);
                          }
                          
                          // Calculate amounts from grandTotal
                          const depositAmount = (currentGrandTotal * numPct) / 100;
                          const finalAmount = (currentGrandTotal * adjustedFinalPct) / 100;
                          
                          // Update deposit milestone
                          const depositMilestone = currentMilestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                          let updatedMilestones = currentMilestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                          updatedMilestones.unshift({
                            id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                            name: 'Deposit',
                            paymentAmount: depositAmount,
                            percentage: numPct,
                            type: 'deposit'
                          });
                          
                          // Update final milestone if it was adjusted
                          if (finalMilestone) {
                            updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                            updatedMilestones.push({
                              id: finalMilestone.id,
                              name: 'Final Completion',
                              paymentAmount: finalAmount,
                              percentage: adjustedFinalPct,
                              type: 'final'
                            });
                          }
                          
                          // ALWAYS recalculate weekly payments based on new remaining percentage
                          const currentWeeks = currentWeeklyPayments.length > 0 ? currentWeeklyPayments.length : 5;
                          let newWeekly = [];
                          if (remainingPct > 0 && currentWeeks > 0) {
                            const weeklyPct = remainingPct / currentWeeks;
                            const weeklyAmount = (currentGrandTotal * weeklyPct) / 100;
                            newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                              id: `weekly-hybrid-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: weeklyAmount,
                              percentage: weeklyPct,
                            }));
                          }
                          
                          // Update both milestones and weekly payments in a single state update
                          setBid(prev => {
                            // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                            const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, currentGrandTotal);
                            
                            const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                            // Auto-save payment schedule changes immediately
                            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                            return updated;
                          });
                          setCustomDepositModal({ visible: false, value: '' });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } else {
                          Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: Colors.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Custom Final Payment Input Modal (Android fallback) */}
            <Modal
              visible={customFinalModal.visible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setCustomFinalModal({ visible: false, value: '' })}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(45, 255, 196, 0.3)' }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Custom Final Payment</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20 }}>Enter final payment percentage (0-50)</Text>
                  
                  <TextInput
                    value={customFinalModal.value}
                    onChangeText={(text) => setCustomFinalModal({ ...customFinalModal, value: text })}
                    placeholder="Enter percentage"
                    placeholderTextColor={Colors.sub}
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      color: Colors.text,
                      fontSize: 16,
                      marginBottom: 20,
                    }}
                    autoFocus={true}
                  />
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setCustomFinalModal({ visible: false, value: '' })}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const numPct = parseInt(customFinalModal.value);
                        if (customFinalModal.value && numPct >= 0 && numPct <= 50) {
                          // Get current state from bid
                          const currentMilestones = bid.paymentMilestones || [];
                          const currentWeeklyPayments = bid.weeklyPayments || [];
                          const currentGrandTotal = calc?.grandTotal || calc?.total || 0;
                          
                          // Get current deposit milestone
                          const depositMilestone = currentMilestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                          const currentDepositPct = depositMilestone?.percentage || 0;
                          
                          // Validate and adjust percentages to prevent exceeding 100%
                          const totalPct = currentDepositPct + numPct;
                          let adjustedFinalPct = numPct;
                          let adjustedDepositPct = currentDepositPct;
                          let remainingPct = 100 - currentDepositPct - numPct;
                          let warning = null;
                          
                          if (totalPct > 100) {
                            adjustedFinalPct = Math.max(0, 100 - currentDepositPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          } else if (remainingPct < 0) {
                            adjustedFinalPct = Math.max(0, 100 - currentDepositPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          }
                          
                          // Show warning if adjustment was needed
                          if (warning) {
                            Alert.alert('⚠️ Payment Adjustment', warning);
                          }
                          
                          // Calculate amounts from grandTotal
                          const depositAmount = (currentGrandTotal * adjustedDepositPct) / 100;
                          const finalAmount = (currentGrandTotal * adjustedFinalPct) / 100;
                          
                          // Update deposit milestone if it was adjusted
                          let updatedMilestones = currentMilestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                          if (depositMilestone) {
                            updatedMilestones.unshift({
                              id: depositMilestone.id,
                              name: 'Deposit',
                              paymentAmount: depositAmount,
                              percentage: adjustedDepositPct,
                              type: 'deposit'
                            });
                          }
                          
                          // Update final milestone
                          const finalMilestone = currentMilestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                          updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                          updatedMilestones.push({
                            id: finalMilestone?.id || `milestone-final-${Date.now()}`,
                            name: 'Final Completion',
                            paymentAmount: finalAmount,
                            percentage: adjustedFinalPct,
                            type: 'final'
                          });
                          
                          // ALWAYS recalculate weekly payments based on new remaining percentage
                          const currentWeeks = currentWeeklyPayments.length > 0 ? currentWeeklyPayments.length : 5;
                          let newWeekly = [];
                          if (remainingPct > 0 && currentWeeks > 0) {
                            const weeklyPct = remainingPct / currentWeeks;
                            const weeklyAmount = (currentGrandTotal * weeklyPct) / 100;
                            newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                              id: `weekly-hybrid-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: weeklyAmount,
                              percentage: weeklyPct,
                            }));
                          }
                          
                          // Update both milestones and weekly payments in a single state update
                          setBid(prev => {
                            const updated = { ...prev, paymentMilestones: updatedMilestones, weeklyPayments: newWeekly };
                            // Auto-save payment schedule changes immediately
                            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                            return updated;
                          });
                          setCustomFinalModal({ visible: false, value: '' });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } else {
                          Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: Colors.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        );
      }
      
      case 4: {
        const laborItems = bid.laborLineItems || [];
        const totalLabor = laborItems.reduce((sum, item) => sum + (item.total || 0), 0);
        
        return (
          <>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
              {/* Header */}
              <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="people-outline" size={20} color="#2DFFC4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Labor & Subcontractors</Text>
                    <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>In-house and subcontractor labor</Text>
                  </View>
                </View>
                
                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: laborModal.visible
                        ? Colors.primary
                        : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: laborModal.visible
                        ? Colors.primary
                        : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      minWidth: 0,
                    }}
                    onPress={() => setLaborModal({ visible: true, item: null })}
                  >
                    <Ionicons name="add" size={18} color={laborModal.visible ? '#fff' : Colors.text} style={{ marginRight: 6 }} />
                    <Text style={{ color: laborModal.visible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>Add Labor Item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: subcontractorModalVisible
                        ? Colors.primary
                        : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: subcontractorModalVisible
                        ? Colors.primary
                        : (darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line),
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      minWidth: 0,
                    }}
                    onPress={() => setSubcontractorModalVisible(true)}
                  >
                    <Ionicons name="search" size={18} color={subcontractorModalVisible ? '#fff' : Colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: subcontractorModalVisible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>Find Subcontractor</Text>
                  </TouchableOpacity>
                </View>
              </GlassBorderCard>
              
              {/* Labor Cart Summary */}
              <View style={{ marginTop: 16 }}>
                <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
                  <TouchableOpacity
                    onPress={() => setIsLaborCartExpanded(!isLaborCartExpanded)}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isLaborCartExpanded ? 16 : 0 }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="people-outline" size={16} color="#2DFFC4" />
                    </View>
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                      Labor Items
                    </Text>
                    {laborItems.length > 0 && (
                      <View style={{ backgroundColor: 'rgba(45, 255, 196, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                        <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '700' }}>
                          {laborItems.length}
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name={isLaborCartExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={Colors.sub}
                    />
                  </TouchableOpacity>
                  
                  {isLaborCartExpanded && (
                    <>
                      {laborItems.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                            <Ionicons name="people-outline" size={28} color={Colors.sub} />
                          </View>
                          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                            No labor items yet
                          </Text>
                          <Text style={{ color: Colors.sub, fontSize: 13, textAlign: 'center' }}>
                            Add in-house labor or search for subcontractors
                          </Text>
                        </View>
                      ) : (
                        <>
                          {laborItems.map((item, index) => (
                            <View key={item.id || index} style={{
                              backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                              borderRadius: 12,
                              padding: 14,
                              marginBottom: 10,
                              borderWidth: 1,
                              borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                            }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>
                                      {item.description || item.name || 'Labor'}
                                    </Text>
                                    {item.laborType === 'subcontractor' && (
                                      <View style={{
                                        marginLeft: 8,
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                        borderWidth: 1,
                                        borderColor: '#f59e0b',
                                      }}>
                                        <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>
                                          SUB
                                        </Text>
                                      </View>
                                    )}
                                    {item.laborType === 'inhouse' && (
                                      <View style={{
                                        marginLeft: 8,
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                        borderWidth: 1,
                                        borderColor: '#22c55e',
                                      }}>
                                        <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '600' }}>
                                          IN-HOUSE
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 2 }}>
                                    {item.mode === 'sqft' ? (
                                      `${bid.sqft || 0} sqft × ${money(item.rate || 0)}/sqft`
                                    ) : (
                                      `${item.hours || 0} hrs × ${money(item.rate || 0)}/hr`
                                    )}
                                  </Text>
                                  {item.metadata && (
                                    <View style={{ marginTop: 4 }}>
                                      {item.metadata.rating && (
                                        <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                          ⭐ {item.metadata.rating} ({item.metadata.reviews || 0} reviews)
                                        </Text>
                                      )}
                                      {item.metadata.location && (
                                        <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                          📍 {item.metadata.location}
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
                                    {money(item.total || 0)}
                                  </Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      Alert.alert(
                                        'Delete Labor Item?',
                                        `Remove "${item.description || item.name || 'Labor'}"?`,
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: () => {
                                              const updated = laborItems.filter(l => l.id !== item.id);
                                              updateBid('laborLineItems', updated);
                                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            }
                                          }
                                        ]
                                      );
                                    }}
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 14,
                                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          ))}
                          
                          {laborItems.length > 1 && (
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert('Clear All?', 'This will remove all labor items.', [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Clear', style: 'destructive', onPress: () => updateBid('laborLineItems', []) },
                                ]);
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 10,
                                marginTop: 8,
                                marginBottom: 12,
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.35)',
                              }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Clear All</Text>
                            </TouchableOpacity>
                          )}
                          
                          <View style={{
                            backgroundColor: 'rgba(45, 255, 196, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            marginTop: 8,
                          }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <Text style={{ color: Colors.sub, fontSize: 12 }}>Items</Text>
                              <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600' }}>
                                {laborItems.length}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>
                                Total Labor
                              </Text>
                              <Text style={{ color: '#2DFFC4', fontSize: 22, fontWeight: '700' }}>
                                {money(totalLabor)}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </GlassBorderCard>
              </View>
            </View>
            
            {/* Subcontractor Search Modal */}
            <SubcontractorSearchModal
              visible={subcontractorModalVisible}
              onClose={() => setSubcontractorModalVisible(false)}
              onSelect={handleSubcontractorSelect}
              defaultZip={bid.customerZip || ''}
            />
          </>
        );
      }
      
      case 5: {
        // Load contractor type from profile or bid
        const contractorType = bid.contractorType || null;
        
        // Contractor type definitions
        const contractorTypes = {
          1: {
            name: 'Solo + Helper (No Subs)',
            description: 'I do everything myself',
            overheadRange: { min: 5, max: 8 },
            safeMarkupRange: { min: 15, max: 20 },
            defaultMarkup: 18,
          },
          2: {
            name: 'Small Crew + Subs',
            description: '1-3 guys + subcontractors',
            overheadRange: { min: 8, max: 12 },
            safeMarkupRange: { min: 20, max: 25 },
            defaultMarkup: 22,
          },
          3: {
            name: 'Subcontractor-Only GC',
            description: 'I manage, no direct labor',
            overheadRange: { min: 6, max: 10 },
            safeMarkupRange: { min: 15, max: 20 },
            defaultMarkup: 18,
          },
          4: {
            name: 'Large Crew + Subs',
            description: '5+ guys + subcontractors',
            overheadRange: { min: 12, max: 18 },
            safeMarkupRange: { min: 25, max: 30 },
            defaultMarkup: 27,
          },
        };
        
        // Ensure contractorType is a number for proper lookup
        const normalizedContractorType = contractorType ? parseInt(contractorType) : null;
        const contractorInfo = normalizedContractorType ? contractorTypes[normalizedContractorType] : null;
        
        // Calculate total overhead
        const totalOverhead = (bid.insuranceOverhead || 0) + 
                              (bid.equipment || 0) + 
                              (bid.facilities || 0) + 
                              (bid.otherOverhead || 0);
        
        // Calculate overhead as percentage of job total
        const jobTotal = calc?.grandTotal || calc?.total || 0;
        const overheadPct = jobTotal > 0 ? (totalOverhead / jobTotal) * 100 : 0;
        
        // Calculate recommended markup based on contractor type and job characteristics
        const materialsTotal = calc?.materials || 0;
        const laborTotal = calc?.labor || 0;
        const materialsRatio = jobTotal > 0 ? (materialsTotal / jobTotal) : 0.5;
        const laborRatio = jobTotal > 0 ? (laborTotal / jobTotal) : 0.5;
        
        // Recommended markup calculation based on contractor type
        // ALWAYS use contractor type default if set, otherwise calculate from job characteristics
        let recommendedMarkup;
        
        if (contractorInfo && normalizedContractorType) {
          // Use contractor type's default markup (this is the primary recommendation)
          recommendedMarkup = contractorInfo.defaultMarkup;
        } else {
          // Fallback: calculate based on job size and material/labor mix
          recommendedMarkup = 20;
          if (jobTotal > 100000) {
            recommendedMarkup = 22;
          } else if (jobTotal < 20000) {
            recommendedMarkup = 25;
          }
          if (laborRatio > 0.6) {
            recommendedMarkup += 2;
          }
          if (materialsRatio > 0.6) {
            recommendedMarkup -= 1;
          }
        }
        recommendedMarkup = Math.round(recommendedMarkup);
        
        // Calculate net profit (markup - overhead as % of subtotal)
        const currentMarkup = bid.markupPct || 0;
        const profit = calc?.profit || 0;
        const subtotal = calc?.subtotal || 0;
        const netProfitPct = subtotal > 0 ? ((profit - totalOverhead) / subtotal) * 100 : 0;
        
        // AI badge always shows - determine message and button text
        let showApplyButton = true; // Always show the AI badge
        let applyButtonText = '';
        let contextualMessage = null;
        const currentMarkupNum = Number(currentMarkup);
        const recommendedMarkupNum = Number(recommendedMarkup);
        const defaultMarkup = 20; // Global default markup
        
        if (contractorInfo && normalizedContractorType) {
          const { safeMarkupRange } = contractorInfo;
          const minMarkup = Number(safeMarkupRange.min);
          const maxMarkup = Number(safeMarkupRange.max);
          const rangeSize = maxMarkup - minMarkup;
          
          // Check if current markup matches default (20%) or recommended (within 1% tolerance)
          const matchesDefault = Math.abs(currentMarkupNum - defaultMarkup) <= 1;
          const matchesRecommended = Math.abs(currentMarkupNum - recommendedMarkupNum) <= 1;
          const atMin = Math.abs(currentMarkupNum - minMarkup) <= 1;
          const atMax = Math.abs(currentMarkupNum - maxMarkup) <= 1;
          
          // If at minimum of range (which may also be the default), show range option
          if (atMin && rangeSize > 0) {
            // At minimum of range - show range option (e.g., "Apply 0-5%" for 20-25% range)
            applyButtonText = `Apply 0-${rangeSize}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'At minimum of range — can increase up to maximum',
              color: '#22c55e',
            };
          } else if (matchesRecommended && !atMin) {
            // At recommended (but not at min) - show "Apply 0%"
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At recommended markup — optimal',
              color: '#22c55e',
            };
          } else if (atMax) {
            // At maximum of range - show "Apply 0%"
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At maximum of range — optimal',
              color: '#22c55e',
            };
          } else if (currentMarkupNum < minMarkup) {
            // Below minimum - show range needed to get into the safe range
            const diffToMin = Math.round(minMarkup - currentMarkupNum);
            const diffToMax = Math.round(maxMarkup - currentMarkupNum);
            applyButtonText = `Apply ${diffToMin}-${diffToMax}%`;
            contextualMessage = {
              type: 'low',
              text: 'Below typical range — risk of underpricing',
              color: '#ef4444',
            };
          } else if (currentMarkupNum > maxMarkup + 5) {
            // Far above range - show optional lower suggestion
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'high',
              text: 'Above typical range — higher profit, may reduce competitiveness',
              color: '#fbbf24',
            };
          } else if (currentMarkupNum > maxMarkup) {
            // Slightly above range
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'above',
              text: 'Above typical range — higher profitability',
              color: '#38d39f',
            };
          } else if (currentMarkupNum < recommendedMarkupNum) {
            // Within range but below recommended
            const diffToRecommended = Math.round(recommendedMarkupNum - currentMarkupNum);
            applyButtonText = `Apply ${diffToRecommended}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — consider recommended',
              color: '#38d39f',
            };
          } else {
            // Within range, above recommended but not far above
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — good',
              color: '#22c55e',
            };
          }
        } else {
          // Generic logic if no contractor type
          const matchesDefault = Math.abs(currentMarkupNum - defaultMarkup) <= 1;
          const matchesRecommended = Math.abs(currentMarkupNum - recommendedMarkupNum) <= 1;
          
          if (matchesDefault || matchesRecommended) {
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At recommended markup — optimal',
              color: '#22c55e',
            };
          } else if (currentMarkup < 15) {
            applyButtonText = `Apply ${recommendedMarkup}%`;
            contextualMessage = {
              type: 'low',
              text: 'Below typical range — risk of underpricing',
              color: '#ef4444',
            };
          } else if (currentMarkup > 30) {
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'high',
              text: 'Above typical range — higher profit, may reduce competitiveness',
              color: '#fbbf24',
            };
          } else if (currentMarkupNum < recommendedMarkupNum) {
            applyButtonText = `Apply ${recommendedMarkup}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — consider recommended',
              color: '#22c55e',
            };
          } else {
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — good',
              color: '#22c55e',
            };
          }
        }
        
        // Health badge based on NET PROFIT (markup - overhead), not just markup
        // Always show feedback, even if no subtotal yet
        let markupStatus = 'good';
        let markupStatusText = 'Right percentage – within typical range';
        let markupStatusColor = '#38d39f';
        
        if (subtotal > 0) {
          // Calculate based on net profit when we have subtotal
          if (netProfitPct < 5) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – net profit too low, increase markup';
            markupStatusColor = '#ef4444';
          } else if (netProfitPct < 8) {
            markupStatus = 'warn';
            markupStatusText = 'Too low – thin margins, consider increasing markup';
            markupStatusColor = '#fbbf24';
          } else if (netProfitPct >= 15) {
            markupStatus = 'strong';
            markupStatusText = 'Right percentage – strong profitability';
            markupStatusColor = '#38d39f'; // Green for "strong"
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – healthy and profitable';
            markupStatusColor = '#38d39f';
          }
        } else if (contractorInfo && normalizedContractorType) {
          // If no subtotal yet, validate based on markup vs contractor type range
          const { safeMarkupRange } = contractorInfo;
          const minMarkup = Number(safeMarkupRange.min);
          const maxMarkup = Number(safeMarkupRange.max);
          const currentMarkupNum = Number(currentMarkup);
          
          if (currentMarkupNum === 0) {
            markupStatus = 'warn';
            markupStatusText = 'Set your markup percentage';
            markupStatusColor = '#fbbf24';
          } else if (currentMarkupNum < minMarkup) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – below typical range for your business type';
            markupStatusColor = '#ef4444';
          } else if (currentMarkupNum > maxMarkup) {
            markupStatus = 'warn';
            markupStatusText = 'Too high – above typical range, may reduce competitiveness';
            markupStatusColor = '#fbbf24';
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – within typical range';
            markupStatusColor = '#38d39f';
          }
        } else {
          // Generic validation if no contractor type
          if (currentMarkup === 0) {
            markupStatus = 'warn';
            markupStatusText = 'Set your markup percentage';
            markupStatusColor = '#fbbf24';
          } else if (currentMarkup < 15) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – below typical range';
            markupStatusColor = '#ef4444';
          } else if (currentMarkup > 25) {
            markupStatus = 'warn';
            markupStatusText = 'Too high – above typical range, may reduce competitiveness';
            markupStatusColor = '#fbbf24';
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – within typical range';
            markupStatusColor = '#38d39f';
          }
        }
        
        return (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
              <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="calculator-outline" size={20} color="#2DFFC4" />
                  </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Overhead & Markup</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Break down overhead, tune markup</Text>
                </View>
              </View>
              
              {/* Contractor Type Selector */}
              <View style={s.inputGroup}>
                <Text style={s.label}>Business Type</Text>
                <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8 }}>
                  Select your business model for personalized recommendations
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(contractorTypes).map(([type, info]) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => {
                        updateBid('contractorType', parseInt(type));
                        // Don't auto-apply markup - let user keep their current value and see recommendations
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        flex: 1,
                        minWidth: '47%',
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: normalizedContractorType === parseInt(type) 
                          ? '#38d39f' 
                          : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                        backgroundColor: normalizedContractorType === parseInt(type)
                          ? 'rgba(56, 211, 159, 0.1)'
                          : (darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2),
                      }}
                    >
                      <Text style={{ 
                        color: normalizedContractorType === parseInt(type) ? '#38d39f' : Colors.text, 
                        fontSize: 13, 
                        fontWeight: contractorType === parseInt(type) ? '700' : '600',
                        marginBottom: 4,
                      }}>
                        {info.name}
                      </Text>
                      <Text style={{ 
                        color: Colors.sub, 
                        fontSize: 11,
                      }}>
                        {info.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Show recommendations if contractor type is set */}
                {contractorInfo && (
                  <View style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(56, 211, 159, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(56, 211, 159, 0.2)',
                  }}>
                    <Text style={{ color: '#38d39f', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                      Suggested for {contractorInfo.name}:
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>
                      Markup: {contractorInfo.safeMarkupRange.min}–{contractorInfo.safeMarkupRange.max}% • 
                      Overhead: {contractorInfo.overheadRange.min}–{contractorInfo.overheadRange.max}%
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
                      Typical range — not a limit
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Insurance Overhead</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.insuranceOverhead && bid.insuranceOverhead !== 0 ? bid.insuranceOverhead.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('insuranceOverhead', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('insuranceOverhead', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Equipment</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.equipment && bid.equipment !== 0 ? bid.equipment.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('equipment', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('equipment', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Facilities</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.facilities && bid.facilities !== 0 ? bid.facilities.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('facilities', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('facilities', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Other Overhead</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.otherOverhead && bid.otherOverhead !== 0 ? bid.otherOverhead.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('otherOverhead', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('otherOverhead', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              {/* Total Overhead Summary */}
              {totalOverhead > 0 && (
                <View style={{
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                }}>
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                    Total Overhead: <Text style={{ color: '#22d3ee' }}>{money(totalOverhead)}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    ≈ {overheadPct.toFixed(1)}% of job total
                  </Text>
                </View>
              )}
              
              {/* Total Overhead and Markup Summary */}
              {(totalOverhead > 0 || (calc?.profit && calc.profit > 0)) && (
                <View style={{
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                }}>
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                    Total Overhead & Markup: <Text style={{ color: '#22d3ee' }}>{money(totalOverhead + (calc?.profit || 0))}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    Overhead: {money(totalOverhead)} + Markup: {money(calc?.profit || 0)}
                  </Text>
                  {jobTotal > 0 && (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>
                      ≈ {((totalOverhead + (calc?.profit || 0)) / jobTotal * 100).toFixed(1)}% of job total
                    </Text>
                  )}
                </View>
              )}
              
              {/* Total Bid Summary */}
              {calc && (
                <View style={{
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
                    Total Bid: <Text style={{ color: '#22d3ee' }}>{money(calc?.grandTotal || calc?.total || 0)}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    Final project total including all costs, overhead, and markup
                  </Text>
                </View>
              )}
              
              <View style={s.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={s.label}>Markup Percentage</Text>
                  <TouchableOpacity
                    onPress={() => {
                      // Only update if not already at recommended (not "Apply 0%")
                      if (applyButtonText !== 'Apply 0%') {
                        // If it's a range (e.g., "Apply 0-5%"), apply the recommended markup
                        updateBid('markupPct', recommendedMarkup);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    style={{
                      backgroundColor: contextualMessage?.type === 'low' 
                        ? 'rgba(239, 68, 68, 0.15)' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? 'rgba(56, 211, 159, 0.15)'
                        : 'rgba(251, 191, 36, 0.15)',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons 
                      name="sparkles" 
                      size={14} 
                      color={contextualMessage?.type === 'low' 
                        ? '#ef4444' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? '#38d39f'
                        : '#fbbf24'} 
                    />
                    <Text style={{ 
                      color: contextualMessage?.type === 'low' 
                        ? '#ef4444' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? '#38d39f'
                        : '#fbbf24', 
                      fontSize: 12, 
                      fontWeight: '600' 
                    }}>
                      {applyButtonText}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  ref={markupInputRef}
                  style={[s.input, { color: Colors.text }]}
                  placeholder="20"
                  placeholderTextColor={Colors.sub}
                  value={markupPctText}
                  onFocus={() => {
                    isMarkupFocused.current = true;
                  }}
                  onChangeText={(text) => {
                    // Only update local state while typing - no re-renders of parent
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    setMarkupPctText(cleaned);
                  }}
                  onBlur={() => {
                    isMarkupFocused.current = false;
                    // Only update bid state when done typing
                    const cleaned = markupPctText.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('markupPct', 0);
                      setMarkupPctText('0');
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('markupPct', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    // Also apply the value on submit
                    isMarkupFocused.current = false;
                    const cleaned = markupPctText.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('markupPct', 0);
                      setMarkupPctText('0');
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('markupPct', num);
                      }
                    }
                  }}
                  blurOnSubmit={true}
                />
                {contractorInfo ? (
                  <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 6 }}>
                    Typical markup for {contractorInfo.name}: {contractorInfo.safeMarkupRange.min}–{contractorInfo.safeMarkupRange.max}%
                  </Text>
                ) : (
                  <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 6 }}>
                    Typical GC markup: 15–25% residential
                  </Text>
                )}
                <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4 }}>
                  Current markup: {money(calc.profit)} ({currentMarkup}%)
                </Text>
                
                {/* Contextual Message */}
                {contextualMessage && (
                  <View style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: contextualMessage.type === 'low' ? 'rgba(239, 68, 68, 0.08)' :
                                    contextualMessage.type === 'high' ? 'rgba(251, 191, 36, 0.08)' :
                                    contextualMessage.type === 'above' ? 'rgba(56, 211, 159, 0.08)' :
                                    contextualMessage.type === 'inRange' ? 'rgba(56, 211, 159, 0.08)' :
                                    'rgba(56, 211, 159, 0.08)',
                    borderWidth: 1,
                    borderColor: contextualMessage.type === 'low' ? 'rgba(239, 68, 68, 0.2)' :
                                 contextualMessage.type === 'high' ? 'rgba(251, 191, 36, 0.2)' :
                                 contextualMessage.type === 'above' ? 'rgba(56, 211, 159, 0.3)' :
                                 contextualMessage.type === 'inRange' ? 'rgba(56, 211, 159, 0.3)' :
                                 'rgba(56, 211, 159, 0.3)',
                  }}>
                    <Text style={{ 
                      color: contextualMessage.type === 'low' ? '#ef4444' :
                             contextualMessage.type === 'high' ? '#fbbf24' :
                             contextualMessage.type === 'inRange' ? '#38d39f' :
                             '#38d39f', 
                      fontSize: 12, 
                      fontWeight: '600' 
                    }}>
                      {contextualMessage.type === 'low' && '🔴 '}
                      {contextualMessage.type === 'high' && '🟡 '}
                      {contextualMessage.type === 'above' && '🟢 '}
                      {contextualMessage.type === 'inRange' && '🟢 '}
                      {contextualMessage.text}
                    </Text>
                  </View>
                )}
                
                {/* Net Profit Calculation */}
                {currentMarkup > 0 && subtotal > 0 && (
                  <View style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                  }}>
                    <Text style={{ 
                      color: Colors.text, 
                      fontSize: 12, 
                      fontWeight: '600',
                      marginBottom: 2,
                    }}>
                      Estimated Net Profit: <Text style={{ color: '#22d3ee' }}>{netProfitPct.toFixed(1)}%</Text>
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>
                      At {currentMarkup}% markup: {money(profit - totalOverhead)} after overhead
                      {netProfitPct < 5 && ' (risky)'}
                      {netProfitPct >= 5 && netProfitPct < 8 && ' (thin margins)'}
                      {netProfitPct >= 8 && netProfitPct < 15 && ' (healthy)'}
                      {netProfitPct >= 15 && ' (strong)'}
                    </Text>
                  </View>
                )}
                
                {/* Health Badge - Always Visible, Based on Net Profit */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: markupStatusColor === '#38d39f' ? 'rgba(56, 211, 159, 0.1)' :
                                  markupStatusColor === '#fbbf24' ? 'rgba(251, 191, 36, 0.1)' :
                                  markupStatusColor === '#ef4444' ? 'rgba(239, 68, 68, 0.1)' :
                                  'rgba(56, 211, 159, 0.1)',
                  borderWidth: 1,
                  borderColor: markupStatusColor === '#38d39f' ? 'rgba(56, 211, 159, 0.3)' :
                               markupStatusColor === '#fbbf24' ? 'rgba(251, 191, 36, 0.3)' :
                               markupStatusColor === '#ef4444' ? 'rgba(239, 68, 68, 0.3)' :
                               'rgba(56, 211, 159, 0.3)',
                }}>
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: markupStatusColor,
                    marginRight: 8,
                  }} />
                  <Text style={{ color: markupStatusColor, fontSize: 12, fontWeight: '600' }}>
                    {markupStatusText}
                  </Text>
                </View>
              </View>
              </GlassBorderCard>
              
              {/* Legal Disclaimer */}
              <Text style={{
                color: Colors.sub,
                fontSize: 11,
                textAlign: 'center',
                marginTop: 20,
                marginBottom: 8,
                paddingHorizontal: 16,
                opacity: 0.6,
                fontStyle: 'italic',
              }}>
                Estimates are scenario-based projections and not guarantees of actual costs or profit.
              </Text>
            </View>
          </TouchableWithoutFeedback>
        );
      }

      case 6: {
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="analytics-outline" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Project Analysis</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Project outcome scenarios</Text>
                </View>
              </View>
              <ProjectAnalysis
                bid={bid}
                calc={calc}
                materialsCart={materialsCart}
                laborLineItems={bid.laborLineItems || []}
              />
            </GlassBorderCard>
            
            {/* Legal Disclaimer - Outside the card */}
            <Text style={{
              color: Colors.sub,
              fontSize: 11,
              textAlign: 'center',
              marginTop: 16,
              marginBottom: 8,
              paddingHorizontal: 20,
              opacity: 0.6,
              fontStyle: 'italic',
            }}>
              Estimates are scenario-based projections and not guarantees of actual costs or profit.
            </Text>
          </View>
        );
      }
      
      case 7: {
        // Note: roundPayment and normalizePaymentsToExactTotal are defined at component level
        
        // Smart validation helper to prevent totals over 100%
        const validateAndAdjustPercentages = (newDepositPct, newFinalPct, currentWeeks) => {
          const totalPct = newDepositPct + newFinalPct;
          
          // If total would exceed 100%, adjust final payment down
          if (totalPct > 100) {
            const adjustedFinalPct = Math.max(0, 100 - newDepositPct);
            return {
              depositPct: newDepositPct,
              finalPct: adjustedFinalPct,
              remainingPct: 0,
              warning: `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`
            };
          }
          
          // Calculate remaining percentage for weekly payments
          const remainingPct = 100 - newDepositPct - newFinalPct;
          
          // If remaining is negative, adjust final payment
          if (remainingPct < 0) {
            const adjustedFinalPct = Math.max(0, 100 - newDepositPct);
            return {
              depositPct: newDepositPct,
              finalPct: adjustedFinalPct,
              remainingPct: 0,
              warning: `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`
            };
          }
          
          return {
            depositPct: newDepositPct,
            finalPct: newFinalPct,
            remainingPct: remainingPct,
            warning: null
          };
        };
        
        // Smart defaults: Default to milestone-based
        const defaultSchedule = 'milestone-based';
        
        // Use bid.paymentSchedule if explicitly set, otherwise use default
        // Important: Only use default if paymentSchedule is truly undefined/null/empty
        // If schedule is 'hybrid', convert to 'milestone-based' (hybrid option removed)
        const rawSchedule = (bid.paymentSchedule !== undefined && bid.paymentSchedule !== null && bid.paymentSchedule !== '') 
          ? bid.paymentSchedule 
          : defaultSchedule;
        const scheduleType = rawSchedule === 'hybrid' ? 'milestone-based' : rawSchedule;
        const milestones = bid.paymentMilestones || [];
        const weeklyPayments = bid.weeklyPayments || [];
        const grandTotal = calc?.grandTotal || calc?.total || 0;
        
        // Calculate totals
        // For hybrid mode, only count deposit and final milestones, not all milestones
        const hybridMilestones = scheduleType === 'hybrid' 
          ? milestones.filter(m => {
              const isDeposit = m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'));
              const isFinal = m.type === 'final' || (m.name && (m.name.toLowerCase().includes('final') || m.name.toLowerCase().includes('completion')));
              return isDeposit || isFinal;
            })
          : milestones;
        
        const milestoneTotal = hybridMilestones.reduce((sum, m) => sum + (m.paymentAmount || m.amount || 0), 0);
        const weeklyTotal = weeklyPayments.reduce((sum, w) => sum + (w.amount || 0), 0);
        
        // Always calculate percentages from amounts (normalized) for accuracy
        // This ensures the displayed total is exactly 100% when amounts sum correctly
        const milestoneTotalPct = grandTotal > 0 ? (milestoneTotal / grandTotal) * 100 : 0;
        const weeklyTotalPct = grandTotal > 0 ? (weeklyTotal / grandTotal) * 100 : 0;
        const combinedTotalPct = scheduleType === 'hybrid' ? (milestoneTotalPct + weeklyTotalPct) : milestoneTotalPct;
        const remainingPctMilestone = scheduleType === 'milestone-based' || scheduleType === 'hybrid' ? Math.max(0, 100 - milestoneTotalPct) : 0;
        const remainingPctWeekly = scheduleType === 'weekly' ? Math.max(0, 100 - weeklyTotalPct) : 0;
        
        // Calculate payment risk and cash-flow insight
        const calculatePaymentRisk = () => {
          if (scheduleType === 'weekly' && weeklyPayments.length > 0) {
            // Check if equal payments
            const firstPct = weeklyPayments[0]?.percentage || (weeklyPayments[0]?.amount && grandTotal > 0 ? Math.round((weeklyPayments[0].amount / grandTotal) * 100) : 0);
            const allEqual = weeklyPayments.every(w => {
              const pct = w.percentage || (w.amount && grandTotal > 0 ? Math.round((w.amount / grandTotal) * 100) : 0);
              return Math.abs(pct - firstPct) < 1;
            });
            if (allEqual) return 'low';
          }
          
          // Check for deposit
          const firstMilestone = milestones[0];
          const firstMilestonePct = firstMilestone?.percentage || (firstMilestone?.paymentAmount && grandTotal > 0 ? Math.round((firstMilestone.paymentAmount / grandTotal) * 100) : 0);
          const firstWeekly = weeklyPayments[0];
          const firstWeeklyPct = firstWeekly?.percentage || (firstWeekly?.amount && grandTotal > 0 ? Math.round((firstWeekly.amount / grandTotal) * 100) : 0);
          const depositPct = scheduleType === 'milestone-based' ? firstMilestonePct : scheduleType === 'weekly' ? firstWeeklyPct : Math.max(firstMilestonePct, firstWeeklyPct);
          
          if (depositPct >= 20) return 'low';
          
          // Check final payment size
          const lastMilestone = milestones[milestones.length - 1];
          const lastMilestonePct = lastMilestone?.percentage || (lastMilestone?.paymentAmount && grandTotal > 0 ? Math.round((lastMilestone.paymentAmount / grandTotal) * 100) : 0);
          const lastWeekly = weeklyPayments[weeklyPayments.length - 1];
          const lastWeeklyPct = lastWeekly?.percentage || (lastWeekly?.amount && grandTotal > 0 ? Math.round((lastWeekly.amount / grandTotal) * 100) : 0);
          const finalPct = scheduleType === 'milestone-based' ? lastMilestonePct : scheduleType === 'weekly' ? lastWeeklyPct : Math.max(lastMilestonePct, lastWeeklyPct);
          
          if (depositPct < 15 && finalPct > 25) return 'moderate';
          if (depositPct < 10 && finalPct > 30) return 'tight';
          if (depositPct < 15) return 'moderate';
          
          return 'low';
        };
        
        const paymentRisk = calculatePaymentRisk();
        const riskLabels = {
          low: { label: 'Low Payment Risk', color: '#22c55e', emoji: '🟢' },
          moderate: { label: 'Moderate Payment Risk', color: '#f59e0b', emoji: '🟡' },
          tight: { label: 'High Payment Risk', color: '#ef4444', emoji: '🔴' }
        };
        
        // Calculate cash-flow insight (cash flow only, never profit)
        const getCashFlowInsight = () => {
          // Hybrid-specific insights
          if (scheduleType === 'hybrid') {
            const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
            const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
            
            const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? Math.round((depositMilestone.paymentAmount / grandTotal) * 100) : 0);
            const finalPct = finalMilestone?.percentage || (finalMilestone?.paymentAmount && grandTotal > 0 ? Math.round((finalMilestone.paymentAmount / grandTotal) * 100) : 0);
            
            if (depositPct >= 15 && finalPct <= 20) {
              return "💡 This hybrid schedule keeps cash flow positive by Week 1 while limiting end-of-job risk.";
            }
            if (finalPct > 25) {
              return "⚠️ Large final payment may increase collection risk.";
            }
            return "💡 This hybrid schedule balances cash flow protection with client comfort.";
          }
          
          if (scheduleType === 'weekly' && weeklyPayments.length > 0) {
            const firstPct = weeklyPayments[0]?.percentage || (weeklyPayments[0]?.amount && grandTotal > 0 ? Math.round((weeklyPayments[0].amount / grandTotal) * 100) : 0);
            if (firstPct >= 20) {
              return "This schedule keeps cash flow positive by Week 2.";
            }
            if (firstPct < 15 && weeklyPayments.length >= 3) {
              return "Cash flow tight until Week 3 — consider a larger deposit.";
            }
            return "Equal weekly payments provide steady cash flow throughout the project.";
          }
          
          if (milestones.length > 0) {
            const firstPct = milestones[0]?.percentage || (milestones[0]?.paymentAmount && grandTotal > 0 ? Math.round((milestones[0].paymentAmount / grandTotal) * 100) : 0);
            const midPoint = Math.floor(milestones.length / 2);
            const paidBeforeMid = milestones.slice(0, midPoint + 1).reduce((sum, m) => {
              const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? Math.round((m.paymentAmount / grandTotal) * 100) : 0);
              return sum + pct;
            }, 0);
            
            if (firstPct >= 20 && paidBeforeMid >= 50) {
              return "Early payments cover initial cash flow needs.";
            }
            if (paidBeforeMid < 40) {
              return "Most payments are back-loaded — plan cash flow accordingly.";
            }
          }
          
          return "Payment schedule provides steady cash flow.";
        };
        
        // Build timeline data
        const buildTimeline = () => {
          const timeline = [];
          if (scheduleType === 'milestone-based' || scheduleType === 'hybrid') {
            milestones.forEach((m, index) => {
              const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? Math.round((m.paymentAmount / grandTotal) * 100) : 0);
              const amount = roundPayment(m.paymentAmount || (grandTotal * pct / 100));
              const isFirst = index === 0;
              const isLast = index === milestones.length - 1;
              timeline.push({
                label: m.name || `Milestone ${index + 1}`,
                pct,
                amount,
                type: isFirst ? 'deposit' : isLast ? 'final' : 'progress',
                isMilestone: true,
                order: index
              });
            });
          }
          if (scheduleType === 'weekly' || scheduleType === 'hybrid') {
            weeklyPayments.forEach((w, index) => {
              const pct = w.percentage || (w.amount && grandTotal > 0 ? Math.round((w.amount / grandTotal) * 100) : 0);
              const amount = roundPayment(w.amount || (grandTotal * pct / 100));
              const isFirst = index === 0 && scheduleType === 'weekly';
              const isLast = index === weeklyPayments.length - 1 && scheduleType === 'weekly';
              timeline.push({
                label: (scheduleType === 'weekly' && index === 0)
                  ? 'Deposit'
                  : `Week ${w.weekNumber || index + 1}`,
                pct,
                amount,
                type: isFirst ? 'deposit' : isLast ? 'final' : 'progress',
                isMilestone: false,
                order: scheduleType === 'hybrid' ? (milestones.length + index) : index
              });
            });
          }
          // Sort chronologically by order (for hybrid) or by type (for single mode)
          return timeline.sort((a, b) => {
            if (scheduleType === 'hybrid') {
              return a.order - b.order;
            }
            // For single mode, show deposit first, then progress, then final
            const order = { deposit: 0, progress: 1, final: 2 };
            return order[a.type] - order[b.type];
          });
        };
        
        const timeline = buildTimeline();
        
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            {/* Payment Strategy Header */}
            <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="cash-outline" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Payment Strategy</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>How and when you get paid on this job</Text>
                </View>
              </View>
              <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                Payment schedules vary by contract. Use this as a starting template.
              </Text>
            </GlassBorderCard>
            
            <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
              <View style={s.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    <Ionicons name="calendar-outline" size={18} color="#2DFFC4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800' }}>Schedule Type</Text>
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>Choose how progress payments are structured</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[
                      {
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: scheduleType === 'milestone-based'
                          ? '#38d39f'
                          : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                        backgroundColor: scheduleType === 'milestone-based'
                          ? 'rgba(56, 211, 159, 0.1)'
                          : (darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2),
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        minWidth: '47%',
                      }
                    ]}
                    onPress={() => {
                      // When switching to milestone-based, clear payments from other schedule types
                      if (scheduleType === 'hybrid') {
                        // Clear both milestones and weekly payments from hybrid
                        setBid(prev => {
                          const updated = { ...prev, paymentSchedule: 'milestone-based', paymentMilestones: [], weeklyPayments: [] };
                          AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                          return updated;
                        });
                      } else if (scheduleType === 'weekly') {
                        // Clear weekly payments when switching from weekly
                        updateBid('weeklyPayments', []);
                        updateBid('paymentSchedule', 'milestone-based');
                      } else {
                        // Just switch if already milestone-based
                        updateBid('paymentSchedule', 'milestone-based');
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[
                      {
                        color: scheduleType === 'milestone-based' ? '#38d39f' : Colors.text,
                        fontSize: 13,
                        fontWeight: scheduleType === 'milestone-based' ? '700' : '600',
                        textAlign: 'center',
                      }
                    ]}>
                      Milestone-Based
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      {
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: scheduleType === 'weekly'
                          ? '#38d39f'
                          : (darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line),
                        backgroundColor: scheduleType === 'weekly'
                          ? 'rgba(56, 211, 159, 0.1)'
                          : (darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2),
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        minWidth: '47%',
                      }
                    ]}
                    onPress={() => {
                      // When switching to weekly, clear payments from other schedule types
                      if (scheduleType === 'hybrid') {
                        // Clear both milestones and weekly payments from hybrid
                        setBid(prev => {
                          const updated = { ...prev, paymentSchedule: 'weekly', paymentMilestones: [], weeklyPayments: [] };
                          AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                          return updated;
                        });
                      } else if (scheduleType === 'milestone-based') {
                        // Clear milestones when switching from milestone-based
                        updateBid('paymentMilestones', []);
                        updateBid('paymentSchedule', 'weekly');
                      } else {
                        // Just switch if already weekly
                        updateBid('paymentSchedule', 'weekly');
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[
                      {
                        color: scheduleType === 'weekly' ? '#38d39f' : Colors.text,
                        fontSize: 13,
                        fontWeight: scheduleType === 'weekly' ? '700' : '600',
                        textAlign: 'center',
                      }
                    ]}>
                      Time-Based (Weekly)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Payment Timeline Preview */}
              {timeline.length > 0 && (
                <View style={{ marginTop: 20, marginBottom: 20 }}>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={[s.label, { marginBottom: 4, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }]}>Payment Timeline</Text>
                    <Text style={{ color: Colors.sub, fontSize: 10, opacity: 0.8, fontStyle: 'italic' }}>
                      Shows when payments are received — not cost timing.
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {timeline.map((item, index) => {
                        const isFinal = item.type === 'final';
                        const isDeposit = item.type === 'deposit';
                        const lightTimelineStyle = !darkMode
                          ? { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line }
                          : {};
                        // Final payment: outlined style (not filled) - dark mode only
                        const finalStyle = (isFinal && darkMode) ? {
                          backgroundColor: 'transparent',
                          borderWidth: 2,
                          borderColor: 'rgba(45, 255, 196, 0.5)',
                          borderStyle: 'dashed',
                        } : {};
                        // Deposit: green glow - dark mode only
                        const depositStyle = isDeposit ? {
                          backgroundColor: 'rgba(56, 211, 159, 0.15)',
                          borderWidth: 1,
                          borderColor: 'rgba(56, 211, 159, 0.3)',
                        } : {};
                        // Progress: subtle - dark mode only
                        const progressStyle = (!isFinal && !isDeposit && darkMode) ? {
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        } : {};
                        
                        return (
                          <View
                            key={index}
                            style={[
                              {
                                minWidth: 100,
                                padding: 10,
                                borderRadius: 12,
                              },
                              lightTimelineStyle,
                              finalStyle,
                              depositStyle,
                              progressStyle,
                            ]}
                          >
                            <Text style={{ color: Colors.sub, fontSize: 10, marginBottom: 4, fontWeight: '600' }} numberOfLines={1}>
                              {item.label}
                            </Text>
                            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                              {item.pct.toFixed(1)}%
                            </Text>
                            <Text style={{ color: Colors.sub, fontSize: 11 }}>
                              {money(item.amount)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                  
                  {/* AI Cash-Flow Insight */}
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(34, 211, 238, 0.08)', borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.15)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Ionicons name="bulb-outline" size={16} color="#22d3ee" style={{ marginRight: 8, marginTop: 2 }} />
                      <Text style={{ color: Colors.text, fontSize: 12, flex: 1, lineHeight: 18 }}>
                        {getCashFlowInsight()}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Payment Risk Indicator */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: riskLabels[paymentRisk].color + '20',
                      borderWidth: 1,
                      borderColor: riskLabels[paymentRisk].color + '40',
                    }}>
                      <Text style={{ fontSize: 12, marginRight: 6 }}>{riskLabels[paymentRisk].emoji}</Text>
                      <Text style={{ color: riskLabels[paymentRisk].color, fontSize: 12, fontWeight: '600' }}>
                        {riskLabels[paymentRisk].label}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* Hybrid Setup Flow - 3 Clear Sections */}
              {scheduleType === 'hybrid' ? (
                <View style={{ marginTop: 24 }}>
                  {/* Hybrid Header with Clear Button */}
                  {milestones.length > 0 || weeklyPayments.length > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View>
                        <Text style={[s.label, { marginBottom: 4 }]}>Hybrid Payment Schedule</Text>
                        {(milestones.length > 0 || weeklyPayments.length > 0) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Text style={{ color: Math.abs(combinedTotalPct - 100) < 0.01 ? '#22c55e' : combinedTotalPct > 100 ? Colors.orange : Colors.sub, fontSize: 12, fontWeight: '600', marginRight: 8 }}>
                              Total: {Math.abs(combinedTotalPct - 100) < 0.01 ? '100' : combinedTotalPct.toFixed(1)}% {Math.abs(combinedTotalPct - 100) < 0.01 ? '✅' : combinedTotalPct > 100 ? '⚠️' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(milestones.length > 0 || weeklyPayments.length > 0) && (
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 20,
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.15)',
                            }}
                            onPress={() => {
                              Alert.alert(
                                'Clear Hybrid Schedule',
                                'This will remove all deposit, weekly, and final payments. Continue?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Clear',
                                    style: 'destructive',
                                    onPress: async () => {
                                      console.log('🗑️ Clearing Hybrid schedule...');
                                      // Update both at once to ensure they're cleared together
                                      const updatedBid = { 
                                        ...bid, 
                                        paymentMilestones: [], 
                                        weeklyPayments: [] 
                                      };
                                      setBid(updatedBid);
                                      
                                      // Auto-save
                                      try {
                                        await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updatedBid));
                                        console.log('💾 Cleared Hybrid schedule saved');
                                      } catch (error) {
                                        console.error('Error saving cleared schedule:', error);
                                      }
                                      
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }
                                  }
                                ]
                              );
                            }}
                          >
                            <Ionicons name="trash-outline" size={14} color="rgba(239, 68, 68, 0.6)" />
                            <Text style={{ color: 'rgba(239, 68, 68, 0.6)', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                              Clear
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ) : null}
                  
                  {/* Empty State for Hybrid - Template Selection */}
                  {milestones.length === 0 && weeklyPayments.length === 0 ? (
                    <View style={[s.stepCard, { padding: 32, alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <Ionicons name="calendar-outline" size={32} color="rgba(255, 255, 255, 0.6)" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
                        No payment schedule yet
                      </Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 }}>
                        Choose a structure or generate one — you can edit everything.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '100%' }}>
                        <TouchableOpacity
                          onPress={() => {
                            // Hybrid Template: 20% Deposit + 5 Weekly + 15% Final (exactly 100%)
                            const depositPct = 20;
                            const finalPct = 15;
                            const weeks = 5;
                            const remainingPct = 100 - depositPct - finalPct; // 65% for weekly
                            const weeklyPct = remainingPct / weeks; // 13% per week
                            
                            // Calculate deposit amount
                            const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                            
                            // Calculate amounts for first (weeks - 1) weekly payments
                            const weeklyAmount = roundPayment((grandTotal * weeklyPct) / 100);
                            const weeklyPayments = Array.from({ length: weeks - 1 }, (_, i) => ({
                              id: `weekly-hybrid-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: weeklyAmount,
                              percentage: weeklyPct,
                            }));
                            
                            // Calculate final milestone amount
                            const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                            
                            // Calculate sum of deposit + first (weeks - 1) weekly + final
                            const sumOfAllExceptLastWeek = depositAmount + (weeklyAmount * (weeks - 1)) + finalAmount;
                            
                            // Make last weekly payment equal to grandTotal - sum of all others (ensures exact 100%)
                            const lastWeekAmount = roundPayment(grandTotal - sumOfAllExceptLastWeek);
                            const lastWeekPct = grandTotal > 0 ? (lastWeekAmount / grandTotal) * 100 : 0;
                            
                            const deposit = {
                              id: `milestone-hybrid-deposit-${Date.now()}`,
                              name: 'Deposit',
                              paymentAmount: depositAmount,
                              amount: depositAmount,
                              percentage: depositPct,
                              type: 'deposit'
                            };
                            
                            const weekly = [
                              ...weeklyPayments,
                              {
                                id: `weekly-hybrid-${Date.now()}-${weeks - 1}`,
                                weekNumber: weeks,
                                description: `Week ${weeks} Payment`,
                                amount: lastWeekAmount,
                                percentage: lastWeekPct,
                              }
                            ];
                            
                            const final = {
                              id: `milestone-hybrid-final-${Date.now()}`,
                              name: 'Final Completion',
                              paymentAmount: finalAmount,
                              amount: finalAmount,
                              percentage: finalPct,
                              type: 'final'
                            };
                            
                            // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                            const normalized = normalizeHybridPaymentsToExactTotal([deposit, final], weekly, grandTotal);
                            
                            // Update both milestones and weekly payments in a single state update
                            // to ensure the calculation includes both when the component re-renders
                            setBid(prev => {
                              const updated = {
                                ...prev,
                                paymentMilestones: normalized.milestones,
                                weeklyPayments: normalized.weeklyPayments
                              };
                              // Auto-save immediately
                              AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                              return updated;
                            });
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: 'rgba(45, 255, 196, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            position: 'relative',
                            width: '100%',
                          }}
                        >
                          <View style={{ alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '600' }}>Recommended</Text>
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 8,
                                backgroundColor: 'rgba(45, 255, 196, 0.2)',
                                borderWidth: 1,
                                borderColor: 'rgba(45, 255, 196, 0.4)',
                              }}>
                                <Text style={{ color: '#2DFFC4', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>BEST</Text>
                              </View>
                            </View>
                            <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2, opacity: 0.8 }}>20% deposit + over 5 weeks + 15% final</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      {/* Section 1: Upfront Deposit */}
                  <View style={{ 
                    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2, 
                    borderWidth: 1,
                    borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                    borderRadius: 20, 
                    padding: 16, 
                    marginBottom: 16 
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="wallet-outline" size={18} color="#2DFFC4" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Upfront Deposit</Text>
                        <Text style={{ color: Colors.sub, fontSize: 11 }}>Covers materials & job start</Text>
                      </View>
                    </View>
                    
                    {(() => {
                      const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                      const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? Math.round((depositMilestone.paymentAmount / grandTotal) * 100) : 20);
                      const isCustomDeposit = depositPct > 0 && depositPct !== 15 && depositPct !== 20 && depositPct !== 25;
                      
                      return (
                        <View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {[15, 20, 25, 'Custom'].map((preset) => {
                              const isSelected = preset === 'Custom' 
                                ? isCustomDeposit 
                                : depositPct === preset;
                              const displayText = preset === 'Custom' 
                                ? (isCustomDeposit ? `${depositPct}%` : 'Custom')
                                : `${preset}%`;
                              
                              return (
                                <TouchableOpacity
                                  key={preset}
                                  onPress={() => {
                                    if (preset !== 'Custom') {
                                      const newDepositPct = typeof preset === 'number' ? preset : parseInt(preset);
                                      
                                      // Get current final milestone
                                      const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                      const currentFinalPct = finalMilestone?.percentage || 0;
                                      
                                      // Validate and adjust percentages to prevent exceeding 100%
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeksForValidation = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      const validation = validateAndAdjustPercentages(newDepositPct, currentFinalPct, currentWeeksForValidation);
                                      
                                      // Show warning if adjustment was needed
                                      if (validation.warning) {
                                        Alert.alert('⚠️ Payment Adjustment', validation.warning);
                                      }
                                      
                                      const finalPct = validation.finalPct;
                                      const remainingPct = validation.remainingPct;
                                      
                                      // Calculate amounts from grandTotal
                                      const depositAmount = roundPayment((grandTotal * validation.depositPct) / 100);
                                      const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                                      
                                      // Update deposit milestone
                                      let updatedMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                      updatedMilestones.unshift({
                                        id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                                        name: 'Deposit',
                                        paymentAmount: depositAmount,
                                        percentage: validation.depositPct,
                                        type: 'deposit'
                                      });
                                      
                                      // Update final milestone if it was adjusted
                                      if (finalMilestone) {
                                        updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                                        updatedMilestones.push({
                                          id: finalMilestone.id,
                                          name: 'Final Completion',
                                          paymentAmount: finalAmount,
                                          percentage: finalPct,
                                          type: 'final'
                                        });
                                      }
                                      
                                      // ALWAYS recalculate weekly payments based on new remaining percentage
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeks = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      let newWeekly = [];
                                      if (remainingPct > 0 && currentWeeks > 0) {
                                        const weeklyPct = remainingPct / currentWeeks;
                                        const weeklyAmount = roundPayment((grandTotal * weeklyPct) / 100);
                                        newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                                          id: `weekly-hybrid-${Date.now()}-${i}`,
                                          weekNumber: i + 1,
                                          description: `Week ${i + 1} Payment`,
                                          amount: weeklyAmount,
                                          percentage: weeklyPct,
                                        }));
                                      }
                                      
                                      // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                      const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, grandTotal);
                                      
                                      // Update both milestones and weekly payments in a single state update
                                      setBid(prev => {
                                        const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                        // Auto-save payment schedule changes immediately
                                        AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                        return updated;
                                      });
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    } else {
                                      // Handle custom deposit input
                                      if (Platform.OS === 'ios') {
                                        Alert.prompt(
                                          'Custom Deposit',
                                          'Enter deposit percentage (0-50):',
                                          [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                              text: 'Set',
                                              onPress: (text) => {
                                                const numPct = parseInt(text);
                                                if (text && numPct >= 0 && numPct <= 50) {
                                                  // Get current final milestone
                                                  const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                                  const currentFinalPct = finalMilestone?.percentage || 0;
                                                  
                                                  // Validate and adjust percentages to prevent exceeding 100%
                                                  // Use current bid state to get the actual number of weeks
                                                  const currentWeeksForValidation = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                                  const validation = validateAndAdjustPercentages(numPct, currentFinalPct, currentWeeksForValidation);
                                                  
                                                  // Show warning if adjustment was needed
                                                  if (validation.warning) {
                                                    Alert.alert('⚠️ Payment Adjustment', validation.warning);
                                                  }
                                                  
                                                  const finalPct = validation.finalPct;
                                                  const remainingPct = validation.remainingPct;
                                                  
                                                  // Calculate amounts from grandTotal
                                                  const depositAmount = roundPayment((grandTotal * validation.depositPct) / 100);
                                                  const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                                                  
                                                  // Update deposit milestone
                                                  let updatedMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                                  updatedMilestones.unshift({
                                                    id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                                                    name: 'Deposit',
                                                    paymentAmount: depositAmount,
                                                    percentage: validation.depositPct,
                                                    type: 'deposit'
                                                  });
                                                  
                                                  // Update final milestone if it was adjusted
                                                  if (finalMilestone) {
                                                    updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                                                    updatedMilestones.push({
                                                      id: finalMilestone.id,
                                                      name: 'Final Completion',
                                                      paymentAmount: finalAmount,
                                                      percentage: finalPct,
                                                      type: 'final'
                                                    });
                                                  }
                                                  
                                      // ALWAYS recalculate weekly payments based on new remaining percentage
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeks = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      let newWeekly = [];
                                      if (remainingPct > 0 && currentWeeks > 0) {
                                        const weeklyPct = remainingPct / currentWeeks;
                                        const weeklyAmount = roundPayment((grandTotal * weeklyPct) / 100);
                                        newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                                          id: `weekly-hybrid-${Date.now()}-${i}`,
                                          weekNumber: i + 1,
                                          description: `Week ${i + 1} Payment`,
                                          amount: weeklyAmount,
                                          percentage: weeklyPct,
                                        }));
                                      }
                                      
                                      // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                      const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, grandTotal);
                                      
                                      // Update both milestones and weekly payments in a single state update
                                      setBid(prev => {
                                        const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                        // Auto-save payment schedule changes immediately
                                        AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                        return updated;
                                      });
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                } else {
                                                  Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                                                }
                                              }
                                            }
                                          ],
                                          'plain-text',
                                          isCustomDeposit ? depositPct.toString() : ''
                                        );
                                      } else {
                                        // Android - use modal
                                        setCustomDepositModal({ 
                                          visible: true, 
                                          value: isCustomDeposit ? depositPct.toString() : '' 
                                        });
                                      }
                                    }
                                  }}
                                  style={{
                                    minWidth: 70,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    backgroundColor: isSelected
                                      ? 'rgba(45, 255, 196, 0.2)'
                                      : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                                    borderWidth: 1,
                                    borderColor: isSelected
                                      ? 'rgba(45, 255, 196, 0.4)'
                                      : (darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ 
                                    color: isSelected ? '#2DFFC4' : Colors.text, 
                                    fontSize: 13, 
                                    fontWeight: isSelected ? '700' : '600',
                                    textAlign: 'center',
                                  }}>
                                    {displayText}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {depositMilestone && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                              <Text style={{ color: Colors.sub, fontSize: 12 }}>Amount</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>{money(depositMilestone.paymentAmount || 0)}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                  
                  {/* Section 2: Weekly Progress Payments */}
                  <View style={{ 
                    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2, 
                    borderWidth: 1,
                    borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                    borderRadius: 20, 
                    padding: 16, 
                    marginBottom: 16 
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="calendar-outline" size={18} color="#2DFFC4" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Weekly Progress Payments</Text>
                        <Text style={{ color: Colors.sub, fontSize: 11 }}>Keeps cash flow steady during work</Text>
                      </View>
                    </View>
                    
                    {(() => {
                      const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                      const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                      const depositPct = depositMilestone?.percentage || 0;
                      const finalPct = finalMilestone?.percentage || 0;
                      const remainingPct = 100 - depositPct - finalPct;
                      const weeks = weeklyPayments.length || 5;
                      const weeklyPctPerWeek = weeks > 0 ? remainingPct / weeks : 0;
                      const isCustomWeeks = weeks > 12;
                      const customWeeksDisplay = isCustomWeeks ? weeks.toString() : '';
                      
                      return (
                        <View>
                          <View style={{ marginBottom: 12 }}>
                            <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Number of Weeks</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                              {[5, 6, 7, 8, 9, 10, 11, 12].map((weekCount) => (
                                <TouchableOpacity
                                  key={weekCount}
                                  onPress={() => {
                                    // Recalculate weekly payments based on remaining percentage
                                    const newWeeklyPct = remainingPct / weekCount;
                                    const newWeeklyAmount = roundPayment((grandTotal * newWeeklyPct) / 100);
                                    const newWeekly = Array.from({ length: weekCount }, (_, i) => ({
                                      id: `weekly-hybrid-${Date.now()}-${i}`,
                                      weekNumber: i + 1,
                                      description: `Week ${i + 1} Payment`,
                                      amount: newWeeklyAmount,
                                      percentage: newWeeklyPct,
                                    }));
                                    
                                    // Get current milestones (deposit and final)
                                    const currentMilestones = milestones.filter(m => {
                                      const isDeposit = m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'));
                                      const isFinal = m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'));
                                      return isDeposit || isFinal;
                                    });
                                    
                                    // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                    const normalized = normalizeHybridPaymentsToExactTotal(currentMilestones, newWeekly, grandTotal);
                                    
                                    // Update both milestones and weekly payments
                                    setBid(prev => {
                                      const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                      AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                      return updated;
                                    });
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }}
                                  style={{
                                    minWidth: 50,
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 12,
                                    backgroundColor: !isCustomWeeks && weeks === weekCount ? 'rgba(45, 255, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    borderWidth: 1,
                                    borderColor: !isCustomWeeks && weeks === weekCount ? 'rgba(45, 255, 196, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={{ color: !isCustomWeeks && weeks === weekCount ? '#2DFFC4' : Colors.text, fontSize: 12, fontWeight: !isCustomWeeks && weeks === weekCount ? '700' : '600' }}>
                                    {weekCount}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            
                            {/* Custom Weeks Input */}
                            <View style={{ marginTop: 8 }}>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Custom (13+ weeks)</Text>
                              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                <View style={{ flex: 1 }}>
                                  <TextInput
                                    key={`custom-weeks-input-${weeks}`}
                                    defaultValue={customWeeksDisplay}
                                    onChangeText={(text) => {
                                      const numWeeks = parseInt(text);
                                      if (text === '' || (numWeeks >= 13 && numWeeks <= 52)) {
                                        if (numWeeks >= 13 && numWeeks <= 52) {
                                          // Recalculate weekly payments based on remaining percentage
                                          const newWeeklyPct = remainingPct / numWeeks;
                                          const newWeeklyAmount = roundPayment((grandTotal * newWeeklyPct) / 100);
                                          const newWeekly = Array.from({ length: numWeeks }, (_, i) => ({
                                            id: `weekly-hybrid-${Date.now()}-${i}`,
                                            weekNumber: i + 1,
                                            description: `Week ${i + 1} Payment`,
                                            amount: newWeeklyAmount,
                                            percentage: newWeeklyPct,
                                          }));
                                          
                                          // Get current milestones (deposit and final)
                                          const currentMilestones = milestones.filter(m => {
                                            const isDeposit = m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'));
                                            const isFinal = m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'));
                                            return isDeposit || isFinal;
                                          });
                                          
                                          // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                          const normalized = normalizeHybridPaymentsToExactTotal(currentMilestones, newWeekly, grandTotal);
                                          
                                          // Update both milestones and weekly payments
                                          setBid(prev => {
                                            const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                            return updated;
                                          });
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        } else if (text === '') {
                                          // Clear if empty
                                          updateBid('weeklyPayments', []);
                                        }
                                      }
                                    }}
                                    placeholder="Enter weeks (13-52)"
                                    placeholderTextColor={Colors.sub}
                                    keyboardType="number-pad"
                                    style={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                      borderWidth: 1,
                                      borderColor: isCustomWeeks ? 'rgba(45, 255, 196, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                      borderRadius: 12,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      color: Colors.text,
                                      fontSize: 14,
                                    }}
                                  />
                                </View>
                                {isCustomWeeks && (
                                  <Text style={{ color: Colors.sub, fontSize: 12, minWidth: 80 }}>
                                    {weeklyPctPerWeek.toFixed(1)}% per week
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                          {weeklyPayments.length > 0 && (
                            <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={{ color: Colors.sub, fontSize: 12 }}>Per Week</Text>
                                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{weeklyPctPerWeek.toFixed(1)}% ({money(weeklyPayments[0]?.amount || 0)})</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Weekly</Text>
                                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{remainingPct.toFixed(1)}% ({money(weeklyTotal)})</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                  
                  {/* Section 3: Final Completion Payment */}
                  <View style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 20, 
                    padding: 16, 
                    marginBottom: 16 
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#2DFFC4" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Final Completion Payment</Text>
                        <Text style={{ color: Colors.sub, fontSize: 11 }}>Paid at final walkthrough or punch list</Text>
                      </View>
                    </View>
                    
                    {(() => {
                      const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                      
                      // Get percentage from milestone - prefer percentage field, fallback to calculation
                      // Handle negative percentages (some systems store as negative)
                      let finalPct = 15; // default
                      if (finalMilestone) {
                        if (finalMilestone.percentage !== undefined && finalMilestone.percentage !== null) {
                          finalPct = Math.abs(Math.round(Number(finalMilestone.percentage)));
                        } else if (finalMilestone.paymentAmount && grandTotal > 0) {
                          finalPct = Math.abs(Math.round((finalMilestone.paymentAmount / grandTotal) * 100));
                        }
                      }
                      
                      const isCustomFinal = finalPct > 0 && finalPct !== 10 && finalPct !== 15 && finalPct !== 20;
                      
                      return (
                        <View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {[10, 15, 20, 'Custom'].map((preset) => {
                              const isSelected = preset === 'Custom' 
                                ? isCustomFinal 
                                : finalPct === preset;
                              const displayText = preset === 'Custom' 
                                ? (isCustomFinal ? `${finalPct}%` : 'Custom')
                                : `${preset}%`;
                              
                              return (
                              <TouchableOpacity
                                key={preset}
                                activeOpacity={0.7}
                                  onPress={() => {
                                    if (preset !== 'Custom') {
                                      const newFinalPct = typeof preset === 'number' ? preset : parseInt(preset);
                                      
                                      // Get current deposit milestone
                                      const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                      const currentDepositPct = depositMilestone?.percentage || 0;
                                      
                                      // Validate and adjust percentages to prevent exceeding 100%
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeksForValidation = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      const validation = validateAndAdjustPercentages(currentDepositPct, newFinalPct, currentWeeksForValidation);
                                      
                                      // Show warning if adjustment was needed
                                      if (validation.warning) {
                                        Alert.alert('⚠️ Payment Adjustment', validation.warning);
                                      }
                                      
                                      const depositPct = validation.depositPct;
                                      const finalPct = validation.finalPct;
                                      const remainingPct = validation.remainingPct;
                                      
                                      // Calculate amounts from grandTotal
                                      const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                                      const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                                      
                                      // Update deposit milestone if it was adjusted
                                      let updatedMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                      if (depositMilestone) {
                                        updatedMilestones.unshift({
                                          id: depositMilestone.id,
                                          name: 'Deposit',
                                          paymentAmount: depositAmount,
                                          percentage: depositPct,
                                          type: 'deposit'
                                        });
                                      }
                                      
                                      // Update final milestone
                                      // Ensure percentage is positive (handle negative values)
                                      const finalPctPositive = Math.abs(finalPct);
                                      updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                                      updatedMilestones.push({
                                        id: finalMilestone?.id || `milestone-final-${Date.now()}`,
                                        name: 'Final Completion',
                                        paymentAmount: Math.abs(finalAmount), // Ensure amount is positive
                                        percentage: finalPctPositive, // Ensure percentage is positive
                                        type: 'final'
                                      });
                                      
                                      console.log('🔧 Creating final milestone:', {
                                        finalPct: finalPctPositive,
                                        finalAmount: Math.abs(finalAmount),
                                        name: 'Final Completion'
                                      });
                                      
                                      // ALWAYS recalculate weekly payments based on new remaining percentage
                                      // Use current bid state to get the actual number of weeks
                                      const currentWeeks = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                      let newWeekly = [];
                                      if (remainingPct > 0 && currentWeeks > 0) {
                                        const weeklyPct = remainingPct / currentWeeks;
                                        const weeklyAmount = roundPayment((grandTotal * weeklyPct) / 100);
                                        newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                                          id: `weekly-hybrid-${Date.now()}-${i}`,
                                          weekNumber: i + 1,
                                          description: `Week ${i + 1} Payment`,
                                          amount: weeklyAmount,
                                          percentage: weeklyPct,
                                        }));
                                      }
                                      
                                      // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                      const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, grandTotal);
                                      
                                      // CRITICAL: Preserve the exact percentage we set, even after normalization
                                      // The normalization might adjust amounts slightly, but we want to keep the user's selected percentage
                                      const finalMilestoneInNormalized = normalized.milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                      if (finalMilestoneInNormalized) {
                                        // Restore the exact percentage the user selected
                                        finalMilestoneInNormalized.percentage = finalPctPositive;
                                        // Recalculate amount from the preserved percentage (to ensure consistency)
                                        finalMilestoneInNormalized.paymentAmount = Math.abs(roundPayment((grandTotal * finalPctPositive) / 100));
                                        finalMilestoneInNormalized.amount = finalMilestoneInNormalized.paymentAmount;
                                        console.log('🔧 Preserved exact percentage after normalization:', {
                                          requested: finalPctPositive,
                                          stored: finalMilestoneInNormalized.percentage,
                                          amount: finalMilestoneInNormalized.paymentAmount
                                        });
                                      }
                                      
                                      // Update both milestones and weekly payments in a single state update
                                      console.log('🎯 Updating final payment button click:', {
                                        clickedPreset: preset,
                                        newFinalPct,
                                        finalPct: validation.finalPct,
                                        finalPctPositive,
                                        finalAmount,
                                        milestones: normalized.milestones.length
                                      });
                                      
                                      setBid(prev => {
                                        const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                        
                                        // Log the update
                                        const updatedFinal = updated.paymentMilestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                        console.log('✅ State updated with final milestone:', {
                                          percentage: updatedFinal?.percentage,
                                          paymentAmount: updatedFinal?.paymentAmount,
                                          name: updatedFinal?.name
                                        });
                                        
                                        // Auto-save payment schedule changes immediately
                                        AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                        return updated;
                                      });
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  } else {
                                    // Handle custom final payment input
                                    if (Platform.OS === 'ios') {
                                      Alert.prompt(
                                        'Custom Final Payment',
                                        'Enter final payment percentage (0-50):',
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Set',
                                            onPress: (text) => {
                                              const numPct = parseInt(text);
                                              if (text && numPct >= 0 && numPct <= 50) {
                                                // Get current deposit milestone
                                                const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                                const currentDepositPct = depositMilestone?.percentage || 0;
                                                
                                                // Validate and adjust percentages to prevent exceeding 100%
                                                // Use current bid state to get the actual number of weeks
                                                const currentWeeksForValidation = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                                const validation = validateAndAdjustPercentages(currentDepositPct, numPct, currentWeeksForValidation);
                                                
                                                // Show warning if adjustment was needed
                                                if (validation.warning) {
                                                  Alert.alert('⚠️ Payment Adjustment', validation.warning);
                                                }
                                                
                                                const depositPct = validation.depositPct;
                                                const finalPct = validation.finalPct;
                                                const remainingPct = validation.remainingPct;
                                                
                                                // Calculate amounts from grandTotal
                                                const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                                                const finalAmount = roundPayment((grandTotal * finalPct) / 100);
                                                
                                                // Update deposit milestone if it was adjusted
                                                let updatedMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                                if (depositMilestone) {
                                                  updatedMilestones.unshift({
                                                    id: depositMilestone.id,
                                                    name: 'Deposit',
                                                    paymentAmount: depositAmount,
                                                    percentage: depositPct,
                                                    type: 'deposit'
                                                  });
                                                }
                                                
                                                // Update final milestone
                                                updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                                                updatedMilestones.push({
                                                  id: finalMilestone?.id || `milestone-final-${Date.now()}`,
                                                  name: 'Final Completion',
                                                  paymentAmount: finalAmount,
                                                  percentage: finalPct,
                                                  type: 'final'
                                                });
                                                
                                                // ALWAYS recalculate weekly payments based on new remaining percentage
                                                // Use current bid state to get the actual number of weeks
                                                const currentWeeks = (bid.weeklyPayments?.length || 0) > 0 ? bid.weeklyPayments.length : 5;
                                                let newWeekly = [];
                                                if (remainingPct > 0 && currentWeeks > 0) {
                                                  const weeklyPct = remainingPct / currentWeeks;
                                                  const weeklyAmount = (grandTotal * weeklyPct) / 100;
                                                  newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                                                    id: `weekly-hybrid-${Date.now()}-${i}`,
                                                    weekNumber: i + 1,
                                                    description: `Week ${i + 1} Payment`,
                                                    amount: weeklyAmount,
                                                    percentage: weeklyPct,
                                                  }));
                                                }
                                                
                                                // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                                                const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, grandTotal);
                                                
                                                // Update both milestones and weekly payments in a single state update
                                                setBid(prev => {
                                                  const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                                                  // Auto-save payment schedule changes immediately
                                                  AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                                                  return updated;
                                                });
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                              } else {
                                                Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                                              }
                                            }
                                          }
                                        ],
                                        'plain-text',
                                        isCustomFinal ? finalPct.toString() : ''
                                      );
                                    } else {
                                      // Android - use modal
                                      setCustomFinalModal({ 
                                        visible: true, 
                                        value: isCustomFinal ? finalPct.toString() : '' 
                                      });
                                    }
                                  }
                                }}
                                  style={{
                                    minWidth: 70,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    backgroundColor: isSelected
                                      ? 'rgba(45, 255, 196, 0.2)'
                                      : (darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2),
                                    borderWidth: 1,
                                    borderColor: isSelected
                                      ? 'rgba(45, 255, 196, 0.4)'
                                      : (darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ 
                                    color: isSelected ? '#2DFFC4' : Colors.text, 
                                    fontSize: 13, 
                                    fontWeight: isSelected ? '700' : '600',
                                    textAlign: 'center',
                                  }}>
                                    {displayText}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {finalMilestone && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                              <Text style={{ color: Colors.sub, fontSize: 12 }}>Amount</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>{money(finalMilestone.paymentAmount || 0)}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                    </>
                  )}
                </View>
              ) : scheduleType === 'milestone-based' ? (
                <View style={{ marginTop: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={[s.label, { marginBottom: 4 }]}>Payment Milestones</Text>
                      {milestones.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Text style={{ color: Math.abs(milestoneTotalPct - 100) < 0.01 ? '#2DFFC4' : milestoneTotalPct > 100 ? Colors.orange : Colors.sub, fontSize: 12, fontWeight: '600', marginRight: 8 }}>
                            Total: {Math.abs(milestoneTotalPct - 100) < 0.01 ? '100' : milestoneTotalPct.toFixed(1)}% {Math.abs(milestoneTotalPct - 100) < 0.01 ? '✅' : milestoneTotalPct > 100 ? '⚠️' : ''}
                          </Text>
                          {remainingPctMilestone > 0 && scheduleType !== 'hybrid' && (
                            <TouchableOpacity
                              onPress={() => {
                                // Auto-balance: distribute remaining percentage evenly across all milestones
                                if (milestones.length > 0) {
                                  const perMilestone = remainingPctMilestone / milestones.length;
                                  const updatedMilestones = milestones.map(m => {
                                    const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? Math.round((m.paymentAmount / grandTotal) * 100) : 0);
                                    return {
                                      ...m,
                                      percentage: currentPct + perMilestone,
                                      paymentAmount: grandTotal > 0 ? ((currentPct + perMilestone) / 100) * grandTotal : m.paymentAmount
                                    };
                                  });
                                  updateBid('paymentMilestones', updatedMilestones);
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center' }}
                            >
                              <Text style={{ color: '#2DFFC4', fontSize: 11, fontWeight: '600' }}>
                                Remaining: {remainingPctMilestone.toFixed(1)}% • Auto-Fix
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {milestones.length > 0 && (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            borderWidth: 1,
                            borderColor: 'rgba(239, 68, 68, 0.35)',
                          }}
                          onPress={() => {
                            Alert.alert(
                              'Clear Milestones',
                              'This will remove all milestone payments. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Clear',
                                  style: 'destructive',
                                  onPress: () => {
                                    updateBid('paymentMilestones', []);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                }
                              ]
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={14} color="rgba(239, 68, 68, 0.6)" />
                          <Text style={{ color: 'rgba(239, 68, 68, 0.6)', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                            Clear
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  
                  {milestones.length === 0 && scheduleType !== 'hybrid' ? (
                    <View style={[s.stepCard, { padding: 32, alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <Ionicons name="calendar-outline" size={32} color="rgba(255, 255, 255, 0.6)" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
                        No payment schedule yet
                      </Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 }}>
                        Choose a structure or generate one — you can edit everything.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                        <TouchableOpacity
                          onPress={() => {
                            // Deposit + 3 Milestones: 20% deposit, then 26.67%, 26.67%, 26.66% (exactly 100%)
                            const depositPct = 20;
                            const milestonePct = (100 - depositPct) / 3; // 26.666...% per milestone
                            
                            // Calculate amounts for first 3 payments
                            const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                            const milestone1Amount = roundPayment((grandTotal * milestonePct) / 100);
                            const milestone2Amount = roundPayment((grandTotal * milestonePct) / 100);
                            
                            // Calculate sum of first 3 payments
                            const sumOfFirstThree = depositAmount + milestone1Amount + milestone2Amount;
                            
                            // Make final payment equal to grandTotal - sum of first 3 (ensures exact 100%)
                            const finalAmount = roundPayment(grandTotal - sumOfFirstThree);
                            const finalPct = grandTotal > 0 ? (finalAmount / grandTotal) * 100 : 0;
                            
                            const deposit = { 
                              id: `milestone-${Date.now()}-deposit`, 
                              name: 'Deposit', 
                              paymentAmount: depositAmount, 
                              amount: depositAmount,
                              percentage: depositPct,
                              type: 'deposit'
                            };
                            const milestone1 = { 
                              id: `milestone-${Date.now()}-1`, 
                              name: 'Milestone 1', 
                              paymentAmount: milestone1Amount, 
                              amount: milestone1Amount,
                              percentage: milestonePct
                            };
                            const milestone2 = { 
                              id: `milestone-${Date.now()}-2`, 
                              name: 'Milestone 2', 
                              paymentAmount: milestone2Amount, 
                              amount: milestone2Amount,
                              percentage: milestonePct
                            };
                            const milestone3 = { 
                              id: `milestone-${Date.now()}-3`, 
                              name: 'Final Payment', 
                              paymentAmount: finalAmount, 
                              amount: finalAmount,
                              percentage: finalPct,
                              type: 'final'
                            };
                            updateBid('paymentMilestones', [deposit, milestone1, milestone2, milestone3]);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: 'rgba(45, 255, 196, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            position: 'relative',
                            width: '100%',
                          }}
                        >
                          <View style={{ alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '600' }}>Deposit + Milestones</Text>
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 8,
                                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                borderWidth: 1,
                                borderColor: 'rgba(34, 197, 94, 0.4)',
                              }}>
                                <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>RECOMMENDED</Text>
                              </View>
                            </View>
                            <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2, opacity: 0.8 }}>Protects cash flow and covers upfront costs</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                  
                  {/* Upfront Deposit Card for Milestone-Based */}
                  {scheduleType === 'milestone-based' && milestones.length > 0 ? (
                    <>
                    <View style={{ 
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2, 
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                      borderRadius: 20, 
                      padding: 16, 
                      marginBottom: 16 
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                            <Ionicons name="wallet-outline" size={18} color="#22c55e" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Upfront Deposit</Text>
                            <Text style={{ color: Colors.sub, fontSize: 11 }}>Covers materials & job start</Text>
                          </View>
                        </View>
                        
                        {(() => {
                          const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                          const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? Math.round((depositMilestone.paymentAmount / grandTotal) * 100) : 20);
                          const isCustomDeposit = depositPct > 0 && depositPct !== 15 && depositPct !== 20 && depositPct !== 25;
                          
                          return (
                            <View>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                {[15, 20, 25, 'Custom'].map((preset) => {
                                  const isSelected = preset === 'Custom' 
                                    ? isCustomDeposit 
                                    : depositPct === preset;
                                  const displayText = preset === 'Custom' 
                                    ? (isCustomDeposit ? `${depositPct}%` : 'Custom')
                                    : `${preset}%`;
                                  
                                  return (
                                    <TouchableOpacity
                                      key={preset}
                                      onPress={() => {
                                        if (preset !== 'Custom') {
                                          const newDepositPct = typeof preset === 'number' ? preset : parseInt(preset);
                                          const depositAmount = roundPayment((grandTotal * newDepositPct) / 100);
                                          
                                          // Get all other milestones (excluding deposit)
                                          let otherMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                          
                                          // Calculate total percentage of other milestones
                                          const otherMilestonesPct = otherMilestones.reduce((sum, m) => {
                                            const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
                                            return sum + pct;
                                          }, 0);
                                          
                                          // Calculate remaining percentage
                                          const remainingPct = 100 - newDepositPct;
                                          
                                          // ALWAYS recalculate other milestones proportionally to keep total at 100%
                                          if (otherMilestones.length > 0 && remainingPct > 0) {
                                            const scaleFactor = remainingPct / (otherMilestonesPct || 1);
                                            otherMilestones = otherMilestones.map(m => {
                                              const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
                                              const newPct = currentPct * scaleFactor;
                                              return {
                                                ...m,
                                                percentage: newPct,
                                                paymentAmount: roundPayment((grandTotal * newPct) / 100),
                                                amount: roundPayment((grandTotal * newPct) / 100)
                                              };
                                            });
                                          } else if (otherMilestones.length > 0 && remainingPct <= 0) {
                                            // If remaining is 0 or negative, set all other milestones to 0
                                            otherMilestones = otherMilestones.map(m => ({
                                              ...m,
                                              percentage: 0,
                                              paymentAmount: 0,
                                              amount: 0
                                            }));
                                          }
                                          
                                          // Update deposit milestone
                                          let updatedMilestones = otherMilestones;
                                          updatedMilestones.unshift({
                                            id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                                            name: 'Deposit',
                                            paymentAmount: depositAmount,
                                            percentage: newDepositPct,
                                            type: 'deposit',
                                            amount: depositAmount
                                          });
                                          
                                          updateBid('paymentMilestones', updatedMilestones);
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        } else {
                                          // Handle custom deposit input
                                          if (Platform.OS === 'ios') {
                                            Alert.prompt(
                                              'Custom Deposit',
                                              'Enter deposit percentage (0-50):',
                                              [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                  text: 'Set',
                                                  onPress: (text) => {
                                                    const numPct = parseInt(text);
                                                    if (text && numPct >= 0 && numPct <= 50) {
                                                      const depositAmount = roundPayment((grandTotal * numPct) / 100);
                                                      
                                                      // Get all other milestones (excluding deposit)
                                                      let otherMilestones = milestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                                                      
                                                      // Calculate total percentage of other milestones
                                                      const otherMilestonesPct = otherMilestones.reduce((sum, m) => {
                                                        const pct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
                                                        return sum + pct;
                                                      }, 0);
                                                      
                                                      // Calculate remaining percentage
                                                      const remainingPct = 100 - numPct;
                                                      
                                                      // ALWAYS recalculate other milestones proportionally to keep total at 100%
                                                      if (otherMilestones.length > 0 && remainingPct > 0) {
                                                        const scaleFactor = remainingPct / (otherMilestonesPct || 1);
                                                        otherMilestones = otherMilestones.map(m => {
                                                          const currentPct = m.percentage || (m.paymentAmount && grandTotal > 0 ? (m.paymentAmount / grandTotal) * 100 : 0);
                                                          const newPct = currentPct * scaleFactor;
                                                          return {
                                                            ...m,
                                                            percentage: newPct,
                                                            paymentAmount: roundPayment((grandTotal * newPct) / 100),
                                                            amount: roundPayment((grandTotal * newPct) / 100)
                                                          };
                                                        });
                                                      } else if (otherMilestones.length > 0 && remainingPct <= 0) {
                                                        // If remaining is 0 or negative, set all other milestones to 0
                                                        otherMilestones = otherMilestones.map(m => ({
                                                          ...m,
                                                          percentage: 0,
                                                          paymentAmount: 0,
                                                          amount: 0
                                                        }));
                                                      }
                                                      
                                                      // Update deposit milestone
                                                      let updatedMilestones = otherMilestones;
                                                      updatedMilestones.unshift({
                                                        id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                                                        name: 'Deposit',
                                                        paymentAmount: depositAmount,
                                                        percentage: numPct,
                                                        type: 'deposit',
                                                        amount: depositAmount
                                                      });
                                                      
                                                      updateBid('paymentMilestones', updatedMilestones);
                                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    } else {
                                                      Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                                                    }
                                                  }
                                                }
                                              ],
                                              'plain-text',
                                              isCustomDeposit ? depositPct.toString() : ''
                                            );
                                          } else {
                                            Alert.alert('Custom Deposit', 'Enter deposit percentage (0-50):', [
                                              { text: 'Cancel', style: 'cancel' },
                                              {
                                                text: 'Set',
                                                onPress: () => {
                                                  // Android: would need a custom input modal
                                                  Alert.alert('Not supported', 'Custom input requires iOS. Please edit the milestone manually.');
                                                }
                                              }
                                            ]);
                                          }
                                        }
                                      }}
                                      style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 14,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: isSelected
                                          ? '#38d39f'
                                          : (darkMode ? 'rgba(255, 255, 255, 0.15)' : '#94A3B8'),
                                        backgroundColor: isSelected
                                          ? 'rgba(56, 211, 159, 0.1)'
                                          : (darkMode ? 'rgba(255, 255, 255, 0.03)' : '#CBD5E1'),
                                      }}
                                    >
                                      <Text style={{ 
                                        color: isSelected ? '#38d39f' : Colors.text, 
                                        fontSize: 13, 
                                        fontWeight: isSelected ? '700' : '600',
                                        textAlign: 'center',
                                      }}>
                                        {displayText}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })()}
                    </View>
                    
                    {/* Section 2: Milestone Progress Payments */}
                    <View style={{ 
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2, 
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                      borderRadius: 20, 
                      padding: 16, 
                      marginBottom: 16 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                          <Ionicons name="checkmark-done-outline" size={18} color="#3b82f6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Milestone Progress Payments</Text>
                          <Text style={{ color: Colors.sub, fontSize: 11 }}>Payments at key project stages</Text>
                        </View>
                      </View>
                      
                      {(() => {
                        const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                        const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? Math.round((depositMilestone.paymentAmount / grandTotal) * 100) : 0);
                        const remainingPct = 100 - depositPct;
                        
                        // Count progress milestones (excluding deposit, but including final as last milestone)
                        const progressMilestones = milestones.filter(m => {
                          const isDeposit = m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'));
                          return !isDeposit;
                        });
                        const milestonesCount = progressMilestones.length || 3;
                        const milestonePctPerMilestone = milestonesCount > 0 ? remainingPct / milestonesCount : 0;
                        const isCustomMilestones = milestonesCount > 8;
                        const customMilestonesDisplay = isCustomMilestones ? milestonesCount.toString() : '';
                        
                        return (
                          <View>
                            <View style={{ marginBottom: 12 }}>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Number of Milestones</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                {[2, 3, 4, 5, 6, 7, 8].map((milestoneCount) => (
                                  <TouchableOpacity
                                    key={milestoneCount}
                                    onPress={() => {
                                      // Get deposit milestone (no separate final milestone for milestone-based)
                                      const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                      
                                      // Calculate remaining percentage for milestones (including final)
                                      const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? (depositMilestone.paymentAmount / grandTotal) * 100 : 0);
                                      const remainingPct = 100 - depositPct;
                                      
                                      // Calculate per-milestone percentage (last one will be final)
                                      const newMilestonePct = remainingPct > 0 && milestoneCount > 0 ? remainingPct / milestoneCount : 0;
                                      const newMilestoneAmount = roundPayment((grandTotal * newMilestonePct) / 100);
                                      
                                      // Create milestones - last one is the final payment
                                      const newMilestones = Array.from({ length: milestoneCount }, (_, i) => {
                                        const isLast = i === milestoneCount - 1;
                                        return {
                                          id: `milestone-progress-${Date.now()}-${i}`,
                                          name: isLast ? 'Final Payment' : `Milestone ${i + 1}`,
                                          paymentAmount: newMilestoneAmount,
                                          percentage: newMilestonePct,
                                          amount: newMilestoneAmount,
                                          type: isLast ? 'final' : undefined,
                                        };
                                      });
                                      
                                      // Combine with deposit
                                      let updatedMilestones = [];
                                      if (depositMilestone) {
                                        updatedMilestones.push(depositMilestone);
                                      }
                                      updatedMilestones = updatedMilestones.concat(newMilestones);
                                      
                                      updateBid('paymentMilestones', updatedMilestones);
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={{
                                      minWidth: 50,
                                      paddingVertical: 8,
                                      paddingHorizontal: 12,
                                      borderRadius: 12,
                                      backgroundColor: !isCustomMilestones && milestonesCount === milestoneCount
                                        ? 'rgba(59, 130, 246, 0.2)'
                                        : (darkMode ? 'rgba(255, 255, 255, 0.05)' : '#CBD5E1'),
                                      borderWidth: 1,
                                      borderColor: !isCustomMilestones && milestonesCount === milestoneCount
                                        ? 'rgba(59, 130, 246, 0.4)'
                                        : (darkMode ? 'rgba(255, 255, 255, 0.1)' : '#94A3B8'),
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text style={{ color: !isCustomMilestones && milestonesCount === milestoneCount ? '#3b82f6' : Colors.text, fontSize: 12, fontWeight: !isCustomMilestones && milestonesCount === milestoneCount ? '700' : '600' }}>
                                      {milestoneCount}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                              
                              {/* Custom Milestones Input */}
                              <View style={{ marginTop: 8 }}>
                                <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Custom (9+ milestones)</Text>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                  <View style={{ flex: 1 }}>
                                    <TextInput
                                      key={`custom-milestones-input-${milestonesCount}`}
                                      defaultValue={customMilestonesDisplay}
                                      onChangeText={(text) => {
                                        const numMilestones = parseInt(text);
                                        if (text === '' || (numMilestones >= 9 && numMilestones <= 20)) {
                                          if (numMilestones >= 9 && numMilestones <= 20) {
                                            // Get deposit milestone (no separate final for milestone-based)
                                            const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                            
                                            // Calculate remaining percentage for milestones (including final)
                                            const depositPct = depositMilestone?.percentage || (depositMilestone?.paymentAmount && grandTotal > 0 ? (depositMilestone.paymentAmount / grandTotal) * 100 : 0);
                                            const remainingPct = 100 - depositPct;
                                            
                                            // Calculate per-milestone percentage (last one will be final)
                                            const newMilestonePct = remainingPct > 0 && numMilestones > 0 ? remainingPct / numMilestones : 0;
                                            const newMilestoneAmount = roundPayment((grandTotal * newMilestonePct) / 100);
                                            
                                            // Create milestones - last one is the final payment
                                            const newMilestones = Array.from({ length: numMilestones }, (_, i) => {
                                              const isLast = i === numMilestones - 1;
                                              return {
                                                id: `milestone-progress-${Date.now()}-${i}`,
                                                name: isLast ? 'Final Payment' : `Milestone ${i + 1}`,
                                                paymentAmount: newMilestoneAmount,
                                                percentage: newMilestonePct,
                                                amount: newMilestoneAmount,
                                                type: isLast ? 'final' : undefined,
                                              };
                                            });
                                            
                                            // Combine with deposit
                                            let updatedMilestones = [];
                                            if (depositMilestone) {
                                              updatedMilestones.push(depositMilestone);
                                            }
                                            updatedMilestones = updatedMilestones.concat(newMilestones);
                                            
                                            updateBid('paymentMilestones', updatedMilestones);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                          } else if (text === '') {
                                            // Clear progress milestones if empty
                                            const depositMilestone = milestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                                            const finalMilestone = milestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                                            let updatedMilestones = [];
                                            if (depositMilestone) {
                                              updatedMilestones.push(depositMilestone);
                                            }
                                            if (finalMilestone) {
                                              updatedMilestones.push(finalMilestone);
                                            }
                                            updateBid('paymentMilestones', updatedMilestones);
                                          }
                                        }
                                      }}
                                      placeholder="Enter milestones (9-20)"
                                      placeholderTextColor={Colors.sub}
                                      keyboardType="number-pad"
                                      style={{
                                        backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : '#CBD5E1',
                                        borderWidth: 1,
                                        borderColor: isCustomMilestones
                                          ? 'rgba(59, 130, 246, 0.4)'
                                          : (darkMode ? 'rgba(255, 255, 255, 0.1)' : '#94A3B8'),
                                        borderRadius: 12,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        color: Colors.text,
                                        fontSize: 14,
                                      }}
                                    />
                                  </View>
                                  {isCustomMilestones && (
                                    <Text style={{ color: Colors.sub, fontSize: 12, minWidth: 100 }}>
                                      {milestonePctPerMilestone.toFixed(1)}% per milestone
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                            {progressMilestones.length > 0 && (
                              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Per Milestone</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{milestonePctPerMilestone.toFixed(1)}% ({money(progressMilestones[0]?.paymentAmount || 0)})</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Progress</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{remainingPct.toFixed(1)}% ({money(progressMilestones.reduce((sum, m) => sum + (m.paymentAmount || 0), 0))})</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                    </>
                  ) : null}
                  
                  {/* Individual Milestone Cards */}
                  {milestones.length === 0 && scheduleType === 'hybrid' ? null : (
                    milestones.map((milestone, index) => {
                      // Calculate percentage if not set but amount is
                      let displayPercentage = milestone.percentage || 0;
                      if (!displayPercentage && milestone.paymentAmount && grandTotal > 0) {
                        displayPercentage = Math.round((milestone.paymentAmount / grandTotal) * 100);
                      }
                      
                      return (
                        <View key={milestone.id || index} style={[s.stepCard, { marginBottom: 12, position: 'relative' }]}>
                          <View
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              flexDirection: 'row',
                              gap: 4,
                              zIndex: 10,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => {
                                handleEditMilestone(milestone);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={{ 
                                padding: 12,
                                minWidth: 44,
                                minHeight: 44,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              activeOpacity={0.6}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="create-outline" size={20} color="#22c55e" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteMilestone(milestone.id)}
                              style={{ 
                                padding: 12,
                                minWidth: 44,
                                minHeight: 44,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              activeOpacity={0.6}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="trash-outline" size={20} color="rgba(239, 68, 68, 0.6)" />
                            </TouchableOpacity>
                          </View>
                          
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8, paddingRight: 60 }}>
                        {milestone.name || `Milestone ${index + 1}`}
                      </Text>
                          {milestone.description && (
                            <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 8 }}>
                              {milestone.description}
                            </Text>
                          )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>Amount</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
                                {money(milestone.paymentAmount || 0)}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
                                {displayPercentage}%
                              </Text>
                            </View>
                      </View>
                      {milestone.scheduledDate && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                              <Ionicons name="calendar-outline" size={14} color={Colors.sub} />
                              <Text style={{ color: Colors.sub, fontSize: 12, marginLeft: 6 }}>
                                Due: {milestone.scheduledDate}
                        </Text>
                            </View>
                      )}
                    </View>
                      );
                    })
                  )}
                  
                  {milestones.length > 0 && scheduleType !== 'hybrid' && (
                    <View style={{
                      backgroundColor: 'rgba(45, 255, 196, 0.1)',
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(45, 255, 196, 0.3)',
                      marginBottom: 12,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Scheduled</Text>
                        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '600' }}>
                          {money(milestoneTotal)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Percentage</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {(() => {
                            const isExactly100 = Math.abs(milestoneTotalPct - 100) < 0.01;
                            return (
                              <>
                                <Text style={{ color: isExactly100 ? '#22c55e' : Colors.text, fontSize: 14, fontWeight: '600', marginRight: 4 }}>
                                  {isExactly100 ? '100' : milestoneTotalPct.toFixed(1)}%
                                </Text>
                                {isExactly100 && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
                              </>
                            );
                          })()}
                        </View>
                      </View>
                      {grandTotal > 0 && Math.abs(milestoneTotal - grandTotal) > 1 && (
                        <Text style={{ color: Colors.orange, fontSize: 11, marginTop: 8 }}>
                          ⚠️ Total doesn't match bid amount ({money(grandTotal)})
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ) : null}
              
              {scheduleType === 'weekly' || (scheduleType === 'hybrid' && weeklyPayments.length > 0) ? (
                <View style={{ marginTop: scheduleType === 'hybrid' ? 24 : 0 }}>
                  {/* Upfront Deposit Card for Time-Based */}
                  {scheduleType === 'weekly' && weeklyPayments.length > 0 ? (
                    (() => {
                      const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                      if (depositPayment) {
                        const depositPct = depositPayment.percentage || (depositPayment.amount && grandTotal > 0 ? (depositPayment.amount / grandTotal) * 100 : 0);
                        const isCustomDeposit = depositPct > 0 && depositPct !== 15 && depositPct !== 20 && depositPct !== 25;
                        
                        return (
                          <View style={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            borderRadius: 20, 
                            padding: 16, 
                            marginBottom: 16 
                          }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                <Ionicons name="wallet-outline" size={18} color="#22c55e" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Upfront Deposit</Text>
                                <Text style={{ color: Colors.sub, fontSize: 11 }}>Covers materials & job start</Text>
                              </View>
                            </View>
                            
                            <View>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                {[15, 20, 25, 'Custom'].map((preset) => {
                                  const isSelected = preset === 'Custom' 
                                    ? isCustomDeposit 
                                    : depositPct === preset;
                                  const displayText = preset === 'Custom' 
                                    ? (isCustomDeposit ? `${Math.round(depositPct)}%` : 'Custom')
                                    : `${preset}%`;
                                  
                                  return (
                                    <TouchableOpacity
                                      key={preset}
                                      onPress={() => {
                                        if (preset !== 'Custom') {
                                          const newDepositPct = typeof preset === 'number' ? preset : parseInt(preset);
                                          const depositAmount = roundPayment((grandTotal * newDepositPct) / 100);
                                          
                                          // Get all other weekly payments (excluding deposit)
                                          let otherPayments = weeklyPayments.filter(w => w.weekNumber !== 0 && !(w.description && w.description.toLowerCase().includes('deposit')));
                                          
                                          // Calculate total percentage of other payments
                                          const otherPaymentsPct = otherPayments.reduce((sum, p) => {
                                            const pct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
                                            return sum + pct;
                                          }, 0);
                                          
                                          // Calculate remaining percentage
                                          const remainingPct = 100 - newDepositPct;
                                          
                                          // ALWAYS recalculate other payments proportionally to keep total at 100%
                                          if (otherPayments.length > 0 && remainingPct > 0) {
                                            const scaleFactor = remainingPct / (otherPaymentsPct || 1);
                                            otherPayments = otherPayments.map(p => {
                                              const currentPct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
                                              const newPct = currentPct * scaleFactor;
                                              return {
                                                ...p,
                                                percentage: newPct,
                                                amount: roundPayment((grandTotal * newPct) / 100)
                                              };
                                            });
                                          } else if (otherPayments.length > 0 && remainingPct <= 0) {
                                            // If remaining is 0 or negative, set all other payments to 0
                                            otherPayments = otherPayments.map(p => ({
                                              ...p,
                                              percentage: 0,
                                              amount: 0
                                            }));
                                          }
                                          
                                          // Update deposit payment
                                          const updatedDeposit = {
                                            ...depositPayment,
                                            amount: depositAmount,
                                            percentage: newDepositPct
                                          };
                                          
                                          // Combine with other payments
                                          const updatedPayments = [updatedDeposit, ...otherPayments].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
                                          
                                          updateBid('weeklyPayments', updatedPayments);
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        } else {
                                          // Handle custom deposit input
                                          if (Platform.OS === 'ios') {
                                            Alert.prompt(
                                              'Custom Deposit',
                                              'Enter deposit percentage (0-50):',
                                              [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                  text: 'Set',
                                                  onPress: (text) => {
                                                    const numPct = parseInt(text);
                                                    if (text && numPct >= 0 && numPct <= 50) {
                                                      const depositAmount = roundPayment((grandTotal * numPct) / 100);
                                                      
                                                      // Get all other weekly payments (excluding deposit)
                                                      let otherPayments = weeklyPayments.filter(w => w.weekNumber !== 0 && !(w.description && w.description.toLowerCase().includes('deposit')));
                                                      
                                                      // Calculate total percentage of other payments
                                                      const otherPaymentsPct = otherPayments.reduce((sum, p) => {
                                                        const pct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
                                                        return sum + pct;
                                                      }, 0);
                                                      
                                                      // Calculate remaining percentage
                                                      const remainingPct = 100 - numPct;
                                                      
                                                      // ALWAYS recalculate other payments proportionally to keep total at 100%
                                                      if (otherPayments.length > 0 && remainingPct > 0) {
                                                        const scaleFactor = remainingPct / (otherPaymentsPct || 1);
                                                        otherPayments = otherPayments.map(p => {
                                                          const currentPct = p.percentage || (p.amount && grandTotal > 0 ? (p.amount / grandTotal) * 100 : 0);
                                                          const newPct = currentPct * scaleFactor;
                                                          return {
                                                            ...p,
                                                            percentage: newPct,
                                                            amount: roundPayment((grandTotal * newPct) / 100)
                                                          };
                                                        });
                                                      } else if (otherPayments.length > 0 && remainingPct <= 0) {
                                                        // If remaining is 0 or negative, set all other payments to 0
                                                        otherPayments = otherPayments.map(p => ({
                                                          ...p,
                                                          percentage: 0,
                                                          amount: 0
                                                        }));
                                                      }
                                                      
                                                      // Update deposit payment
                                                      const updatedDeposit = {
                                                        ...depositPayment,
                                                        amount: depositAmount,
                                                        percentage: numPct
                                                      };
                                                      
                                                      // Combine with other payments
                                                      const updatedPayments = [updatedDeposit, ...otherPayments].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
                                                      
                                                      updateBid('weeklyPayments', updatedPayments);
                                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    } else {
                                                      Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                                                    }
                                                  }
                                                }
                                              ],
                                              'plain-text',
                                              isCustomDeposit ? Math.round(depositPct).toString() : ''
                                            );
                                          } else {
                                            Alert.alert('Custom Deposit', 'Enter deposit percentage (0-50):', [
                                              { text: 'Cancel', style: 'cancel' },
                                              {
                                                text: 'Set',
                                                onPress: () => {
                                                  Alert.alert('Not supported', 'Custom input requires iOS. Please edit the payment manually.');
                                                }
                                              }
                                            ]);
                                          }
                                        }
                                      }}
                                      style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 14,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: isSelected
                                          ? '#38d39f'
                                          : (darkMode ? 'rgba(255, 255, 255, 0.15)' : '#94A3B8'),
                                        backgroundColor: isSelected
                                          ? 'rgba(56, 211, 159, 0.1)'
                                          : (darkMode ? 'rgba(255, 255, 255, 0.03)' : '#CBD5E1'),
                                      }}
                                    >
                                      <Text style={{ 
                                        color: isSelected ? '#38d39f' : Colors.text, 
                                        fontSize: 13, 
                                        fontWeight: isSelected ? '700' : '600',
                                        textAlign: 'center',
                                      }}>
                                        {displayText}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          </View>
                        );
                      }
                      return null;
                    })()
                  ) : null}
                  
                  {/* Weekly Progress Payments Card for Time-Based */}
                  {scheduleType === 'weekly' && weeklyPayments.length > 0 ? (
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: 20, 
                      padding: 16, 
                      marginBottom: 16 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                          <Ionicons name="calendar-outline" size={18} color="#3b82f6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>Weekly Progress Payments</Text>
                          <Text style={{ color: Colors.sub, fontSize: 11 }}>Keeps cash flow steady during work</Text>
                        </View>
                      </View>
                      
                      {(() => {
                        // For time-based, check if there's a deposit (weekNumber 0 or description includes 'deposit')
                        const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                        const depositPct = depositPayment?.percentage || (depositPayment?.amount && grandTotal > 0 ? Math.round((depositPayment.amount / grandTotal) * 100) : 0);
                        // Remaining percentage for weekly payments (excluding deposit if present)
                        const remainingPct = 100 - depositPct;
                        // Count only progress weekly payments (excluding deposit)
                        const progressPayments = weeklyPayments.filter(w => w.weekNumber !== 0 && !(w.description && w.description.toLowerCase().includes('deposit')));
                        const weeks = progressPayments.length || weeklyPayments.length || 4;
                        const weeklyPctPerWeek = weeks > 0 ? remainingPct / weeks : 0;
                        const isCustomWeeks = weeks > 12;
                        const customWeeksDisplay = isCustomWeeks ? weeks.toString() : '';
                        
                        return (
                          <View>
                            <View style={{ marginBottom: 12 }}>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Number of Weeks</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((weekCount) => (
                                  <TouchableOpacity
                                    key={weekCount}
                                    onPress={() => {
                                      // Preserve deposit if it exists
                                      const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                                      const depositPct = depositPayment?.percentage || 0;
                                      const remainingPct = 100 - depositPct;
                                      
                                      const newWeeklyPct = remainingPct / weekCount;
                                      const newWeeklyAmount = roundPayment((grandTotal * newWeeklyPct) / 100);
                                      
                                      // Create new weekly payments array
                                      let newWeekly = [];
                                      if (depositPayment) {
                                        newWeekly.push(depositPayment);
                                      }
                                      newWeekly = newWeekly.concat(Array.from({ length: weekCount }, (_, i) => ({
                                        id: `weekly-${Date.now()}-${i}`,
                                        weekNumber: i + 1,
                                        description: `Week ${i + 1} Payment`,
                                        amount: newWeeklyAmount,
                                        percentage: newWeeklyPct,
                                      })));
                                      updateBid('weeklyPayments', newWeekly);
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={{
                                      minWidth: 50,
                                      paddingVertical: 8,
                                      paddingHorizontal: 12,
                                      borderRadius: 12,
                                      backgroundColor: !isCustomWeeks && weeks === weekCount
                                        ? 'rgba(59, 130, 246, 0.2)'
                                        : (darkMode ? 'rgba(255, 255, 255, 0.05)' : '#CBD5E1'),
                                      borderWidth: 1,
                                      borderColor: !isCustomWeeks && weeks === weekCount
                                        ? 'rgba(59, 130, 246, 0.4)'
                                        : (darkMode ? 'rgba(255, 255, 255, 0.1)' : '#94A3B8'),
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text style={{ color: !isCustomWeeks && weeks === weekCount ? '#3b82f6' : Colors.text, fontSize: 12, fontWeight: !isCustomWeeks && weeks === weekCount ? '700' : '600' }}>
                                      {weekCount}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                              
                              {/* Custom Weeks Input */}
                              <View style={{ marginTop: 8 }}>
                                <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 6 }}>Custom (13+ weeks)</Text>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                  <View style={{ flex: 1 }}>
                                    <TextInput
                                      key={`custom-weeks-input-${weeks}`}
                                      defaultValue={customWeeksDisplay}
                                      onChangeText={(text) => {
                                        const numWeeks = parseInt(text);
                                        if (text === '' || (numWeeks >= 13 && numWeeks <= 52)) {
                                          if (numWeeks >= 13 && numWeeks <= 52) {
                                            // Preserve deposit if it exists
                                            const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                                            const depositPct = depositPayment?.percentage || 0;
                                            const remainingPct = 100 - depositPct;
                                            
                                            const newWeeklyPct = remainingPct / numWeeks;
                                            const newWeeklyAmount = roundPayment((grandTotal * newWeeklyPct) / 100);
                                            
                                            // Create new weekly payments array
                                            let newWeekly = [];
                                            if (depositPayment) {
                                              newWeekly.push(depositPayment);
                                            }
                                            newWeekly = newWeekly.concat(Array.from({ length: numWeeks }, (_, i) => ({
                                              id: `weekly-${Date.now()}-${i}`,
                                              weekNumber: i + 1,
                                              description: `Week ${i + 1} Payment`,
                                              amount: newWeeklyAmount,
                                              percentage: newWeeklyPct,
                                            })));
                                            updateBid('weeklyPayments', newWeekly);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                          } else if (text === '') {
                                            // Clear if empty (but preserve deposit if exists)
                                            const depositPayment = weeklyPayments.find(w => w.weekNumber === 0 || (w.description && w.description.toLowerCase().includes('deposit')));
                                            if (depositPayment) {
                                              updateBid('weeklyPayments', [depositPayment]);
                                            } else {
                                              updateBid('weeklyPayments', []);
                                            }
                                          }
                                        }
                                      }}
                                      placeholder="Enter weeks (13-52)"
                                      placeholderTextColor={Colors.sub}
                                      keyboardType="number-pad"
                                      style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        borderWidth: 1,
                                        borderColor: isCustomWeeks ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: 12,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        color: Colors.text,
                                        fontSize: 14,
                                      }}
                                    />
                                  </View>
                                  {isCustomWeeks && (
                                    <Text style={{ color: Colors.sub, fontSize: 12, minWidth: 80 }}>
                                      {weeklyPctPerWeek.toFixed(1)}% per week
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                            {progressPayments.length > 0 && (
                              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Per Week</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{weeklyPctPerWeek.toFixed(1)}% ({money(progressPayments[0]?.amount || weeklyPayments.find(w => w.weekNumber !== 0)?.amount || 0)})</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Weekly</Text>
                                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{remainingPct.toFixed(1)}% ({money(progressPayments.reduce((sum, w) => sum + (w.amount || 0), 0) || weeklyTotal)})</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  ) : null}
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={[s.label, { marginBottom: 4 }]}>Weekly Payments</Text>
                      {weeklyPayments.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          {(() => {
                            const displayPct = scheduleType === 'hybrid' ? combinedTotalPct : weeklyTotalPct;
                            const isExactly100 = Math.abs(displayPct - 100) < 0.01;
                            return (
                              <Text style={{ color: isExactly100 ? '#22c55e' : displayPct > 100 ? Colors.orange : Colors.sub, fontSize: 12, fontWeight: '600', marginRight: 8 }}>
                                Total: {isExactly100 ? '100' : displayPct.toFixed(1)}% {isExactly100 ? '✅' : displayPct > 100 ? '⚠️' : ''}
                              </Text>
                            );
                          })()}
                          {remainingPctWeekly > 0 && scheduleType === 'weekly' && (
                            <TouchableOpacity
                              onPress={() => {
                                // Auto-balance: distribute remaining percentage evenly across all weekly payments
                                if (weeklyPayments.length > 0) {
                                  const perPayment = remainingPctWeekly / weeklyPayments.length;
                                  const updatedPayments = weeklyPayments.map(p => {
                                    const currentPct = p.percentage || (p.amount && grandTotal > 0 ? Math.round((p.amount / grandTotal) * 100) : 0);
                                    return {
                                      ...p,
                                      percentage: currentPct + perPayment,
                                      amount: grandTotal > 0 ? ((currentPct + perPayment) / 100) * grandTotal : p.amount
                                    };
                                  });
                                  updateBid('weeklyPayments', updatedPayments);
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center' }}
                            >
                              <Text style={{ color: '#22d3ee', fontSize: 11, fontWeight: '600' }}>
                                Remaining: {remainingPctWeekly.toFixed(1)}% • Auto-Fix
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {weeklyPayments.length > 0 && (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                          }}
                          onPress={() => {
                            Alert.alert(
                              'Clear Weekly Payments',
                              'This will remove all weekly payments. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Clear',
                                  style: 'destructive',
                                  onPress: () => {
                                    updateBid('weeklyPayments', []);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                }
                              ]
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={14} color="rgba(239, 68, 68, 0.6)" />
                          <Text style={{ color: 'rgba(239, 68, 68, 0.6)', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                            Clear
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  
                  {weeklyPayments.length === 0 && scheduleType !== 'hybrid' ? (
                    <View style={[s.stepCard, { padding: 32, alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <Ionicons name="calendar-outline" size={32} color="rgba(255, 255, 255, 0.6)" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
                        No payment schedule yet
                      </Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 }}>
                        Choose a structure or generate one — you can edit everything.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                        <TouchableOpacity
                          onPress={() => {
                            const depositPct = 20;
                            const weeks = 4;
                            const remainingPct = 100 - depositPct;
                            const pctPerWeek = remainingPct / weeks; // 20% per week
                            
                            // Calculate deposit amount
                            const depositAmount = roundPayment((grandTotal * depositPct) / 100);
                            
                            // Calculate amounts for first (weeks - 1) weekly payments
                            const amountPerWeek = roundPayment((grandTotal * pctPerWeek) / 100);
                            const weeklyPayments = Array.from({ length: weeks - 1 }, (_, i) => ({
                              id: `weekly-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: amountPerWeek,
                              percentage: pctPerWeek,
                            }));
                            
                            // Calculate sum of deposit + first (weeks - 1) payments
                            const sumOfFirstPayments = depositAmount + (amountPerWeek * (weeks - 1));
                            
                            // Make last weekly payment equal to grandTotal - sum of all others (ensures exact 100%)
                            const lastWeekAmount = roundPayment(grandTotal - sumOfFirstPayments);
                            const lastWeekPct = grandTotal > 0 ? (lastWeekAmount / grandTotal) * 100 : 0;
                            
                            const newPayments = [
                              {
                                id: `weekly-deposit-${Date.now()}`,
                                weekNumber: 0,
                                description: 'Deposit',
                                amount: depositAmount,
                                percentage: depositPct,
                              },
                              ...weeklyPayments,
                              {
                                id: `weekly-${Date.now()}-${weeks - 1}`,
                                weekNumber: weeks,
                                description: `Week ${weeks} Payment`,
                                amount: lastWeekAmount,
                                percentage: lastWeekPct,
                              }
                            ];
                            updateBid('weeklyPayments', newPayments);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: 'rgba(45, 255, 196, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            position: 'relative',
                            width: '100%',
                          }}
                        >
                          <View style={{ alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '600' }}>Deposit + Weekly</Text>
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 8,
                                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                borderWidth: 1,
                                borderColor: 'rgba(34, 197, 94, 0.4)',
                              }}>
                                <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>RECOMMENDED</Text>
                              </View>
                            </View>
                            <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 2, opacity: 0.8 }}>Protects cash flow and covers upfront costs</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : weeklyPayments.length === 0 && scheduleType === 'hybrid' ? null : (
                    weeklyPayments.map((payment, index) => {
                      // Calculate percentage if not set but amount is
                      let displayPercentage = payment.percentage || 0;
                      if (!displayPercentage && payment.amount && grandTotal > 0) {
                        displayPercentage = Math.round((payment.amount / grandTotal) * 100);
                      }
                      
                      return (
                        <View key={payment.id || index} style={[s.stepCard, { marginBottom: 12, position: 'relative' }]}>
                          <View
                            style={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              flexDirection: 'row',
                              gap: 8,
                              zIndex: 10,
                            }}
                            pointerEvents="box-none"
                          >
                            <TouchableOpacity
                              onPress={() => {
                                handleEditWeeklyPayment(payment);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={{ padding: 4 }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="create-outline" size={18} color="#22c55e" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteWeeklyPayment(payment.id)}
                              style={{ padding: 4 }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="trash-outline" size={18} color="rgba(239, 68, 68, 0.6)" />
                            </TouchableOpacity>
                          </View>
                          
                          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8, paddingRight: 60 }}>
                            {payment.description || `Week ${payment.weekNumber || index + 1} Payment`}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>Amount</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
                                {money(payment.amount || 0)}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>Percentage</Text>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
                                {displayPercentage}%
                              </Text>
                            </View>
                      </View>
                      {payment.scheduledDate && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                              <Ionicons name="calendar-outline" size={14} color={Colors.sub} />
                              <Text style={{ color: Colors.sub, fontSize: 12, marginLeft: 6 }}>
                                Due: {payment.scheduledDate}
                        </Text>
                            </View>
                      )}
                    </View>
                      );
                    })
                  )}
                  
                  {weeklyPayments.length > 0 && scheduleType !== 'hybrid' && (
                    <View style={{
                      backgroundColor: 'rgba(45, 255, 196, 0.1)',
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(45, 255, 196, 0.3)',
                      marginBottom: 12,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Scheduled</Text>
                        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '600' }}>
                          {money(weeklyTotal)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Percentage</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {(() => {
                            const isExactly100 = Math.abs(weeklyTotalPct - 100) < 0.01;
                            return (
                              <>
                                <Text style={{ color: isExactly100 ? '#22c55e' : Colors.text, fontSize: 14, fontWeight: '600', marginRight: 4 }}>
                                  {isExactly100 ? '100' : weeklyTotalPct.toFixed(1)}%
                                </Text>
                                {isExactly100 && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
                              </>
                            );
                          })()}
                        </View>
                      </View>
                      {grandTotal > 0 && Math.abs(weeklyTotal - grandTotal) > 1 && (
                        <Text style={{ color: Colors.orange, fontSize: 11, marginTop: 8 }}>
                          ⚠️ Total doesn't match bid amount ({money(grandTotal)})
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ) : null}
              
              {/* Hybrid mode combined total */}
              {scheduleType === 'hybrid' && (milestones.length > 0 || weeklyPayments.length > 0) && (
                <View style={[s.stepCard, { backgroundColor: Math.abs(combinedTotalPct - 100) < 0.01 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)', borderColor: Math.abs(combinedTotalPct - 100) < 0.01 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)', marginTop: 16 }]}>
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12 }}>Combined Total</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Scheduled</Text>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '600' }}>
                      {money(milestoneTotal + weeklyTotal)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>Total Percentage</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {(() => {
                        const isExactly100 = Math.abs(combinedTotalPct - 100) < 0.01;
                        return (
                          <>
                            <Text style={{ color: isExactly100 ? '#22c55e' : Colors.text, fontSize: 14, fontWeight: '600', marginRight: 4 }}>
                              {isExactly100 ? '100' : combinedTotalPct.toFixed(1)}%
                            </Text>
                            {isExactly100 && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
                          </>
                        );
                      })()}
                    </View>
                  </View>
                  {grandTotal > 0 && Math.abs((milestoneTotal + weeklyTotal) - grandTotal) > 1 && (
                    <Text style={{ color: Colors.orange, fontSize: 11, marginTop: 8 }}>
                      ⚠️ Total doesn't match bid amount ({money(grandTotal)})
                    </Text>
                  )}
                </View>
              )}
              
              {/* Legal Protection Disclaimer */}
              {(milestones.length > 0 || weeklyPayments.length > 0) && (
                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Ionicons name="information-circle-outline" size={14} color={Colors.sub} style={{ marginRight: 6, marginTop: 2, opacity: 0.6 }} />
                      <Text style={{ color: Colors.sub, fontSize: 10, lineHeight: 16, flex: 1, opacity: 0.8 }}>
                        ℹ️ Payment schedules vary by contract and jurisdiction. Review before sending.
                      </Text>
                    </View>
                </View>
              )}
            </GlassBorderCard>
          </View>
        );
      }
      
      case 8: {
        const aiLevel = healthScore >= 75 ? 'good' : healthScore >= 55 ? 'warn' : 'risk';
        
        // Calculate diagnostic reasons for health score
        const diagnosticReasons = [];
        const totalOverhead = (bid.insuranceOverhead || 0) + (bid.equipment || 0) + (bid.facilities || 0) + (bid.otherOverhead || 0);
        const netProfit = (calc?.profit || 0) - totalOverhead;
        const netProfitPct = calc?.subtotal > 0 ? (netProfit / calc.subtotal) * 100 : 0;
        const laborRatio = calc?.total > 0 ? (calc?.labor || 0) / calc.total : 0;
        
        // Check payment schedule completion
        let paymentComplete = false;
        let paymentScheduleType = 'None';
        if (bid.paymentSchedule === 'milestone-based') {
          const totalPct = bid.paymentMilestones?.reduce((sum, m) => sum + (m.percentage || 0), 0) || 0;
          paymentComplete = Math.abs(totalPct - 100) < 0.1;
          paymentScheduleType = 'Milestone-based';
        } else if (bid.paymentSchedule === 'weekly') {
          const totalScheduled = bid.weeklyPayments?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
          paymentComplete = calc?.total > 0 && Math.abs(calc.total - totalScheduled) < 1;
          paymentScheduleType = 'Weekly';
        }
        
        // Generate diagnostic reasons based on score factors
        if (netProfitPct < 8) {
          diagnosticReasons.push({ icon: '⚠️', text: 'Low margin buffer' });
        }
        if (laborRatio > 0.6) {
          diagnosticReasons.push({ icon: '⏱️', text: 'High labor exposure' });
        }
        if (!paymentComplete) {
          diagnosticReasons.push({ icon: '💸', text: 'Payment schedule incomplete' });
        } else if (bid.paymentSchedule === 'milestone-based' && bid.paymentMilestones?.length > 0) {
          const lastMilestone = bid.paymentMilestones[bid.paymentMilestones.length - 1];
          const lastPct = lastMilestone?.percentage || 0;
          if (lastPct > 30) {
            diagnosticReasons.push({ icon: '💸', text: 'Back-loaded payments' });
          }
        }
        if ((calc?.materials || 0) === 0 && (calc?.labor || 0) === 0) {
          diagnosticReasons.push({ icon: '📋', text: 'Missing cost details' });
        }
        
        // Check for missing customer information
        const missingCustomerFields = [];
        if (!bid.customerEmail) missingCustomerFields.push('email');
        if (!bid.customerPhone) missingCustomerFields.push('phone');
        if (!bid.customerAddress) missingCustomerFields.push('address');
        if (!bid.customerCity) missingCustomerFields.push('city');
        if (!bid.customerState) missingCustomerFields.push('state');
        if (!bid.customerZip) missingCustomerFields.push('zip');
        if (!bid.customerCompany) missingCustomerFields.push('company');
        if (!bid.customerNotes) missingCustomerFields.push('notes');
        if (!bid.customerName) missingCustomerFields.push('name');
        
        if (missingCustomerFields.length > 0) {
          const fieldCount = missingCustomerFields.length;
          if (fieldCount >= 5) {
            diagnosticReasons.push({ icon: '📝', text: `Missing ${fieldCount} customer fields` });
          } else if (fieldCount >= 3) {
            diagnosticReasons.push({ icon: '📝', text: 'Incomplete customer info' });
          }
        }
        
        // Check for missing project dates
        if (!startDate && !endDate) {
          diagnosticReasons.push({ icon: '📅', text: 'Project dates not set' });
        } else if (!startDate || !endDate) {
          diagnosticReasons.push({ icon: '📅', text: 'Incomplete date range' });
        }
        
        // Calculate project duration (check startDate/endDate from step 2, or fallback to projectStartDate/projectEndDate)
        let durationText = 'Not set';
        const startDate = bid.startDate || bid.projectStartDate;
        const endDate = bid.endDate || bid.projectEndDate;
        if (startDate && endDate) {
          const start = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T00:00:00');
          const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          const weeks = Math.ceil(days / 7);
          durationText = weeks > 0 ? `${weeks} week${weeks !== 1 ? 's' : ''}` : `${days} day${days !== 1 ? 's' : ''}`;
        } else if (bid.projectDuration) {
          durationText = `${bid.projectDuration} week${bid.projectDuration !== 1 ? 's' : ''}`;
        } else if (startDate || endDate) {
          // If only one date is set, show partial info
          durationText = startDate ? 'Start date set' : 'End date set';
        }
        
        // Pre-flight checklist items
        const checklistItems = [];
        if (paymentComplete) {
          checklistItems.push({ checked: true, text: 'Payment schedule totals 100%', isWarning: false });
        } else {
          checklistItems.push({ checked: false, text: 'Payment schedule totals 100%', isWarning: true });
        }
        if (calc?.profit && calc.profit > 0) {
          checklistItems.push({ checked: true, text: 'Margin calculated successfully', isWarning: false });
        } else {
          checklistItems.push({ checked: false, text: 'Margin calculated successfully', isWarning: true });
        }
        if (healthScore < 60) {
          checklistItems.push({ checked: false, text: 'Health score below recommended threshold', isWarning: true });
        }
        
        // Check if all items are complete
        const allChecklistItemsComplete = checklistItems.every(item => item.checked);
        
        // AI Insight text (refined to sound more advisor-like)
        let aiInsightText = '';
        if (aiLevel === 'good') {
          aiInsightText = 'This bid is well-structured with solid margins and complete payment terms. Ready for client review.';
        } else if (aiLevel === 'warn') {
          aiInsightText = 'This bid carries moderate risk due to margin and payment structure. Adjusting markup or shifting payments earlier can improve protection.';
        } else {
          aiInsightText = 'This bid is vulnerable to cost overruns and delayed payments. Adjusting markup or shifting payments earlier would improve protection.';
        }
        
        // Calculate cost overrun cushion (net profit percentage as buffer)
        const costOverrunCushion = netProfitPct;
        
        // Health Score Breakdown calculations
        const marginStrength = netProfitPct >= 15 ? 'Strong' : netProfitPct >= 10 ? 'Moderate' : netProfitPct >= 5 ? 'Weak' : 'Very Weak';
        const paymentTiming = paymentScheduleType === 'Milestone-based' 
          ? (bid.paymentMilestones?.some(m => m.type === 'deposit') 
            ? 'Milestone-based, low exposure' 
            : 'Milestone-based, moderate exposure')
          : paymentScheduleType === 'Weekly'
          ? 'Weekly, low exposure'
          : 'Not set, high exposure';
        const costVolatility = (calc?.materials || 0) > (calc?.labor || 0) ? 'Material-heavy, remodel-level risk' : 
                              (calc?.labor || 0) > (calc?.materials || 0) ? 'Labor-heavy, moderate risk' :
                              'Balanced, low risk';
        const readiness = durationText !== 'Not set' ? 'Duration defined' : 'Duration not defined';
        
        // Predictive micro-simulation: if costs rise 10%, projected profit
        const currentSubtotal = calc?.subtotal || 0;
        const currentBidTotal = calc?.total || 0;
        const costIncrease10Pct = currentSubtotal * 1.1;
        const projectedProfit10Pct = currentBidTotal - costIncrease10Pct;
        const projectedProfitPct10Pct = currentBidTotal > 0 ? (projectedProfit10Pct / currentBidTotal) * 100 : 0;
        
        // AI Recommendations with score improvements
        const aiRecommendations = [];
        
        // Check if deposit exists (more robust check)
        const hasDepositMilestone = bid.paymentMilestones?.some(m => {
          const isDepositType = m.type === 'deposit';
          const hasDepositName = m.name && (m.name.toLowerCase().includes('deposit') || m.name.toLowerCase().includes('down payment'));
          const isFirstMilestoneWithLowPct = bid.paymentMilestones.indexOf(m) === 0 && (m.percentage || 0) <= 30 && (m.percentage || 0) >= 10;
          return isDepositType || hasDepositName || isFirstMilestoneWithLowPct;
        });
        
        const hasDepositWeekly = bid.weeklyPayments?.some(w => {
          const isDepositWeek = w.weekNumber === 0;
          const hasDepositDesc = w.description && (w.description.toLowerCase().includes('deposit') || w.description.toLowerCase().includes('down payment'));
          return isDepositWeek || hasDepositDesc;
        });
        
        const hasGoodPaymentStructure = (bid.paymentSchedule === 'milestone-based' && hasDepositMilestone && paymentComplete) ||
                                        (bid.paymentSchedule === 'weekly' && hasDepositWeekly && paymentComplete);
        
        // Only suggest payment improvements if payment structure is missing something
        if (!hasGoodPaymentStructure) {
          if (bid.paymentSchedule === 'milestone-based' && !hasDepositMilestone && bid.paymentMilestones && bid.paymentMilestones.length > 0) {
            aiRecommendations.push({ 
              icon: '🔧', 
              text: 'Add a 20% deposit', 
              scoreGain: '+8',
              action: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            });
          } else if (bid.paymentSchedule === 'weekly' && !hasDepositWeekly) {
            aiRecommendations.push({ 
              icon: '📅', 
              text: 'Add deposit to weekly schedule', 
              scoreGain: '+8',
              action: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            });
          }
          
          // Only suggest switching if current structure is incomplete
          if (!paymentComplete && bid.paymentSchedule === 'milestone-based') {
            aiRecommendations.push({ 
              icon: '📅', 
              text: 'Switch to Deposit + Weekly', 
              scoreGain: '+10',
              action: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            });
          }
        }
        
        // Check markup
        const currentMarkup = bid.markupPct || 0;
        if (currentMarkup < 19) {
          aiRecommendations.push({ 
            icon: '📈', 
            text: `Increase markup to 19%`, 
            scoreGain: '+6',
            action: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          });
        }
        
        // Check duration - only recommend if both start and end dates are missing
        // Note: startDate and endDate are already declared above in the duration calculation section
        if (!startDate || !endDate) {
          const missingDateCount = (!startDate ? 1 : 0) + (!endDate ? 1 : 0);
          const scoreGain = missingDateCount === 2 ? '+10' : '+5';
          aiRecommendations.push({ 
            icon: '⏱', 
            text: missingDateCount === 2 ? 'Set project dates' : 'Complete date range', 
            scoreGain: scoreGain,
            action: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Navigate to step 2 (Project Information)
              setStep(2);
            }
          });
        }
        
        // Check for missing customer information
        const missingCustomerInfo = [];
        if (!bid.customerName) missingCustomerInfo.push({ field: 'name', points: 3 });
        if (!bid.customerEmail) missingCustomerInfo.push({ field: 'email', points: 2 });
        if (!bid.customerPhone) missingCustomerInfo.push({ field: 'phone', points: 2 });
        if (!bid.customerAddress) missingCustomerInfo.push({ field: 'address', points: 2 });
        if (!bid.customerCity) missingCustomerInfo.push({ field: 'city', points: 1.5 });
        if (!bid.customerState) missingCustomerInfo.push({ field: 'state', points: 1.5 });
        if (!bid.customerZip) missingCustomerInfo.push({ field: 'zip', points: 1.5 });
        if (!bid.customerCompany) missingCustomerInfo.push({ field: 'company', points: 1.5 });
        if (!bid.customerNotes) missingCustomerInfo.push({ field: 'notes', points: 1 });
        
        if (missingCustomerInfo.length > 0) {
          const totalPoints = missingCustomerInfo.reduce((sum, item) => sum + item.points, 0);
          const scoreGain = `+${Math.round(totalPoints)}`;
          const fieldNames = missingCustomerInfo.map(item => item.field).join(', ');
          aiRecommendations.push({ 
            icon: '📝', 
            text: `Complete customer info (${missingCustomerInfo.length} fields)`, 
            scoreGain: scoreGain,
            action: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Navigate to step 1 (Customer Information)
              setStep(1);
            }
          });
        }
        
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20} lightBg>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <MaterialIcons name="description" size={22} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Final Bid & Contract</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Health score, contract generation & export</Text>
                </View>
              </View>
              
              {/* 1. Upgraded Health Score Diagnostic Card */}
              <View style={{
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2,
                borderWidth: 2,
                borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                borderRadius: 20,
                padding: 20,
                marginBottom: 20,
                alignItems: 'center',
              }}>
                <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 12, marginBottom: 8, fontWeight: '600', letterSpacing: 1 }}>
                  HEALTH SCORE
                </Text>
                <View style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 4,
                  borderColor: healthScore < 50 ? '#ef4444' : healthScore < 70 ? '#fbbf24' : '#38d39f',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <Text style={{ color: healthColor, fontSize: 48, fontWeight: '700' }}>
                    {healthScore}
                  </Text>
                </View>
                <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 14, marginBottom: 4 }}>
                  {aiLevel === 'good' ? 'Ready to send' : aiLevel === 'warn' ? 'Moderate risk — optimizable' : 'Needs attention'}
                </Text>
                {projectedProfit10Pct > 0 && (
                  <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, opacity: darkMode ? 0.7 : 1, marginBottom: 8, textAlign: 'center' }}>
                    If costs rise 10%, projected profit: {money(projectedProfit10Pct)} ({projectedProfitPct10Pct.toFixed(1)}%)
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setHealthScoreBreakdownExpanded(!healthScoreBreakdownExpanded);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{ width: '100%', marginTop: 8 }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, opacity: 0.7, fontWeight: '600' }}>
                      Why this score
                    </Text>
                    <MaterialIcons
                      name={healthScoreBreakdownExpanded ? 'expand-less' : 'expand-more'}
                      size={16}
                      color={Colors.sub}
                      style={{ opacity: 0.7 }}
                    />
                  </View>
                </TouchableOpacity>
                
                {healthScoreBreakdownExpanded && (
                  <View style={{ width: '100%', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700', marginBottom: 12, textAlign: 'left', width: '100%' }}>
                      Health Score Breakdown
                    </Text>
                    <View style={{ width: '100%', gap: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, flex: 1 }}>Margin strength:</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'right' }}>
                          {marginStrength} ({netProfitPct.toFixed(1)}%)
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, flex: 1 }}>Payment timing:</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'right', flex: 1 }}>
                          {paymentTiming}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, flex: 1 }}>Cost volatility:</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'right', flex: 1 }}>
                          {costVolatility}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, flex: 1 }}>Readiness:</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'right' }}>
                          {readiness}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                
                {/* Diagnostic Reason Chips */}
                {diagnosticReasons.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                    {diagnosticReasons.map((reason, index) => (
                      <View
                        key={index}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: 12,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 12 }}>{reason.icon}</Text>
                        <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, fontWeight: '600' }}>{reason.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              
              {/* 2. AI Insight Line */}
              <View style={{
                backgroundColor: 'rgba(56, 211, 159, 0.1)',
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(56, 211, 159, 0.2)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <MaterialIcons name="lightbulb" size={18} color="#38d39f" style={{ marginTop: 2 }} />
                  <Text style={{ color: Colors.text, fontSize: 13, lineHeight: 20, flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#38d39f' }}>AI Insight: </Text>
                    {aiInsightText}
                  </Text>
                </View>
              </View>
              
              {/* AI Recommendations (Fix-It Actions) */}
              {aiRecommendations.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 12 }}>
                    AI Recommendations
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {aiRecommendations.map((rec, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={rec.action}
                        style={{
                          flex: 1,
                          minWidth: '47%',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          backgroundColor: 'rgba(56, 211, 159, 0.1)',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: 'rgba(56, 211, 159, 0.3)',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 16 }}>{rec.icon}</Text>
                        <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '600', flex: 1 }}>
                          {rec.text}
                        </Text>
                        <Text style={{ color: '#38d39f', fontSize: 11, fontWeight: '700' }}>
                          {rec.scoreGain}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              
              {/* 3. Bid Snapshot Card */}
              <View style={{
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2,
                borderWidth: 2,
                borderColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.line,
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <MaterialIcons name="receipt" size={18} color={Colors.sub} style={{ marginRight: 8 }} />
                  <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>Bid Snapshot</Text>
                </View>
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 12 }}>Total Bid:</Text>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>{money(calc?.total || 0)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 12 }}>Estimated Net Profit:</Text>
                    <Text style={{ color: netProfit >= 0 ? '#38d39f' : '#ff7a7a', fontSize: 12, fontWeight: '700' }}>
                      {money(netProfit)} ({netProfitPct.toFixed(1)}%)
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 12 }}>Payment Structure:</Text>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>{paymentScheduleType}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 12 }}>Duration:</Text>
                    <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>{durationText}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 12 }}>Cost Overrun Cushion:</Text>
                    <Text style={{ color: costOverrunCushion >= 10 ? '#38d39f' : costOverrunCushion >= 5 ? '#ffcc66' : '#ff7a7a', fontSize: 12, fontWeight: '700' }}>
                      ~{costOverrunCushion.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Optional: What affects this score? (Collapsible) */}
              <TouchableOpacity
                onPress={() => {
                  setScoreExplanationExpanded(!scoreExplanationExpanded);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  marginBottom: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface2,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 12, fontWeight: '600' }}>
                    What affects this score?
                  </Text>
                  <MaterialIcons
                    name={scoreExplanationExpanded ? 'expand-less' : 'expand-more'}
                    size={18}
                    color={Colors.sub}
                  />
                </View>
                {scoreExplanationExpanded && (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11 }}>•</Text>
                      <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, flex: 1 }}>Margin strength</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11 }}>•</Text>
                      <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, flex: 1 }}>Payment timing</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11 }}>•</Text>
                      <Text style={{ color: darkMode ? Colors.sub : Colors.text, fontSize: 11, flex: 1 }}>Cost volatility</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
              
              {/* 5. Pre-Flight Checklist */}
              {checklistItems.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 12 }}>
                    Pre-Flight Checklist {allChecklistItemsComplete && '(Ready to Send)'}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {checklistItems.map((item, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <MaterialIcons
                          name={item.checked ? 'check-circle' : item.isWarning ? 'warning' : 'radio-button-unchecked'}
                          size={18}
                          color={item.checked ? '#38d39f' : item.isWarning ? '#ffcc66' : Colors.sub}
                        />
                        <Text style={{
                          color: item.checked ? Colors.text : item.isWarning ? '#ffcc66' : Colors.sub,
                          fontSize: 12,
                          flex: 1,
                          fontWeight: item.isWarning ? '600' : '500',
                        }}>
                          {item.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {allChecklistItemsComplete && (
                    <Text style={{
                      color: '#38d39f',
                      fontSize: 11,
                      marginTop: 12,
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>
                      All required items are complete. This bid is ready to generate a client-facing contract.
                    </Text>
                  )}
                </View>
              )}
              
              {/* 4. Generate Contract CTA with Framing */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{
                  color: Colors.sub,
                  fontSize: 12,
                  marginBottom: 8,
                  textAlign: 'center',
                  fontWeight: '600',
                }}>
                  Ready to generate client-facing contract
                </Text>
                <TouchableOpacity
                  onPress={generateContract}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                    start={{ x: 0.05, y: 0.15 }}
                    end={{ x: 0.95, y: 0.85 }}
                    style={{
                      borderRadius: 12,
                      padding: 16,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons name="description" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                      Generate Contract PDF
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={{
                  color: Colors.sub,
                  fontSize: 10,
                  marginTop: 6,
                  textAlign: 'center',
                  opacity: 0.7,
                }}>
                  Includes scope, pricing, payment schedule, and terms
                </Text>
              </View>
              
              {/* 8. Legal Safety Text */}
              <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <MaterialIcons name="info-outline" size={14} color={Colors.sub} style={{ marginTop: 2, opacity: 0.6 }} />
                  <Text style={{ color: Colors.sub, fontSize: 10, lineHeight: 16, flex: 1, opacity: 0.7 }}>
                    Health score and insights are estimates based on provided inputs. Review contract terms before client use.
                  </Text>
                </View>
              </View>
            </GlassBorderCard>
          </View>
        );
      }
      
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Header */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: Colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.3 }}>
              Bid Builder
            </Text>
            <Text style={{ color: Colors.sub, fontSize: 14, marginTop: 6 }}>
              Build, review, and submit your bid
            </Text>
          </View>

          {/* + New (outline, iOS-grade) */}
          <LinearGradient
            colors={GRAD}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={{ borderRadius: 24, padding: 2 }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={{
                backgroundColor: darkMode ? '#000000' : '#FFFFFF',
                borderRadius: 22,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
              onPress={async () => {
                // Haptic feedback for button press
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                
                // Save current bid automatically
                await backupCurrentEstimateSilently();
                
                // Clear bid fields and reset refs
                const nextBid = blankState();
                
                // Reset refs to prevent glitching
                lastSavedBidRef.current = null;
                if (pendingSaveRef.current) {
                  clearTimeout(pendingSaveRef.current);
                  pendingSaveRef.current = null;
                }
                
                // Clear state
                setMaterialsCart([]);
                setRentalCart([]);
                setBid(nextBid);
                setStep(0); // Start at Bid Summary (step 0)
                setActiveNavButton('summary');
                
                // Save blank state to AsyncStorage to prevent conflicts
                try {
                  await AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(nextBid));
                  await AsyncStorage.setItem('bps.materialsCart', JSON.stringify([]));
                  await AsyncStorage.setItem('bps.rentalCart', JSON.stringify([]));
                } catch (error) {
                  console.warn('Failed to save new blank bid to storage:', error);
                }
              }}
            >
              <Text style={{ color: darkMode ? Colors.text : '#000000', fontSize: 16, fontWeight: '800' }}>+ New</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Navigation Pill (matches dashboard segmented control) */}
        <View
          style={[
            s.navPillBorder,
            !darkMode && { borderColor: Colors.line, backgroundColor: Colors.surface2 },
          ]}
        >
          <BlurView
            intensity={darkMode ? 35 : 0}
            tint={darkMode ? "dark" : "light"}
            style={{ borderRadius: 999, backgroundColor: darkMode ? "transparent" : Colors.surface2 }}
          >
              <View style={[s.navPillInner, !darkMode && { backgroundColor: Colors.surface2 }]}>
                {/* Back button */}
                {activeNavButton === 'back' ? (
                  <LinearGradient
                    colors={['#22c55e', '#22d3ee']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.navBtn, s.navNextActive]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (step > 1) {
                          setStep(step - 1);
                          setActiveNavButton('back');
                        } else if (step === 1) {
                          // From step 1, can go back to step 0 (Bid Summary) if desired
                          setStep(0);
                          setActiveNavButton('summary');
                        }
                      }}
                      activeOpacity={0.85}
                      style={s.navBtnInner}
                      disabled={step === 0}
                    >
                      <Ionicons name="chevron-back" size={18} color="#050B13" />
                      <Text style={{ color: '#050B13', fontSize: 15, fontWeight: '600' }}>Back</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      if (step > 1) {
                        setStep(step - 1);
                        setActiveNavButton('back');
                      } else if (step === 1) {
                        // From step 1, can go back to step 0 (Bid Summary) if desired
                        setStep(0);
                        setActiveNavButton('summary');
                      }
                    }}
                    style={s.navBtn}
                    activeOpacity={0.85}
                    disabled={step === 0}
                  >
                    <View style={s.navBtnInner}>
                      <Ionicons name="chevron-back" size={18} color={darkMode ? "#E5F7FF" : "#000000"} />
                      <Text style={{ color: darkMode ? '#E5F7FF' : '#000000', fontSize: 15, fontWeight: '600' }}>Back</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Summary button */}
                {activeNavButton === 'summary' ? (
                  <LinearGradient
                    colors={['#22c55e', '#22d3ee']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.navCenterBtn, s.navNextActive]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setStep(0);
                        setActiveNavButton('summary');
                      }}
                      activeOpacity={0.85}
                      style={s.navCenterBtnInner}
                    >
                      <Text style={{ color: '#050B13', fontSize: 15, fontWeight: '600' }}>Summary</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setStep(0); // Go to Bid Summary (not a numbered step)
                      setActiveNavButton('summary');
                    }}
                    style={s.navCenterBtn}
                    activeOpacity={0.85}
                  >
                    <View style={s.navCenterBtnInner}>
                      <Text style={{ color: darkMode ? '#E5F7FF' : '#000000', fontSize: 15, fontWeight: '600' }}>Summary</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Next button */}
                {activeNavButton === 'next' && step < 8 && step !== 0 ? (
                  <LinearGradient
                    colors={['#22c55e', '#22d3ee']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.navNextWrap, s.navNextActive]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={s.navNextInner}
                      onPress={() => {
                        setStep(step + 1);
                        setActiveNavButton('next');
                      }}
                    >
                      <Text style={{ color: '#050B13', fontSize: 15, fontWeight: '600' }}>Next</Text>
                      <Ionicons name="arrow-forward" size={18} color="#050B13" />
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={s.navNextWrap}
                    onPress={() => {
                      if (step === 0) {
                        // From Bid Summary (step 0), go to Customer Information (step 1)
                        setStep(1);
                        setActiveNavButton('next');
                      } else if (step < 8) {
                        setStep(step + 1);
                        setActiveNavButton('next');
                      }
                    }}
                    disabled={step >= 8 && step !== 0}
                  >
                    <View style={s.navNextInner}>
                      <Text style={{ color: darkMode ? '#E5F7FF' : '#000000', fontSize: 15, fontWeight: '600' }}>Next</Text>
                      <Ionicons name="arrow-forward" size={18} color={darkMode ? "#E5F7FF" : "#000000"} />
                    </View>
                  </TouchableOpacity>
                )}
            </View>
          </BlurView>
        </View>
      </View>
      
      {/* Step Section Card with Icons */}
      <View style={[s.wideContainer, { marginTop: 12 }]}>
        <LinearGradient
          colors={['#2DFFC4', '#00A6FF']}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={{ borderRadius: 20, padding: 1 }}
        >
          <View
            style={[
              s.stepperPanelInner,
              { borderRadius: 18 },
              !darkMode && { backgroundColor: Colors.bg },
            ]}
          >
          {/* Current Step Info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(25, 225, 128, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
              <MaterialIcons name={getStepIcon(step)} size={20} color="#19E180" />
            </View>
            <View>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>
                {step === 0 ? 'Bid Summary' : STEPS[step - 1]?.title}
              </Text>
              <Text style={{ color: Colors.sub, fontSize: 12 }}>
                {step === 0 ? 'Financial breakdown and totals' : STEPS[step - 1]?.subtitle}
              </Text>
            </View>
          </View>
          
          {/* Step Icons Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
            {/* Bid Summary - Special icon without number, appears before step 1 */}
            <TouchableOpacity
              onPress={() => {
                setStep(0);
                setActiveNavButton('summary');
              }}
              style={{
                alignItems: 'center',
                marginHorizontal: 6,
                opacity: step === 0 ? 1 : 1,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: darkMode
                  ? (step === 0 ? 'rgba(25, 225, 128, 0.25)' : 'rgba(255, 255, 255, 0.12)')
                  : (step === 0 ? 'rgba(25, 225, 128, 0.2)' : '#D1D5DB'),
                borderWidth: darkMode ? (step === 0 ? 2 : 1) : (step === 0 ? 2 : 1),
                borderColor: darkMode
                  ? (step === 0 ? '#19E180' : 'rgba(255, 255, 255, 0.25)')
                  : (step === 0 ? '#19E180' : '#9CA3AF'),
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 4,
              }}>
                <MaterialIcons
                  name={getStepIcon(0)}
                  size={18}
                  color={darkMode ? (step === 0 ? '#19E180' : 'rgba(229, 231, 235, 0.8)') : (step === 0 ? '#19E180' : '#000000')}
                />
              </View>
              <Text style={{
                color: darkMode ? (step === 0 ? '#19E180' : 'rgba(229, 231, 235, 0.8)') : (step === 0 ? '#19E180' : Colors.sub),
                fontSize: 10,
                fontWeight: darkMode ? (step === 0 ? '700' : '500') : (step === 0 ? '700' : '600'),
              }}>
                S
              </Text>
            </TouchableOpacity>
            
            {/* Numbered Steps 1-8 */}
            {STEPS.map((stepItem) => (
              <TouchableOpacity
                key={stepItem.id}
                onPress={() => setStep(stepItem.id)}
                style={{
                  alignItems: 'center',
                  marginHorizontal: 6,
                  opacity: step === stepItem.id ? 1 : 1,
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                backgroundColor: darkMode
                  ? (step === stepItem.id ? 'rgba(25, 225, 128, 0.25)' : 'rgba(255, 255, 255, 0.12)')
                  : (step === stepItem.id ? 'rgba(25, 225, 128, 0.2)' : '#D1D5DB'),
                borderWidth: darkMode ? (step === stepItem.id ? 2 : 1) : (step === stepItem.id ? 2 : 1),
                borderColor: darkMode
                  ? (step === stepItem.id ? '#19E180' : 'rgba(255, 255, 255, 0.25)')
                  : (step === stepItem.id ? '#19E180' : '#9CA3AF'),
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 4,
                }}>
                  <MaterialIcons
                    name={getStepIcon(stepItem.id)}
                    size={18}
                  color={darkMode ? (step === stepItem.id ? '#19E180' : 'rgba(229, 231, 235, 0.8)') : (step === stepItem.id ? '#19E180' : '#000000')}
                  />
                </View>
                <Text style={{
                  color: darkMode ? (step === stepItem.id ? '#19E180' : 'rgba(229, 231, 235, 0.8)') : (step === stepItem.id ? '#19E180' : Colors.sub),
                  fontSize: 10,
                  fontWeight: darkMode ? (step === stepItem.id ? '700' : '500') : (step === stepItem.id ? '700' : '600'),
                }}>
                  {stepItem.id}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          </View>
        </LinearGradient>
      </View>
      
        {/* Step Content */}
        {renderStepContent()}
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Modals */}
      <LineItemModal
        visible={materialModal.visible}
        onClose={() => setMaterialModal({ visible: false, item: null })}
        item={materialModal.item}
        onSave={(item) => {
          if (materialModal.item) {
            setMaterialsCart(prev => prev.map(m => m.id === materialModal.item.id ? item : m));
          } else {
            setMaterialsCart(prev => [...prev, { ...item, id: Date.now().toString() }]);
          }
          setMaterialModal({ visible: false, item: null });
        }}
        title="Material"
        laborMode={false}
      />
      
      <LineItemModal
        visible={laborModal.visible}
        onClose={() => setLaborModal({ visible: false, item: null })}
        item={laborModal.item}
        onSave={(item) => {
          const updated = bid.laborLineItems || [];
          if (laborModal.item) {
            const index = updated.findIndex(l => l.id === laborModal.item.id);
            if (index >= 0) {
              updated[index] = item;
            }
          } else {
            updated.push({ ...item, id: Date.now().toString() });
          }
          updateBid('laborLineItems', updated);
          setLaborModal({ visible: false, item: null });
        }}
        title="Labor"
        laborMode={true}
      />
      
      {/* Payment Milestone Modal */}
      <PaymentMilestoneModal
        visible={milestoneModal.visible}
        onClose={() => setMilestoneModal({ visible: false, item: null })}
        item={milestoneModal.item}
        onSave={handleSaveMilestone}
        grandTotal={calc?.grandTotal || calc?.total || 0}
      />
      
      {/* Weekly Payment Modal */}
      <WeeklyPaymentModal
        visible={weeklyPaymentModal.visible}
        onClose={() => setWeeklyPaymentModal({ visible: false, item: null })}
        item={weeklyPaymentModal.item}
        onSave={handleSaveWeeklyPayment}
        grandTotal={calc?.grandTotal || calc?.total || 0}
      />
      
      {/* Recovery Modal - Full Page */}
      <Modal
        visible={showRecoveryModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowRecoveryModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <StatusBar barStyle={Colors.bg === '#000000' ? "light-content" : "dark-content"} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 200 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            {/* Header */}
            <View style={{ marginTop: 32, marginBottom: 18, marginHorizontal: -20, paddingHorizontal: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 2,
                    marginRight: 12,
                    shadowColor: "#22c55e",
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowRecoveryModal(false);
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 18,
                      backgroundColor: '#000000',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <MaterialIcons name="arrow-back" size={20} color="#f9fafb" />
                  </TouchableOpacity>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f9fafb', fontSize: 34, fontWeight: '900', letterSpacing: -0.3 }}>
                    Restore
                  </Text>
                  <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 6 }}>
                    {savedEstimates.length} {savedEstimates.length === 1 ? 'saved bid' : 'saved bids'}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* List of Saved Estimates */}
            {savedEstimates.length === 0 ? (
              <View style={{
                padding: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 24,
                }}>
                  <Ionicons name="document-outline" size={40} color="#22c55e" />
                </View>
                <Text style={{ color: '#f9fafb', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                  No saved bids found
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>
                  Save a bid to restore it later
                </Text>
              </View>
            ) : (
              <View style={{ marginHorizontal: -20, paddingHorizontal: 8 }}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 2 }}>
                    Saved Bids
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 13, color: '#8DA0B8' }}>
                    Tap to restore a saved bid
                  </Text>
                </View>
                
                {savedEstimates.map((item, index) => (
                  <LinearGradient
                    key={item.id}
                    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                    start={{ x: 0.05, y: 0.15 }}
                    end={{ x: 0.95, y: 0.85 }}
                    style={{
                      borderRadius: 20,
                      padding: 1,
                      marginBottom: index < savedEstimates.length - 1 ? 12 : 0,
                      shadowColor: "#22c55e",
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        borderRadius: 19,
                        padding: 16,
                        backgroundColor: '#000000',
                      }}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        loadEstimate(item);
                        setShowRecoveryModal(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                            {item.title || 'Untitled Bid'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <Ionicons name="person-outline" size={14} color="#8DA0B8" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#8DA0B8', fontSize: 13 }}>
                              {item.customer || item.customerName || 'Unknown Customer'}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="calendar-outline" size={14} color="#8DA0B8" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#8DA0B8', fontSize: 13 }}>
                              {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Unknown date')}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: '#22c55e', fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
                            {money(item.total || item.grandTotal || 0)}
                          </Text>
                          <TouchableOpacity
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              borderWidth: 1,
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                            onPress={(e) => {
                              e.stopPropagation();
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              Alert.alert(
                                'Delete Bid?',
                                `Are you sure you want to delete "${item.title || 'Untitled Bid'}"?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: () => {
                                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                      deleteEstimate(item.id);
                                    },
                                  },
                                ]
                              );
                            }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </LinearGradient>
                ))}
              </View>
            )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}