import ActivityKit
import Foundation

public struct GymBeatWidgetAttributes: ActivityAttributes {
    public init() {}

    public struct ContentState: Codable, Hashable {
        public var deadline: Double
        public var exerciseName: String
        public var currentSet: Int
        public var totalSets: Int
        public var weight: String
        public var reps: String
        public var dropsetCount: Int
        
        public init(deadline: Double, exerciseName: String, currentSet: Int, totalSets: Int, weight: String, reps: String, dropsetCount: Int) {
            // This initializer is not strictly necessary since the struct has memberwise initializers by default,
            // but it can be kept for explicit clarity.
            self.deadline = deadline
            self.exerciseName = exerciseName
            self.currentSet = currentSet
            self.totalSets = totalSets
            self.weight = weight
            self.reps = reps
            self.dropsetCount = dropsetCount
        }
    }
}