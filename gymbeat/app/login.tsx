import React, { useState } from "react";
import { View, Text, Button, TextInput, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { auth } from "../firebaseconfig";
import { signInWithEmailAndPassword } from "firebase/auth";

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
        source={require("../assets/images/logo.jpg")}
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

      <Button title="Entrar" onPress={handleLogin} color="#4CAF50" />

      <View style={{ marginTop: 20 }}>
        <Button
          title="Ir para Cadastro"
          onPress={() => router.push("./cadastro")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d181c",
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
    backgroundColor: "#173F5F",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  error: {
    color: "#ff5555",
    marginBottom: 15,
    textAlign: "center",
  },
});