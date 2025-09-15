import React, { useEffect, useState, ReactNode } from "react";

import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { auth } from "../firebaseconfig"; // Add this import

type Props = { children: ReactNode };

export default function AuthProvider({ children }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}
