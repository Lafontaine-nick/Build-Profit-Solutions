import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ProjectItem {
  id: string;
  type: 'Material' | 'Labor';
  name: string;
  supplier: string;
  price: number;
  location: string;
  inflationAdjusted: number;
  forecast: string;
}

interface ProjectContextType {
  selectedItems: ProjectItem[];
  addItem: (item: ProjectItem) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [selectedItems, setSelectedItems] = useState<ProjectItem[]>([]);

  const addItem = (item: ProjectItem) => {
    setSelectedItems(prev =>
      prev.find(i => i.id === item.id) ? prev : [...prev, item]
    );
  };

  const removeItem = (id: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== id));
  };

  const clearItems = () => setSelectedItems([]);

  return (
    <ProjectContext.Provider
      value={{ selectedItems, addItem, removeItem, clearItems }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context)
    throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
