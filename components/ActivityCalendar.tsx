import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActivityCalendarProps {
    loggedDays: Set<string>;
}

export const ActivityCalendar = ({ loggedDays }: ActivityCalendarProps) => {
    const [calendarDate, setCalendarDate] = useState(new Date());

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthName = calendarDate.toLocaleString('pt-BR', { month: 'long' });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<View key={`blank-${i}`} style={styles.dayCell} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dayDate = new Date(year, month, i);
        // Ensure date string comparison matches how loggedDays are stored (toDateString())
        const isLogged = loggedDays.has(dayDate.toDateString());
        days.push(
            <View key={i} style={styles.dayCell}>
                <View style={[styles.dayRing, isLogged ? styles.loggedDayRing : styles.defaultDayRing]}>
                    <Text style={styles.dayText}>{i}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={() => setCalendarDate(new Date(year, month - 1, 1))}>
                    <FontAwesome name="chevron-left" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.calendarMonth}>{`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`}</Text>
                <TouchableOpacity onPress={() => setCalendarDate(new Date(year, month + 1, 1))}>
                    <FontAwesome name="chevron-right" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
            <View style={styles.weekDaysContainer}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => <Text key={i} style={styles.weekDayText}>{day}</Text>)}
            </View>
            <View style={styles.calendarGrid}>
                {days}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    calendarContainer: {
        width: '100%',
        backgroundColor: '#ffffff13',
        borderRadius: 10,
        padding: 15,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#ffffff52',
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    calendarMonth: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
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
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    defaultDayRing: {
        borderColor: '#555',
    },
    loggedDayRing: {
        borderColor: '#DAA520',
    },
    dayText: {
        color: '#fff',
    },
});
