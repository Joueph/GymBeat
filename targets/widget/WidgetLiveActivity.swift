import ActivityKit
import WidgetKit
import SwiftUI

struct GymBeatWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GymBeatAttributes.self) { context in
            // --- LOCK SCREEN ---
            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "dumbbell.fill").foregroundColor(.orange)
                    Text(context.state.exerciseName)
                        .font(.headline)
                        .foregroundColor(.white)
                    Spacer()
                    // Exibe Série X/Y
                    Text("Série \(context.state.currentSet)/\(context.state.totalSets)")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }
                
                // O CRONÔMETRO NATIVO
                Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                    .font(.system(size: 48, weight: .bold))
                    .monospacedDigit()
                    .foregroundColor(Color(red: 1.0, green: 0.58, blue: 0.0))
                
                Text(context.state.stateLabel)
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.8))
            
        } dynamicIsland: { context in
            DynamicIsland {
                // --- EXPANDED ---
                DynamicIslandExpandedRegion(.leading) {
                     HStack {
                        Image(systemName: "dumbbell.fill").foregroundColor(.orange)
                        Text(context.state.exerciseName).foregroundColor(.white)
                     }.padding(.leading)
                }
                DynamicIslandExpandedRegion(.trailing) {
                     Text("\(context.state.currentSet)/\(context.state.totalSets)")
                        .foregroundColor(.gray)
                        .padding(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    // Timer Grande na Ilha Expandida
                    Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                        .font(.system(size: 40, weight: .semibold))
                        .monospacedDigit()
                        .foregroundColor(.yellow)
                        .frame(height: 50)
                }
            } compactLeading: {
                Image(systemName: "timer").foregroundColor(.orange)
            } compactTrailing: {
                // Timer Pequeno na Ilha Compacta
                Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                    .monospacedDigit()
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.yellow)
                    .frame(width: 42)
            } minimal: {
                Text(timerInterval: Date()...context.state.endTime, countsDown: true)
                    .monospacedDigit()
                    .font(.system(size: 12))
                    .foregroundColor(.yellow)
            }
        }
    }
}