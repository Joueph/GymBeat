import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import { Button, Image, StyleSheet, Text, TextInput, View } from "react-native";
import { auth } from "../firebaseconfig";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState(""); // Estado para feedback

  const handleLogin = async () => {
    setErrorMessage(""); // limpa mensagens anteriores
    try {
      // A navegação após o login é gerenciada globalmente pelo _layout.tsx.
      // Apenas realizamos o login aqui.
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (error: any) {
      setErrorMessage(error.message); // atualiza feedback
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.logo}
        resizeMode="stretch"
      />
      <Text style={styles.title}>GymBeat</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#ccc"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#ccc"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    
      <Button title="Entrar" onPress={handleLogin} color="#1cb0f6" />

      <View style={{ marginTop: 20 }}>
        <Button
          title="Ir para Cadastro"
          color="#555"
          onPress={() => router.push("./cadastro")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030405",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 30,
  },
  input: {
    width: "100%",
    backgroundColor: "#141414",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#1cb0f6",
    height: 65,
  },
  error: {
    color: "#ff5555",
    marginBottom: 15,
    textAlign: "center",
  },
});