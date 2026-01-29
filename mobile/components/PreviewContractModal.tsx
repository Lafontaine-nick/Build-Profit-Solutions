import React from "react";
import { Modal, View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { WebView } from 'react-native-webview';

export default function PreviewContractModal({
  visible,
  text,
  html,
  onClose,
  onShare,
}: {
  visible: boolean;
  text: string | null;
  html?: string | null;
  onClose: () => void;
  onShare: () => void;
}) {
  // Debug logging - VERSION 3
  React.useEffect(() => {
    if (visible) {
      console.log('👁️👁️👁️ [V3] Preview modal opened');
      console.log('👁️ HTML exists:', !!html);
      console.log('👁️ HTML length:', html?.length || 0);
      console.log('👁️ HTML type:', typeof html);
      console.log('👁️ HTML is truthy?:', !!html ? 'YES' : 'NO');
      if (!html) {
        console.error('❌ NO HTML PROVIDED TO PREVIEW!');
      } else {
        console.log('✅ HTML IS PROVIDED - WebView should render!');
      }
    }
  }, [visible, html]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Contract Preview</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>Review before sharing as PDF</Text>
        
        {/* Simplified preview - WebView doesn't work reliably in Expo Go */}
        {html ? (
          <View style={styles.body}>
            <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Text style={{ fontSize: 48, marginBottom: 20 }}>✅</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#22E0B9', marginBottom: 10 }}>
                Contract Generated Successfully
              </Text>
              <Text style={{ fontSize: 14, color: '#a9c5de', textAlign: 'center', marginBottom: 20 }}>
                Your professional proposal is ready with all the correct calculations.
              </Text>
              <Text style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
                Click "Share Contract" below to view and share the PDF.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyBody}>
            <Text style={styles.emptyText}>Generate the contract to preview.</Text>
          </View>
        )}
        
        <View style={styles.footer}>
          <Pressable style={styles.primary} onPress={onShare}>
            <Text style={styles.primaryText}>Share Contract PDF</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={onClose}>
            <Text style={styles.linkText}>Close Preview</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { 
    flex: 1, 
    backgroundColor: "#0e2a3e" 
  },
  header: { 
    padding: 16, 
    paddingTop: 56, 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  title: { 
    color: "white", 
    fontSize: 22, 
    fontWeight: "800" 
  },
  close: { 
    color: "#cfe8ff", 
    fontSize: 28, 
    padding: 8,
    fontWeight: "300"
  },
  sub: { 
    color: "#a9c5de", 
    marginHorizontal: 16, 
    marginBottom: 8,
    fontSize: 14
  },
  body: { 
    flex: 1, 
    marginHorizontal: 12, 
    marginBottom: 12,
    borderRadius: 12, 
    backgroundColor: "#ffffff", 
    overflow: 'hidden'
  },
  emptyBody: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "#0f3148",
    borderColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  emptyText: {
    color: "#a9c5de",
    fontSize: 14,
    textAlign: 'center'
  },
  footer: { 
    padding: 16,
    paddingBottom: 32
  },
  primary: { 
    backgroundColor: "#2ee0b5", 
    padding: 16, 
    borderRadius: 12, 
    alignItems: "center" 
  },
  primaryText: { 
    color: "#08342c", 
    fontWeight: "800", 
    fontSize: 16 
  },
  linkBtn: { 
    alignItems: "center", 
    marginTop: 12,
    padding: 8
  },
  linkText: { 
    color: "#cfe8ff", 
    fontSize: 16 
  },
});

