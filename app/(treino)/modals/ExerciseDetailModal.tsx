import { VideoListItem } from '@/components/VideoListItem';
import { Exercicio, Serie } from '@/models/exercicio';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SerieComTipo extends Serie {
  type?: 'normal' | 'dropset';
}

interface ExerciseDetailModalProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercicio | null;
}

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({ visible, onClose, exercise }) => {
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
            <View style={styles.detailModalSeriesContainer}>
              {(exercise.series as SerieComTipo[]).map((serieItem, index) => {
                const isDropset = serieItem.type === 'dropset';
                if (!isDropset) normalSeriesCounter++;

                return (
                  <View key={serieItem.id || `serie-detail-${index}`} style={[styles.detailModalSetRow, isDropset && { marginLeft: 20 }]}>
                    <View style={styles.detailModalSetTitleContainer}>
                      {isDropset && <FontAwesome5 name="arrow-down" size={14} color="#ccc" style={{ marginRight: 8 }} />}
                      <Text style={styles.detailModalSetText}>
                        {isDropset ? 'Dropset' : `Série ${normalSeriesCounter}`}
                      </Text>
                    </View>
                    {isDropset && <Text style={styles.dropsetTag}>DROPSET</Text>}
                    <View style={styles.detailModalSetInfoContainer}>
                      <Text style={styles.detailModalSetInfo}>{serieItem.repeticoes}</Text>
                      <Text style={styles.detailModalSetInfo}>{serieItem.peso || 0} kg</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeArea: { flex: 1, backgroundColor: '#141414' },
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
});