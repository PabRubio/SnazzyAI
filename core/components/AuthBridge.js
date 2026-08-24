import { useSuperwall, useUser } from "expo-superwall";
import { useEffect, useRef } from "react";

import { supabase } from "../../supabase/services/supabase";

export default function SuperwallIdentity() {
  const { identify, signOut, update } = useUser();
  const isConfigured = useSuperwall((state) => state.isConfigured);
  const superwallRef = useRef({ identify, signOut, update });

  superwallRef.current = { identify, signOut, update };

  useEffect(() => {
    if (!isConfigured) return;

    const syncUser = async (user) => {
      if (!user) {
        await superwallRef.current.signOut();
        return;
      }

      await superwallRef.current.identify(user.id);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!profile) return;

      await superwallRef.current.update({
        email: profile.email,
        name: profile.name,
      });
    };

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) throw error;
        return syncUser(session?.user);
      })
      .catch(() => {});

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void superwallRef.current.signOut().catch(() => {});
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void syncUser(session?.user).catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, [isConfigured]);

  return null;
}
