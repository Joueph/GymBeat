import ExpoModulesCore
import ActivityKit

public class NotificationsLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NotificationsLiveActivity")

    // ... (manter startActivity existente mas certifique-se que usa os novos atributos se mudaram)

    AsyncFunction("startActivity") { (timestamp: Double, exerciseName: String, currentSet: Int, totalSets: Int, weight: String, reps: String, dropsetCount: Int) -> String? in
      if #available(iOS 16.1, *) {
        let attributes = GymBeatWidgetAttributes()
        // Estado inicial
        let contentState = GymBeatWidgetAttributes.ContentState(
            deadline: timestamp,
            exerciseName: exerciseName,
            currentSet: currentSet,
            totalSets: totalSets,
            weight: weight,
            reps: reps,
            dropsetCount: dropsetCount
        )
        
        do {
          let activity = try Activity<GymBeatWidgetAttributes>.request(
            attributes: attributes,
            contentState: contentState,
            pushType: nil
          )
          return activity.id
        } catch {
          print("Erro ao iniciar Live Activity: \(error)")
          return nil
        }
      }
      return nil
    }

    // R1: Nova função para atualizar a atividade existente
    AsyncFunction("updateActivity") { (activityId: String, timestamp: Double, exerciseName: String, currentSet: Int, totalSets: Int, weight: String, reps: String, dropsetCount: Int) in
        if #available(iOS 16.1, *) {
            Task {
                for activity in Activity<GymBeatWidgetAttributes>.activities {
                    if activity.id == activityId {
                        let updatedContentState = GymBeatWidgetAttributes.ContentState(
                            deadline: timestamp,
                            exerciseName: exerciseName,
                            currentSet: currentSet,
                            totalSets: totalSets,
                            weight: weight,
                            reps: reps,
                            dropsetCount: dropsetCount
                        )
                        
                        await activity.update(using: updatedContentState)
                    }
                }
            }
        }
    }

    AsyncFunction("endActivity") { (activityId: String) in
        if #available(iOS 16.1, *) {
            Task {
                for activity in Activity<GymBeatWidgetAttributes>.activities {
                    if activity.id == activityId {
                        await activity.end(dismissalPolicy: .immediate)
                    }
                }
            }
        }
    }
  }
}