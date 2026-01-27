import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FreeTrialEnforcer } from '@/components/FreeTrialEnforcer';
import { AddOptionsModal } from '../../components/amigos/AddOptionsModal';
import { FriendDetailsModal } from '../../components/amigos/FriendDetailsModal';
import { FriendData } from '../../components/amigos/FriendListItem';
import { FriendRequestsModal } from '../../components/amigos/FriendRequestsModal';
import { FriendsHorizontalWidget } from '../../components/amigos/FriendsHorizontalWidget';
import { JoinProjectModal } from '../../components/amigos/JoinProjectModal';
import { PerfilCard } from '../../components/amigos/PerfilCard';
import { PostFeedWidget } from '../../components/amigos/PostFeedWidget';
import { SocialHeader } from '../../components/amigos/SocialHeader';
import { useAmigosData } from '../../hooks/useAmigosData';

export default function AmigosScreen() {
  const router = useRouter();
  const {
    user,
    isOnline,
    loading,
    friends,
    stats,
    projects,
    requests,
    modals,
    inputs,
    actions
  } = useAmigosData();

  const [selectedFriend, setSelectedFriend] = React.useState<FriendData | null>(null);

  if (!isOnline) {
    return (
      <View style={[styles.centered, { backgroundColor: "#030405" }]}>
        <FontAwesome name="wifi" size={50} color="#555" style={{ marginBottom: 20 }} />
        <Text style={[styles.emptyText, { fontSize: 18, textAlign: 'center' }]}>
          Você está offline.
        </Text>
        <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: 10, maxWidth: '80%' }}>
          Recursos sociais como ranking, amigos e projetos precisam de internet para funcionar.
        </Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <SocialHeader
          onNotificationsPress={() => modals.notifications.setVisible(true)}
          onAddFriendPress={() => actions.handleShareCode()}
          pendingNotificationCount={requests.length}
        />

        <PerfilCard
          user={user}
          friendsCount={friends.length}
          workoutsCount={stats.workoutsCount}
          postsCount={stats.postsCount}
        />

        <FriendsHorizontalWidget
          friends={friends}
          onAddFriendPress={() => actions.handleShareCode()}
          onFriendPress={setSelectedFriend}
        />

        <PostFeedWidget />
      </ScrollView>


      {/* Modals - Keeping them here for now as they are page-level interactions */}
      <AddOptionsModal
        visible={modals.addOptions.visible}
        onClose={() => modals.addOptions.setVisible(false)}
        onCreateProject={() => {
          modals.addOptions.setVisible(false);
          router.push('/(projetos)/criar');
        }}
        onJoinProject={() => {
          modals.addOptions.setVisible(false);
          modals.joinProject.setVisible(true);
        }}
      />

      <JoinProjectModal
        visible={modals.joinProject.visible}
        onClose={() => modals.joinProject.setVisible(false)}
        projectCode={inputs.projectCode}
        setProjectCode={inputs.setProjectCode}
        onJoin={actions.handleJoinProject}
      />

      <FriendRequestsModal
        visible={modals.notifications.visible}
        onClose={() => modals.notifications.setVisible(false)}
        requests={requests}
        onAccept={actions.handleAcceptRequest}
        onReject={actions.handleRejectRequest}
      />

      <FriendDetailsModal
        visible={!!selectedFriend}
        friend={selectedFriend}
        onClose={() => setSelectedFriend(null)}
        onRemoveFriend={(id) => {
          actions.removeFriend(id);
          setSelectedFriend(null);
        }}
      />

      <FreeTrialEnforcer />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0B0D10",
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: "#030405"
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
});