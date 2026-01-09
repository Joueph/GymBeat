import { FontAwesome } from '@expo/vector-icons';
import React, { memo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ficha } from '../../models/ficha';
import { Log } from '../../models/log';
import { Treino } from '../../models/treino';
import { Usuario } from '../../models/usuario';
import { getFichaAtiva } from '../../services/fichaService';
import { getLogsByUsuarioId } from '../../services/logService';
import { getTreinosByIds } from '../../services/treinoService';

export interface FriendData extends Usuario {
    hasTrainedToday: boolean;
    weeklyLogs: Log[];
}

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

export const FriendListItem = memo(({ item }: { item: FriendData }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [friendFicha, setFriendFicha] = useState<Ficha | null>(null);
    const [friendTreinos, setFriendTreinos] = useState<Treino[]>([]);
    const [monthlyLogs, setMonthlyLogs] = useState<Log[]>([]);

    const toggleExpand = async () => {
        const expanding = !isExpanded;
        setIsExpanded(expanding);

        if (expanding && !friendFicha) {
            setIsLoadingDetails(true);
            try {
                const [ficha, logs] = await Promise.all([
                    getFichaAtiva(item.id),
                    getLogsByUsuarioId(item.id)
                ]);
                setFriendFicha(ficha);
                setMonthlyLogs(logs);

                if (ficha && ficha.treinos.length > 0) {
                    const treinos = await getTreinosByIds(ficha.treinos);
                    setFriendTreinos(treinos);
                }
            } catch (error) {
                console.error("Error fetching friend details:", error);
                Alert.alert("Erro", "Não foi possível carregar os detalhes do amigo.");
            } finally {
                setIsLoadingDetails(false);
            }
        }
    };

    const renderWeeklyDots = () => {
        const trainedDays = new Set(
            item.weeklyLogs.map(log => toDate(log.horarioFim)?.getDay())
        );

        return (
            <View style={styles.weeklyDotsContainer}>
                {Array.from({ length: 7 }).map((_, i) => (
                    <View key={i} style={[styles.dot, trainedDays.has(i) && styles.dotFilled]} />
                ))}
            </View>
        );
    };

    const renderMonthlyCalendar = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const loggedDays = new Set(
            monthlyLogs
                .filter(log => {
                    const logDate = toDate(log.horarioFim);
                    return logDate && logDate.getFullYear() === year && logDate.getMonth() === month;
                })
                .map(log => toDate(log.horarioFim)!.getDate())
        );

        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<View key={`blank-${i}`} style={styles.dayCell} />);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const isLogged = loggedDays.has(i);
            days.push(
                <View key={i} style={styles.dayCell}>
                    <View style={[styles.dayRing, isLogged && styles.loggedDayRing]}>
                        <Text style={styles.dayText}>{i}</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.calendarContainer}>
                <View style={styles.weekDaysContainer}>
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => <Text key={i} style={styles.weekDayText}>{day}</Text>)}
                </View>
                <View style={styles.calendarGrid}>{days}</View>
            </View>
        );
    };

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={toggleExpand}>
                {item.photoURL ? (
                    <Image source={{ uri: item.photoURL }} style={styles.pfp} />
                ) : (
                    <View style={styles.pfpPlaceholder}>
                        <FontAwesome name="user" size={20} color="#555" />
                    </View>
                )}
                <View style={styles.friendInfo}>
                    <Text style={styles.friendName} numberOfLines={1}>{item.nome}</Text>
                    {renderWeeklyDots()}
                </View>
                <FontAwesome name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#ccc" />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.expandedContent}>
                    {isLoadingDetails ? (
                        <ActivityIndicator color="#fff" style={{ marginVertical: 20 }} />
                    ) : (
                        <>
                            {friendFicha ? (
                                <View style={styles.fichaContainer}>
                                    <Text style={styles.expandedSectionTitle}>Ficha Ativa: {friendFicha.nome}</Text>
                                    {friendTreinos.map(treino => (
                                        <View key={treino.id} style={styles.treinoItem}>
                                            <Text style={styles.treinoName}>{treino.nome}</Text>
                                            <Text style={styles.treinoDays}>{treino.diasSemana.join(', ').toUpperCase()}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>Este amigo não possui uma ficha ativa.</Text>
                            )}
                            <View style={styles.divider} />
                            <Text style={styles.expandedSectionTitle}>Atividade em {new Date().toLocaleString('pt-BR', { month: 'long' })}</Text>
                            {renderMonthlyCalendar()}
                        </>
                    )}
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    card: {
        marginVertical: 8,
        marginHorizontal: 16,
        backgroundColor: '#1A1D23',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffffff1a',
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    pfp: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    pfpPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#0B0D10',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    weeklyDotsContainer: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#333',
    },
    dotFilled: {
        backgroundColor: '#DAA520',
    },
    expandedContent: {
        padding: 15,
        paddingTop: 0,
        borderTopWidth: 0.5,
        borderTopColor: '#ffffff1a',
        marginTop: 10,
    },
    expandedSectionTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    fichaContainer: {
        paddingTop: 10,
        marginBottom: 10,
    },
    treinoItem: {
        backgroundColor: '#0B0D10',
        borderRadius: 6,
        padding: 10,
        marginBottom: 5,
    },
    treinoName: {
        color: '#fff',
        fontWeight: 'bold',
    },
    treinoDays: {
        color: '#aaa',
        fontSize: 12,
        marginTop: 2,
    },
    calendarContainer: {
        width: '100%',
        backgroundColor: '#0B0D10',
        borderRadius: 10,
        padding: 10,
    },
    weekDaysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 10,
    },
    weekDayText: {
        color: '#ccc',
        fontWeight: 'bold',
        width: '14.28%',
        textAlign: 'center',
        fontSize: 12,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayRing: {
        width: '85%',
        height: '85%',
        borderRadius: 50,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: 'transparent',
    },
    loggedDayRing: {
        borderColor: '#DAA520',
    },
    dayText: {
        color: '#fff',
        fontSize: 12,
    },
    emptyText: {
        color: '#aaa',
        fontSize: 16,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: '#ffffff1a',
        marginVertical: 20,
    }
});
