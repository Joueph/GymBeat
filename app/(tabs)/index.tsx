import { WorkoutReviewModal } from '@/app/(treino)/modals/modalReviewTreinos';
import { FichaSelectionDrawer } from '@/components/FichaSelectionDrawer';
import { FriendsWidget } from '@/components/home/FriendsWidget';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeLayoutConfigModal } from '@/components/home/HomeLayoutConfigModal';
import { MetricsConfigModal } from '@/components/home/MetricsConfigModal';
import { MetricsGrid } from '@/components/home/MetricsGrid';
import { PastWorkoutsWidget } from '@/components/home/PastWorkoutsWidget';
import { QuickActionsWidget } from '@/components/home/QuickActionsWidget';
import { StreakWidget } from '@/components/home/StreakWidget';
import { TodayWorkoutCard } from '@/components/home/TodayWorkoutCard';
import { WeeklyCalendar } from '@/components/home/WeeklyCalendar';
import { WeeklyProgress } from '@/components/home/WeeklyProgress';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';

import { FreeTrialEnforcer } from '@/components/FreeTrialEnforcer';
import { WeightInputDrawer } from '@/components/WeightInputDrawer';
import { useHomeData } from '@/hooks/useHomeData';
import { Log } from '@/models/log';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FeatureUpvoteModal } from '../FeatureUpvoteModal';

/**
 * Renders the home/progress dashboard and wires widget deep links into workout logging.
 * @returns Home screen composed from home data hooks, dashboard widgets, and modals.
 */
