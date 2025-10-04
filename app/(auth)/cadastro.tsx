// app/(auth)/cadastro.tsx
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from "../../firebaseconfig";
import { uploadImageAndGetURL } from '../../services/storageService'; // Assumimos que esta função existe
import { createUserProfileDocument } from "../../userService"; // Assumimos que esta função aceita os novos campos

const ProgressBar = ({ progress }: { progress: number }) => (
  <View style={styles.progressBarContainer}>
    <View style={[styles.progressBar, { width: `${progress}%` }]} />
  </View>
);

export default function CadastroScreen() {
  const router = useRouter();
  const TOTAL_FORM_STEPS = 5; // nome, dados, nivel, foto, credenciais

  const [step, setStep] = useState(0); // 0: Welcome, 1-5: Form steps

  // Dados do usuário
  const [nome, setNome] = useState("");
  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");
  const [genero, setGenero] = useState<'Masculino' | 'Feminino' | 'Outro' | null>(null);
  const [nivel, setNivel] = useState<'Iniciante' | 'Intermediário' | 'Avançado' | null>(null);
  const [photoURI, setPhotoURI] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const isCredentialsValid = email.trim().length > 5 && email.includes('@') && senha.length >= 6 && senha === confirmarSenha;

  const handleNext = () => {
    if (step <= TOTAL_FORM_STEPS) {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(s => s - 1);
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permissão necessária", "Você precisa permitir o acesso à galeria para escolher uma foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setPhotoURI(result.assets[0].uri);
    }
  };

  const handleCadastro = async () => {
    if (!email.trim() || !senha.trim()) {
      Alert.alert("Erro", "E-mail e senha são obrigatórios.");
      return;
    }
    if (senha !== confirmarSenha) {
      Alert.alert("Erro", "As senhas não coincidem.");
      return;
    }
    try {
      setIsLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      let photoURL: string | undefined = undefined;
      if (photoURI) {
        photoURL = await uploadImageAndGetURL(photoURI, user.uid);
      }

      const alturaNum = Number(altura);
      const pesoNum = Number(peso);

      // Cria o documento de perfil no Firestore com todos os dados coletados.
      // A função `createUserProfileDocument` precisará ser adaptada para aceitar estes campos.
      await createUserProfileDocument(user, {
        nome: nome || '',
        isPro: false,
        altura: !isNaN(alturaNum) && alturaNum > 0 ? alturaNum : undefined,
        peso: !isNaN(pesoNum) && pesoNum > 0 ? pesoNum : undefined,
        genero: genero || undefined,
        nivel: nivel || undefined,
        photoURL: photoURL || '',
      });

      setIsLoading(false);
      Alert.alert("Sucesso!", "Conta criada com sucesso!");
      // O AuthProvider e o _layout irão redirecionar o usuário para a tela principal.
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert("Erro no Cadastro", error.message);
    }
  };

  // Renderiza o conteúdo da etapa atual
  const renderStepContent = () => {
    switch (step) {
      case 0: // Tela de Boas-vindas
        return (
          <View style={styles.welcomeContainer}>
            <SafeAreaView style={styles.welcomeHeader}>
              <Image source={require('../../assets/images/Frame 40.png')} style={styles.headerImage} />
            </SafeAreaView>

            <Image
              source={require('../../assets/images/onboarding/Before-start.png')}
              style={styles.welcomeImage}
            />
            <View style={styles.welcomeBottomContent}>
              <Text style={styles.title}>Faça com que a academia se torne um vício</Text>
              <View style={styles.welcomeButtonContainer}>
                <TouchableOpacity style={styles.welcomePrimaryButton} onPress={handleNext}>
                  <Text style={styles.welcomePrimaryButtonText}>Vamos começar seu cadastro</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/login")}>
                  <Text style={styles.welcomeSecondaryButtonText}>Já tenho uma conta (Login)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case 1: // Nome
        return <TextInput placeholder="Seu nome" value={nome} onChangeText={setNome} style={styles.input} placeholderTextColor="#ccc" />;
      case 2: // Medidas e Gênero
        return (
          <>
            <TextInput placeholder="Altura (cm)" value={altura} onChangeText={setAltura} style={styles.input} keyboardType="numeric" placeholderTextColor="#ccc" />
            <TextInput placeholder="Peso (kg)" value={peso} onChangeText={setPeso} style={styles.input} keyboardType="numeric" placeholderTextColor="#ccc" />
            <Text style={styles.label}>Gênero</Text>
            <View style={styles.optionContainer}>
              {(['Masculino', 'Feminino', 'Outro'] as const).map(g => (
                <TouchableOpacity key={g} style={[styles.optionButton, genero === g && styles.optionSelected]} onPress={() => setGenero(g)}>
                  <Text style={styles.optionText}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case 3: // Nível
        const niveis = [
          { label: 'Iniciante', description: 'Treino faz menos de 1 ano e meio' },
          { label: 'Intermediário', description: 'Treino de 1 ano e meio a 3 anos' },
          { label: 'Avançado', description: 'Já treino a mais de 3 anos' },
        ] as const;

        return (
          <View style={styles.optionContainerVertical}>
            {niveis.map(n => (
              <TouchableOpacity key={n.label} style={[styles.optionButton, nivel === n.label && styles.optionSelected]} onPress={() => setNivel(n.label)}>
                <Text style={styles.optionText}>{n.label}</Text>
                <Text style={styles.optionDescription}>{n.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      case 4: // Foto
        return (
          <>
            <TouchableOpacity disabled style={styles.pfpContainer}>
              <View style={styles.pfpPlaceholder}>
                <FontAwesome name="camera" size={40} color="#555" />
              </View>
            </TouchableOpacity>
            <Text style={styles.pfpSubtext}>Função para adicionar foto de perfil em breve</Text>
          </>
        );
      case 5: // Credenciais
        return (
          <>
            <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#ccc" />
            <TextInput placeholder="Senha (mínimo 6 caracteres)" secureTextEntry value={senha} onChangeText={setSenha} style={styles.input} placeholderTextColor="#ccc" />
            <TextInput placeholder="Confirme a senha" secureTextEntry value={confirmarSenha} onChangeText={setConfirmarSenha} style={styles.input} placeholderTextColor="#ccc" />
            <TouchableOpacity
              style={[styles.finalButton, { backgroundColor: isCredentialsValid ? '#1cb0f6' : '#555' }]}
              onPress={handleCadastro}
              disabled={!isCredentialsValid}
            >
              <Text style={styles.finalButtonText}>Finalizar Cadastro</Text>
            </TouchableOpacity>
          </>
        );
      default: return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return "Como podemos te chamar?";
      case 2: return "Nos conte um pouco sobre você";
      case 3: return "Qual seu nível na academia?";
      case 4: return "Adicione uma foto de perfil";
      case 5: return "Crie sua conta";
      default: return "";
    }
  };

  const progress = step > 0 ? (step / TOTAL_FORM_STEPS) * 100 : 0;

  if (isLoading) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  if (step === 0) {
    // A tela de boas-vindas não usa SafeAreaView para a imagem cobrir a tela toda.
    return <View style={styles.welcomeScreenContainer}>{renderStepContent()}</View>;
  }

  // Os passos do formulário usam SafeAreaView para evitar sobreposição com a UI do sistema.
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.stepContainer}> 
        {/* --- Top Section --- */}
        <View>
          <ProgressBar progress={progress} />
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
              <FontAwesome name="chevron-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Image source={require('../../assets/images/Frame 40.png')} style={styles.headerImage} />
            <View style={styles.headerButton} />
          </View>
        </View>

        {/* --- Middle Section (Content) --- */}
        <View>
          <Text style={styles.stepTitle}>{getStepTitle()}</Text>
          {renderStepContent()}
        </View>

        {/* --- Bottom Section (Navigation) --- */}
        <View style={styles.footer}>
          {step < TOTAL_FORM_STEPS ? <Button title="Pular" onPress={handleNext} color="#888" /> : <View />}
          {step < TOTAL_FORM_STEPS && (
              <TouchableOpacity style={styles.circularButton} onPress={handleNext}>
                  <FontAwesome name="arrow-right" size={24} color="#fff" />
              </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", backgroundColor: "#030405" },
  welcomeScreenContainer: { flex: 1, backgroundColor: "#030405" },
  welcomeContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center',},
  welcomeBottomContent: {
    width: '100%',
    backgroundColor: '#030405d4',
    padding: 30,
    paddingTop: 15,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    gap: 15,
    borderTopWidth: 1,
    borderTopColor: '#ffffff1a',
    paddingBottom: 60,
  },
  welcomeHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1, // Garante que o logo fique sobre a imagem de fundo
    height: 60,
    width: '100%',
  },
  welcomeImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  welcomeButtonContainer: { width: '100%', alignItems: 'center', gap: 30, marginTop: 20 },
  welcomePrimaryButton: {
    backgroundColor: '#1cb0f6',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  welcomePrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  welcomeSecondaryButtonText: {
    color: '#fffffffd',
    fontSize: 16,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#030405",
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
    marginBottom: 15,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerImage: {
    width: 100, height: 110, resizeMode: 'contain'
  },
  title: {
    fontSize: 45,
    fontWeight: '300',
    textAlign: "left",
    color: "#fff",
  },
  subtitle: { fontSize: 16, color: '#ccc', textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
  stepTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 25, textAlign: "center", color: "#fff" },
  input: {
    backgroundColor: "#141414",
    color: "#fff",
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ffffff1a",
    height: 64,
  },
  circularButton: {
    backgroundColor: '#1cb0f6',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: { height: 8, width: '100%', backgroundColor: '#173F5F', borderRadius: 4, marginTop: 10, marginBottom: 10 },
  progressBar: { height: '100%', backgroundColor: '#1cb0f6', borderRadius: 4 },
  label: { fontSize: 16, color: "#ccc", marginBottom: 10, alignSelf: 'flex-start' },
  optionContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, gap: 10 },
  optionContainerVertical: { flexDirection: 'column', alignItems: 'stretch', marginBottom: 20, gap: 10 },
  optionButton: { paddingVertical: 15, paddingHorizontal: 20, backgroundColor: '#173F5F', borderRadius: 8, borderWidth: 1, borderColor: '#ffffff1a', marginVertical: 5 },
  optionSelected: { backgroundColor: '#1cb0f6', borderColor: '#fff' },
  optionText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 18 },
  optionDescription: { color: '#ccc', fontSize: 14, textAlign: 'center', marginTop: 5 },
  pfpContainer: { alignItems: 'center', marginBottom: 10 },
  pfp: { width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: '#1cb0f6' },
  pfpPlaceholder: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#173F5F', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff1a' },
  pfpPlaceholderText: { fontSize: 60, color: '#ccc', fontWeight: '200' },
  pfpSubtext: { textAlign: 'center', color: '#aaa', fontSize: 12 },
  finalButton: {
    marginTop: 15,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  finalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});