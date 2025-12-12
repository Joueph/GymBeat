import WidgetKit
import SwiftUI

// MARK: - 1. Data Models (Shared with React Native)
struct TodayWorkoutData: Codable {
    let name: String
    let muscleGroup: String
    let duration: String
    let isCompleted: Bool
}

struct WeekStreakData: Codable {
    // Array de 7 booleanos representando Seg-Dom ou Dom-Sab
    let daysTrained: [Bool]
    let totalDays: Int
}

// MARK: - 2. Data Manager (App Groups)
struct WidgetDataManager {
    // IMPORTANTE: Deve corresponder ao grupo no app.config.js
    static let appGroup = "group.br.com.gymbeat"
    
    static func getTodayWorkout() -> TodayWorkoutData? {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: "widget_today_workout") else { return nil }
        return try? JSONDecoder().decode(TodayWorkoutData.self, from: data)
    }
    
    static func getWeekStreak() -> WeekStreakData? {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: "widget_week_streak") else { return nil }
        return try? JSONDecoder().decode(WeekStreakData.self, from: data)
    }
}

// MARK: - 3. Timeline Provider
struct GymBeatProvider: TimelineProvider {
    func placeholder(in context: Context) -> GymBeatEntry {
        GymBeatEntry(date: Date(), workout: TodayWorkoutData(name: "Treino A", muscleGroup: "Peito e Tríceps", duration: "60 min", isCompleted: false), streak: WeekStreakData(daysTrained: [false, true, true, false, true, false, false], totalDays: 3))
    }

    func getSnapshot(in context: Context, completion: @escaping (GymBeatEntry) -> Void) {
        let entry = GymBeatEntry(date: Date(), workout: WidgetDataManager.getTodayWorkout(), streak: WidgetDataManager.getWeekStreak())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GymBeatEntry>) -> Void) {
        let workout = WidgetDataManager.getTodayWorkout()
        let streak = WidgetDataManager.getWeekStreak()
        
        let entry = GymBeatEntry(date: Date(), workout: workout, streak: streak)
        
        // Atualizar a cada 15 minutos
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct GymBeatEntry: TimelineEntry {
    let date: Date
    let workout: TodayWorkoutData?
    let streak: WeekStreakData?
}

// MARK: - 4. Views

// --- Widget 1: Treino de Hoje ---
struct TodayWorkoutView: View {
    var workout: TodayWorkoutData?
    @Environment(\.widgetFamily) var family
    
    // Cores do GymBeat
    let gymBlue = Color(red: 28/255, green: 176/255, blue: 246/255)
    let bgDark = Color(red: 0.1, green: 0.1, blue: 0.1)

    var body: some View {
        ZStack {
            bgDark.ignoresSafeArea()
            
            if let workout = workout {
                VStack(alignment: .leading) {
                    HStack {
                        Image(systemName: "dumbbell.fill").foregroundColor(gymBlue)
                        Text("HOJE").font(.caption).bold().foregroundColor(.gray)
                        Spacer()
                    }
                    
                    Spacer()
                    
                    Text(workout.name)
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(workout.muscleGroup)
                        .font(.subheadline)
                        .foregroundColor(.gray)
                    
                    Spacer()
                    
                    // Diferença de layout entre Small e Medium
                    if family == .systemMedium {
                        HStack {
                            Label(workout.duration, systemImage: "clock").font(.caption).foregroundColor(.gray)
                            Spacer()
                            if workout.isCompleted {
                                Text("CONCLUÍDO").font(.caption).bold().foregroundColor(gymBlue)
                            }
                        }
                    } else {
                        // Layout Compacto (Tile)
                        if workout.isCompleted {
                            Image(systemName: "checkmark.circle.fill").foregroundColor(gymBlue)
                        } else {
                            Text(workout.duration).font(.caption2).foregroundColor(.gray)
                        }
                    }
                }
                .padding()
            } else {
                // Estado vazio/Descanso
                VStack {
                    Image(systemName: "moon.zzz.fill").font(.largeTitle).foregroundColor(.gray)
                    Text("Descanso").foregroundColor(.white).font(.headline)
                }
            }
        }
    }
}

// --- Widget 2: Dias Treinados ---
struct WeekStreakView: View {
    var streak: WeekStreakData?
    let gymBlue = Color(red: 28/255, green: 176/255, blue: 246/255)
    let bgDark = Color(red: 0.1, green: 0.1, blue: 0.1)
    let days = ["D", "S", "T", "Q", "Q", "S", "S"]
    
    var body: some View {
        ZStack {
            bgDark.ignoresSafeArea()
            
            VStack(alignment: .leading) {
                HStack {
                    Image(systemName: "flame.fill").foregroundColor(.orange)
                    Text("FREQUÊNCIA").font(.caption).bold().foregroundColor(.gray)
                    Spacer()
                    if let total = streak?.totalDays {
                        Text("\(total) dias").font(.caption).bold().foregroundColor(.white)
                    }
                }
                .padding(.bottom, 5)
                
                Spacer()
                
                HStack(spacing: 0) {
                    ForEach(0..<7) { index in
                        VStack(spacing: 8) {
                            Text(days[index])
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.gray)
                            
                            Circle()
                                .fill(isTrained(index) ? gymBlue : Color.gray.opacity(0.3))
                                .frame(width: 20, height: 20)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                Spacer()
            }
            .padding()
        }
    }
    
    func isTrained(_ index: Int) -> Bool {
        guard let s = streak, index < s.daysTrained.count else { return false }
        return s.daysTrained[index]
    }
}

// MARK: - 5. Widget Configuration

struct TodayWorkoutWidget: Widget {
    let kind: String = "TodayWorkoutWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GymBeatProvider()) { entry in
            TodayWorkoutView(workout: entry.workout)
                .containerBackground(Color(red: 0.1, green: 0.1, blue: 0.1), for: .widget)
        }
        .configurationDisplayName("Treino de Hoje")
        .description("Veja o seu treino agendado.")
        .supportedFamilies([.systemSmall, .systemMedium]) // Tile e Medium
    }
}

struct StreakWidget: Widget {
    let kind: String = "StreakWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GymBeatProvider()) { entry in
            WeekStreakView(streak: entry.streak)
                .containerBackground(Color(red: 0.1, green: 0.1, blue: 0.1), for: .widget)
        }
        .configurationDisplayName("Dias Treinados")
        .description("Acompanhe a sua consistência semanal.")
        .supportedFamilies([.systemMedium]) // Apenas Medium
    }
}