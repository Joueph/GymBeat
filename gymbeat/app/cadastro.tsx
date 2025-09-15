// app/cadastro.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { auth } from "../firebaseconfig";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function CadastroScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleCadastro = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, senha);
      alert("Conta criada com sucesso!");
      router.replace("/(tabs)"); // vai direto para home
    } catch (error: any) {
      alert("Erro: " + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Criar Conta</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
        style={styles.input}
      />

      <Button title="Cadastrar" onPress={handleCadastro} />
      <Button title="Voltar ao Login" onPress={() => router.push("/login")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
});
