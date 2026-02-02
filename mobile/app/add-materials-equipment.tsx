import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import AddMaterialScreen from '../components/AddMaterialScreen';

export default function AddMaterialsEquipmentPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  
  const content = (
    <AddMaterialScreen 
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
