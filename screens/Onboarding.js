import React from 'react';
import { OnboardingProvider } from '../onboarding/OnboardingContext';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import BirthScreen from '../onboarding/BirthScreen';
import GenderScreen from '../onboarding/GenderScreen';
import MeasurementsScreen from '../onboarding/MeasurementsScreen';
import LocationScreen from '../onboarding/LocationScreen';
import CurrencyPriceScreen from '../onboarding/CurrencyPriceScreen';
import ClothingSizesScreen from '../onboarding/ClothingSizesScreen';
import FavoriteBrandsScreen from '../onboarding/FavoriteBrandsScreen';
import FavoriteStylesScreen from '../onboarding/FavoriteStylesScreen';
import ValueProp1Screen from '../onboarding/ValueProp1Screen';
import ValueProp2Screen from '../onboarding/ValueProp2Screen';
import ValueProp3Screen from '../onboarding/ValueProp3Screen';
import Questionnaire1Screen from '../onboarding/Questionnaire1Screen';
import Questionnaire2Screen from '../onboarding/Questionnaire2Screen';
import Questionnaire3Screen from '../onboarding/Questionnaire3Screen';
import TrialExplainerScreen from '../onboarding/TrialExplainerScreen';
import FreeTrialScreen from '../onboarding/FreeTrialScreen';
import PaywallScreen from '../onboarding/PaywallScreen';

const OnboardingStack = createStackNavigator();

export default function OnboardingNavigator() {
  return (
    <OnboardingProvider>
      <OnboardingStack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animationEnabled: false,
        cardStyleInterpolator: () => ({}),
        cardStyle: { backgroundColor: '#fff' }
      }}
    >
      <OnboardingStack.Screen
        name="OnboardingQuestionnaire1"
        component={Questionnaire1Screen}
      />
      <OnboardingStack.Screen
        name="OnboardingValueProp1"
        component={ValueProp1Screen}
      />
      <OnboardingStack.Screen
        name="OnboardingBirth"
        component={BirthScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingGender"
        component={GenderScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingLocation"
        component={LocationScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingMeasurements"
        component={MeasurementsScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingQuestionnaire2"
        component={Questionnaire2Screen}
      />
      <OnboardingStack.Screen
        name="OnboardingValueProp2"
        component={ValueProp2Screen}
      />
      <OnboardingStack.Screen
        name="OnboardingCurrencyPrice"
        component={CurrencyPriceScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingClothingSizes"
        component={ClothingSizesScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingFavoriteStyles"
        component={FavoriteStylesScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingFavoriteBrands"
        component={FavoriteBrandsScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingQuestionnaire3"
        component={Questionnaire3Screen}
      />
      <OnboardingStack.Screen
        name="OnboardingValueProp3"
        component={ValueProp3Screen}
      />
      <OnboardingStack.Screen
        name="OnboardingTrialExplainer"
        component={TrialExplainerScreen}
      />
      <OnboardingStack.Screen
        name="OnboardingFreeTrial"
        component={FreeTrialScreen}
        options={{
          animationEnabled: false,
          gestureEnabled: false,
          cardStyle: { backgroundColor: '#3a3b3c' }
        }}
      />
      <OnboardingStack.Screen
        name="OnboardingPaywall"
        component={PaywallScreen}
        options={{
          animationEnabled: true,
          gestureEnabled: false,
        }}
      />
      </OnboardingStack.Navigator>
    </OnboardingProvider>
  );
}
