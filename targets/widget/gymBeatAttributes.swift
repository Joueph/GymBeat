import ActivityKit
import SwiftUI

struct GymBeatWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var deadline: Double
        var exerciseName: String
        var currentSet: Int
        var totalSets: Int
        var weight: String
        var reps: String
        var dropsetCount: Int
        var isFinished: Bool
    }
}