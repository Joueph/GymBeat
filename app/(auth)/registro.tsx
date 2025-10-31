// app/(auth)/registro.tsx
import { FontAwesome, Ionicons } from '@expo/vector-icons'; // Importar Ionicons
import { useNetInfo } from '@react-native-community/netinfo';
import { ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signInAnonymously, User } from 'firebase/auth';
import React, { useCallback, useEffect, useRef, useState } from 'react';


import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { NumberSlider } from '../../components/NumberSlider';
import { OnboardingOption } from '../../components/Onboarding/onboardingOptions'; // Importar o novo componente
import { auth } from "../../firebaseconfig";
import { EstatisticasOnboarding } from '../../models/EstatisticasOnboarding'; // Importar o Model
import { FichaModelo } from '../../models/fichaModelo';
import { TreinoModelo } from '../../models/treinoModelo';
import { getFichasModelos } from '../../services/fichaService';
import {
  atualizarPassoOnboarding,
  converterContaAnonima,
  finalizarOnboarding,
  iniciarOnboarding
} from '../../services/onboardingService'; // Importar o Service
import { uploadImageAndGetURL } from '../../services/storageService';
import { DiaSemana, getTreinosModelosByIds } from '../../services/treinoService';
import { createUserProfileDocument } from "../../userService";

const AnimatedImage = Animated.createAnimatedComponent(Image);

const DIAS_SEMANA_ORDEM: { [key in DiaSemana]: number } = {
  'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6
};

/**
 * Componente da Barra de Progresso com animação.
 * Movido para fora do componente principal para persistir o estado da animação.
 */
const ProgressBar = ({ progress }: { progress: number }) => {
  // Inicializa o valor compartilhado com o progresso inicial.
  // Usar useRef garante que o valor não seja recriado em cada renderização.
  const animatedWidth = useRef(useSharedValue(progress)).current;

  // Observa mudanças na prop 'progress' e anima o valor da largura.
  useEffect(() => {
    // Anima a mudança do valor ATUAL para o novo valor de progresso.
    animatedWidth.value = withTiming(progress, { duration: 400 });
  }, [progress, animatedWidth]);

  // Cria um estilo animado que será aplicado à barra de progresso.
  const animatedStyle = useAnimatedStyle(() => ({ width: `${animatedWidth.value}%` }));

  return <View style={styles.progressBarContainer}><Animated.View style={[styles.progressBar, animatedStyle]} /></View>;
};

/**
 * Componente para cada item do carrossel de metas de treino.
 * Inclui animação de escala e opacidade ao ser selecionado.
 */
const StreakGoalItem = ({
  day,
  isSelected,
  onPress,
  imageSrc,
  itemWidth,
  spacing
}: {
  day: number;
  isSelected: boolean;
  onPress: () => void;
  imageSrc: any;
  itemWidth: number;
  spacing: number;
}) => {
  const progress = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, { duration: 300 });
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = progress.value * 0.3 + 0.8; // Anima de 0.8 para 1.1
    const opacity = progress.value * 0.5 + 0.5; // Anima de 0.5 para 1.0
    return { transform: [{ scale }], opacity };
  });

  return (
    <TouchableOpacity style={styles.streakImageButton} onPress={onPress}>
      <AnimatedImage source={imageSrc} style={[styles.streakImageSlider, { width: itemWidth, marginHorizontal: spacing / 2 }, animatedStyle]} />
    </TouchableOpacity>
  );
};

