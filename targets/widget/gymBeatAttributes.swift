import ActivityKit
import Foundation

public struct GymBeatAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dados Comuns
        public var exerciseName: String
        public var currentSet: Int
        public var totalSets: Int
        
        // Modo Descanso
        public var isRestMode: Bool
        public var endTime: Date? // Opcional, pois no modo exercício não tem timer
        
        // Modo Exercício (Novos Campos)
        public var weight: String
        public var reps: String
        public var dropsetCount: Int
    }
    
    // Atributo fixo
    public var timerName: String
}