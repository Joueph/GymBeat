import ExpoModulesCore
import ActivityKit

// --- CÓPIA IDÊNTICA DO GymBeatAttributes ---
struct GymBeatAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var exerciseName: String
        public var stateLabel: String
        public var currentSet: Int
    }
    public var timerName: String
}
// -------------------------------------------

public class NotificationsLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NotificationsLiveActivity")

    // Função simplificada: 3 argumentos
    AsyncFunction("startActivity") { (exerciseName: String, stateLabel: String, currentSet: Int) -> String? in
      if #available(iOS 16.2, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
        
        // Criando o ContentState
        let contentState = GymBeatAttributes.ContentState(
            exerciseName: exerciseName,
            stateLabel: stateLabel,
            currentSet: currentSet
        )
        
        // Criando os Atributos
        let attributes = GymBeatAttributes(timerName: "GymBeat Timer")
        
        let activityContent = ActivityContent(state: contentState, staleDate: nil)
        
        do {
          let activity = try Activity.request(attributes: attributes, content: activityContent, pushType: nil)
          print("[LiveActivity] ✅ Sucesso! ID: \(activity.id)")
          return activity.id
        } catch {
          print("[LiveActivity] ❌ Erro: \(error.localizedDescription)")
          return nil
        }
      } else {
        return nil
      }
    }

    AsyncFunction("endActivity") { (activityId: String) in
      if #available(iOS 16.2, *) {
        Task {
          // Atualizado para GymBeatAttributes
          guard let activity = Activity<GymBeatAttributes>.activities.first(where: { $0.id == activityId }) else { return }
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }
}