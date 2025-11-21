import ActivityKit
import Foundation

public struct GymBeatAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Vamos começar APENAS com String e Int para garantir que a conexão funciona.
        // Datas (Date) costumam dar erro de fuso/formato se não estiverem perfeitas.
        public var exerciseName: String
        public var stateLabel: String
        public var currentSet: Int
    }
    
    // Atributos fixos (que não mudam durante a atividade)
    public var timerName: String
}