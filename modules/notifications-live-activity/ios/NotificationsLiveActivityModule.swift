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
            dropsetCount: dropsetCount,
            isFinished: false
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
    // Função para atualizar a atividade existente
    AsyncFunction("updateActivity") { (activityId: String, timestamp: Double, exerciseName: String, currentSet: Int, totalSets: Int, weight: String, reps: String, dropsetCount: Int, isFinished: Bool) in
        if #available(iOS 16.2, *) {
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
                            dropsetCount: dropsetCount,
                            isFinished: isFinished
                        )
                        
                        var alertConfig: AlertConfiguration? = nil
                        if isFinished {
                            alertConfig = AlertConfiguration(
                                title: "Tempo de descanso finalizado",
                                body: "Bom treino!",
                                sound: .default
                            )
                        }
                        
                        await activity.update(
                            ActivityContent(
                                state: updatedContentState,
                                staleDate: nil,
                                relevanceScore: isFinished ? 100 : 50
                            ),
                            alertConfiguration: alertConfig
                        )
                    }
                }
            }
        } else if #available(iOS 16.1, *) {
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
                            dropsetCount: dropsetCount,
                            isFinished: isFinished
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

    // NOVA FUNÇÃO: Lista atividades ativas
    AsyncFunction("listActivities") { () -> [String] in
        if #available(iOS 16.1, *) {
            return Activity<GymBeatWidgetAttributes>.activities.map { $0.id }
        }
        return []
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