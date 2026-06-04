import { FontAwesome } from "@expo/vector-icons";
import appleAuth from '@invertase/react-native-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter } from "expo-router";
import { GoogleAuthProvider, OAuthProvider, sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword, User } from "firebase/auth";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, LayoutAnimation, Platform, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from "react-native";
import { auth, db } from "../../firebaseconfig";
// import { createUserProfileDocument, getUserProfile } from "../../userService";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { Ficha } from "../../models/ficha";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Configuração do Google Sign-In
GoogleSignin.configure({
  webClientId: '418244836174-0e2ch7p0rjdg58d1hcghn135munqat75.apps.googleusercontent.com',
});

/**
 * Renders email, Google, and Apple login flows, including pending onboarding ficha setup.
 * @returns Login screen with credential and social-auth actions.
 */
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState(""); // Estado para feedback
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Social/Email choice, Step 2: Email credentials

  // Função para criar o perfil do usuário se ele não existir (após login social)
  // const checkAndCreateUserProfile = async (user: any) => {
  //   const userProfile = await getUserProfile(user.uid);
  //   if (!userProfile) {
  //     // Usuário está logando pela primeira vez, cria um perfil básico
  //     await createUserProfileDocument(user, {
  //       nome: user.displayName || user.email?.split('@')[0] || 'Novo Usuário',
  //       photoURL: user.photoURL || '',
  //       isPro: false,
  //       // Outros campos podem ser definidos como `undefined` ou com valores padrão
  //       altura: undefined,
  //       peso: undefined,
  //       genero: undefined,
  //       nivel: 'Iniciante',
  //       streakGoal: 3,
  //       weeksStreakGoal: 4,
  //     });
  //   }
  // };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      await GoogleSignin.hasPlayServices();
      const signInResponse = await GoogleSignin.signIn();
      const idToken = signInResponse.data?.idToken;

      if (!idToken) throw new Error("Google Sign-In: idToken não encontrado.");

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);

      // Checa se tem ficha pendente
      await checkAndAssignPendingFicha(userCredential.user);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Falha no login com Google. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      const { identityToken } = appleAuthRequestResponse;
      if (!identityToken) throw new Error("Apple Sign-In: identityToken não encontrado.");
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: identityToken });
      const userCredential = await signInWithCredential(auth, credential);

      await checkAndAssignPendingFicha(userCredential.user);
    } catch (error: any) {
      if ((error as any).code !== '1001') setErrorMessage("Falha no login com Apple. Tente novamente.");
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    setErrorMessage(""); // limpa mensagens anteriores
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // Após o login, verifica se há uma ficha pendente do onboarding
      await checkAndAssignPendingFicha(user);

    } catch (error: any) {
      setErrorMessage(error.message); // atualiza feedback
      Alert.alert("Erro ao entrar", transformAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleContinueWithEmail = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(2);
  };

  const handleBackToStep1 = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(1);
    setErrorMessage("");
  };

  // Helper function to make error messages more user-friendly
  const transformAuthError = (error: any) => {
    // Prioritize error code if available
    const code = error.code || "";
    const message = error.message || "";

    if (code === "auth/user-not-found" || message.includes("auth/user-not-found")) {
      return "Usuário não encontrado.";
    }
    if (code === "auth/wrong-password" || message.includes("auth/wrong-password")) {
      return "Senha incorreta.";
    }
    if (code === "auth/invalid-credential" || message.includes("auth/invalid-credential")) {
      return "Email ou senha incorretos.";
    }
    if (code === "auth/invalid-email" || message.includes("auth/invalid-email")) {
      return "O formato do email é inválido.";
    }
    if (code === "auth/too-many-requests" || message.includes("auth/too-many-requests")) {
      return "Muitas tentativas. Tente novamente mais tarde.";
    }

    return "Ocorreu um erro. Verifique suas credenciais.";
  };

  const checkAndAssignPendingFicha = async (user: User) => {
    try {
      const statsRef = doc(db, 'estatisticasOnboarding', user.uid);
      const statsSnap = await getDoc(statsRef);

      if (statsSnap.exists()) {
        const statsData = statsSnap.data();

        // Verifica se o usuário aceitou a ficha recomendada durante o onboarding
        if (statsData.acceptedFicha && statsData.recommendedFicha) {
          // Importa os serviços necessários
          const { copyFichaModeloToUser, setFichaAtiva } = require('../../services/fichaService'); // Renomeado para evitar conflito
          const { getTreinosByIds } = require('../../services/treinoService');
          const { cacheFichaCompleta, cacheFichaAtiva, cacheUserSession } = require('../../services/offlineCacheService');

          // Copia a ficha e os treinos para o usuário
          const newFichaId = await copyFichaModeloToUser(statsData.recommendedFicha, user.uid, statsData.recommendedTreinos);

          // Define a nova ficha como ativa
          const fichaAtivada: Ficha | null = await setFichaAtiva(user.uid, newFichaId);

          // Busca os treinos recém-criados e salva tudo no cache para uso offline
          const treinosRecemCriados = await getTreinosByIds(fichaAtivada?.treinos || []);
          await cacheFichaCompleta(fichaAtivada, treinosRecemCriados);
          await cacheFichaAtiva(fichaAtivada); // Salva a ficha ativa em cache

          // Limpa os dados do onboarding para não processar novamente
          const batch = writeBatch(db);
          batch.delete(statsRef);
          await batch.commit();
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message); // atualiza feedback
      // Not showing alert here to avoid spamming if it's a background process error, but logging it.
      console.log("Error checking pending ficha:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      Alert.alert("Redefinir Senha", "Por favor, digite seu e-mail no campo correspondente para receber o link de redefinição.");
      return;
    }
    setErrorMessage("");
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert("Verifique seu E-mail", "Um link para redefinir sua senha foi enviado para o seu e-mail.");
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setErrorMessage("Nenhum usuário encontrado com este e-mail.");
      } else {
        setErrorMessage("Ocorreu um erro ao tentar enviar o e-mail de redefinição.");
      }
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => {
          if (step === 2) {
            handleBackToStep1();
          } else {
            router.back();
          }
        }}
      >
        <FontAwesome name="chevron-left" size={24} color="#fff" />
      </TouchableOpacity>
      <Image
        source={require("../../assets/images/icon.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>GymBeat</Text>

      {step === 1 ? (
        <>
          <View style={styles.socialButtonsContainer}>
            <TouchableOpacity style={[styles.socialButton, styles.googleButton]} onPress={handleGoogleSignIn} disabled={loading}>
              <FontAwesome name="google" size={20} color="#fff" />
              <Text style={styles.socialButtonText}>Entrar com Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity style={[styles.socialButton, styles.appleButton]} onPress={handleAppleSignIn} disabled={loading}>
                <FontAwesome name="apple" size={20} color="#000" />
                <Text style={[styles.socialButtonText, { color: '#000' }]}>Entrar com Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OU</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.emailButton} onPress={handleContinueWithEmail} disabled={loading}>
            <FontAwesome name="envelope" size={20} color="#fff" />
            <Text style={styles.socialButtonText}>Continuar com E-mail</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.formContainer}>
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

          <TouchableOpacity style={styles.forgotPasswordButton} onPress={handlePasswordReset}>
            <Text style={styles.forgotPasswordText}>Esqueceu sua senha?</Text>
          </TouchableOpacity>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {errorMessage && step === 1 ? <Text style={styles.error}>{errorMessage}</Text> : null}

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
  registerButton: {
    position: "absolute",
    top: 60,
    left: 20,
    padding: 10,
    zIndex: 10,
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
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    width: "100%",
    backgroundColor: "#141414",
    color: "#fff",
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#1cb0f6",
    height: 65,
  },
  forgotPasswordButton: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#1cb0f6',
    fontSize: 14,
  },
  loginButton: {
    width: "100%",
    backgroundColor: "#1cb0f6",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  error: {
    color: "#ff5555",
    marginTop: 15,
    textAlign: "center",
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#888',
    marginHorizontal: 10,
    fontWeight: 'bold',
  },
  socialButtonsContainer: {
    width: '100%',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#555',
    backgroundColor: '#141414',
  },
  googleButton: { borderColor: '#555', backgroundColor: '#141414' },
  appleButton: { borderColor: '#fff', backgroundColor: '#fff' },
  socialButtonText: {
    color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 15,
  },
});