export default function CadastroScreen() { 
  const router = useRouter();
  const netInfo = useNetInfo(); // Hook para verificar a conexão
  const TOTAL_FORM_STEPS = 20; // Agora são 20
  
  const [onboardingStep, setOnboardingStep] = useState(0); // 0: Welcome, 1-25: Form steps

  const [animationDirection, setAnimationDirection] = useState<'forward' | 'backward'>('forward');

  // -------- NOVOS ESTADOS --------
  // Estado unificado para os dados do onboarding
  const [recommendedFicha, setRecommendedFicha] = useState<FichaModelo | null>(null);
  const [recommendedTreinos, setRecommendedTreinos] = useState<TreinoModelo[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendationProgress, setRecommendationProgress] = useState(0);
  const [acceptedFicha, setAcceptedFicha] = useState(false);
  const [onboardingData, setOnboardingData] = useState<Partial<EstatisticasOnboarding>>({ problemasParaTreinar: [] });
  // -------------------------------

  // Dados do usuário (antigos - vamos migrar o que for do onboarding para 'onboardingData')
  const [nome, setNome] = useState("");
  const [altura, setAltura] = useState(175);
  const [peso, setPeso] = useState(75);
  const [genero, setGenero] = useState<'Masculino' | 'Feminino' | 'Outro' | null>(null);
  const [nivel, setNivel] = useState<'Iniciante' | 'Intermediário' | 'Avançado' | null>(null);
  const [streakGoal, setStreakGoal] = useState<number>(3); // Meta de treinos por semana
  const [diaNascimento, setDiaNascimento] = useState(15);
  const [mesNascimento, setMesNascimento] = useState(6); // 0-indexed for Date, but 1-indexed for display
  const [anoNascimento, setAnoNascimento] = useState(2000);
  const [weeksStreakGoal, setWeeksStreakGoal] = useState<number>(4); // Meta de semanas seguidas
  const [photoURI, setPhotoURI] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false); // Novo estado para o botão "Vamos lá!"

  // --- Refs para o carrossel de metas ---
  const flatListRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // CORREÇÃO: Mover o hook `useCallback` para o nível superior do componente.
  // Chamar hooks dentro de condições (como o switch case) viola as regras do React.
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const visibleItem = viewableItems.find((i: any) => i.isViewable);
    if (visibleItem && typeof visibleItem.item.id === 'number') {
      // Se o usuário aceitou a ficha, não faz nada
      if (acceptedFicha) {
        // Aqui você pode adicionar a lógica para copiar a ficha aceita
        // e talvez até definir como ativa no final do onboarding.
      }
      if (streakGoal !== visibleItem.item.id) {
        setStreakGoal(visibleItem.item.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [streakGoal]);

  const checkIconScale = useSharedValue(0);
  const checkIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkIconScale.value }],
    };
  });




  useEffect(() => {
    if (recommendationProgress === 1) {
      // Animação de bounce para o ícone de check
      checkIconScale.value = withSpring(1, { damping: 12, stiffness: 150 });
      // Feedback tátil de sucesso
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Reseta a animação se o progresso for reiniciado
      checkIconScale.value = 0;
    }
  }, [recommendationProgress]);
  // This validation is now only for the email/password form
  const isCredentialsValid = email.trim().length > 5 && email.includes('@') && senha.length >= 6 && senha === confirmarSenha;

  const isStepComplete = () => {
    // Vamos atualizar isso a cada passo
    switch (onboardingStep) {
      case 1: return !!onboardingData.ondeOuviuGymBeat;
      case 2: return onboardingData.tentouOutrosApps !== undefined && onboardingData.tentouOutrosApps !== null;
      case 3: return !!onboardingData.objetivoPrincipal;
      case 4: return !!onboardingData.problemasParaTreinar && onboardingData.problemasParaTreinar.length > 0;
      case 5: return true; // Tela informativa
      case 6: return true; // Tela informativa
      // --- NOVOS STEPS ---
      case 7: return true; // Tela informativa "Muito bem!"
      case 8: return !!onboardingData.localTreino; // "Onde treina?"
      case 9: return onboardingData.possuiEquipamentosCasa !== undefined; // "Halteres?" (só aparece se localTreino === 'Em casa')
      case 10: return nivel !== null; // "Nível" (antigo case 7)
      // --- STEPS REORDENADOS ---
      case 11: return streakGoal >= 2 && streakGoal <= 7; // Meta de treinos (CORRETO)
      case 12: return weeksStreakGoal > 0; // Meta de semanas (CORRETO)
      case 13: return genero !== null; // Gênero (CORRETO)
      case 14: return diaNascimento > 0 && mesNascimento > 0 && anoNascimento > 1920; // Data de Nascimento
      case 15: return altura > 0; // Altura
      case 16: return peso > 0; // Peso
      case 17: return true; // Tela de processamento
      case 18: return true; // Tela de recomendação
      case 19: return nome.trim().length > 0; // Nome
      case 20: return isCredentialsValid; // Credenciais
      default:
        return true;
    }
  };

  const handleIniciarOnboarding = async () => {
    setIsStarting(true); // Ativa o estado de carregamento
    try {
      // ETAPA 1 (CRÍTICA): Garantir que o usuário esteja autenticado (anonimamente)
      // Isso PRECISA ser 'await' pois o passo 2 depende do UID.
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // ETAPA 2 (BACKGROUND): Iniciar a criação do documento no Firestore.
      // Removemos o 'await' e adicionamos .catch() para rodar em background.
      iniciarOnboarding()
        .catch(error => console.error("Erro (background) ao iniciar onboarding:", error));
      
      // ETAPA 3 (IMEDIATA): Navegar para o próximo passo.
      // Isso agora acontece imediatamente após o login, sem esperar o Firestore.
      setAnimationDirection('forward');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setOnboardingStep(s => s + 1);

    } catch (error) {
      // Se o LOGIN falhar (ex: sem rede), não podemos continuar.
      console.error("Erro CRÍTICO ao fazer login anônimo:", error);
      Alert.alert("Erro de Conexão", "Não foi possível iniciar. Verifique sua conexão e tente novamente.");
    } finally {
      setIsStarting(false); // Desativa o estado de carregamento, independentemente do resultado
    }
  };

  const handleRecommendation = async () => {
    if (isRecommending) return;
    setIsRecommending(true);
    setRecommendationProgress(0);

    try {
      const [fichas, userProfileData] = await Promise.all([
        getFichasModelos(),
        Promise.resolve({ nivel, genero, streakGoal }) // Usa os dados do state do onboarding
      ]);
      setRecommendationProgress(0.3);

      const modelosComTotalDias = await Promise.all(fichas.map(async (ficha) => {
        const treinosDaFicha = await getTreinosModelosByIds(ficha.treinos);
        const totalDias = treinosDaFicha.reduce((sum, treino) => sum + (treino.diasSemana?.length || 0), 0);
        return { ...ficha, totalDias };
      }));
      setRecommendationProgress(0.6);

      const sortFichas = (a: FichaModelo, b: FichaModelo) => {
        const getScore = (ficha: FichaModelo) => {
          let score = 0;
          if (Math.abs((ficha.totalDias || 0) - (userProfileData.streakGoal || 3)) <= 1) score += 20;
          if (ficha.dificuldade === userProfileData.nivel) score += 10;
          else if (ficha.dificuldade === 'Todos') score += 5;
          if (ficha.sexo === (userProfileData.genero === 'Masculino' ? 'Homem' : userProfileData.genero === 'Feminino' ? 'Mulher' : undefined)) score += 10;
          else if (ficha.sexo === 'Ambos') score += 5;
          return score;
        };
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        return scoreB - scoreA;
      };

      const sortedFichas = modelosComTotalDias.sort(sortFichas);
      const bestFicha = sortedFichas[0];
      setRecommendedFicha(bestFicha);
      setRecommendationProgress(0.8);

      const treinosData = await getTreinosModelosByIds(bestFicha.treinos ?? []);
      setRecommendedTreinos(treinosData);
      setRecommendationProgress(1);

      // A navegação agora é manual, via botão "Próximo" que aparecerá.
    } catch (error) {
      console.error("Erro ao recomendar ficha:", error);
      handleNext(); // Continua mesmo se der erro
    } finally { setIsRecommending(false); }
  };

// ... (linha de adjacência)
  const handleNext = () => { // Removido o 'async'
    // Salva os dados do passo atual no Firestore EM BACKGROUND
    
    // Não usamos mais try/catch para não bloquear a UI.
    // Usamos .catch() para capturar erros de rede em background.
    if (onboardingStep === 1) {
      atualizarPassoOnboarding({ ondeOuviuGymBeat: onboardingData.ondeOuviuGymBeat })
        .catch(error => console.error("Erro (background) ao salvar passo 1:", error));
    } else if (onboardingStep === 2) {
      atualizarPassoOnboarding({ tentouOutrosApps: onboardingData.tentouOutrosApps })
        .catch(error => console.error("Erro (background) ao salvar passo 2:", error));
    } else if (onboardingStep === 3) {
      atualizarPassoOnboarding({ objetivoPrincipal: onboardingData.objetivoPrincipal })
        .catch(error => console.error("Erro (background) ao salvar passo 3:", error));
    }
    // --- NOVOS STEPS ---
    else if (onboardingStep === 4) {
      atualizarPassoOnboarding({ problemasParaTreinar: onboardingData.problemasParaTreinar })
        .catch(error => console.error("Erro (background) ao salvar passo 4:", error));
    }
    // Não precisamos salvar nada para 5 e 6 (telas informativas)
    // --- FIM NOVOS STEPS ---
    // Não precisamos salvar nada para 5, 6 e 7 (telas informativas)
    // --- NOVOS STEPS ---
    else if (onboardingStep === 8) {
      atualizarPassoOnboarding({ localTreino: onboardingData.localTreino || null })
        .catch(error => console.error("Erro (background) ao salvar passo 8:", error));
    } else if (onboardingStep === 9) {
      atualizarPassoOnboarding({ possuiEquipamentosCasa: onboardingData.possuiEquipamentosCasa })
        .catch(error => console.error("Erro (background) ao salvar passo 9:", error));
    }
    // A lógica de salvar os dados restantes (nível, metas, dados pessoais)
    // será feita no próprio handleCadastro, antes de finalizar, para garantir
    // que tudo seja salvo.

    if (onboardingStep === 16) { // Ao sair da tela de peso
      // Avança para a tela de processamento
      setOnboardingStep(s => s + 1);
      // Inicia a recomendação em background
      handleRecommendation();
      return;
    }


    // Esta lógica agora executa IMEDIATAMENTE, sem esperar o salvamento
    if (onboardingStep < TOTAL_FORM_STEPS) {
      setAnimationDirection('forward');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Keyboard.dismiss(); // Esconde o teclado ao avançar

      // --- LÓGICA CONDICIONAL ---
      const problemas = onboardingData.problemasParaTreinar || [];

      if (onboardingStep === 4) {
        // Lógica de pulo:
        // Se 'Falta de constância' foi selecionado, o próximo passo é 5
        if (problemas.includes('Falta de constância')) {
          setOnboardingStep(5);
          return;
        }
        // Se não, checa se 'Não vejo resultados' foi selecionado, o próximo é 6
        if (problemas.includes('Não vejo resultados')) {
          setOnboardingStep(6);
          return;
        }
        // Se nenhum dos dois, pula para o passo 7 (Gênero)
        setOnboardingStep(7);
        return;
      }

      if (onboardingStep === 5) {
        // Vindo do passo 5, checa se o 6 também é necessário
        if (problemas.includes('Não vejo resultados')) {
          setOnboardingStep(6);
          return;
        }
        // Se não, pula para o 7
        setOnboardingStep(7);
        return;
      }

      if (onboardingStep === 8) {
        // Se 'Na academia', pula o case 9 (Halteres) e vai para o 10 (Nível)
        if (onboardingData.localTreino === 'Na academia') {
          setOnboardingStep(10);
        } else {
          setOnboardingStep(9);
        }
        return;
      }
      // Se vindo do 6, ou qualquer outro passo, avança normalmente
      if (onboardingStep === 18) { // Se o usuário está na tela de recomendação
        // Se ele clicar em "próximo" (usar este treino), marcamos como aceito
        setAcceptedFicha(true);
        setOnboardingStep(s => s + 1); // Vai para a tela de nome
        return;
      }
      setOnboardingStep(s => s + 1);

    } else if (onboardingStep === TOTAL_FORM_STEPS) {
      // Lógica de finalização (ex: handleCadastro)
      // handleCadastro(); // Vamos implementar isso no último step
    }
  };  
  
