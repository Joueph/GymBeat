import ActivityKit
import SwiftUI

struct GymBeatWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // R3: Informações unificadas
        var deadline: Double // Timestamp unix. Se 0 ou passado, não há timer ativo.
        var exerciseName: String
        var currentSet: Int
        var totalSets: Int
        var weight: String
        var reps: String
        var dropsetCount: Int
    }
}