import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { safeAsyncStorage } from '../utils/asyncStorage';

export type UserRole = 'contractor' | 'creator' | 'admin';

export interface UserRoleData {
  role: UserRole;
  userId: string;
  permissions: string[];
  preferences: {
    notifications: boolean;
    emailUpdates: boolean;
    smsAlerts: boolean;
  };
}

interface UserRoleContextType {
  userRole: UserRole | null;
  userRoleData: UserRoleData | null;
  isLoading: boolean;
  setUserRole: (role: UserRole) => void;
  setUserRoleData: (data: UserRoleData) => void;
  clearUserRole: () => void;
  hasPermission: (permission: string) => boolean;
  isContractor: boolean;
  isCreator: boolean;
  isAdmin: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(
  undefined
);

interface UserRoleProviderProps {
  children: ReactNode;
}

export const UserRoleProvider: React.FC<UserRoleProviderProps> = ({
  children,
}) => {
  const [userRole, setUserRoleState] = useState<UserRole | null>(null);
  const [userRoleData, setUserRoleDataState] = useState<UserRoleData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load user role from storage on mount
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const storedRole = await safeAsyncStorage.getItem('userRole');
        const storedData = await safeAsyncStorage.getItem('userRoleData');

        if (storedRole) {
          setUserRoleState(storedRole as UserRole);
        }

        if (storedData) {
          setUserRoleDataState(JSON.parse(storedData));
        }
      } catch (error) {
        console.warn('Error loading user role:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserRole();
  }, []);

  const setUserRole = async (role: UserRole) => {
    try {
      setUserRoleState(role);
      await safeAsyncStorage.setItem('userRole', role);
    } catch (error) {
      console.warn('Error saving user role:', error);
    }
  };

  const setUserRoleData = async (data: UserRoleData) => {
    try {
      setUserRoleDataState(data);
      await safeAsyncStorage.setItem('userRoleData', JSON.stringify(data));
    } catch (error) {
      console.warn('Error saving user role data:', error);
    }
  };

  const clearUserRole = async () => {
    try {
      setUserRoleState(null);
      setUserRoleDataState(null);
      await safeAsyncStorage.removeItem('userRole');
      await safeAsyncStorage.removeItem('userRoleData');
    } catch (error) {
      console.warn('Error clearing user role:', error);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!userRoleData) return false;
    return userRoleData.permissions.includes(permission);
  };

  const isContractor = userRole === 'contractor';
  const isCreator = userRole === 'creator';
  const isAdmin = userRole === 'admin';

  const value: UserRoleContextType = {
    userRole,
    userRoleData,
    isLoading,
    setUserRole,
    setUserRoleData,
    clearUserRole,
    hasPermission,
    isContractor,
    isCreator,
    isAdmin,
  };

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = (): UserRoleContextType => {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
};
