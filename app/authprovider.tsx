import { onAuthStateChanged, User } from "firebase/auth";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth } from "../firebaseConfig";

export type AuthContextType = {
  user: User | null;
  initialized: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  initialized: false,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // This listener is called whenever the user's sign-in state changes.
      setUser(currentUser);
      setInitialized(true); // Set initialized to true once we get the first auth status.
      setLoading(false); // The initial auth check is complete.
    });
    return unsubscribe; // Unsubscribe from the listener when the component unmounts.
  }, []);

  return (
    <AuthContext.Provider value={{ user, initialized, loading }}>
      {children}
    </AuthContext.Provider>
  );
}