import {
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import { registerRootComponent } from "expo";
import { ActivityIndicator, View } from "react-native";

import AppNavigator from "./core/components/navigation/Navigator";

function Navigator() {
  const [fontsLoaded] = useFonts({
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AppNavigator />;
}

registerRootComponent(Navigator);
