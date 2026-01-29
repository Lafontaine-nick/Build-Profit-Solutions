/**
 * INTEGRATION EXAMPLE
 * 
 * This file shows how to integrate the React PDF system into estimate-generator.jsx
 * Copy the relevant sections into your actual component.
 */

import React from 'react';
import { Alert, View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { CompleteContract } from './CompleteContract';
import { generateAndSavePdf, formatContractData } from '../../utils/pdfGenerator';

/**
 * STEP 1: Add this function to your estimate-generator.jsx
 * Place it alongside your existing handleGenerateContract function
 */
export const handleGenerateContractReactPdf = async (
  bid: any,
  user: any,
  materialsCart: any[],
  laborLineItems: any[]
) => {
  try {
    console.log('📝 Generating React PDF contract...');

    // Format data for PDF
    const contractData = formatContractData(bid, user, materialsCart, laborLineItems);

    // Generate PDF document component
    const document = <CompleteContract data={contractData} />;

    // Generate and save PDF
    const path = await generateAndSavePdf(document, {
      filename: `Contract_${contractData.contractId}.pdf`,
      autoShare: true,
    });

    console.log('✅ Contract generated successfully:', path);
    Alert.alert('Success', 'Contract generated and ready to share!');

    return path;
  } catch (error) {
    console.error('❌ Contract generation failed:', error);
    Alert.alert('Error', 'Failed to generate contract. Please try again.');
    throw error;
  }
};

/**
 * STEP 2: Update your existing button in estimate-generator.jsx
 * 
 * BEFORE:
 * <Button onPress={() => handleGenerateContract()} title="Generate Contract" />
 * 
 * AFTER:
 * <Button 
 *   onPress={() => handleGenerateContractReactPdf(bid, user, materialsCart, laborLineItems)} 
 *   title="Generate Contract (New)"
 * />
 */

/**
 * STEP 3: Or create a toggle to switch between old and new system
 */
export const ContractGeneratorButtons = ({
  bid,
  user,
  materialsCart,
  laborLineItems,
  handleGenerateContractOld,
}: any) => {
  const [useNewSystem, setUseNewSystem] = React.useState(false);

  const handleGenerate = async () => {
    if (useNewSystem) {
      await handleGenerateContractReactPdf(bid, user, materialsCart, laborLineItems);
    } else {
      await handleGenerateContractOld();
    }
  };

  return (
    <>
      {/* Toggle Switch */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text>Use New PDF System: </Text>
        <Switch value={useNewSystem} onValueChange={setUseNewSystem} />
      </View>

      {/* Generate Button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#0F766E',
          padding: 15,
          borderRadius: 8,
          alignItems: 'center',
        }}
        onPress={handleGenerate}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          Generate Contract {useNewSystem ? '(React PDF)' : '(HTML)'}
        </Text>
      </TouchableOpacity>
    </>
  );
};

/**
 * STEP 4: FULL EXAMPLE - Complete integration in estimate-generator.jsx
 */
export const EstimateGeneratorWithReactPdf = () => {
  // Your existing state...
  const [bid, setBid] = React.useState({});
  const [user, setUser] = React.useState({});
  const [materialsCart, setMaterialsCart] = React.useState([]);
  const [laborLineItems, setLaborLineItems] = React.useState([]);

  // NEW: React PDF handler
  const handleGenerateContractReactPdf = async () => {
    try {
      const contractData = formatContractData(bid, user, materialsCart, laborLineItems);
      const document = <CompleteContract data={contractData} />;
      await generateAndSavePdf(document, {
        filename: `Contract_${contractData.contractId}.pdf`,
        autoShare: true,
      });
      Alert.alert('Success', 'Contract generated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate contract');
    }
  };

  // Your existing render...
  return (
    <View>
      {/* Your existing UI */}
      
      {/* Add Generate Contract Button */}
      <TouchableOpacity
        style={styles.generateButton}
        onPress={handleGenerateContractReactPdf}
      >
        <Text style={styles.buttonText}>Generate Contract</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * STEP 5: Import statements needed at top of estimate-generator.jsx
 */
/*
import { CompleteContract } from '@/pages/pdf/CompleteContract';
import { generateAndSavePdf, formatContractData } from '@/utils/pdfGenerator';
*/

/**
 * NOTES:
 * 
 * 1. The React PDF system is more maintainable with TypeScript components
 * 2. It may require web-based rendering for full React Native compatibility
 * 3. Your existing HTML-based system (buildProposalHtml.ts) works natively in Expo
 * 4. Consider keeping both systems and letting users choose their preference
 * 5. For production, test thoroughly on both iOS and Android devices
 */

/**
 * COMPARISON:
 * 
 * Old System (buildProposalHtml.ts):
 * ✅ Native Expo support
 * ✅ Works on all devices
 * ✅ Smaller bundle size
 * ❌ String templates (harder to maintain)
 * ❌ No type safety
 * 
 * New System (React PDF):
 * ✅ Type-safe components
 * ✅ Reusable React components
 * ✅ Better developer experience
 * ⚠️ May need web rendering bridge
 * ⚠️ Larger bundle size (~200KB)
 */

const styles = StyleSheet.create({
  generateButton: {
    backgroundColor: '#0F766E',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});



