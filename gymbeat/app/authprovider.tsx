import React, {
  useEffect,
  useState,
  ReactNode,
  createContext,
  useContext,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { ActivityIndicator, View } from "react-native";
import { auth } from "../firebaseconfig";

type AuthContextType = {
  user: User | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  initialized: false,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!initialized) {
        setInitialized(true);
      }
    });

    return () => unsubscribe();
  }, [initialized]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}