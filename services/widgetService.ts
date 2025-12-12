import { Log } from '@/models/log';
import { DiaSemana, Treino } from '@/models/treino';
import { Platform } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.br.com.gymbeat'; // Deve ser igual ao do app.config.js e Xcode

// Estruturas correspondentes ao Swift
interface TodayWorkoutData {
  name: string;
  muscleGroup: string;
  duration: string;
  isCompleted: boolean;
}

interface WeekStreakData {
  daysTrained: boolean[];
  totalDays: number;
}

export const widgetService = {
  async updateAll(treinos: Treino[], logs: Log[]) {
    if (Platform.OS !== 'ios') return;

    try {
      await this.updateTodayWorkout(treinos, logs);
      await this.updateWeekStreak(logs);
      
      // Opcional: Se estiver usando react-native-widgetkit para forçar reload
      // WidgetKit.reloadAllTimelines();
    } catch (error) {
      console.error("Erro ao atualizar widgets:", error);
    }
  },

  async updateTodayWorkout(treinos: Treino[], logs: Log[]) {
    // 1. Identificar o dia da semana
    const diasMap: { [key: number]: DiaSemana } = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
    const hojeIndex = new Date().getDay();
    const hojeKey = diasMap[hojeIndex];

    // 2. Achar o treino de hoje
    const treinoHoje = treinos.find(t => t.diasSemana.includes(hojeKey));

    // 3. Verificar se já foi concluído hoje
    const hojeStart = new Date();
    hojeStart.setHours(0, 0, 0, 0);
    
    const logHoje = logs.find(l => {
        if (!l.horarioFim || !l.treino) return false;
        const logData = new Date(l.horarioFim.seconds * 1000); // Ajuste conforme seu modelo de data (Firestore Timestamp)
        return logData >= hojeStart && l.treino.id === treinoHoje?.id;
    });

    const data: TodayWorkoutData = treinoHoje ? {
        name: treinoHoje.nome,
        muscleGroup: treinoHoje.descricao || "Geral", // Ajuste conforme seu modelo
        duration: `${(treinoHoje.exercicios?.length || 0) * 3} min`, // Estimativa
        isCompleted: !!logHoje
    } : {
        name: "Descanso",
        muscleGroup: "Recupere-se",
        duration: "0 min",
        isCompleted: false
    };

    await SharedGroupPreferences.setItem('widget_today_workout', data, APP_GROUP);
  },

  async updateWeekStreak(logs: Log[]) {
    const hoje = new Date();
    const diaSemana = hoje.getDay(); // 0 (Dom) - 6 (Sab)
    
    // Pegar o início desta semana (Domingo)
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaSemana);
    inicioSemana.setHours(0,0,0,0);

    // Mapear quais dias tiveram treino
    const diasTreinados = [false, false, false, false, false, false, false];
    
    logs.forEach(log => {
        if(!log.horarioFim) return;
        const dataLog = new Date(log.horarioFim.seconds * 1000);
        if (dataLog >= inicioSemana) {
            diasTreinados[dataLog.getDay()] = true;
        }
    });

    const totalDays = diasTreinados.filter(Boolean).length;

    const data: WeekStreakData = {
        daysTrained: diasTreinados,
        totalDays: totalDays
    };

    await SharedGroupPreferences.setItem('widget_week_streak', data, APP_GROUP);
  }
};