// ... (linha de adjacência)
  const handleBack = () => {
    if (onboardingStep > 0) { // Permite voltar até o step 0 (vídeo)
      setAnimationDirection('backward');

      // --- LÓGICA CONDICIONAL AO VOLTAR ---
      const problemas = onboardingData.problemasParaTreinar || [];

      if (onboardingStep === 7) {
        // Se estamos indo do 7 (Gênero) para trás, temos que ver para onde voltar
        if (problemas.includes('Não vejo resultados')) {
          setOnboardingStep(6); // Volta para o 6
          return;
        }
        if (problemas.includes('Falta de constância')) {
          setOnboardingStep(5); // Volta para o 5
          return;
        }
        setOnboardingStep(4); // Volta para o 4
        return;
      }

      if (onboardingStep === 6) {
        // Se estamos indo do 6 para trás
        if (problemas.includes('Falta de constância')) {
          setOnboardingStep(5); // Volta para o 5
          return;
        }
        setOnboardingStep(4); // Volta para o 4
        return;
      }
      // --- NOVA LÓGICA CONDICIONAL AO VOLTAR (LOCAL TREINO) ---
      if (onboardingStep === 10) { // Vindo do "Nível"
        // Se treina 'Na academia', pulou o 9, então volta para o 8
        if (onboardingData.localTreino === 'Na academia') {
          setOnboardingStep(8);
          return;
        }
        // Se treina 'Em casa', volta para o 9 (Halteres)
        setOnboardingStep(9);
        return;
      }

      if (onboardingStep === 19) { // Vindo da tela de nome
        // Volta para a tela de recomendação
        setOnboardingStep(18);
        return;
      }
      // --- FIM NOVA LÓGICA CONDICIONAL ---

      setOnboardingStep(s => s - 1);
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

  // NOVA FUNÇÃO para toggle de multi-seleção
  const handleToggleProblema = (problemaKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOnboardingData(prev => {
      const currentProblemas = prev.problemasParaTreinar || [];
      const isSelected = currentProblemas.includes(problemaKey);

      let newProblemas: string[] = [];
      if (isSelected) {
        // Remover
        newProblemas = currentProblemas.filter((p: string) => p !== problemaKey);
      } else {
        // Adicionar
        newProblemas = [...currentProblemas, problemaKey];
      }
      return { ...prev, problemasParaTreinar: newProblemas };
    });
  };

  const handleCadastro = async (): Promise<void> => {
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
      let currentUser: User | null = auth.currentUser;

      if (!currentUser || !currentUser.isAnonymous) {
        // Cenário: Nenhum usuário anônimo ou o usuário atual não é anônimo.
        // Procede com o registro direto por e-mail/senha.
        // Isso lida com casos em que a sessão anônima pode ter expirado ou sido perdida.
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        currentUser = userCredential.user;
      } else {
        // Cenário: Um usuário anônimo está presente. Converte-o para e-mail/senha.
        await converterContaAnonima(email, senha);
        currentUser = auth.currentUser; // Atualiza o usuário após a conversão
      }
      if (!currentUser) {
        throw new Error("A conversão da conta falhou. Nenhum usuário encontrado.");
      }

      let photoURL: string | undefined = undefined;
      if (photoURI) {
        photoURL = await uploadImageAndGetURL(photoURI, currentUser.uid); // Upload da foto
      }

      // Se o usuário aceitou a ficha recomendada, copia ela para o perfil dele
      if (acceptedFicha && recommendedFicha) {
        const { copyFichaModeloToUser, setFichaAtiva } = require('../../services/fichaService');
        const newFichaId = await copyFichaModeloToUser(recommendedFicha, currentUser.uid, recommendedTreinos);
        await setFichaAtiva(currentUser.uid, newFichaId);
      }

      // 2. Salva os últimos dados coletados no documento de estatísticas
      const alturaNum = altura;
      const pesoNum = peso;
      const finalNome = nome.trim() || currentUser.email?.split('@')[0] || '';
      await atualizarPassoOnboarding({
        nomePreferido: finalNome,
        alturaCm: !isNaN(alturaNum) && alturaNum > 0 ? alturaNum : null,
        pesoKg: !isNaN(pesoNum) && pesoNum > 0 ? pesoNum : null,
        genero: genero || null,
        nivelExperiencia: nivel || null,
        compromissoSemanal: streakGoal,
        metaSemanas: weeksStreakGoal,
        dataNascimento: new Date(anoNascimento, mesNascimento - 1, diaNascimento).toISOString(),
        adicionouFotoPerfil: !!photoURI,
      });

      // 3. Finaliza o onboarding (salva o horário de registro)
      await finalizarOnboarding();

      // 4. Cria o perfil principal do usuário
      await createUserProfileDocument(currentUser, {
        nome: finalNome,
        isPro: false,
        altura: !isNaN(alturaNum) && alturaNum > 0 ? alturaNum : undefined,
        peso: !isNaN(pesoNum) && pesoNum > 0 ? pesoNum : undefined,
        genero: genero || undefined,
        nivel: nivel || undefined,
        streakGoal: streakGoal,
        weeksStreakGoal: weeksStreakGoal,
        photoURL: photoURL || '',
        
        // --- COPIANDO DADOS DE PERSONALIZAÇÃO ---
        objetivoPrincipal: onboardingData.objetivoPrincipal || null,
        localTreino: onboardingData.localTreino || null,
        possuiEquipamentosCasa: onboardingData.possuiEquipamentosCasa === undefined ? null : onboardingData.possuiEquipamentosCasa,
        problemasParaTreinar: onboardingData.problemasParaTreinar || [],
      });
      setIsLoading(false);

    } catch (error: any) {
      setIsLoading(false);
      Alert.alert("Erro no Cadastro", error.message);
    }
  };

  const handleUpdateStreakGoal = () => {
    if (!recommendedFicha || !recommendedFicha.totalDias) return;
    // Atualiza o estado localmente. Este valor será usado ao criar o perfil do usuário.
    setStreakGoal(recommendedFicha.totalDias);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Opcional: podemos mostrar um alerta, mas como a UI vai atualizar, talvez não seja necessário.
    // Alert.alert("Sucesso", "Sua meta semanal foi atualizada!");
  };

  const getStreakImage = (num: number) => {
    switch (num) {
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
    switch (onboardingStep) {
      case 0: // Tela de Boas-vindas
        return (
          <>
            <Video
              source={require('../../assets/images/onboarding/intro-video.mp4')}
              rate={1.0}
              isMuted={true}
              isLooping={true}
              shouldPlay={true}
              resizeMode={ResizeMode.COVER}
              style={styles.welcomeVideo}
            />
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeBottomContent}>
              <Text style={styles.title}>Faça com que a academia se torne um vício</Text>
              <View style={styles.welcomeButtonContainer}>
                
                {/* Lógica de Conexão:
                    Mostra o botão "Vamos lá!" se 'isConnected' for true ou null (carregando).
                    Mostra a mensagem "Offline" se 'isConnected' for explicitamente false.
                */}
                {netInfo.isConnected === false ? (
                  <View style={styles.offlineContainer}>
                    <Ionicons name="cloud-offline-outline" size={24} color="#999" />
                    <Text style={styles.offlineText}>Conecte-se à internet para prosseguir</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.welcomePrimaryButton, isStarting && styles.nextButtonDisabled]} onPress={handleIniciarOnboarding} disabled={isStarting}>
                    {isStarting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.welcomePrimaryButtonText}>Vamos lá!</Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => router.push("./login")}>
                  <Text style={styles.welcomeSecondaryButtonText}>Já tenho uma conta (Login)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </>
        );

      case 1: // NOVO STEP: Onde ouviu falar?
        const appStoreOption = Platform.select({
          ios: { key: 'App Store', text: 'App Store', icon: 'logo-apple-appstore' },
          android: { key: 'Google Play', text: 'Google Play', icon: 'logo-google-playstore' },
          default: { key: 'App Store', text: 'App Store', icon: 'logo-apple-appstore' },
        });

        const ondeOuviuOptions = [
          appStoreOption,
          { key: 'Reddit', text: 'Reddit', icon: 'logo-reddit' },
          { key: 'X (antigo twitter)', text: 'X (antigo twitter)', icon: 'logo-twitter' },
          { key: 'Instagram', text: 'Instagram', icon: 'logo-instagram' },
          { key: 'Google', text: 'Google', icon: 'logo-google' },
          { key: 'Indicação', text: 'Indicação', icon: 'people-outline' },
          { key: 'Outro', text: 'Outro', icon: 'help-circle-outline' },
        ];

        return (
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.optionContainerVertical}>
              {ondeOuviuOptions.map((opt, index) => (
                <OnboardingOption
                  key={opt.key}
                  text={opt.text}
                  // Usando Ionicons conforme o componente
                  icon={<Ionicons name={opt.icon as any} size={26} color="#fff" />}
                  isSelected={onboardingData.ondeOuviuGymBeat === opt.key}
                  onPress={() => setOnboardingData(prev => ({ ...prev, ondeOuviuGymBeat: opt.key }))}
                  // Animação de entrada
                  entering={FadeInUp.duration(400).delay(index * 100)} // 100ms de delay
                />
              ))}
            </View>
          </ScrollView>
        );

      case 2: // NOVO STEP: Já tentou outros apps?

        const simNaoOptions = [
          { key: 'Sim', text: 'Sim', icon: 'thumbs-up-outline' },
          { key: 'Não', text: 'Não', icon: 'thumbs-down-outline' },
        ] as const;

        return (
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.optionContainerVertical}>
              {simNaoOptions.map((opt, index) => (
                <OnboardingOption
                  key={opt.text}
                  text={opt.text}
                  icon={<Ionicons name={opt.icon as any} size={26} color="#fff" />}
                  isSelected={onboardingData.tentouOutrosApps === opt.key}
                  onPress={() => setOnboardingData(prev => ({ ...prev, tentouOutrosApps: opt.key }))}
                  entering={FadeInUp.duration(400).delay(index * 100)} // 100ms de delay
                />
              ))}
            </View>
          </ScrollView>
        );

      case 3: // NOVO STEP: Objetivo Principal
        const objetivoOptions = [
          { key: 'Emagrecer', text: 'Emagrecer', icon: 'flame-outline' },
          { key: 'Crescer', text: 'Crescer', icon: 'barbell-outline' },
          { key: 'Manter', text: 'Manter', icon: 'checkmark-circle-outline' }, // Mantido como estava, se a intenção era mudar este, me avise.
          { key: 'Manter a saúde', text: 'Me manter saudável', icon: 'leaf-outline' },
        ] as const;

        return (
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.optionContainerVertical}>
              {objetivoOptions.map((opt, index) => (
                <OnboardingOption
                  key={opt.key}
                  text={opt.text}
                  icon={<Ionicons name={opt.icon as any} size={26} color="#fff" />}
                  isSelected={onboardingData.objetivoPrincipal === opt.key}
                  onPress={() => setOnboardingData(prev => ({ ...prev, objetivoPrincipal: opt.key }))}
                  entering={FadeInUp.duration(400).delay(index * 100)} // 100ms de delay
                />
              ))}
            </View>
          </ScrollView>
        );


