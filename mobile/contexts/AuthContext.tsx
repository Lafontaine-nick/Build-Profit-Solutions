import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UserProfile {
  name: string;
  role: string;
  company: string;
  region: string;
}

interface AuthContextType {
  user: string | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => void;
  signup: (email: string, password: string) => void;
  logout: () => void;
  updateProfile: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const login = (email: string, password: string) => {
    setUser(email); // Mock login
  };

  const signup = (email: string, password: string) => {
    setUser(email); // Mock signup
  };

  const logout = () => {
    setUser(null);
    setProfile(null);
  };

  const updateProfile = (profileData: UserProfile) => {
    setProfile(profileData);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, login, signup, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
