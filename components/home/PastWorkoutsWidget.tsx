import { Log } from '@/models/log';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type PastWorkoutsWidgetProps = {
    logs: Log[];
    onSelectLog: (log: Log) => void;
};

const formatDate = (date: any): string => {
    if (!date) return '';
    const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '';

    // Format: DD/MM/YYYY
    return d.toLocaleDateString('pt-BR');
};

const formatTime = (date: any): string => {
    if (!date) return '';
    const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '';

    // Format: HH:mm
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const calculateDuration = (start: any, end: any): string => {
    if (!start || !end) return '';
    const s = typeof start.toDate === 'function' ? start.toDate() : new Date(start);
    const e = typeof end.toDate === 'function' ? end.toDate() : new Date(end);

    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';

    const diffMs = e.getTime() - s.getTime();
    if (diffMs < 0) return '';

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
};

export const PastWorkoutsWidget: React.FC<PastWorkoutsWidgetProps> = ({ logs, onSelectLog }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Filter completed logs and sort by date descending
    const completedLogs = logs
        .filter(log => log.status === 'concluido' && log.horarioFim)
        .sort((a, b) => {
            const timeA = a.horarioFim?.seconds ? a.horarioFim.seconds * 1000 : (a.horarioFim ? new Date(a.horarioFim).getTime() : 0);
            const timeB = b.horarioFim?.seconds ? b.horarioFim.seconds * 1000 : (b.horarioFim ? new Date(b.horarioFim).getTime() : 0);
            return timeB - timeA;
        });

    const displayLogs = isExpanded ? completedLogs.slice(0, 10) : completedLogs.slice(0, 3);

    if (completedLogs.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Treinos Passados</Text>
                {completedLogs.length > 3 && (
                    <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
                        <Text style={styles.expandText}>{isExpanded ? 'Ver menos' : 'Ver mais'}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {displayLogs.map(log => {
                const day = formatDate(log.horarioFim);
                const duration = calculateDuration(log.horarioInicio, log.horarioFim);
                const volume = log.cargaAcumulada ? `${Math.round(log.cargaAcumulada)}kg` : '-';

                return (
                    <TouchableOpacity key={log.id} style={styles.logItem} onPress={() => onSelectLog(log)}>
                        <View style={styles.logIconContainer}>
                            <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />
                        </View>
                        <View style={styles.logDetails}>
                            <Text style={styles.logTitle}>{log.treino?.nome || 'Treino Sem Nome'}</Text>
                            <Text style={styles.logSubtitle}>{day} • {duration} • {volume}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#555" />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#EAEAEA',
        opacity: 0.7,
    },
    expandText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: '500',
    },
    logItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1D23',
        padding: 15,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 0.5,
        borderColor: '#2A2E37',
    },
    logIconContainer: {
        marginRight: 15,
    },
    logDetails: {
        flex: 1,
    },
    logTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    logSubtitle: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
    },
});
