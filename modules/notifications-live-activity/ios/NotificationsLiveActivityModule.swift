import ExpoModulesCore
import ActivityKit

// --- MANTENHA A CÓPIA IDÊNTICA DO STRUCT AQUI ---
struct GymBeatAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var exerciseName: String
        public var currentSet: Int
        public var totalSets: Int
        
        public var isRestMode: Bool
        public var endTime: Date?
        
        public var weight: String
        public var reps: String
        public var dropsetCount: Int
    }
    public var timerName: String
}
// ------------------------------------------------

public class NotificationsLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NotificationsLiveActivity")

    // Nova assinatura com TODOS os parâmetros
    AsyncFunction("startActivity") { (timestamp: Double?, exerciseName: String, currentSet: Int, totalSets: Int, weight: String, reps: String, dropsetCount: Int) -> String? in
      if #available(iOS 16.2, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
        
        // Lógica: Se timestamp vier > 0, é modo descanso. Se vier 0 ou nil, é modo exercício.
        let isRestMode = (timestamp ?? 0) > 0
        let endDate = isRestMode ? Date(timeIntervalSince1970: (timestamp ?? 0) / 1000) : nil
        
        let contentState = GymBeatAttributes.ContentState(
            exerciseName: exerciseName,
            currentSet: currentSet,
            totalSets: totalSets,
            isRestMode: isRestMode,
            endTime: endDate,
            weight: weight,
            reps: reps,
            dropsetCount: dropsetCount
        )
        
        let attributes = GymBeatAttributes(timerName: "GymBeat")
        
        // Define a política de descarte.
        // Para o modo descanso, a LA será removida automaticamente após o 'endDate'.
        // Para o modo exercício, a política é a padrão (permanece até ser encerrada manualmente).
        let activityContent = ActivityContent(state: contentState, staleDate: endDate)

        
        do {
          let activity = try Activity.request(attributes: attributes, content: activityContent, pushType: nil)
          return activity.id
        } catch {
          print("[LiveActivity] Error: \(error.localizedDescription)")
          return nil
        }
      } else {
        return nil
      }
    }

    AsyncFunction("endActivity") { (activityId: String) in
      if #available(iOS 16.2, *) {
        Task {
          guard let activity = Activity<GymBeatAttributes>.activities.first(where: { $0.id == activityId }) else { return }
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }
}