export default function HomeScreen() {
  const router = useRouter();
  const {
    treinos,
    logs,
    activeWorkoutLog,
    activeFicha,
    allFichas,
    userProfile,
    isWeightDrawerVisible,
    setWeightDrawerVisible,
    isFeatureUpvoteModalVisible,
    setFeatureUpvoteModalVisible,
    isFichaSelectorVisible,
    setFichaSelectorVisible,
    isLayoutConfigVisible,
    setLayoutConfigVisible,
    layout,
    saveLayout,
    weeklyMetrics,
    historyMetrics,
    handleSaveWeight,
    getLatestWeight,
    metricsLayout,
    saveMetricsConfig,
    user,
  } = useHomeData();

  const { isPremium, navigateToPaywall } = usePremiumStatus();

  const [isMetricsConfigVisible, setMetricsConfigVisible] = useState(false);
  const [selectedReviewLog, setSelectedReviewLog] = useState<Log | null>(null);
  const [isReviewModalVisible, setReviewModalVisible] = useState(false);

  const handleStartEmptyWorkout = () => {
    setFichaSelectorVisible(true);
  };

  const handleFichaSelect = (fichaId: string) => {
    setFichaSelectorVisible(false);
    setFichaSelectorVisible(false);
    router.push({ pathname: '/(treino)/LoggingDuringWorkout', params: { fichaId } });
  };

  // --- WIDGET DEEP LINK HANDLER ---
  const params = useLocalSearchParams();
  useEffect(() => {
    if (params.action === 'open_workout' && params.treinoId && params.fichaId) {
      console.log('[DeepLink] 🚀 Opening workout from widget:', params.treinoId);

      // Navigate to the ongoing workout screen
      // We use push to ensure the user can go back to the home screen
      // Clear the params to prevent loop when returning to this screen
      router.setParams({ action: '', treinoId: '', fichaId: '' });

      router.push({
        pathname: '/(treino)/LoggingDuringWorkout',
        params: {
          treinoId: params.treinoId as string,
          fichaId: params.fichaId as string,
        }
      });
    }
  }, [params]);
  // ------------------------------

  const handleSelectLog = (log: Log) => {
    setSelectedReviewLog(log);
    setReviewModalVisible(true);
  };

  const renderWidget = (key: string) => {
    switch (key) {
      case 'weeklyCalendar':
        // Always render calendar if it's in the list (logic handled by useHomeData default)
        return <WeeklyCalendar key={key} logs={logs} treinos={treinos} />;
      case 'streak':
        return <StreakWidget key={key} logs={logs} streakGoal={userProfile?.streakGoal ?? 3} />;
      case 'quickActions':
        return <QuickActionsWidget key={key} activeFicha={activeFicha} activeWorkoutLog={activeWorkoutLog} onStartEmptyWorkout={handleStartEmptyWorkout} />;
      case 'weeklyProgress':
        return <WeeklyProgress key={key} logs={logs} activeFicha={activeFicha} streakGoal={userProfile?.streakGoal} />;
      case 'todayWorkout':
        return <TodayWorkoutCard key={key} treinos={treinos} activeFicha={activeFicha} />;
      case 'metrics':
        return (
          <MetricsGrid
            key={key}
            userProfile={userProfile}
            weeklyMetrics={weeklyMetrics}
            historyMetrics={historyMetrics}
            onEditWeight={() => setWeightDrawerVisible(true)}
            onOpenConfig={() => setMetricsConfigVisible(true)}
            config={metricsLayout}
            isPremium={isPremium}
          />
        );
      case 'friends':
        return <FriendsWidget key={key} />;
      case 'pastWorkouts':
        return <PastWorkoutsWidget key={key} logs={logs} onSelectLog={handleSelectLog} />;
      default:
        return null;
    }
  };

  // Group streak and quickActions if they are adjacent? 
  // For simplicity, now they are just rendered in order.
  // The 'widgetsRow' logic was just wrapper. If we really support full reorder,
  // we might lose the 'row' layout unless we specifically handle it or treat them as one block.
  // Current requirement: "Make so they can be rearanged".
  // If user separates streak and quickActions, the "row" idea breaks.
  // I will Render them individually.

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContentContainer}>
        <HomeHeader
          onOpenUpvote={() => setFeatureUpvoteModalVisible(true)}
          onOpenSettings={() => router.push('/settings')}
          onOpenLayoutConfig={() => {
            if (!isPremium) {
              navigateToPaywall();
              return;
            }
            setLayoutConfigVisible(true)
          }}
        />

        {layout.map(item => {
          if (!item.visible) return null;
          return renderWidget(item.key);
        })}

        <WeightInputDrawer visible={isWeightDrawerVisible} onClose={() => setWeightDrawerVisible(false)} onSave={handleSaveWeight} initialValue={getLatestWeight()} />
        <FeatureUpvoteModal visible={isFeatureUpvoteModalVisible} onClose={() => setFeatureUpvoteModalVisible(false)} />

        <FichaSelectionDrawer
          visible={isFichaSelectorVisible}
          onClose={() => setFichaSelectorVisible(false)}
          onSelect={handleFichaSelect}
          fichas={allFichas}
        />

        <HomeLayoutConfigModal
          visible={isLayoutConfigVisible}
          onClose={() => setLayoutConfigVisible(false)}
          layout={layout}
          onSaveLayout={(newLayout) => {
            // Double check just in case
            if (!isPremium) return;
            saveLayout(newLayout);
          }}
        />

        <MetricsConfigModal
          visible={isMetricsConfigVisible}
          onClose={() => setMetricsConfigVisible(false)}
          config={metricsLayout}

          onSaveConfig={(newConfig) => {
            if (!isPremium) {
              navigateToPaywall();
              return;
            }
            saveMetricsConfig(newConfig);
          }}
        />

        <WorkoutReviewModal
          visible={isReviewModalVisible}
          onClose={() => setReviewModalVisible(false)}
          initialLog={selectedReviewLog}
          allUserLogs={logs}
          currentUserId={user?.id || ''}
        />
      </ScrollView>

      <FreeTrialEnforcer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  scrollContentContainer: { paddingHorizontal: 16, paddingTop: '15%', paddingBottom: 40 },
});
