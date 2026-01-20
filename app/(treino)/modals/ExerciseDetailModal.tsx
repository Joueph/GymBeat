import { ExerciseProgressionView } from '@/components/ExerciseProgressionView';
import { ExerciseVariationsView } from '@/components/ExerciseVariationsView';
import { VideoListItem } from '@/components/VideoListItem';
import { Exercicio, Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SerieComTipo extends Serie {
  type?: 'normal' | 'dropset';
}

interface ExerciseDetailModalProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercicio | null;
  allUserLogs: Log[];
  treinoId?: string;
  onSelectMachine?: (machineId: string | undefined, machineName: string | undefined) => void;
  isPremium?: boolean;
  navigateToPaywall?: () => void;
}

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({ visible, onClose, exercise, allUserLogs, treinoId, onSelectMachine, isPremium, navigateToPaywall }) => {
  const [activeTab, setActiveTab] = React.useState<'progression' | 'variations'>('progression');

  React.useEffect(() => {
    if (visible) setActiveTab('progression');
  }, [visible]);

  if (!exercise) {
    return null;
  }

  let normalSeriesCounter = 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Detalhes do Exercício</Text>
          <TouchableOpacity onPress={onClose}>
            <FontAwesome name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.detailModalContentWrapper}>
          <ScrollView>
            <View>
              {exercise.modelo.imagemUrl && (
                <VideoListItem uri={exercise.modelo.imagemUrl} style={styles.detailModalVideo} />
              )}
              <Text style={styles.detailModalExerciseName}>{exercise.modelo.nome}</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'progression' && styles.activeTabButton]}
                onPress={() => setActiveTab('progression')}
              >
                <Text style={[styles.tabText, activeTab === 'progression' && styles.activeTabText]}>Progresso</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'variations' && styles.activeTabButton]}
                onPress={() => setActiveTab('variations')}
              >
                <Text style={[styles.tabText, activeTab === 'variations' && styles.activeTabText]}>Variações</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'progression' ? (
              <ExerciseProgressionView
                exerciseId={exercise.modeloId}
                currentTreinoId={treinoId}
                allUserLogs={isPremium ? allUserLogs : allUserLogs.slice(0, 5)}
              />
            ) : (
              <ExerciseVariationsView
                exerciseId={exercise.modeloId}
                currentMachineId={exercise.machineId}
                onSelectMachine={(id, name) => {
                  if (onSelectMachine) onSelectMachine(id, name);
                }}
                isPremium={isPremium}
                navigateToPaywall={navigateToPaywall}
              />
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeArea: { flex: 1, backgroundColor: '#0B0D10' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  detailModalContentWrapper: { flex: 1, padding: 5 },
  detailModalVideo: { width: '100%', aspectRatio: 1, borderRadius: 15, backgroundColor: '#000', marginBottom: 10 },
  detailModalExerciseName: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', paddingVertical: 10 },
  detailModalSeriesContainer: { backgroundColor: 'transparent', marginTop: 15 },
  detailModalSetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a2a33', padding: 15, borderRadius: 10, marginBottom: 10 },
  detailModalSetTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  detailModalSetText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dropsetTag: { color: '#fff', backgroundColor: '#1cb0f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10 },
  detailModalSetInfoContainer: { flexDirection: 'row', alignItems: 'center' },
  detailModalSetInfo: { color: '#ccc', fontSize: 16, marginLeft: 20 },

  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 15,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#1cb0f6',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
});