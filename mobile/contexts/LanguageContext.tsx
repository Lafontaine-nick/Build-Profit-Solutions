import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LanguageContextType {
  currentLanguage: string;
  changeLanguage: (language: string) => Promise<void>;
  t: (key: string, options?: any) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = '@app_language';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t, i18n: i18nInstance } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState('en');

  useEffect(() => {
    const ensureEnglish = async () => {
      try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
        if (i18nInstance.language !== 'en') {
          await i18nInstance.changeLanguage('en');
        }
        setCurrentLanguage('en');
      } catch (error) {
        console.error('Error ensuring English locale:', error);
      }
    };
    void ensureEnglish();
  }, [i18nInstance]);

  const changeLanguage = async (_language: string) => {
    try {
      await i18nInstance.changeLanguage('en');
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
      setCurrentLanguage('en');
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
