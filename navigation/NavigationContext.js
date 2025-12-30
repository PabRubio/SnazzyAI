import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const NavigationContext = createContext();

export function NavigationProvider({ children }) {
  const [showAppStack, setShowAppStack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check initial session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setShowAppStack(!!session);
      setIsLoading(false);
    });
  }, []);

  const switchToAppStack = () => {
    setShowAppStack(true);
  };

  const switchToAuthStack = () => {
    setShowAppStack(false);
  };

  return (
    <NavigationContext.Provider value={{
      isLoading,
      showAppStack,
      switchToAppStack,
      switchToAuthStack
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
