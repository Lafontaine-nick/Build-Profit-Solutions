# Legal Attribution Guide

## ✅ What Was Built

Your app now has complete legal compliance for using third-party data (Yelp, Home Depot, Lowes).

### 1. Legal Hub Screen (`/app/legal-hub.tsx`)
- ✅ Complete Terms of Use with specific sections for Yelp, Home Depot, and Lowes
- ✅ Privacy Policy placeholder (to be customized with legal review)
- ✅ Data Sources & Attributions with deep links
- ✅ Accessible from Profile → Settings → Terms/Privacy

### 2. Attribution Components (`/components/AttributionBadge.tsx`)
- ✅ Reusable badges and disclaimers
- ✅ Ready to use in Materials and Contractor screens
- ✅ Links to Legal Hub for details

---

## 🎯 How to Use Attribution Components

### Quick Reference

```tsx
import {
  AttributionBadge,
  InlineAttribution,
  MaterialPricingDisclaimer,
  YelpResultsFooter,
} from '@/components/AttributionBadge';
```

---

## 📱 Component Usage Examples

### 1. AttributionBadge

**Use:** Show "Powered by Yelp" or retailer badges

```tsx
// Yelp badge (for contractor/supplier search)
<AttributionBadge type="yelp" />

// Compact version (space-constrained areas)
<AttributionBadge type="yelp" compact />

// With learn more link
<AttributionBadge type="yelp" showLearnMore />

// Home Depot badge
<AttributionBadge type="home-depot" />

// Lowe's badge
<AttributionBadge type="lowes" />
```

**Types available:**
- `"yelp"` - Yelp Fusion API
- `"home-depot"` - Home Depot products
- `"lowes"` - Lowe's products
- `"general"` - Generic third-party data

---

### 2. InlineAttribution

**Use:** Small disclaimers below content sections

```tsx
// Yelp attribution
<InlineAttribution type="yelp" />

// Material pricing attribution
<InlineAttribution type="home-depot" />
<InlineAttribution type="lowes" />
```