case 4: // NOVO STEP: Problemas para treinar (Multi-select)
        const problemasOptions = [
          { key: 'Falta de motivação', text: 'Falta de motivação', icon: 'battery-dead-outline' },
          { key: 'Falta de constância', text: 'Falta de constância', icon: 'refresh-outline' },
          { key: 'Horários bagunçados', text: 'Horários bagunçados', icon: 'time-outline' },
          { key: 'Não vejo resultados', text: 'Não vejo resultados', icon: 'trending-down-outline' },
          { key: 'Me sinto intimidado', text: 'Me sinto intimidado', icon: 'eye-off-outline' },
        ] as const;

        return (
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.optionContainerVertical}>
              {problemasOptions.map((opt, index) => (
                <OnboardingOption
                  key={opt.key}
                  text={opt.text}
                  icon={<Ionicons name={opt.icon as any} size={26} color="#fff" />}
                  isSelected={(onboardingData.problemasParaTreinar || []).includes(opt.key)}
                  onPress={() => handleToggleProblema(opt.key)} // Usa a nova função
                  entering={FadeInUp.duration(400).delay(index * 100)}
                />
              ))}
              <Text style={[styles.optionDescription, {marginTop: 10}]}>Pode escolher mais de um</Text>
            </View>
          </ScrollView>
        );

      case 5: // NOVO STEP: Feature Streaks (Condicional - Onboarding 9.png)
        return (
            <Video
              source={require('../../assets/images/onboarding/Animations/CaseFaltaDeMotivacaofaltaDeConstancia.mp4')}
              rate={1.0}
              isMuted={true}
              isLooping={false}
              shouldPlay={true}
              resizeMode={ResizeMode.CONTAIN}
              style={styles.featureImage}
            />
        );

      case 6: // NOVO STEP: Feature Gráficos (Condicional - Onboarding 10.png)
        return (
            <Video
              source={require('../../assets/images/onboarding/Animations/CaseNaoVejoResultadosMeSintoIntimidado2.mp4')}
              rate={1.0}
              isMuted={true}
              isLooping={false}
              shouldPlay={true}
              resizeMode={ResizeMode.CONTAIN}
              style={styles.featureImage}
            />
        );
        
