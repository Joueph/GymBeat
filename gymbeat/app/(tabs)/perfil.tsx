import React from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { auth } from "../../firebaseconfig";
import { signOut } from "firebase/auth";
import { useAuth } from "../authprovider";

export default function PerfilScreen() {
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // A navegação será tratada pelo _layout ao detectar a mudança no estado de autenticação.
    } catch (error: any) {
      Alert.alert("Erro ao Sair", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      {user ? (
        <Text style={styles.emailText}>Logado como: {user.email}</Text>
      ) : (
        <Text style={styles.emailText}>Não está logado.</Text>
      )}
      <Button title="Sair" onPress={handleSignOut} color="#f44336" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#0d181c",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#fff", marginBottom: 20 },
  emailText: { fontSize: 16, color: "#ccc", marginBottom: 20 },
});
