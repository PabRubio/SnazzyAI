import React, { createContext, useContext, useState } from 'react';

const OnboardingContext = createContext();

const INITIAL_STATE = {
  birth: null,
  gender: null,
  height: '',
  weight: '',
  location: '',
  currency: null,
  priceMin: '',
  priceMax: '',
  shirtSize: null,
  pantsSize: null,
  shoeSize: null,
  favoriteBrands: [],
  favoriteStyles: [],
  questionnaire1: null,
  questionnaire2: null,
  questionnaire3: null,
};

export function OnboardingProvider({ children }) {
  const [data, setData] = useState(INITIAL_STATE);

  const updateData = (newData) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const resetData = () => {
    setData(INITIAL_STATE);
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData, resetData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