case 7: // NOVO STEP: "Muito bem!" (Onboarding 11.png)
        return (
          <View style={styles.stepContentWrapper}>
            <Text style={[styles.mainTitle, { textAlign: 'center', fontSize: 36, marginBottom: 15 }]}>Muito bem!</Text>
            <Text style={styles.featureSubtitle}>Agora faremos algumas perguntas para ajustar sua experiência no app e torna-la o mais otimizada possível para que você alcance seus objetivos</Text>
          </View>
        );

      case 8: // NOVO STEP: "Onde você costuma treinar?" (Onboarding 12.png)
        const localOptions = [
          { key: 'Em casa', text: 'Em casa', icon: 'home-outline' },
          { key: 'Na academia', text: 'Na academia', icon: 'barbell-outline' }, // Usei barbell, ajuste se tiver ícone melhor
        ] as const;

        return (
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.optionContainerVertical}>
              {localOptions.map((opt, index) => (
                <OnboardingOption
                  key={opt.key}
                  text={opt.text}
                  icon={<Ionicons name={opt.icon as any} size={26} color="#fff" />}
                  isSelected={onboardingData.localTreino === opt.key}
                  onPress={() => setOnboardingData(prev => ({ ...prev, localTreino: opt.key }))}
                  entering={FadeInUp.duration(400).delay(index * 100)}
                />
              ))}
            </View>
          </ScrollView>
        );

      case 9: // NOVO STEP: "Halteres?" (Onboarding 13.png)
        const halteresOptions = [
          { key: 'Sim', text: 'Sim', icon: 'thumbs-up-outline' },
          { key: 'Não', text: 'Não', icon: 'thumbs-down-outline' },
        ] as const;

        return (
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.optionContainerVertical}>
              {halteresOptions.map((opt, index) => (
                <OnboardingOption
                  key={opt.key}
                  text={opt.text}
                  icon={<Ionicons name={opt.icon as any} size={26} color="#fff" />} 
                  isSelected={onboardingData.possuiEquipamentosCasa === (opt.key === 'Sim')}
                  onPress={() => setOnboardingData(prev => ({ ...prev, possuiEquipamentosCasa: opt.key === 'Sim' }))}
                  entering={FadeInUp.duration(400).delay(index * 100)} 
                />
              ))}
            </View>
          </ScrollView>
        );
        
      case 10: // Nível (Antigo step 7)
        const nivelOptions = [
          { key: 'Iniciante', text: 'Iniciante', icon: 'body-outline' },
          { key: 'Intermediário', text: 'Intermediário', icon: 'barbell-outline' },
          { key: 'Avançado', text: 'Avançado', icon: 'ribbon-outline' },
        ] as const;

        return (
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.optionContainerVertical}>
              {nivelOptions.map((opt, index) => (
                <OnboardingOption
                  key={opt.key}
                  text={opt.text}
                  icon={<Ionicons name={opt.icon as any} size={26} color="#fff" />}
                  isSelected={nivel === opt.key}
                  onPress={() => setNivel(opt.key)}
                  entering={FadeInUp.duration(400).delay(index * 100)}
                />
              ))}
            </View>
          </ScrollView>
        );

      case 13: // Gênero (CORRETO)
        const generoOptions = [
          { key: 'Masculino', text: 'Masculino', icon: 'male-outline' },
          { key: 'Feminino', text: 'Feminino', icon: 'female-outline' },
          { key: 'Outro', text: 'Outro', icon: 'male-female-outline' },
        ] as const;

        return (
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.optionContainerVertical}>
              {generoOptions.map((opt, index) => (
                <OnboardingOption
                  key={opt.key}
                  text={opt.text}
                  icon={<Ionicons name={opt.icon as any} size={26} color="#fff" />}
                  isSelected={genero === opt.key}
                  onPress={() => setGenero(opt.key)}
                  entering={FadeInUp.duration(400).delay(index * 100)}
                />
              ))}
            </View>
          </ScrollView>
        );

