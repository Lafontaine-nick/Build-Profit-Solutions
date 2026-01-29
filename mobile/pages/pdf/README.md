# React PDF Contract System

A professional, modular PDF generation system using `@react-pdf/renderer`.

## 📦 Components

### Core Components
- **`ContractHeader`** - Company logo, contract ID, and date
- **`ProjectDetails`** - Customer and project information boxes
- **`MaterialsSection`** - Grouped materials with auto-hiding for small items
- **`LaborSection`** - Labor line items with subtotals
- **`ContractTotals`** - Materials, labor, and contract total
- **`GrandTotalWithTax`** - Optional tax calculation
- **`Footer`** - Company contact information
- **`PoweredBy`** - Build Profit Solutions branding

### Complete Documents
- **`CompleteContract`** - Full contract document with all sections

## 🚀 Usage

### Basic Example

```typescript
import { pdf } from '@react-pdf/renderer';
import { CompleteContract } from '@/pages/pdf/CompleteContract';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const generateContract = async () => {
  const contractData = {
    companyName: "American Building",
    contractId: "1759443042563",
    dateStr: "10/13/2025",
    customer: {
      name: "John Doe",
      email: "john@example.com",
      phone: "(702) 555-1234"
    },
    project: {
      name: "Bathroom Renovation",
      address: "123 Main St, Las Vegas, NV",
      duration: "30 days",
      warranty: "1 year"
    },
    scopeSummary: "Complete bathroom remodel including tile work, plumbing fixtures, and waterproofing.",
    materials: [
      { description: "2×4 SYP Lumber", quantity: 4, unit: "ea", materials: 23.36, section: "Framing" },
      { description: "DensShield Backer Board", quantity: 3, unit: "ea", materials: 95.16, section: "Tile & Waterproofing" },
      { description: "RedGard Membrane", quantity: 3, unit: "ea", materials: 167.91, section: "Tile & Waterproofing" },
    ],
    labor: [
      { task: "Demolition", amount: 500 },
      { task: "Tile Installation", amount: 5000 },
    ],
    taxRate: 0.0838, // 8.38% Nevada tax
    currency: "USD",
    minVisibleMaterialAmount: 75, // Hide materials under $75
  };

  // Generate PDF blob
  const blob = await pdf(<CompleteContract data={contractData} />).toBlob();
  
  // Save to file system
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = async () => {
    const base64data = reader.result as string;
    const path = FileSystem.documentDirectory + `Contract_${contractData.contractId}.pdf`;
    await FileSystem.writeAsStringAsync(path, base64data.split(',')[1], {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Share
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path);
    }
  };
};
```

### Using Individual Components

```typescript
import { Document, Page } from '@react-pdf/renderer';
import { ContractHeader, MaterialsSection, LaborSection, ContractTotals } from '@/components/pdf';

const CustomContract = () => (
  <Document>
    <Page size="LETTER" style={{ padding: 28 }}>
      <ContractHeader
        companyName="Your Company"
        contractId="12345"
        dateStr="10/15/2025"
      />
      
      <MaterialsSection items={yourMaterials} />
      <LaborSection items={yourLabor} />
      <ContractTotals materialsTotal={2000} laborTotal={5000} />
    </Page>
  </Document>
);
```

## ✨ Features

### Smart Material Visibility
Materials under $75 are automatically hidden from the contract but included in totals. The `ContractTotals` component shows a note explaining this.

### Auto-Categorization
Materials are automatically grouped by section (Framing, Tile & Waterproofing, Plumbing, etc.)

### Professional Formatting
- Clean typography with proper spacing
- Color-coded sections
- Shaded total boxes
- Section subtotals
- Tax calculations (optional)

### Flexible Currency
All components accept an optional `currency` prop (defaults to USD)

## 🎨 Styling

All components use inline StyleSheet from `@react-pdf/renderer`. Colors follow the Build Profit Solutions design system:
- Primary: `#0F766E` (Teal)
- Accent: `#3B82F6` (Blue)
- Text: `#111827` to `#6B7280` (Gray scale)

## 📱 Integration with Existing App

To integrate with your existing estimate generator:

```typescript
// In estimate-generator.jsx
import { pdf } from '@react-pdf/renderer';
import { CompleteContract } from '@/pages/pdf/CompleteContract';

const handleGenerateContract = async () => {
  const contractData = {
    companyName: user.company || "American Building",
    contractId: bid.id.toString(),
    dateStr: new Date().toLocaleDateString(),
    customer: {
      name: bid.clientName,
      email: bid.clientEmail,
      phone: bid.clientPhone,
    },
    project: {
      name: bid.projectName,
      address: bid.location,
      duration: `${bid.duration || 30} days`,
      warranty: "1 year",
    },
    materials: materialsCart,
    labor: laborLineItems,
    taxRate: 0.0838,
    minVisibleMaterialAmount: 75,
  };

  // Generate and share
  const blob = await pdf(<CompleteContract data={contractData} />).toBlob();
  // ... handle file save and share
};
```

## 🔧 Customization

### Custom Footer
```typescript
// components/pdf/Footer.tsx
export const Footer = () => (
  <View style={styles.footer}>
    <Text style={styles.line}>Your Company • License #12345</Text>
    <Text style={styles.line}>(555) 123-4567 • hello@yourcompany.com</Text>
  </View>
);
```

### Custom Note Text
```typescript
<ContractTotals
  materialsTotal={2000}
  laborTotal={5000}
  noteConsumables="Custom note about included items..."
/>
```

## 📝 Notes

- **React Native Compatibility**: `@react-pdf/renderer` is primarily designed for web. For full React Native/Expo compatibility, you may need to render the PDF on a server or use the existing `expo-print` HTML-based approach.
- **Alternative**: The existing `buildProposalHtml.ts` system uses `expo-print` which is native to Expo and works seamlessly on mobile devices.

## 🆚 Comparison with HTML-based System

| Feature | React PDF | HTML (expo-print) |
|---------|-----------|-------------------|
| Type Safety | ✅ Full TypeScript | ⚠️ String templates |
| Component Reuse | ✅ React components | ❌ Copy/paste |
| Mobile Native | ⚠️ Requires bridge | ✅ Native support |
| Styling | React StyleSheet | HTML/CSS |
| Learning Curve | Medium | Low |
| Bundle Size | +200KB | Minimal |

## 📚 Resources

- [React PDF Documentation](https://react-pdf.org/)
- [Expo Print API](https://docs.expo.dev/versions/latest/sdk/print/)
- [Build Profit Solutions Design System](../DESIGN_SYSTEM.md)



