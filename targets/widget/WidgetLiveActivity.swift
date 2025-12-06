import ActivityKit
import WidgetKit
import SwiftUI

struct GymBeatWidgetLiveActivity: Widget {
    
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GymBeatAttributes.self) { context in
            // --- LOCK SCREEN / BANNER ---
            VStack(spacing: 8) {
                // Cabeçalho Comum
                HStack {
                    Image(systemName: context.state.isRestMode ? "timer" : "dumbbell.fill")
                        .foregroundColor(Color(hex: 0x3B82F6))
                    Text(context.state.exerciseName)
                        .font(.headline)
                        .foregroundColor(.white)
                    Spacer()
                    Text("Série \(context.state.currentSet)/\(context.state.totalSets)")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }
                
                if context.state.isRestMode, let endTime = context.state.endTime {
                    // MODO DESCANSO (Timer)
                    VStack(alignment: .center) {
                        Text(timerInterval: Date()...endTime, countsDown: true)
                            .font(.system(size: 48, weight: .bold))
                            .monospacedDigit()
                            .foregroundColor(Color(hex: 0x3B82F6))
                            .multilineTextAlignment(.center)
                        Text("Descanso")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    // MODO EXERCÍCIO (Peso/Reps)
                    HStack(spacing: 20) {
                        VStack {
                            Text(context.state.reps)
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            Text("Reps")
                                .font(.caption2)
                                .foregroundColor(.gray)
                        }
                        
                        VStack {
                            Text(context.state.weight)
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            Text("Carga")
                                .font(.caption2)
                                .foregroundColor(.gray)
                        }
                        
                        if context.state.dropsetCount > 0 {
                            VStack {
                                Text("\(context.state.dropsetCount)")
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .foregroundColor(.red)
                                Text("Drops")
                                    .font(.caption2)
                                    .foregroundColor(.red)
                            }
                        }
                    }
                    .padding(.vertical, 5)
                }
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.9))
            
        } dynamicIsland: { context in // <--- Agora conectado corretamente ao ActivityConfiguration
            DynamicIsland {
                // --- EXPANDED ---
                DynamicIslandExpandedRegion(.leading) {
                    HStack {
                        Image(systemName: context.state.isRestMode ? "timer" : "dumbbell")
                            .foregroundColor(context.state.isRestMode ? .orange : .blue)
                    }.padding(.leading)
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.currentSet)/\(context.state.totalSets)")
                        .foregroundColor(.gray)
                        .padding(.trailing)
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    if context.state.isRestMode, let endTime = context.state.endTime {
                        // Timer Grande
                        Text(timerInterval: Date()...endTime, countsDown: true)
                            .font(.system(size: 40, weight: .semibold))
                            .monospacedDigit()
                            .foregroundColor(.yellow)
                            .frame(height: 50)
                    } else {
                        // Info do Exercício Expandida
                        HStack(alignment: .center, spacing: 16) {
                            Label(context.state.reps, systemImage: "arrow.triangle.2.circlepath")
                            Label(context.state.weight, systemImage: "scalemass")
                            if context.state.dropsetCount > 0 {
                                Label("\(context.state.dropsetCount)", systemImage: "exclamationmark.triangle")
                                    .foregroundColor(.red)
                            }
                        }
                        .foregroundColor(.white)
                        .font(.headline)
                        .padding(.top, 10)
                    }
                }
                
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.exerciseName)
                        .foregroundColor(.white)
                        .font(.headline)
                        .lineLimit(1)
                }
                
            } compactLeading: {
                // Ícone muda conforme o modo
                Image(systemName: context.state.isRestMode ? "timer" : "dumbbell.fill")
                    .foregroundColor(context.state.isRestMode ? .orange : .blue)
            } compactTrailing: {
                if context.state.isRestMode, let endTime = context.state.endTime {
                    Text(timerInterval: Date()...endTime, countsDown: true)
                        .monospacedDigit()
                        .frame(width: 40)
                        .font(.system(size: 13))
                        .foregroundColor(.yellow)
                } else {
                    // No modo exercício colapsado, mostramos a série atual
                    Text("S \(context.state.currentSet)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                }
            } minimal: {
                Image(systemName: context.state.isRestMode ? "timer" : "dumbbell")
                    .foregroundColor(context.state.isRestMode ? .orange : .blue)
            }
        }
    }
}

extension Color {
    init(hex: UInt, opacity: Double = 1.0) {
        let red = Double((hex & 0xff0000) >> 16) / 255.0
        let green = Double((hex & 0xff00) >> 8) / 255.0
        let blue = Double((hex & 0xff) >> 0) / 255.0
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: opacity)
    }
}
