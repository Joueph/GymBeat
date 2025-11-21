import ActivityKit
import Foundation

public struct GymBeatAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var exerciseName: String
        public var stateLabel: String
        public var currentSet: Int
        public var totalSets: Int       // <--- VOLTOU
        public var endTime: Date        // <--- VOLTOU
    }
    
    public var timerName: String
}