import ActivityKit
import WidgetKit
import SwiftUI

struct GymBeatWidgetLiveActivity: Widget {
    // R2: Tom de azul padrão (#1cb0f6)
    let gymBeatBlue = Color(red: 28/255, green: 176/255, blue: 246/255)
    
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GymBeatWidgetAttributes.self) { context in
            // LOCK SCREEN / BANNER UI
            // R3: Verifica se o timer está ativo (deadline no futuro)
            let isTimerActive = Date(timeIntervalSince1970: context.state.deadline / 1000) > Date()
            
            VStack(spacing: 0) {
                HStack {
                    // Ícone e Nome do Exercício
                    Image(systemName: "dumbbell.fill")
                        .foregroundColor(gymBeatBlue) // R2
                    Text(context.state.exerciseName)
                        .font(.headline)
                        .foregroundColor(.white)
                    Spacer()
                    
                    if isTimerActive {
                        // R3: Se timer ativo, mostra contagem regressiva
                        Text(timerInterval: Date()...Date(timeIntervalSince1970: context.state.deadline / 1000), countsDown: true)
                            .monospacedDigit()
                            .font(.title2)
                            .foregroundColor(gymBeatBlue) // R2
                    } else {
                        // R3: Se timer inativo, mostra info da série
                        Text("\(context.state.currentSet)/\(context.state.totalSets)")
                            .font(.title2)
                            .foregroundColor(gymBeatBlue) // R2
                    }
                }
                .padding()
                
                // Barra de progresso ou Detalhes extras
                if isTimerActive {
                     ProgressView(timerInterval: Date()...Date(timeIntervalSince1970: context.state.deadline / 1000), countsDown: true) {
                        EmptyView()
                     }
                     .tint(gymBeatBlue) // R2
                     .padding(.horizontal)
                     .padding(.bottom, 10)
                } else {
                    HStack {
                         Label(context.state.weight, systemImage: "scalemass")
                         Spacer()
                         Label(context.state.reps, systemImage: "arrow.triangle.2.circlepath")
                    }
                    .font(.caption)
                    .foregroundColor(.gray)
                    .padding(.horizontal)
                    .padding(.bottom, 10)
                }
            }
            .background(Color(red: 0.1, green: 0.1, blue: 0.1)) // Fundo escuro
            .activityBackgroundTint(Color.black)
            .activitySystemActionForegroundColor(Color.white)

        } dynamicIsland: { context in
            // DYNAMIC ISLAND UI
            let isTimerActive = Date(timeIntervalSince1970: context.state.deadline / 1000) > Date()

            return DynamicIsland {
                // Expanded Region
                DynamicIslandExpandedRegion(.leading) {
                    HStack {
                        Image(systemName: "dumbbell.fill").foregroundColor(gymBeatBlue)
                        Text("\(context.state.currentSet)/\(context.state.totalSets)").font(.caption)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if isTimerActive {
                         Text(timerInterval: Date()...Date(timeIntervalSince1970: context.state.deadline / 1000), countsDown: true)
                            .monospacedDigit()
                            .foregroundColor(gymBeatBlue)
                            .multilineTextAlignment(.trailing)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    // Area central expandida
                    VStack {
                        Text(context.state.exerciseName)
                            .font(.headline)
                        
                        if !isTimerActive {
                             HStack(spacing: 20) {
                                Text("Carga: \(context.state.weight)")
                                Text("Reps: \(context.state.reps)")
                             }.font(.subheadline).foregroundColor(.gray)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill")
                    .foregroundColor(gymBeatBlue) // R2
            } compactTrailing: {
                if isTimerActive {
                    Text(timerInterval: Date()...Date(timeIntervalSince1970: context.state.deadline / 1000), countsDown: true)
                        .monospacedDigit()
                        .frame(width: 40)
                        .foregroundColor(gymBeatBlue) // R2
                } else {
                     Text("\(context.state.currentSet)/\(context.state.totalSets)")
                        .foregroundColor(gymBeatBlue) // R2
                }
            } minimal: {
                Image(systemName: isTimerActive ? "timer" : "dumbbell.fill")
                    .foregroundColor(gymBeatBlue) // R2
            }
        }
    }
}