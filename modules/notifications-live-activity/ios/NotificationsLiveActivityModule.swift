import ExpoModulesCore
import ActivityKit
import WidgetKit

public class NotificationsLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NotificationsLiveActivity")

    // Função para iniciar a Live Activity
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

    // Função para atualizar a atividade existente
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

    // Função para encerrar a atividade
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

    // NOVA FUNÇÃO: Recarrega os widgets da Home Screen
    Function("reloadAllTimelines") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }

    // NOVA FUNÇÃO: Salva dados genéricos no UserDefaults do App Group para o Widget ler
    Function("setWidgetData") { (key: String, jsonValue: String) in
        if let userDefaults = UserDefaults(suiteName: "group.br.com.gymbeat") {
            userDefaults.set(jsonValue, forKey: key)
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }
  }
}