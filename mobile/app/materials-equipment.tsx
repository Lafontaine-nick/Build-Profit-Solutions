import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import MaterialsEquipmentScreen from '../components/MaterialsEquipmentScreen';

export default function MaterialsEquipmentPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  
  // If we have a projectId, wrap in provider, otherwise use context from parent
  const content = (
    <MaterialsEquipmentScreen 
      navigation={{
        goBack: () => router.back()
      }} 
    />
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
