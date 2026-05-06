import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import MaterialsEquipmentScreen from '../components/MaterialsEquipmentScreen';
import WebPageShell from '@/components/layout/WebPageShell';

export default function MaterialsEquipmentPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  
  // If we have a projectId, wrap in provider, otherwise use context from parent
  const content = (
    <WebPageShell size="form" scroll={false} contentStyle={{ paddingBottom: 0 }}>
    <MaterialsEquipmentScreen
      routeProjectId={typeof projectId === 'string' ? projectId : undefined}
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
