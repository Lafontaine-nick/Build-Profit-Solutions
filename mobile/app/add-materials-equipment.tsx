import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import AddMaterialScreen from '../components/AddMaterialScreen';
import WebPageShell from '@/components/layout/WebPageShell';

export default function AddMaterialsEquipmentPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  
  const content = (
    <WebPageShell size="form" scroll={false} contentStyle={{ paddingBottom: 0 }}>
    <AddMaterialScreen 
      navigation={{
        goBack: () => router.back()
      }}
    />
    </WebPageShell>
  );
  
  if (projectId) {
    return (
      <ProjectDataProvider projectId={projectId}>
        {content}
      </ProjectDataProvider>
    );
  }
  
  return content;
}
