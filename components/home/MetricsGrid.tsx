import { MetricCard } from '@/components/MetricCard';
import { Usuario } from '@/models/usuario';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type MetricsGridProps = {
    userProfile: Usuario | null;
    weeklyMetrics: any;
    historyMetrics: any;
    onEditWeight: () => void;
    onOpenConfig: () => void;
    config: { key: string; visible: boolean; fullWidth: boolean }[];
};

export const MetricsGrid: React.FC<MetricsGridProps> = ({ userProfile, weeklyMetrics, historyMetrics, onEditWeight, onOpenConfig, config }) => {
    const getLatestWeight = () => {
        if (!userProfile?.historicoPeso || userProfile.historicoPeso.length === 0) return 70;
        const sortedHistorico = [...userProfile.historicoPeso]
            .map(h => ({ ...h, data: typeof (h.data as any)?.toDate === 'function' ? (h.data as any).toDate() : new Date(h.data as any) }))
            .sort((a, b) => b.data.getTime() - a.data.getTime());
        return sortedHistorico[0].valor;
    };

    if (!userProfile) return null;

    const renderCard = (item: { key: string; visible: boolean; fullWidth: boolean }) => {
        const widthStyle: any = item.fullWidth ? { width: '100%' } : { width: '48.9%' };

        switch (item.key) {
            case 'weight':
                return (
                    <View key={item.key} style={[widthStyle]}>
                        <MetricCard metricName="Peso Corporal" metricValue={`${getLatestWeight()} kg`} isEditable={true} onEdit={onEditWeight} historyData={historyMetrics.pesoCorporal} />
                    </View>
                );
            case 'time':
                return (
                    <View key={item.key} style={[widthStyle]}>
                        <MetricCard metricName="Tempo de treino" metricValue={weeklyMetrics.tempoDeTreino} historyData={historyMetrics.tempoDeTreino} />
                    </View>
                );
            case 'sets':
                return (
                    <View key={item.key} style={[widthStyle]}>
                        <MetricCard metricName="Séries" metricValue={String(weeklyMetrics.series)} historyData={historyMetrics.series} />
                    </View>
                );
            case 'volume':
                return (
                    <View key={item.key} style={[widthStyle]}>
                        <MetricCard metricName="Volume" metricValue={weeklyMetrics.volume} historyData={historyMetrics.volume} />
                    </View>
                );
            default:
                return null;
        }
    };

    const getSortedItems = () => {
        const visibleItems = config.filter(item => item.visible);
        const sortedItems: typeof visibleItems = [];
        const usedIndices = new Set<number>();

        for (let i = 0; i < visibleItems.length; i++) {
            if (usedIndices.has(i)) continue;

            const item = visibleItems[i];
            sortedItems.push(item);
            usedIndices.add(i);

            if (!item.fullWidth) {
                // Find next half-width item
                for (let j = i + 1; j < visibleItems.length; j++) {
                    if (!usedIndices.has(j) && !visibleItems[j].fullWidth) {
                        sortedItems.push(visibleItems[j]);
                        usedIndices.add(j);
                        break;
                    }
                }
            }
        }
        return sortedItems;
    };

    const sortedConfig = getSortedItems();

    return (
        <>
            <View style={styles.headerContainer}>
                <Text style={styles.sectionTitle}>Minhas métricas</Text>
                <TouchableOpacity onPress={onOpenConfig} style={styles.editButton}>
                    <Text style={styles.editButtonText}>Editar</Text>
                    <Ionicons name="pencil" size={14} color="#888" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
            </View>
            <View style={styles.metricsContainer}>
                {sortedConfig.map(item => renderCard(item))}
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#EAEAEA', opacity: 0.7, },
    editButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
    editButtonText: { color: '#888', fontSize: 14, fontWeight: '500' },
    metricsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, },
});
