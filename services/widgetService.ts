import { Log } from '@/models/log';
import { DiaSemana, Treino } from '@/models/treino';
import { reloadWidgetTimelines } from '@/modules/notifications-live-activity';
import { Platform } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';
import { getPendingOperations } from './offlineSyncService';

const APP_GROUP = 'group.br.com.gymbeat';

// ... (Interfaces e helper parseLogDate permanecem iguais)
interface TodayWorkoutData {
  name: string;
  muscleGroup: string;
  duration: string;
  isCompleted: boolean;
  dayLabel: string;
}

interface WeekStreakData {
  daysTrained: boolean[];
  totalDays: number;
}

const parseLogDate = (dateField: any): Date | null => {
    if (!dateField) return null;
    if (dateField instanceof Date) return dateField;
    if (typeof dateField.toDate === 'function') return dateField.toDate();
    if (dateField.seconds) return new Date(dateField.seconds * 1000);
    if (typeof dateField === 'string') return new Date(dateField);
    if (typeof dateField === 'number') return new Date(dateField);
    return null;
};

export const widgetService = {
  async updateAll(treinos: Treino[], logs: Log[]) {
    if (Platform.OS !== 'ios') return;
    
    console.log(`[WidgetDebug] 🚀 Iniciando updateAll. Treinos: ${treinos.length}, Logs (memória): ${logs.length}`);

    try {
      const pendingOps = await getPendingOperations();
      const pendingLogs = pendingOps
          .filter(op => op.collectionPath === 'logs' && op.type === 'create')
          .map(op => op.data as Log);
      
      console.log(`[WidgetDebug] 📂 Logs pendentes offline encontrados: ${pendingLogs.length}`);

      const allLogs = [...logs, ...pendingLogs];
      const uniqueLogsMap = new Map<string, Log>();
      allLogs.forEach(l => { if (l.id) uniqueLogsMap.set(l.id, l); });
      const uniqueLogs = Array.from(uniqueLogsMap.values());

      console.log(`[WidgetDebug] 📊 Total de logs únicos para processamento: ${uniqueLogs.length}`);

      await this.updateTodayWorkout(treinos, uniqueLogs);
      await this.updateWeekStreak(uniqueLogs);
      
      console.log("[WidgetDebug] 🔄 Chamando reloadWidgetTimelines() nativo...");
      reloadWidgetTimelines(); 
      
    } catch (error) {
      console.error("[WidgetDebug] ❌ Erro ao atualizar widgets:", error);
    }
  },

  async updateTodayWorkout(treinos: Treino[], logs: Log[]) {
    const diasMap: { [key: number]: DiaSemana } = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
    const diasNomeMap: { [key: number]: string } = { 0: 'DOMINGO', 1: 'SEGUNDA', 2: 'TERÇA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA', 6: 'SÁBADO' };
    
    const hojeDate = new Date();
    const hojeIndex = hojeDate.getDay();
    const hojeKey = diasMap[hojeIndex];

    console.log(`[WidgetDebug] 📅 Hoje é: ${hojeKey} (Index: ${hojeIndex})`);

    let treinoDisplay = treinos.find(t => t.diasSemana && t.diasSemana.includes(hojeKey));
    let dayLabel = "HOJE";
    
    if (!treinoDisplay) {
        console.log("[WidgetDebug] 🔍 Nenhum treino agendado para hoje. Procurando próximo...");
        for (let i = 1; i <= 7; i++) {
            const nextIndex = (hojeIndex + i) % 7;
            const nextKey = diasMap[nextIndex];
            const nextTreino = treinos.find(t => t.diasSemana && t.diasSemana.includes(nextKey));
            
            if (nextTreino) {
                treinoDisplay = nextTreino;
                dayLabel = i === 1 ? "AMANHÃ" : diasNomeMap[nextIndex];
                console.log(`[WidgetDebug] 👉 Próximo treino encontrado: ${nextTreino.nome} (${dayLabel})`);
                break;
            }
        }
    } else {
        console.log(`[WidgetDebug] 👉 Treino de hoje encontrado: ${treinoDisplay.nome}`);
    }

    let isCompleted = false;
    
    if (dayLabel === "HOJE" && treinoDisplay) {
        const hojeStart = new Date();
        hojeStart.setHours(0, 0, 0, 0);
        
        const logHoje = logs.find(l => {
            if (!l.horarioFim) return false; 
            const logData = parseLogDate(l.horarioFim);
            if (!logData || !l.treino) return false;
            
            // Log extra para depurar comparação de datas se necessário
            // console.log(`[WidgetDebug] Comparando log ${l.id} - Data: ${logData.toISOString()} vs Hoje: ${hojeStart.toISOString()}`);
            
            return logData >= hojeStart && l.treino.id === treinoDisplay?.id;
        });
        
        if (logHoje) {
            console.log(`[WidgetDebug] ✅ Treino CONCLUÍDO encontrado! Log ID: ${logHoje.id}`);
            isCompleted = true;
        } else {
            console.log(`[WidgetDebug] ⏳ Treino ainda não concluído (ou log não encontrado).`);
        }
    }

    const data: TodayWorkoutData = treinoDisplay ? {
        name: treinoDisplay.nome,
        muscleGroup: treinoDisplay.descricao || "Geral",
        duration: `${(treinoDisplay.exercicios?.length || 0) * 4} min`,
        isCompleted: isCompleted,
        dayLabel: dayLabel
    } : {
        name: "Descanso",
        muscleGroup: "Recupere-se",
        duration: "0 min",
        isCompleted: false,
        dayLabel: "HOJE"
    };

    console.log(`[WidgetDebug] 💾 Salvando JSON para 'widget_today_workout':`, JSON.stringify(data));
    await SharedGroupPreferences.setItem('widget_today_workout', JSON.stringify(data), APP_GROUP);
  },

  async updateWeekStreak(logs: Log[]) {
    // ... (lógica de dias)
    const hoje = new Date();
    const diaSemana = hoje.getDay(); 
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaSemana);
    inicioSemana.setHours(0,0,0,0);

    const diasTreinados = [false, false, false, false, false, false, false];
    
    logs.forEach(log => {
        if(!log.horarioFim) return;
        const dataLog = parseLogDate(log.horarioFim);
        if (!dataLog) return;
        if (dataLog >= inicioSemana) {
            diasTreinados[dataLog.getDay()] = true;
        }
    });

    const totalDays = diasTreinados.filter(Boolean).length;
    const data: WeekStreakData = {
        daysTrained: diasTreinados,
        totalDays: totalDays
    };
    
    console.log(`[WidgetDebug] 💾 Salvando JSON para 'widget_week_streak':`, JSON.stringify(data));
    await SharedGroupPreferences.setItem('widget_week_streak', JSON.stringify(data), APP_GROUP);
  }
};