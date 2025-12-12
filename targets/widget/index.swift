import WidgetKit
import SwiftUI

@main
struct exportWidgets: WidgetBundle {
    var body: some Widget {
        // Widgets definidos no arquivo widgets.swift
        TodayWorkoutWidget()
        StreakWidget()
        
        // Live Activity definida em WidgetLiveActivity.swift
        GymBeatWidgetLiveActivity()
    }
}