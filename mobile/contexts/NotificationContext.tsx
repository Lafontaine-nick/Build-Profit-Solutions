import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import InAppNotification, { InAppNotificationData } from '@/components/InAppNotification';
import notificationEmitter from '@/utils/notificationEmitter';

interface NotificationContextType {
  showNotification: (notification: InAppNotificationData) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  showNotification: () => {},
  hideNotification: () => {},
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notification, setNotification] = useState<InAppNotificationData | null>(null);

  // Listen for notifications from the notification service
  useEffect(() => {
    const handleNotification = (data: any) => {
      setNotification({
        title: data.title,
        body: data.body,
        type: data.type || 'info',
        data: data.data,
        icon: data.icon,
        iconType: data.iconType,
        onPress: data.onPress,
        duration: data.duration,
        id: `notification-${Date.now()}`,
      });
    };

    notificationEmitter.on('notification', handleNotification);

    return () => {
      notificationEmitter.off('notification', handleNotification);
    };
  }, []);

  const showNotification = useCallback((data: InAppNotificationData) => {
    setNotification({
      ...data,
      id: data.id || `notification-${Date.now()}`,
    });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification((current) => {
      if (current?.onDismiss) {
        try {
          current.onDismiss();
        } catch (e) {
          if (__DEV__) console.warn('Notification onDismiss failed', e);
        }
      }
      return null;
    });
  }, []);

  const handleNotificationPress = useCallback(() => {
    if (notification?.onPress) {
      notification.onPress();
    }
  }, [notification]);

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      <InAppNotification
        notification={notification}
        onDismiss={hideNotification}
        onPress={handleNotificationPress}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
