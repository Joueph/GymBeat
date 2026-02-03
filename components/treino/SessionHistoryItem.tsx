import { Log } from '@/models/log';
import { calculateDuration, formatDate } from '@/utils/treinoUtils';
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SessionHistoryItemProps {
    log: Log;
    onPress: () => void;
}

export const SessionHistoryItem: React.FC<SessionHistoryItemProps> = ({ log, onPress }) => (
    <TouchableOpacity style={styles.historyItem} onPress={onPress}>
        <View style={styles.historyLeft}>
            <FontAwesome5 name="calendar-alt" size={14} color="#888" style={{ marginRight: 8 }} />
            <Text style={styles.historyDate}>{formatDate(log.horarioFim || log.horarioInicio)}</Text>
        </View>
        <View style={styles.historyRight}>
            <View style={styles.historyStat}>
                <FontAwesome5 name="clock" size={12} color="#666" style={{ marginRight: 4 }} />
                <Text style={styles.historyValue}>{calculateDuration(log.horarioInicio, log.horarioFim)}</Text>
            </View>
            {log.cargaAcumulada ? (
                <View style={[styles.historyStat, { marginLeft: 12 }]}>
                    <FontAwesome5 name="weight-hanging" size={12} color="#666" style={{ marginRight: 4 }} />
                    <Text style={styles.historyValue}>{Math.round(log.cargaAcumulada)}kg</Text>
                </View>
            ) : null}
            <FontAwesome5 name="chevron-right" size={12} color="#444" style={{ marginLeft: 12 }} />
        </View>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    historyItem: {
        backgroundColor: '#1A1D23',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222',
    },
    historyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    historyRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    historyDate: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    historyStat: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    historyValue: {
        color: '#ccc',
        fontSize: 12,
    },
});
