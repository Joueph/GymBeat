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

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // This listener is called whenever the user's sign-in state changes.
      setUser(currentUser);
      setInitialized(true); // Set initialized to true once we get the first auth status.
    });
    return unsubscribe; // Unsubscribe from the listener when the component unmounts.
  }, []);

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