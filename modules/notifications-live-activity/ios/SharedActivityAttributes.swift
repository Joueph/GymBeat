import ActivityKit
import Foundation

public struct GymBeatWidgetAttributes: ActivityAttributes {
    // IMPORTANTE: Se você tiver qualquer variável aqui (fora do ContentState), 
    // ela deve estar idêntica no Módulo também. Por enquanto, deixe vazio.
    public init() {}

    public struct ContentState: Codable, Hashable {
        public var endTime: Date
        public var exerciseName: String
        public var currentSet: Int
        public var totalSets: Int
        public var stateLabel: String
        
        public init(endTime: Date, exerciseName: String, currentSet: Int, totalSets: Int, stateLabel: String) {
            self.endTime = endTime
            self.exerciseName = exerciseName
            self.currentSet = currentSet
            self.totalSets = totalSets
            self.stateLabel = stateLabel
        }
    }
}