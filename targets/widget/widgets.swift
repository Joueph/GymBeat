import WidgetKit
import SwiftUI

// MARK: - 1. Data Models
struct TodayWorkoutData: Codable {
    let name: String
    let muscleGroup: String
    let duration: String
    let isCompleted: Bool
    let dayLabel: String
}

struct WeekStreakData: Codable {
    let daysTrained: [Bool]
    let totalDays: Int
}

// MARK: - 2. Data Manager
// (Mantém a lógica de leitura de JSON String para Data corrigida anteriormente)
struct WidgetDataManager {
    static let appGroup = "group.br.com.gymbeat"
    
    static func getTodayWorkout() -> TodayWorkoutData? {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let jsonString = defaults.string(forKey: "widget_today_workout"),
              let data = jsonString.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(TodayWorkoutData.self, from: data)
    }
    
    static func getWeekStreak() -> WeekStreakData? {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let jsonString = defaults.string(forKey: "widget_week_streak"),
              let data = jsonString.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WeekStreakData.self, from: data)
    }
}

// MARK: - 3. Timeline Provider
struct GymBeatProvider: TimelineProvider {
    // Placeholder para pré-visualização (XCode/Galeria)
    func placeholder(in context: Context) -> GymBeatEntry {
        // Exemplo com treino não concluído
        GymBeatEntry(date: Date(), workout: TodayWorkoutData(name: "Treino A", muscleGroup: "Peito e Tríceps", duration: "60 min", isCompleted: false, dayLabel: "HOJE"), streak: WeekStreakData(daysTrained: [false, true, true, false, true, false, false], totalDays: 3))
    }

    func getSnapshot(in context: Context, completion: @escaping (GymBeatEntry) -> Void) {
        let entry = GymBeatEntry(date: Date(), workout: WidgetDataManager.getTodayWorkout(), streak: WidgetDataManager.getWeekStreak())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GymBeatEntry>) -> Void) {
        let workout = WidgetDataManager.getTodayWorkout()
        let streak = WidgetDataManager.getWeekStreak()
        
        let entry = GymBeatEntry(date: Date(), workout: workout, streak: streak)
        
        // Política .never: O widget só atualiza quando o App principal solicitar via WidgetCenter.shared.reloadAllTimelines()
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct GymBeatEntry: TimelineEntry {
    let date: Date
    let workout: TodayWorkoutData?
    let streak: WeekStreakData?
}

// MARK: - 4. Views & Colors

extension Color {
    // Fundo padrão escuro (#0B0D10)
    static let appBackground = Color(red: 11/255, green: 13/255, blue: 16/255)
    // Azul de destaque do app
    static let gymBlue = Color(red: 28/255, green: 176/255, blue: 246/255)
    // NOVO: Fundo azul escuro para quando o treino está concluído (uma versão mais fechada do gymBlue)
    static let completedBackground = Color(red: 14/255, green: 88/255, blue: 123/255)
}

struct TodayWorkoutView: View {
    var workout: TodayWorkoutData?
    @Environment(\.widgetFamily) var family

    // Computed property para determinar a cor de fundo atual
    var currentBackgroundColor: Color {
        if let workout = workout, workout.isCompleted {
            return Color.completedBackground
        } else {
            return Color.appBackground
        }
    }

    var body: some View {
        ZStack {
            // Aplica a cor de fundo condicional
            currentBackgroundColor.ignoresSafeArea()
            
            if let workout = workout {
                if workout.isCompleted {
                    // --- LAYOUT DE TREINO CONCLUÍDO ---
                    VStack(spacing: 8) {
                        Spacer()
                        // Ícone de check grande
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: family == .systemSmall ? 34 : 44))
                            .foregroundColor(.white)
                        
                        Text("TREINO REALIZADO!")
                            .font(family == .systemSmall ? .headline : .title3)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)

                        // Mostra o nome do treino concluído menorzinho embaixo
                        Text(workout.name)
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.8))
                        Spacer()
                    }
                    .padding()
                    
                } else {
                    // --- LAYOUT PADRÃO (A FAZER) ---
                    VStack(alignment: .leading) {
                        HStack {
                            Image(systemName: "dumbbell.fill").foregroundColor(.gymBlue)
                            Text(workout.dayLabel.uppercased())
                                .font(.caption).bold().foregroundColor(.gray)
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
                        
                        if family == .systemMedium {
                            HStack {
                                Label(workout.duration, systemImage: "clock").font(.caption).foregroundColor(.gray)
                                Spacer()
                            }
                        } else {
                            Text(workout.duration).font(.caption2).foregroundColor(.gray)
                        }
                    }
                    .padding()
                }
            } else {
                // Estado vazio (Descanso)
                VStack {
                    Image(systemName: "moon.zzz.fill").font(.largeTitle).foregroundColor(.gray)
                    Text("Descanso").foregroundColor(.white).font(.headline)
                }
            }
        }
    }
}

struct WeekStreakView: View {
    var streak: WeekStreakData?
    let days = ["D", "S", "T", "Q", "Q", "S", "S"]
    
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            
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
                                .fill(isTrained(index) ? Color.gymBlue : Color.gray.opacity(0.3))
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

// MARK: - 5. Widgets Configuration

struct TodayWorkoutWidget: Widget {
    let kind: String = "TodayWorkoutWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GymBeatProvider()) { entry in
            TodayWorkoutView(workout: entry.workout)
                // O containerBackground também precisa ser condicional para iOS 17+
                .containerBackground(
                    entry.workout?.isCompleted == true ? Color.completedBackground : Color.appBackground,
                    for: .widget
                )
        }
        .configurationDisplayName("Treino de Hoje")
        .description("Veja o seu treino agendado.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

struct StreakWidget: Widget {
    let kind: String = "StreakWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GymBeatProvider()) { entry in
            WeekStreakView(streak: entry.streak)
                .containerBackground(Color.appBackground, for: .widget)
        }
        .configurationDisplayName("Dias Treinados")
        .description("Acompanhe a sua consistência semanal.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}