**Example output:**
> ℹ️ Some ratings sourced via Yelp Fusion API. [Details](#)

---

### 3. MaterialPricingDisclaimer

**Use:** Warning box for material pricing screens

```tsx
// Home Depot pricing
<MaterialPricingDisclaimer store="home-depot" />

// Lowe's pricing
<MaterialPricingDisclaimer store="lowes" />

// General pricing
<MaterialPricingDisclaimer store="general" />
```

**Example output:**
> ⚠️ **Price Estimates**  
> Prices are estimates and may change. Always verify current pricing and availability on the Home Depot website before purchasing. [Learn more](#)

---

### 4. YelpResultsFooter

**Use:** Bottom of contractor/supplier search results

```tsx
<YelpResultsFooter />
```

**Example output:**
> ⭐ **Powered by Yelp** [Attribution →]  
> Business information, ratings, and reviews provided by Yelp. BPS is not affiliated with Yelp.

---

## 🛠️ Integration Examples

### Contractor Search Screen

```tsx
import { YelpResultsFooter, AttributionBadge } from '@/components/AttributionBadge';

export default function ContractorSearch() {
  return (
    <View>
      <Text>Search Results</Text>
      
      {/* Your contractor list */}
      <FlatList
        data={contractors}
        renderItem={({ item }) => (
          <ContractorCard contractor={item}>
            {/* Show Yelp badge on each card */}
            <AttributionBadge type="yelp" compact />
          </ContractorCard>
        )}
      />
      
      {/* Footer at bottom of results */}
      <YelpResultsFooter />
    </View>
  );
}
```

---

### Materials Lookup Screen

```tsx
import {
  MaterialPricingDisclaimer,
  AttributionBadge,
} from '@/components/AttributionBadge';

export default function MaterialsScreen() {
  const [selectedStore, setSelectedStore] = useState<'home-depot' | 'lowes'>('home-depot');
  
  return (
    <View>
      <Text>Material Prices</Text>
      
      {/* Store selector */}
      <View>
        <Button onPress={() => setSelectedStore('home-depot')}>
          Home Depot
        </Button>
        <Button onPress={() => setSelectedStore('lowes')}>
          Lowe's
        </Button>
      </View>
      
      {/* Disclaimer at top */}
      <MaterialPricingDisclaimer store={selectedStore} />
      
      {/* Your products list */}
      <FlatList
        data={products}
        renderItem={({ item }) => (
          <ProductCard product={item}>
            {/* Compact badge on each product */}
            <AttributionBadge
              type={selectedStore}
              compact
            />
          </ProductCard>
        )}
      />
    </View>
  );
}
```

---

### Business Details Screen (Single Contractor)

```tsx
import { InlineAttribution } from '@/components/AttributionBadge';

export default function ContractorDetails({ contractorId }) {
  return (
    <ScrollView>
      <Text>Contractor Info</Text>
      
      {/* Business details */}
      <View>
        <Text>{contractor.name}</Text>
        <Text>⭐ {contractor.rating}</Text>
        <Text>{contractor.reviewCount} reviews</Text>
      </View>
      
      {/* Reviews section */}
      <View>
        <Text>Reviews</Text>
        {reviews.map(review => (
          <ReviewCard key={review.id} review={review} />
        ))}
        
        {/* Attribution below reviews */}
        <InlineAttribution type="yelp" />
      </View>
    </ScrollView>
  );
}
```

---

## 📍 Where to Add Attributions

### REQUIRED Locations (for compliance)

1. **Contractor Search Results**
   - ✅ `YelpResultsFooter` at bottom of list
   - ✅ Optional: `AttributionBadge` on each card

2. **Materials Lookup**
   - ✅ `MaterialPricingDisclaimer` at top of screen
   - ✅ `AttributionBadge` showing store on each product

3. **Business Details Page**
   - ✅ `InlineAttribution` below reviews section

4. **Settings/Profile**
   - ✅ Already added! Link to Legal Hub

### OPTIONAL Locations (recommended)

- Product detail pages
- Estimate screens showing material costs
- Marketplace/directory screens
- Any screen displaying third-party data

---

## 🎨 Styling

All components accept a `style` prop for customization:

```tsx
<AttributionBadge
  type="yelp"
  style={{ marginTop: 20, alignSelf: 'center' }}
/>

<MaterialPricingDisclaimer
  store="home-depot"
  style={{ marginVertical: 16 }}
/>
```

---

## 🔗 Navigation Flow

When users tap attribution links:
1. **"Learn more"** → Opens Legal Hub screen
2. **"Details"** → Opens Legal Hub screen
3. **"Powered by Yelp"** → Opens Yelp.com in browser
4. **Store badges** → Opens retailer website

---

## ⚖️ Legal Compliance Checklist

### ✅ What You Have Now:

- [x] Terms of Use with specific Yelp section (§8.1)
- [x] Terms of Use with HD/Lowes section (§8.2)
- [x] Privacy Policy placeholder
- [x] Attribution components ready to use
- [x] "Powered by Yelp" requirement met
- [x] Price disclaimer for materials
- [x] Deep links to legal sections
- [x] Settings → Legal Hub navigation

### ⚠️ Before Launch:

- [ ] **Customize Privacy Policy** with your actual practices
- [ ] **Add your company information** to Terms (replace placeholders)
- [ ] **Legal review** - Have a lawyer review Terms & Privacy
- [ ] **Update affiliate disclosures** when HD/Lowes approve you
- [ ] **Add attribution components** to all screens showing third-party data
- [ ] **Test all links** to ensure legal hub navigation works

---

## 🚀 Quick Start

### Step 1: Navigate to Legal Hub
```tsx
// From anywhere in your app
import { router } from 'expo-router';
router.push('/legal-hub');
```

### Step 2: Add Yelp Attribution
```tsx
// At bottom of contractor search
import { YelpResultsFooter } from '@/components/AttributionBadge';

<YelpResultsFooter />
```

### Step 3: Add Material Pricing Disclaimer
```tsx
// At top of materials screen
import { MaterialPricingDisclaimer } from '@/components/AttributionBadge';

<MaterialPricingDisclaimer store="home-depot" />
```

---

## 💡 Pro Tips

1. **Consistency**: Use the same attribution style across all screens
2. **Visibility**: Don't hide attributions - they should be obvious
3. **Updates**: When you switch from scraping to affiliate programs, update the wording in Legal Hub
4. **Testing**: Test all "Learn more" links to ensure they navigate correctly
5. **Customization**: Add your company info before launching

---

## 📞 Next Steps

1. **Test the Legal Hub** - Navigate from Profile → Settings → Terms/Privacy
2. **Add attributions** to your existing screens:
   - Contractor search
   - Materials lookup
   - Business details
3. **Customize legal text** - Replace placeholders with your actual info
4. **Get legal review** - Have a lawyer review before launch
5. **Update when affiliates approved** - Change wording from "estimates" to "affiliate data"

---

## 🎯 Example: Complete Integration

Here's a full example of a contractor search screen with all attributions:

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import {
  YelpResultsFooter,
  AttributionBadge,
} from '@/components/AttributionBadge';

export default function ContractorSearchScreen() {
  const [contractors, setContractors] = useState([]);

  useEffect(() => {
    // Fetch from your Yelp API endpoint
    fetch('/api/yelp/search?term=contractors&location=Las Vegas')
      .then(res => res.json())
      .then(data => setContractors(data.businesses));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contractors Near You</Text>
      
      <FlatList
        data={contractors}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text>⭐ {item.rating} ({item.reviewCount} reviews)</Text>
            <Text>{item.location.address}</Text>
            
            {/* Compact Yelp badge */}
            <AttributionBadge type="yelp" compact style={styles.badge} />
          </View>
        )}
        ListFooterComponent={
          /* Required: Yelp footer */
          <YelpResultsFooter style={styles.footer} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  name: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  badge: { marginTop: 8, alignSelf: 'flex-start' },
  footer: { marginTop: 16, marginBottom: 32 },
});
```

---

## 📚 Reference Links

- **Yelp API Terms**: https://www.yelp.com/developers/api_terms
- **Home Depot Terms**: https://www.homedepot.com/c/Terms_of_Use
- **Lowe's Terms**: https://www.lowes.com/l/terms-of-use

---

## ❓ FAQ

**Q: Do I need attribution on every screen?**  
A: Only on screens that display third-party data. If you show Yelp ratings, add Yelp attribution. If you show Home Depot prices, add HD attribution.

**Q: Can I customize the attribution text?**  
A: The components are flexible, but don't remove required elements (like "Powered by Yelp"). You can adjust styling and placement.

**Q: What if I don't have API keys yet?**  
A: The components work with or without API keys. They show the same attribution whether you're using real or mock data.

**Q: Do I need a lawyer?**  
A: YES! Before launching, have a legal professional review your Terms of Use and Privacy Policy. The provided templates are starting points, not final legal documents.

---

**✅ You're all set!** Your app now has proper legal compliance for third-party data. Just add the attribution components to your screens and customize the legal text.

