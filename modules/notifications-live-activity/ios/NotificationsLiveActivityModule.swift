import ExpoModulesCore
import ActivityKit

// --- CÓPIA IDÊNTICA DO GymBeatAttributes ---
struct GymBeatAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var exerciseName: String
        public var stateLabel: String
        public var currentSet: Int
        public var totalSets: Int       // <--- IDÊNTICO
        public var endTime: Date        // <--- IDÊNTICO
    }
    public var timerName: String
}
// -------------------------------------------

public class NotificationsLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NotificationsLiveActivity")

    // Nova Assinatura: 5 Argumentos
    // Ordem: Timestamp, Nome, Rótulo, Série Atual, Total Séries
    AsyncFunction("startActivity") { (timestamp: Double, exerciseName: String, stateLabel: String, currentSet: Int, totalSets: Int) -> String? in
      if #available(iOS 16.2, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
        
        // Converter Timestamp (ms) para Date (s)
        let endDate = Date(timeIntervalSince1970: timestamp / 1000)
        
        let contentState = GymBeatAttributes.ContentState(
            exerciseName: exerciseName,
            stateLabel: stateLabel,
            currentSet: currentSet,
            totalSets: totalSets,
            endTime: endDate
        )
        
        let attributes = GymBeatAttributes(timerName: "GymBeat Timer")
        
        // staleDate: nil deixa o iOS decidir. Se quiser que suma ao acabar, use 'endDate'
        let activityContent = ActivityContent(state: contentState, staleDate: nil)
        
        do {
          let activity = try Activity.request(attributes: attributes, content: activityContent, pushType: nil)
          print("[LiveActivity] ✅ ID: \(activity.id)")
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
          guard let activity = Activity<GymBeatAttributes>.activities.first(where: { $0.id == activityId }) else { return }
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }
}