case 15: // Altura
        return (
          <View style={styles.stepContentWrapper}>
            <NumberSlider
              min={120}
              max={220}
              value={altura}
              onChange={(val) => setAltura(val)}
              initialValue={175}
              vertical
            />
            <Text style={styles.sliderUnitText}>cm</Text>
          </View>
        );
        
      case 16: // Peso
        return (
          <View style={[styles.stepContentWrapper, { justifyContent: 'center' }]}>
            <NumberSlider
              min={30}
              max={200}
              value={peso}
              onChange={(val) => setPeso(val)}
              step={1}
              initialValue={75}
              vertical={false} // Slider horizontal
            />
            <Text style={styles.sliderUnitTextHorizontal}>kg</Text>
          </View>
        );

      case 11: // Meta de Treinos Semanal (CORRETO)
        const { width: screenWidth } = Dimensions.get('window');
        const ITEM_WIDTH = 100; // Largura da imagem
        const SPACING = 15; // Espaçamento entre as imagens
        const ITEM_FULL_WIDTH = ITEM_WIDTH + SPACING;
        const PADDING_HORIZONTAL = (screenWidth - ITEM_FULL_WIDTH) / 2;

        // Adiciona espaçadores para centralizar o primeiro e último item
        const streakDaysWithSpacers = [
          { id: 'spacer-left' },
          ...[2, 3, 4, 5, 6, 7].map(d => ({ id: d })),
          { id: 'spacer-right' }
        ];

        const handlePressItem = (day: number, index: number) => {
          setStreakGoal(day);
          flatListRef.current?.scrollToIndex({ index, animated: true });
        };

        const streakDays = [2, 3, 4, 5, 6, 7];
        return (
          <>
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryText}>
                Me comprometo ir à academia ao menos
              </Text>
              <Text style={styles.summaryHighlightBig}>
                {streakGoal} vezes por semana
              </Text>
            </View>

            <FlatList
              ref={flatListRef}
              data={streakDaysWithSpacers}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_FULL_WIDTH}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: PADDING_HORIZONTAL }}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              style={styles.streakScrollContainer}
              renderItem={({ item, index }) => {
                if (typeof item.id !== 'number') {
                  // Os espaçadores não são mais necessários com o paddingHorizontal
                  return null; // Correctly returns null for spacers
                }
                const day = item.id;
                // CORREÇÃO: O return estava faltando aqui, fazendo com que nada fosse renderizado.
                return (
                  <StreakGoalItem
                    day={day}
                    isSelected={streakGoal === day}
                    onPress={() => handlePressItem(day, index)}
                    imageSrc={getStreakImage(day)}
                    itemWidth={ITEM_WIDTH}
                    spacing={SPACING}
                  />
                );
              }}
            />
          </>
        );

      case 12: // Meta de Semanas Seguidas (CORRETO)
        const weekGoals = [1, 2, 4, 8, 16, 32];
        const barHeights = { 1: 30, 2: 50, 4: 70, 8: 90, 16: 110, 32: 130 }; // Alturas em pixels
        const weekColors = {
          1: '#008000', // Verde Escuro
          2: '#90EE90', // Verde
          4: '#DAF7A6', // Verde Claro
          8: '#FFD580', // Laranja claro (Salmão)
          16: '#FF5733', // Laranja
          32: '#FF0000', // Vermelho
        };

        const getMonths = (weeks: number) => {
          if (weeks < 4) return '';
          const months = Math.floor(weeks / 4);
          if (months === 1) return `ou {1} mês`;
          return `ou {${months}} meses`;
        };

        return (
          <>
            <View style={styles.barChartContainer}>
              {weekGoals.map(w => (
                <TouchableOpacity
                  key={w}
                  style={styles.barButton}
                  onPress={() => {
                    setWeeksStreakGoal(w);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeights[w as keyof typeof barHeights],
                        backgroundColor: weeksStreakGoal === w
                          ? weekColors[w as keyof typeof weekColors]
                          : '#173F5F'
                      }
                    ]}
                  />
                  <Text style={[styles.barLabel, weeksStreakGoal === w && {color: '#fff'}]}>{w}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryText}>
                Me comprometo ir à academia ao menos <Text style={styles.summaryHighlight}>{streakGoal}</Text> vezes por semana durante
              </Text>
              <Text style={styles.summaryHighlightBig}>
                {weeksStreakGoal} {weeksStreakGoal === 1 ? 'semana' : 'semanas'}
              </Text>
              <Text style={styles.summarySubText}>
                {getMonths(weeksStreakGoal)}
              </Text>
            </View>
          </>
        );
        
      case 17: // Tela de Processamento da Recomendação
        return (
          <View style={styles.stepContentWrapper}>
            <Text style={[styles.mainTitle, { textAlign: 'center', fontSize: 28, marginBottom: 20 }]}>
              Formulando uma ficha especialmente para você...
            </Text>
            {recommendationProgress === 1 && (
              <Animated.View style={[styles.checkIconContainer, checkIconStyle]}><FontAwesome name="check-circle" size={80} color="#1cb0f6" /></Animated.View>
            )}
            <View style={styles.recommendationProgressContainer}>
              <Animated.View style={[styles.recommendationProgressBar, { width: `${recommendationProgress * 100}%` }]} />
            </View>
          </View>
        );

      case 18: // Tela de Apresentação da Ficha Recomendada
        if (!recommendedFicha) return <ActivityIndicator color="#fff" />;
        const DIAS_SEMANA_ARRAY: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        const originalDays = new Set(recommendedTreinos.flatMap(t => t.diasSemana));
        
        // Ordena os treinos pela ordem dos dias da semana (dom a sab)
        const sortedTreinos = [...recommendedTreinos].sort((a, b) => (DIAS_SEMANA_ORDEM[a.diasSemana[0]] ?? 7) - (DIAS_SEMANA_ORDEM[b.diasSemana[0]] ?? 7));

        const renderGoalDifferenceCard = () => {
          if (!recommendedFicha || !recommendedFicha.totalDias || recommendedFicha.totalDias === (streakGoal || 0)) {
            return null;
          }
      
          const userGoal = streakGoal || 0;
          const workoutGoal = recommendedFicha.totalDias;
      
          if (workoutGoal > userGoal) {
            return (
              <View style={[styles.goalDiffCard, styles.goalDiffConstructive]}>
                <Text style={styles.goalDiffTitle}>Você consegue!</Text>
                <View style={styles.goalDiffImages}>
                  <Image source={getStreakImage(userGoal)} style={styles.goalDiffImage} />
                  <FontAwesome name="long-arrow-right" size={24} color="#fff" />
                  <Image source={getStreakImage(workoutGoal)} style={styles.goalDiffImage} />
                </View>
                <Text style={styles.goalDiffInfo}>Para aderir à este treino, você deverá ir na academia ao menos {workoutGoal} vezes por semana. Recomendamos que você <Text style={{ fontWeight: 'bold' }}>AUMENTE SUA META SEMANAL</Text>.</Text>
                <TouchableOpacity style={styles.goalDiffButtonConstructive} onPress={handleUpdateStreakGoal}>
                  <Text style={styles.goalDiffButtonText}>Aumentar meta para {workoutGoal} dias</Text>
                </TouchableOpacity>
              </View>
            );
          } else { // workoutGoal < userGoal
            return (
              <View style={[styles.goalDiffCard, styles.goalDiffDestructive]}>
                <Text style={styles.goalDiffTitle}>Este treino possui uma meta <Text style={{ fontStyle: 'italic' }}>Menor que a sua</Text></Text>
                <View style={styles.goalDiffImages}>
                  <Image source={getStreakImage(userGoal)} style={styles.goalDiffImage} />
                  <FontAwesome name="long-arrow-right" size={24} color="#fff" />
                  <Image source={getStreakImage(workoutGoal)} style={styles.goalDiffImage} />
                </View>
                <Text style={styles.goalDiffInfo}>Para seguir este plano, sua sequência pode ser comprometida. Recomendamos que você <Text style={{ fontWeight: 'bold' }}>AJUSTE SUA META SEMANAL</Text>.</Text>
                <TouchableOpacity style={styles.goalDiffButtonDestructive} onPress={handleUpdateStreakGoal}>
                  <Text style={styles.goalDiffButtonText}>Diminuir meta para {workoutGoal} dias</Text>
                </TouchableOpacity>
              </View>
            );
          }
        };
        return(
          <ScrollView style={{width: '100%'}} contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}>
            {renderGoalDifferenceCard()}
            <View style={styles.recommendationCard}>
              <Image source={getStreakImage(recommendedFicha.totalDias || 0)} style={styles.recommendationCardImage} />
              <View style={styles.recommendationCardTextContainer}>
                <Text style={styles.recommendationCardTitle}>{recommendedFicha.nome}</Text>
                <Text style={styles.recommendationCardDifficulty}>{recommendedFicha.dificuldade}</Text>
              </View>
            </View>

            <View style={styles.calendarContainer}>
              {DIAS_SEMANA_ARRAY.map((day) => (
                <View key={day} style={[styles.dayContainer, originalDays.has(day) && styles.dayScheduled]}>
                  <Text style={styles.dayText}>{day.toUpperCase()}</Text>
                </View>
              ))}
            </View>
            {sortedTreinos.map(treino => {
              return (
                <View key={treino.id} style={styles.treinoContainer}>
                  <Text style={styles.treinoTitle}>{treino.nome}</Text>
                  <Text style={styles.treinoDetailDays}>{treino.diasSemana.join(', ').toUpperCase()}</Text>
                  {treino.exercicios.map((ex, index) => {
                    const seriesCount = (ex as any).series || 0;
                    const reps = (ex as any).repeticoes || 'N/A';
                    return (
                      <View key={`${ex.modeloId}-${index}`} style={styles.exercicioContainer}>
                        <Text style={styles.exercicioText}>{ex.modelo.nome}</Text>
                        <Text style={styles.exercicioDetailText}>{seriesCount}x {reps}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        );
      case 19: // Nome e Foto
        return(
          <ScrollView style={{width: '100%'}} contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}>
            <View style={styles.finalSummaryContainer}>
              <TouchableOpacity onPress={handlePickImage}>
                {photoURI ? (
                  <Image source={{ uri: photoURI }} style={styles.pfp} />
                ) : (
                  <View style={styles.pfpPlaceholder}>
                    <FontAwesome name="camera" size={40} color="#555" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* --- Campos do Formulário --- */}
            <TextInput placeholder="Seu nome" value={nome} onChangeText={setNome} style={styles.nameInput} placeholderTextColor="#555" />
          </ScrollView>
        );
      case 20: // Credenciais
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

          </ScrollView>
        );

      case 14: // Data de Nascimento
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return (
          <View style={[styles.stepContentWrapper, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }]}>
            {/* Dia */}
            <View style={styles.dataSliderColumn}>
              <NumberSlider
                min={1}
                max={31}
                value={diaNascimento}
                onChange={(val) => setDiaNascimento(val)}
                initialValue={15}
                vertical
                fontSizeConfig={{ selected: 28, unselected: 16 }}
              />
            </View>
            {/* Mês */}
            <View style={styles.dataSliderColumn}>
              <NumberSlider
                min={1}
                max={12}
                value={mesNascimento}
                onChange={(val) => setMesNascimento(val)}
                initialValue={6}
                vertical
                displayValues={meses}
                fontSizeConfig={{ selected: 28, unselected: 16 }}
              />
            </View>
            {/* Ano */}
            <View style={styles.dataSliderColumn}>
              <NumberSlider
                min={new Date().getFullYear() - 80}
                max={new Date().getFullYear()}
                value={anoNascimento}
                onChange={(val) => setAnoNascimento(val)}
                initialValue={2000}
                vertical
                fontSizeConfig={{ selected: 28, unselected: 16 }}
              />
            </View>
          </View>
        );
      default: return null;
    }
  };

  const getStepSubtitle = () => {
    switch (onboardingStep) {
      case 5: return "Um sistema de constância que te incentiva à ir na academia e manter constância!";
      case 6: return "+500 exercícios animados para você treinar como um atleta profissional!";
      default: return null;
    }
  };

// ... (linha de adjacência)
// ... (linha de adjacência)
const getStepTitle = () => {
    switch (onboardingStep) {
      case 1: return "Onde você ouviu falar da GymBeat?";
      case 2: return "Você já tentou outros apps de treino antes?";
      case 3: return "Qual seu objetivo principal";
      case 4: return "O que você considera que seja seu maior problema para treinar?";
      case 5: return "Vamos ajudar você a superar este(s) obstáculos!";
      case 6: return "Vamos ajudar você a superar estes obstáculos!";
      // --- NOVOS TÍTULOS ---
      case 7: return ""; // Tela "Muito bem!" não tem título principal, o texto já é grande
      case 8: return "Onde você costuma treinar?";
      case 9: return "Você possui halteres e pesos livres em casa?";
      case 10: // Título condicional
        return `Como você se considera em relação à ${onboardingData.localTreino === 'Em casa' ? 'Exercícios físicos' : 'academia'}?`;
      case 11: return "Qual sua meta treinos por semana"; // (CORRETO)
      case 12: return "Qual sua meta de semanas em sequência?"; // (CORRETO)
      case 13: return "Qual seu gênero?"; // (CORRETO)
      case 14: return "Qual sua data de nascimento?";
      case 15: return "Qual sua altura?";
      case 16: return "E o seu peso?";
      case 17: return ""; // Tela de processamento não tem título
      case 18: return "Esta ficha é ideal para você";
      case 19: return "Para finalizar, como podemos te chamar?";
      case 20: return "Crie sua conta";
      // Adicionar títulos para os steps 18-25
      default: return "";
    }
}
    
const progress = (onboardingStep / TOTAL_FORM_STEPS) * 100;
  const title = getStepTitle();
  const subtitle = getStepSubtitle();
  const stepComplete = isStepComplete();

  // A tela de "Boas-vindas" (step 0) tem seu próprio layout de vídeo
  if (onboardingStep === 0) {
    return (
      <View style={styles.container}>
        {renderStepContent()}
      </View>
    );
  }

  // Layout para todos os outros passos do formulário (1-17+)
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.stepContainer}>
        
        {/* Cabeçalho com Progresso e Voltar */}
        <View style={styles.topNavContainer}>
          <TouchableOpacity style={styles.navButton} onPress={handleBack}>
            {/* O botão de voltar aparece em todos os steps > 0 */}
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          
          <ProgressBar progress={progress} />
          
          {/* View vazia para manter a barra de progresso centralizada */}
        </View>

        {/* Container Principal do Conteúdo (sem ScrollView) */}
        <View style={styles.contentContainer}>
          {/* Título e Subtítulo */}
          {title && <Text style={styles.mainTitle}>{title}</Text>}
          {subtitle && <Text style={styles.featureSubtitle}>{subtitle}</Text>}

          {/* Renderiza o conteúdo da etapa atual (opções, inputs, etc.) */}
          {renderStepContent()}
        </View>

        {/* Rodapé com Botão "Avançar" */}
        {/* Oculta o botão no step 0 (tela de welcome) 
          e no step 17 (tela de credenciais), pois ele tem seu próprio botão "Finalizar Cadastro"
        */}
        {onboardingStep > 0 && ![20].includes(onboardingStep) && (
          <View style={styles.footer}>
            {/* Mostra o botão na etapa 17 apenas quando o progresso for 100%, caso contrário, não mostra nada no rodapé. */}
            {onboardingStep === 17 && recommendationProgress < 1 ? null : (
              <>
                {onboardingStep === 18 && (
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => { setAcceptedFicha(false); handleNext(); }}>
                    <Text style={styles.secondaryButtonText}>Quero criar meu próprio treino</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.nextButton, !stepComplete && styles.nextButtonDisabled]}
                  onPress={handleNext}
                  disabled={!stepComplete}
                >
                  <Text style={styles.nextButtonText}>
                    {onboardingStep === TOTAL_FORM_STEPS ? "Finalizar Cadastro" :
                     [5, 6, 7].includes(onboardingStep) ? "Eu vou conseguir" :
                     onboardingStep === 18 ? "Usar este treino" :
                     "Próximo"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

      </View>
    </SafeAreaView>
  );

};
  
  const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", backgroundColor: "#01090c" },
    welcomeScreenContainer: { flex: 1, backgroundColor: "#030405", justifyContent: 'flex-end' },
    welcomeContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
    welcomeBottomContent: {
      width: '100%',
      padding: 30,
      backgroundColor: '#030405fa',
      paddingTop: 15,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      gap: 5,
      borderTopWidth: 1,
      borderTopColor: '#ffffff1a',
      paddingBottom: 60,
    },
    welcomeHeader: {
      alignItems: 'center',
      height: 60,
      width: '100%',
      marginBottom: 15,
    },
    welcomeVideo: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '65%', // Ocupa 65% da parte superior da tela
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
      fontSize: 25,
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
      backgroundColor: "#01090c",
      // Removido borderRadius: 12,
    },
    footer: {
      // Removido: flexDirection: 'row',
      // Removido: justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      // Removido: borderTopWidth: 1,
      // Removido: borderTopColor: '#ffffff1a',
    },
    secondaryButton: {
      paddingVertical: 15,
      width: '100%',
      alignItems: 'center',
      marginBottom: 10,
    },
    secondaryButtonText: {
      color: '#1cb0f6',
      fontSize: 16,
    },
    // Removido: backButton e backButtonText
    // Removido: skipButtonText
    
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
      fontWeight: '600',
      textAlign: "left",
      color: "#fff",
      letterSpacing: 1,
      lineHeight: 40,
    },
    subtitle: { fontSize: 16, color: '#ccc', textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
    // Removido: stepTitle
    // NOVO: Título principal da tela
    mainTitle: {
      fontSize: 28, // Um pouco menor que o da Welcome
      fontWeight: '600',
      textAlign: "left",
      color: "#fff",
      width: '100%', // Ocupa a largura
      marginBottom: 25, // Espaço antes das opções
    },
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
    nameInput: {
      backgroundColor: 'transparent',
      color: '#fff',
      borderBottomWidth: 2,
      borderBottomColor: '#ffffff1a',
      textAlign: 'center',
      fontSize: 42,
      fontWeight: 'bold',
      paddingBottom: 10,
      marginBottom: 20,
      width: '100%',
      paddingTop: 30,
    },  
    nextButton: {
      backgroundColor: '#1cb0f6',
      paddingVertical: 20,
      // Removido: paddingHorizontal: 40,
      borderRadius: 12, // Mais arredondado
      width: '100%', // Ocupa 100%
      alignItems: 'center', // Centraliza o texto
    },
    nextButtonDisabled: {
      backgroundColor: '#555',
    },
    nextButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    progressBarContainer: { 
      height: 6, // Mais fino
      flex: 1,
      backgroundColor: '#173F5F', 
      borderRadius: 3, 
      marginHorizontal: 0, // Espaçamento dos botões
      flexDirection: 'row',
    },
    progressBar: { 
      height: '100%', 
      width: '100%',
      backgroundColor: '#1cb0f6', 
      borderRadius: 3 
    },
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
      flexGrow: 1,
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
    optionContainerVertical: { 
      flexDirection: 'column', 
      alignItems: 'stretch', 
      // Removido: marginBottom: 20, 
      gap: 12, // Espaçamento entre os botões
      width: '100%', // Ocupa 100%
    },
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
    pfp: { width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: '#ffffff1a' },
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
      width: '100%',
    },
    // NOVO: Botão de navegação (seta de voltar e view vazia)
    navButton: {
      width: 44, // Largura de toque
      height: 44, // Altura de toque
      justifyContent: 'center',
      alignItems: 'center',
    },
    // skipButtonContainer: { // Removido
    //   width: 50,
    //   alignItems: 'flex-end',
    // },
      // NOVO ESTILO para o container do conteúdo principal
    contentContainer: {
      flex: 1,
      justifyContent: 'flex-start', // Alinha conteúdo no topo
      alignItems: 'center',
      // paddingTop: 15, // Removido
      marginTop: 15, // Adicionado para criar espaço
    },
    
    // --- ADICIONAR ESTES ESTILOS ---
      featureImage: {
        width: '100%',
        height: '80%', // Ajuste a altura conforme necessário
        resizeMode: 'contain',
        marginBottom: 20, // Reduzido para aproximar do subtítulo
      },
      featureSubtitle: {
        fontSize: 18,
        color: '#ccc',
        textAlign: 'center',
        lineHeight: 25,
        paddingHorizontal: 15,
      },

      summaryHighlightBig: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 28, // Maior
    textAlign: 'center',
    marginTop: 5,
  },
  summarySubText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  streakScrollContainer: {
    width: '100%',
    flexGrow: 0, // Impede que o scroll ocupe todo o espaço
    marginTop: 20,
  },
  streakScrollContent: {
    // Este estilo não é mais necessário com a FlatList
  },
  streakImageButton: {
    // O TouchableOpacity agora é apenas um wrapper
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakImageSlider: {
    height: 100,
    resizeMode: 'contain',
    opacity: 0.5, // Inativo
    transform: [{ scale: 0.8 }], // Menor
  },
  streakImageSliderSelected: {
    opacity: 1,
    transform: [{ scale: 1.1 }], // Maior
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 180, // Altura fixa para o container do gráfico
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  barButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 30, // Largura da barra
    borderRadius: 6,
    marginBottom: 10,
  },
  barLabel: {
    color: '#888', // Cor inativa
    fontSize: 16,
    fontWeight: 'bold',
  },
  offlineContainer: {
    backgroundColor: '#1C1C1E', // Um cinza escuro
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  offlineText: {
    color: '#999',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dataSliderColumn: {
    height: '80%',
    // CORREÇÃO: A largura de 60% para cada uma das 3 colunas extrapolava a tela.
    width: '30%',
  }
  ,
  checkIconContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationProgressContainer: {
    width: '80%',
    height: 8,
    backgroundColor: '#173F5F',
    borderRadius: 4,
    marginTop: 20,
  },
  recommendationProgressBar: {
    height: '100%',
    backgroundColor: '#1cb0f6',
    borderRadius: 4,
  },
  recommendationCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff1a',
    padding: 20,
    width: '100%',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationCardTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  recommendationCardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  recommendationCardDifficulty: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 4,
  },
  recommendationCardImage: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginRight: 15,
  },
  calendarContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, width: '100%' },
  dayContainer: { flex: 1, paddingVertical: 10, marginHorizontal: 3, borderRadius: 8, backgroundColor: '#1f1f1f', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  dayScheduled: { backgroundColor: 'rgba(28, 176, 246, 0.5)', borderColor: '#1cb0f6' },
  dayText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  treinoContainer: {
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    width: '100%',
    borderWidth: 1,
    borderTopColor: '#ffffff2a',
    borderLeftColor: '#ffffff2a', 
    borderBottomColor: '#ffffff1a',
    borderRightColor: '#ffffff1a',
  },
  treinoTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  treinoDetailDays: { fontSize: 12, color: '#1cb0f6', marginTop: 5 },
  exercicioContainer: {
    marginLeft: 10,
    marginTop: 12,
  },
  exercicioText: {
    fontSize: 16, color: '#fff', fontWeight: '500',
  },
  exercicioDetailText: {
    fontSize: 14, color: '#aaa', marginTop: 4,
  },
  // Goal Difference Card
  goalDiffCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
  },
  goalDiffDestructive: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  goalDiffConstructive: {
    backgroundColor: 'rgba(28, 176, 246, 0.15)',
    borderColor: 'rgba(28, 176, 246, 0.5)',
  },
  goalDiffTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  goalDiffImages: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 15,
  },
  goalDiffImage: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  goalDiffInfo: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 15,
  },
  goalDiffButtonDestructive: {
    backgroundColor: '#ff3b30',
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8,
  },
  goalDiffButtonConstructive: {
    backgroundColor: '#1cb0f63a',
    borderColor: '#1cb0f6',
    borderWidth: 1,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  goalDiffButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  // Estilo para a unidade 'cm' ao lado do NumberSlider

      // --- FIM DOS NOVOS ESTILOS ---
  })
