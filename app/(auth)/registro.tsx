// app/(auth)/registro.tsx
import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { Easing, FadeInUp, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NumberSlider } from "../../components/NumberSlider";
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
  const TOTAL_FORM_STEPS = 8; // genero, altura, peso, nivel, streakGoal, weeksStreakGoal, nome, credenciais

  const [step, setStep] = useState(0); // 0: Welcome, 1-5: Form steps

  const [animationDirection, setAnimationDirection] = useState<'forward' | 'backward'>('forward');

  // Dados do usuário
  const [nome, setNome] = useState("");
  const [altura, setAltura] = useState("175");
  const [peso, setPeso] = useState("75");
  const [genero, setGenero] = useState<'Masculino' | 'Feminino' | 'Outro' | null>(null);
  const [nivel, setNivel] = useState<'Iniciante' | 'Intermediário' | 'Avançado' | null>(null);
  const [streakGoal, setStreakGoal] = useState<number>(3); // Meta de treinos por semana
  const [weeksStreakGoal, setWeeksStreakGoal] = useState<number>(4); // Meta de semanas seguidas
  const [photoURI, setPhotoURI] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // This validation is now only for the email/password form
  const isCredentialsValid = nome.trim().length > 0 && email.trim().length > 5 && email.includes('@') && senha.length >= 6 && senha === confirmarSenha;

  const isStepComplete = () => {
    switch (step) {
      case 1: return genero !== null;
      case 2: return altura.trim().length > 0;
      case 3: return peso.trim().length > 0;
      case 4: return nivel !== null;
      case 5: return streakGoal >= 2 && streakGoal <= 7;
      case 6: return weeksStreakGoal > 0;
      case 7: return nome.trim().length > 0;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step <= TOTAL_FORM_STEPS) {
      setAnimationDirection('forward');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Keyboard.dismiss(); // Esconde o teclado ao avançar
      setStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setAnimationDirection('backward');
      setStep(s => s - 1);
    }
  };

  const handlePickImage = async () => {
    // Pedir permissão para acessar a galeria de mídia
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permissão necessária", "Você precisa permitir o acesso à galeria para escolher uma foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setPhotoURI(uri); // Armazena a URI local da nova imagem
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

      const finalNome = nome.trim() || user.email?.split('@')[0] || '';

      // Cria o documento de perfil no Firestore com todos os dados coletados.
      // A função `createUserProfileDocument` precisará ser adaptada para aceitar estes campos.
      await createUserProfileDocument(user, {
        nome: finalNome,
        isPro: false,
        altura: !isNaN(alturaNum) && alturaNum > 0 ? alturaNum : undefined,
        peso: !isNaN(pesoNum) && pesoNum > 0 ? pesoNum : undefined,
        genero: genero || undefined,
        nivel: nivel || undefined,
        streakGoal: streakGoal,
        weeksStreakGoal: weeksStreakGoal,
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


  const getStreakImage = () => {
    switch (streakGoal) {
      case 2: return require('../../assets/images/Streak-types/Vector_2_dias.png');
      case 3: return require('../../assets/images/Streak-types/Vector_3_dias.png');
      case 4: return require('../../assets/images/Streak-types/Vector_4_dias.png');
      case 5: return require('../../assets/images/Streak-types/Vector_5_dias.png');
      case 6: return require('../../assets/images/Streak-types/Vector_6_dias.png');
      case 7: return require('../../assets/images/Streak-types/Vector_7_dias.png');
      default:
        // Retorna uma imagem padrão ou a de 3 dias, por exemplo.
        return require('../../assets/images/Streak-types/Vector_3_dias.png');
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
                  <Text style={styles.welcomePrimaryButtonText}>Vamos começar seu registro</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/login")}>
                  <Text style={styles.welcomeSecondaryButtonText}>Já tenho uma conta (Login)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case 1: // Gênero
        return (
          <View style={styles.optionContainerVertical}>
            <TouchableOpacity style={[styles.genderButton, genero === 'Masculino' && styles.optionSelected]} onPress={() => setGenero('Masculino')}>
              <FontAwesome name="mars" size={24} color="#fff" />
              <Text style={styles.optionText}>Masculino</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.genderButton, genero === 'Feminino' && styles.optionSelected]} onPress={() => setGenero('Feminino')}>
              <FontAwesome name="venus" size={24} color="#fff" />
              <Text style={styles.optionText}>Feminino</Text>
            </TouchableOpacity>
          </View>
        );
      case 2: // Altura
        return (
          <View style={styles.stepContentWrapper}>
            <NumberSlider
              min={140}
              max={210}
              value={Number(altura) || 175}
              onChange={(val) => setAltura(val.toString())}
              vertical
            />
            <Text style={styles.sliderUnitText}>cm</Text>
          </View>
        );

      case 3: // Peso
        return (
          <View style={styles.stepContentWrapper}>
            <NumberSlider
              min={40}
              max={175}
              value={Number(peso) || 75}
              onChange={(val) => setPeso(val.toString())}
            />
             {/* O valor já é mostrado no slider, basta exibir a unidade */}
            <Text style={styles.sliderUnitTextHorizontal}>kg</Text>
          </View>
  );
      case 4: // Nível
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
      case 5: // Meta de Treinos Semanal
        return (
          <>
            <Animated.Image
              key={streakGoal} // Chave para forçar a re-renderização e a animação
              source={getStreakImage()}
              style={styles.streakImage}
              entering={FadeInUp.duration(400)} // Animação de entrada
            />
            <View style={styles.optionContainerHorizontal}>
              {[2, 3, 4, 5, 6, 7].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.streakGoalButton, streakGoal === d && styles.optionSelected]}
                  onPress={() => {
                    setStreakGoal(d);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={styles.optionText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>

        );
      case 6: // Meta de Semanas Seguidas
        return (
          <>
            <View style={styles.centralDisplayContainer}>
              <Image
                source={getStreakImage()}
                style={styles.streakImageSmall}
              />
              <View>
                <Animated.Text
                  key={`weeks-text-${weeksStreakGoal}`} // Chave para forçar a animação na mudança
                  style={styles.centralDisplayNumber}
                  entering={FadeInUp.duration(50).springify()} // Animação mais rápida
                >
                  {weeksStreakGoal}
                </Animated.Text>
                <Text style={styles.centralDisplayText}>Semanas</Text>
              </View>
            </View>
            <View style={styles.optionContainerHorizontal}>
              {[4, 8, 12, 24].map(w => (
                <TouchableOpacity
                  key={w}
                  style={[styles.streakGoalButton, weeksStreakGoal === w && styles.optionSelected]}
                  onPress={() => { setWeeksStreakGoal(w); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={styles.optionText}>{w}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case 7: // Nome e Resumo
        return(
          <ScrollView style={{width: '100%'}} contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}>
            {/* --- Seção de Resumo --- */}
            <View style={styles.finalSummaryContainer}>
              <TouchableOpacity style={styles.summaryPfpContainer} onPress={handlePickImage}>
                {photoURI ? (
                  <Image source={{ uri: photoURI }} style={styles.pfpPlaceholderMedium} />
                ) : (
                  <View style={styles.pfpPlaceholderMedium}>
                    <FontAwesome name="camera" size={30} color="#555" />
                  </View>
                )}
                <Text style={styles.pfpSubtext}>Toque para adicionar uma foto</Text>
              </TouchableOpacity>

              <View style={styles.summaryInfoRow}>
                <Text style={styles.summaryInfoText}>{genero?.charAt(0) || 'N/A'}</Text>
                <View style={styles.summaryDivider} />
                <Text style={styles.summaryInfoText}>{altura}cm</Text>
                <View style={styles.summaryDivider} />
                <Text style={styles.summaryInfoText}>{peso}Kg</Text>
              </View>

              <View style={styles.summaryGoalContainer}>
                <Image source={getStreakImage()} style={styles.streakImageTiny} />
                <View style={styles.summaryDividerVertical} />
                <View>
                  <Text style={styles.summaryGoalNumber}>{weeksStreakGoal}</Text>
                  <Text style={styles.summaryGoalText}>Semanas</Text>
                </View>
              </View>
            </View>

            {/* --- Campos do Formulário --- */}
            <TextInput placeholder="Como podemos te chamar?" value={nome} onChangeText={setNome} style={styles.input} placeholderTextColor="#ccc" />
          </ScrollView>
        );
      case 8: // Credenciais
        return (
          <ScrollView style={{width: '100%'}} contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}>
            <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#ccc" />
            <TextInput placeholder="Senha (mínimo 6 caracteres)" secureTextEntry value={senha} onChangeText={setSenha} style={styles.input} placeholderTextColor="#ccc" />
            <TextInput placeholder="Confirme a senha" secureTextEntry value={confirmarSenha} onChangeText={setConfirmarSenha} style={styles.input} placeholderTextColor="#ccc" />
            <TouchableOpacity
              style={[styles.finalButton, { backgroundColor: isCredentialsValid ? '#1cb0f6' : '#555' }, { width: '100%' }]}
              onPress={handleCadastro}
              disabled={!isCredentialsValid || isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.finalButtonText}>Finalizar Cadastro</Text>}
            </TouchableOpacity>

            <Text style={styles.loginRedirectText}>Já tem uma conta? <Text style={styles.loginRedirectLink} onPress={() => router.push('/login')}>Faça Login</Text></Text>
          </ScrollView>
        );
      default: return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return "Qual seu gênero?";
      case 2: return "Qual sua altura?";
      case 3: return "E o seu peso?";
      case 4: return "Qual seu nível na academia?";
      case 5: return "Qual sua meta treinos por semana";
      case 6: return "Qual sua meta de semanas em sequência?";
      case 7: return "Para finalizar, seu nome";
      case 8: return "Crie sua conta";
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.stepContainer}>
        {/* --- Top Section --- */}
        <View>
          <ProgressBar progress={progress} />
          <View style={styles.topNavContainer}>
            <View style={{width: 50}} />
            <Text style={styles.stepTitle}>{getStepTitle()}</Text>
            {step < TOTAL_FORM_STEPS && (
              <TouchableOpacity onPress={handleNext} style={styles.skipButtonContainer}>
                <Text style={styles.skipButtonText}>Pular</Text>
              </TouchableOpacity>
            )}
            {step >= TOTAL_FORM_STEPS && <View style={{width: 50}} />}
          </View>
        </View>

        {/* --- Middle Section (Content) --- */}
        <View style={styles.contentContainer}>
          <Animated.View
            key={step}
            style={{ width: '100%', alignItems: 'center' }}
            entering={
              (animationDirection === 'forward'
                ? SlideInRight
                : SlideInLeft
              )
                .duration(300)
                .easing(Easing.out(Easing.quad))
            }
            exiting={
              (animationDirection === 'forward'
                ? SlideOutLeft.duration(300).easing(Easing.out(Easing.quad))
                : SlideOutRight.duration(300).easing(Easing.out(Easing.quad))
              )
            }
          >
            {renderStepContent()}
          </Animated.View>

        </View>

        {/* --- Summary Text (Conditional) --- */}
        {step === 6 && (
            <View style={styles.summaryContainer}>
                <Text style={styles.summaryText}>
                    Minha meta é ir para a academia <Text style={styles.summaryHighlight}>{streakGoal}</Text> vezes por semana durante <Text style={styles.summaryHighlight}>{weeksStreakGoal}</Text> semanas.
                </Text>
            </View>
        )}

        {/* --- Bottom Section (Navigation) --- */}
        {step < TOTAL_FORM_STEPS && (
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>Voltar</Text>
            </TouchableOpacity>
            {step < TOTAL_FORM_STEPS && (
              <TouchableOpacity style={[styles.nextButton, !isStepComplete() && styles.nextButtonDisabled]} onPress={handleNext} disabled={!isStepComplete()}>
                <Text style={styles.nextButtonText}> 
                  {step === 6 ? "Eu vou conseguir" : "Próximo"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        </View>
      </KeyboardAvoidingView>
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
    borderTopWidth: 1,
    borderTopColor: '#ffffff1a',
  },
  backButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
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
  stepTitle: { flex: 1, fontSize: 24, fontWeight: "bold", textAlign: "center", color: "#fff" },
  input: {
    backgroundColor: "#141414",
    color: "#fff",
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderTopColor: "#ffffff3a",
    borderLeftColor: "#ffffff3a",
    borderRightColor: "#ffffff1a",
    borderBottomColor: "#ffffff1a",

    height: 64,
    width: '100%',
  },  
  nextButton: {
    backgroundColor: '#1cb0f6',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#555',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarContainer: { height: 8, width: '100%', backgroundColor: '#173F5F', borderRadius: 4, marginTop: 10, marginBottom: 10 },
  progressBar: { height: '100%', backgroundColor: '#1cb0f6', borderRadius: 4 },
  label: { fontSize: 16, color: "#ccc", marginBottom: 10, textAlign: 'center', width: '100%' },
  sliderValueText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 28,
  },
  // NOVO ESTILO para o wrapper do conteúdo de cada etapa
  stepContentWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sliderContainer: { // Este estilo pode ser removido se não for usado em outro lugar
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sliderUnitText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    position: 'absolute', // Posiciona ao lado do número central
    left: '65%', // Ajuste conforme necessário
  },

  sliderUnitTextHorizontal: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10, // Espaçamento abaixo do slider horizontal
  },
  optionContainerVertical: { flexDirection: 'column', alignItems: 'stretch', marginBottom: 20, gap: 10 },
  optionContainerHorizontal: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 15, paddingHorizontal: 10 },
  optionButton: { paddingVertical: 15, paddingHorizontal: 20, backgroundColor: '#173F5F', borderRadius: 8, borderWidth: 1, borderColor: '#ffffff1a', marginVertical: 5, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 15, minHeight: 80 },
  genderButton: {
    backgroundColor: '#173F5F',
    borderWidth: 1,
    borderColor: '#ffffff1a',
    marginVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
    width: 120,
    height: 120,
    borderRadius: 1000, // Make it a circle
    borderTopColor: "#ffffff3a",
    borderLeftColor: "#ffffff3a",
    borderRightColor: "#ffffff1a",
    borderBottomColor: "#ffffff1a",
  },
  optionSelected: { backgroundColor: '#1cb0f6', borderColor: '#fff' },
  streakGoalButton: {
    backgroundColor: '#173F5F',
    borderWidth: 1,
    borderColor: '#ffffff1a',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderTopColor: "#ffffff3a",
    borderLeftColor: "#ffffff3a",
    borderRightColor: "#ffffff1a",
    borderBottomColor: "#ffffff1a",
  },
  weekGoalButton: {
    backgroundColor: '#173F5F',
    borderWidth: 1,
    borderColor: '#ffffff1a',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 12,
    padding: 10,
  },
  weekGoalNumber: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 28,
  },
  weekGoalText: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 4,
  },
  optionText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 18 },
  optionDescription: { color: '#ccc', fontSize: 14, textAlign: 'center', marginTop: 5 },
  pfpContainer: { alignItems: 'center', marginBottom: 10 },
  pfp: { width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: '#1cb0f6' },
  pfpPlaceholder: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#173F5F', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff1a' },
  pfpPlaceholderMedium: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#173F5F', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ffffff1a'
  },
  streakImageTiny: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  pfpPlaceholderText: { fontSize: 60, color: '#ccc', fontWeight: '200' },
  pfpSubtext: { textAlign: 'center', color: '#aaa', fontSize: 12 },
  streakImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 30,
  },
  streakImageSmall: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  centralDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 40,
    padding: 20,
    backgroundColor: '#173F5F20',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  centralDisplayNumber: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  centralDisplayText: {
    color: '#ccc',
    fontSize: 18,
  },
  finalSummaryContainer: {
    alignItems: 'center',
    marginBottom: 25,
    gap: 15,
    width: '100%',
  },
  summaryPfpContainer: {
    alignItems: 'center',
    gap: 8,
  },
  summaryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
    backgroundColor: '#173F5F20',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    borderColor: '#ffffff1a',
  },
  summaryInfoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#ffffff3a',
  },
  summaryDividerVertical: {
    width: 1,
    height: '60%',
    backgroundColor: '#ffffff3a',
  },
  summaryGoalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: '#173F5F20',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    borderColor: '#ffffff1a',
  },
  summaryGoalNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryGoalText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
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
  finalBackButton: {
    marginTop: 15,
    padding: 15,
    alignItems: 'center',
  },
  finalBackButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginRedirectText: {
    marginTop: 25,
    color: '#aaa',
    fontSize: 14,
  },
  loginRedirectLink: {
    color: '#1cb0f6',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  summaryContainer: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  summaryText: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryHighlight: {
    color: '#fff',
    fontWeight: 'bold',
  },
  topNavContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  skipButtonContainer: {
    width: 50,
    alignItems: 'flex-end',
  },
    // NOVO ESTILO para o container do conteúdo principal
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  

});