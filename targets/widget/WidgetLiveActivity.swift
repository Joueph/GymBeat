import ActivityKit
import WidgetKit
import SwiftUI

struct GymBeatWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        // ATENÇÃO: Usando GymBeatAttributes (o novo)
        ActivityConfiguration(for: GymBeatAttributes.self) { context in
            // --- LOCK SCREEN ---
            VStack {
                HStack {
                    Image(systemName: "dumbbell.fill").foregroundColor(.orange)
                    Text(context.state.exerciseName)
                        .font(.headline)
                        .foregroundColor(.white)
                }
                Text(context.state.stateLabel)
                    .font(.largeTitle)
                    .foregroundColor(.yellow)
                Text("Série \(context.state.currentSet)")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.8))
            
        } dynamicIsland: { context in
            DynamicIsland {
                // --- EXPANDED ---
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.exerciseName)
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.stateLabel)
                        .font(.title)
                        .foregroundColor(.yellow)
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill").foregroundColor(.orange)
            } compactTrailing: {
                Text("\(context.state.currentSet)")
            } minimal: {
                Image(systemName: "timer")
            }
        }
    }
}