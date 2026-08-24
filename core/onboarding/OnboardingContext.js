import React, { createContext, useContext, useState } from "react";

const OnboardingContext = createContext();

const INITIAL_STATE = {
  birth: null,
  currency: "USD",
  favoriteBrands: [],
  favoriteStyles: [],
  gender: null,
  height: "",
  location: "",
  pantsSize: null,
  priceMax: "",
  priceMin: "",
  questionnaire1: null,
  questionnaire2: null,
  questionnaire3: null,
  shirtSize: null,
  shoeSize: null,
  weight: "",
};

export function OnboardingProvider({ children }) {
  const [data, setData] = useState(INITIAL_STATE);

  const updateData = (updates) => {
    setData((previousData) => ({ ...previousData, ...updates }));
  };

  const resetData = () => {
    setData(INITIAL_STATE);
  };

  return (
    <OnboardingContext.Provider value={{ data, resetData, updateData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
