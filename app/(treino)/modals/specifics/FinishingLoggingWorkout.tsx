import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Serie } from '../../../../models/exercicio'; // Import Serie
import { Ficha } from '../../../../models/ficha';
import { Log } from '../../../../models/log';
import { addFicha, getFichasByUsuarioId } from '../../../../services/fichaService';
import { addLog } from '../../../../services/logService';
import { useAuth } from '../../../authprovider';
import { LoggedExercise } from '../../LoggingDuringWorkout';

interface FinishingLoggingWorkoutProps {
  visible: boolean;
  onClose: () => void;
  loggedExercises: LoggedExercise[];
  totalLoad: number;
  elapsedTime: number; // in seconds
  startTime: Date | null;
  endTime: Date | null; // Should be passed from LoggingDuringWorkout
  initialWorkoutName: string;
  userWeight: number;
}

export const FinishingLoggingWorkout = ({
  visible,
  onClose,
  loggedExercises,
  totalLoad,
  elapsedTime,
  startTime,
  endTime,
  initialWorkoutName,
  userWeight,
}: FinishingLoggingWorkoutProps) => {
  const router = useRouter();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [workoutName, setWorkoutName] = useState(initialWorkoutName);
  const [isSaving, setIsSaving] = useState(false);
  const [userFichas, setUserFichas] = useState<Ficha[]>([]);
  const [selectedFichaId, setSelectedFichaId] = useState<string | null>(null);
  const [newFichaName, setNewFichaName] = useState('Nova Ficha');
  const [fichaOption, setFichaOption] = useState<'existing' | 'new'>('existing'); // Default to existing if available
  const [loadingFichas, setLoadingFichas] = useState(true);

  useEffect(() => {
    if (visible) {
      setWorkoutName(initialWorkoutName);
      setCurrentStep(1);
      setLoadingFichas(true);
      if (user) {
        getFichasByUsuarioId(user.id)
          .then((fichas) => {
            setUserFichas(fichas);
            if (fichas.length > 0) {
              // Pre-select the most recently created ficha (assuming last in array is most recent)
              setSelectedFichaId(fichas[fichas.length - 1].id);
              setFichaOption('existing');
            } else {
              setFichaOption('new');
            }
          })
          .catch((error) => console.error('Error fetching user fichas:', error))
          .finally(() => setLoadingFichas(false));
      } else {
        setLoadingFichas(false);
        setFichaOption('new');
      }
    }
  }, [visible, initialWorkoutName, user]);

  const handleConfirmSave = () => {
    setCurrentStep(2);
  };

  const handleDontSave = () => {
    Alert.alert(
      'Descartar Treino',
      'Tem certeza? Você perderá todo o progresso deste treino.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: onClose },
      ]
    );
  };

  const handleNextStep2 = () => {
    if (!workoutName.trim()) {
      Alert.alert('Erro', 'Por favor, dê um nome ao seu treino.');
      return;
    }
    setCurrentStep(3);
  };

  const handleSaveWorkout = async () => {
    if (!user || !startTime || !endTime) {
      Alert.alert('Erro', 'Dados do usuário ou do treino incompletos.');
      return;
    }

    setIsSaving(true);
    let finalFichaId: string | null = null;

    try {
      if (fichaOption === 'new') {
        if (!newFichaName.trim()) {
          Alert.alert('Erro', 'Por favor, dê um nome à nova ficha.');
          setIsSaving(false);
          return;
        }
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + 2); // Ficha válida por 2 meses

        const newFicha: Omit<Ficha, "id"> = { // Changed from Partial<Ficha>
          usuarioId: user.id,
          nome: newFichaName.trim(),
          treinos: [], // Será atualizado com o ID do treino
          dataExpiracao: expirationDate,
          opcoes: 'Treino avulso',
          ativa: false, // Não ativa automaticamente
        };
        finalFichaId = await addFicha(newFicha);
      } else if (selectedFichaId) {
        finalFichaId = selectedFichaId;
      }

      if (!finalFichaId) {
        Alert.alert('Erro', 'Nenhuma ficha selecionada ou criada.');
        setIsSaving(false);
        return;
      }

      const newLog: Partial<Log> = {
          usuarioId: user.id,
        treino: {
          id: `freestyle-${Date.now()}`, // Unique ID for freestyle workout
          fichaId: finalFichaId,
          nome: workoutName.trim(),
          usuarioId: user.id, // Add this line
          exercicios: loggedExercises.map((ex) => ({
            ...ex,
            series: ex.series.map((s: Serie) => ({ ...s, conclido: true })), // Mark all series as complete
          })),
          diasSemana: [], // Freestyle doesn't have fixed days
          intervalo: { min: 0, seg: 0 }, // Default interval
        },
        exercicios: loggedExercises.map((ex) => ({
          ...ex,
          series: ex.series.map((s: Serie) => ({ ...s, conclido: true })),
        })),
        horarioInicio: startTime,
        horarioFim: endTime,
        status: 'conclido',
        cargaAcumulada: totalLoad,
        exerciciosFeitos: loggedExercises.map((ex) => ({
          ...ex,
          series: ex.series.map((s: Serie) => ({ ...s, conclido: true })),
        })),
        nomeTreino: workoutName.trim(),
        observacoes: loggedExercises.map((ex) => ex.notes).filter(Boolean).join('; '),
      };

      const logId = await addLog(newLog);

      Alert.alert('Sucesso', 'Treino salvo com sucesso!');
      onClose();
      router.replace({ pathname: '/(treino)/treinoCompleto', params: { logId } });
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Erro', 'Não foi possível salvar o treino. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Parabéns!</Text>
            <Text style={styles.subtitle}>Você terminou seu treino, gostaria de salvá-lo?</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmSave}>
              <Text style={styles.primaryButtonText}>Sim!</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleDontSave}>
              <Text style={styles.secondaryButtonText}>Não</Text>
            </TouchableOpacity>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Qual o nome que você deseja dar a ele?</Text>
            <TextInput
              style={styles.input}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder="Nome do Treino"
              placeholderTextColor="#888"
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleNextStep2}>
              <Text style={styles.primaryButtonText}>Próximo</Text>
            </TouchableOpacity>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            {loadingFichas ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <>
                {userFichas.length === 0 ? (
                  <>
                    <Text style={styles.title}>Criar uma nova ficha para ele?</Text>
                    <TextInput
                      style={styles.input}
                      value={newFichaName}
                      onChangeText={setNewFichaName}
                      placeholder="Nome da Nova Ficha"
                      placeholderTextColor="#888"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.title}>Deseja inserir em uma das suas fichas?</Text>
                    <FlatList
                      data={userFichas}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[
                            styles.fichaOption,
                            selectedFichaId === item.id && styles.fichaOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedFichaId(item.id);
                            setFichaOption('existing');
                          }}
                        >
                          <Text style={styles.fichaOptionText}>{item.nome}</Text>
                          {selectedFichaId === item.id && (
                            <FontAwesome name="check-circle" size={20} color="#1cb0f6" />
                          )}
                        </TouchableOpacity>
                      )}
                    />
                    <TouchableOpacity
                      style={[
                        styles.fichaOption,
                        fichaOption === 'new' && styles.fichaOptionSelected,
                        { marginTop: 10 },
                      ]}
                      onPress={() => setFichaOption('new')}
                    >
                      <Text style={styles.fichaOptionText}>Criar uma nova ficha</Text>
                      {fichaOption === 'new' && (
                        <FontAwesome name="check-circle" size={20} color="#1cb0f6" />
                      )}
                    </TouchableOpacity>
                    {fichaOption === 'new' && (
                      <TextInput
                        style={[styles.input, { marginTop: 10 }]}
                        value={newFichaName}
                        onChangeText={setNewFichaName}
                        placeholder="Como esta nova ficha deve se chamar?"
                        placeholderTextColor="#888"
                      />
                    )}
                  </>
                )}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSaveWorkout}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Próximo</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Salvar Treino</Text>
          <TouchableOpacity onPress={onClose}>
            <FontAwesome name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        {renderStepContent()}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#030405',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    color: '#ccc',
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#1cb0f6',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  secondaryButtonText: {
    color: '#ccc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#1cb0f6',
    marginBottom: 40,
  },
  fichaOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
  },
  fichaOptionSelected: {
    borderColor: '#1cb0f6',
    borderWidth: 2,
  },
  fichaOptionText: {
    color: '#fff',
    fontSize: 16,
  },
});