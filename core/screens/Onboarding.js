import { createStackNavigator } from "@react-navigation/stack";
import React from "react";

import BirthScreen from "../onboarding/BirthScreen";
import ClothingSizesScreen from "../onboarding/ClothingSizesScreen";
import CurrencyPriceScreen from "../onboarding/CurrencyPriceScreen";
import FavoriteBrandsScreen from "../onboarding/FavoriteBrandsScreen";
import FavoriteStylesScreen from "../onboarding/FavoriteStylesScreen";
import FreeTrialScreen from "../onboarding/FreeTrialScreen";
import GenderScreen from "../onboarding/GenderScreen";
import LocationScreen from "../onboarding/LocationScreen";
import MeasurementsScreen from "../onboarding/MeasurementsScreen";
import { OnboardingProvider } from "../onboarding/OnboardingContext";
import PaywallScreen from "../onboarding/PaywallScreen";
import Questionnaire1Screen from "../onboarding/Questionnaire1Screen";
import Questionnaire2Screen from "../onboarding/Questionnaire2Screen";
import Questionnaire3Screen from "../onboarding/Questionnaire3Screen";
import TrialExplainerScreen from "../onboarding/TrialExplainerScreen";
import ValueProp1Screen from "../onboarding/ValueProp1Screen";
import ValueProp2Screen from "../onboarding/ValueProp2Screen";
import ValueProp3Screen from "../onboarding/ValueProp3Screen";

const OnboardingStack = createStackNavigator();

export default function OnboardingNavigator() {
  return (
    <OnboardingProvider>
      <OnboardingStack.Navigator
        screenOptions={{
          animationEnabled: false,
          cardStyle: { backgroundColor: "#fff" },
          cardStyleInterpolator: () => ({}),
          gestureEnabled: false,
          headerShown: false,
        }}
      >
        <OnboardingStack.Screen
          component={Questionnaire1Screen}
          name="OnboardingQuestionnaire1"
        />
        <OnboardingStack.Screen
          component={ValueProp1Screen}
          name="OnboardingValueProp1"
        />
        <OnboardingStack.Screen
          component={BirthScreen}
          name="OnboardingBirth"
        />
        <OnboardingStack.Screen
          component={GenderScreen}
          name="OnboardingGender"
        />
        <OnboardingStack.Screen
          component={LocationScreen}
          name="OnboardingLocation"
        />
        <OnboardingStack.Screen
          component={MeasurementsScreen}
          name="OnboardingMeasurements"
        />
        <OnboardingStack.Screen
          component={Questionnaire2Screen}
          name="OnboardingQuestionnaire2"
        />
        <OnboardingStack.Screen
          component={ValueProp2Screen}
          name="OnboardingValueProp2"
        />
        <OnboardingStack.Screen
          component={CurrencyPriceScreen}
          name="OnboardingCurrencyPrice"
        />
        <OnboardingStack.Screen
          component={ClothingSizesScreen}
          name="OnboardingClothingSizes"
        />
        <OnboardingStack.Screen
          component={FavoriteStylesScreen}
          name="OnboardingFavoriteStyles"
        />
        <OnboardingStack.Screen
          component={FavoriteBrandsScreen}
          name="OnboardingFavoriteBrands"
        />
        <OnboardingStack.Screen
          component={Questionnaire3Screen}
          name="OnboardingQuestionnaire3"
        />
        <OnboardingStack.Screen
          component={ValueProp3Screen}
          name="OnboardingValueProp3"
        />
        <OnboardingStack.Screen
          component={TrialExplainerScreen}
          name="OnboardingTrialExplainer"
        />
        <OnboardingStack.Screen
          component={FreeTrialScreen}
          name="OnboardingFreeTrial"
          options={{
            animationEnabled: false,
            cardStyle: { backgroundColor: "#3a3b3c" },
            cardStyleInterpolator: () => ({}),
          }}
        />
        <OnboardingStack.Screen
          component={PaywallScreen}
          name="OnboardingPaywall"
          options={{
            animationEnabled: true,
            gestureEnabled: false,
          }}
        />
      </OnboardingStack.Navigator>
    </OnboardingProvider>
  );
}
