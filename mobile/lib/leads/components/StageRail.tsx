import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { c, radius } from '../ui/tokens';
import { LeadStage } from '../types';

const STAGES: LeadStage[] = ['new','verified','qualified','proposal','won'];
const LABEL: Record<LeadStage,string> = { 
  new:'New', 
  verified:'Verified', 
  qualified:'Qualified', 
  proposal:'Proposal', 
  won:'Won', 
  lost:'Lost' as any 
};

export default function StageRail({ active }: { active: LeadStage }) {
  const idx = STAGES.indexOf(active);
  return (
    <View style={styles.wrap}>
      {STAGES.map((s, i) => (
        <View key={s} style={[styles.cell, { backgroundColor: i<=idx? c.railActive : c.railTrack }]}>
          <Text style={[styles.label, { opacity: i<=idx? 1 : 0.5 }]}>{LABEL[s]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { 
    flexDirection:'row', 
    gap:10, 
    paddingHorizontal:16, 
    paddingTop:14, 
    paddingBottom:8 
  },
  cell: { 
    flex:1, 
    height:56, 
    borderRadius: radius.lg, 
    justifyContent:'center', 
    alignItems:'center' 
  },
  label: { 
    color:'#06221A', 
    fontWeight:'800' 
  },
});


