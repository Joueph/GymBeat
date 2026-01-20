
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { FreeTrialEnforcer } from '@/components/FreeTrialEnforcer';
import { FriendDetailsModal } from '../../components/amigos/FriendDetailsModal';
import { FriendData } from '../../components/amigos/FriendListItem';
import { FriendRequestsModal } from '../../components/amigos/FriendRequestsModal';
import { FriendsHorizontalWidget } from '../../components/amigos/FriendsHorizontalWidget';
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
      <Modal visible={modals.addOptions.visible} transparent={true} animationType="fade" onRequestClose={() => modals.addOptions.setVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={() => modals.addOptions.setVisible(false)}>
          <View style={styles.drawerContainer}>
            <TouchableOpacity style={styles.drawerOption} onPress={() => { modals.addOptions.setVisible(false); router.push('/(projetos)/criar'); }}>
              <FontAwesome name="plus-circle" size={20} color="#fff" />
              <Text style={styles.drawerOptionText}>Criar um novo projeto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerOption} onPress={() => { modals.addOptions.setVisible(false); modals.joinProject.setVisible(true); }}>
              <FontAwesome name="sign-in" size={20} color="#fff" />
              <Text style={styles.drawerOptionText}>Entrar em um projeto</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modals.joinProject.visible} transparent={true} animationType="slide" onRequestClose={() => modals.joinProject.setVisible(false)}>
        <View style={styles.modalCenteredView}>
          <View style={styles.modalView}>
            <TouchableOpacity style={styles.closeButton} onPress={() => modals.joinProject.setVisible(false)}>
              <FontAwesome name="close" size={22} color="#ccc" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Entrar em um Projeto</Text>
            <TextInput
              style={styles.joinProjectInput}
              placeholder="Cole a mensagem de convite aqui"
              placeholderTextColor="#888"
              value={inputs.projectCode}
              onChangeText={inputs.setProjectCode}
              multiline
            />
            <TouchableOpacity style={styles.addButton} onPress={actions.handleJoinProject}>
              <Text style={styles.addButtonText}>Acessar Projeto</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  mainSectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    marginTop: 10,
    paddingHorizontal: 16, // Added padding to match other sections if needed
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    backgroundColor: '#1A1D23',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  drawerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  drawerOptionText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 15,
  },
  modalCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#1A1D23',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  joinProjectInput: {
    height: 60,
    width: '100%',
    backgroundColor: '#2A2E37',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff1a',
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  addButton: {
    backgroundColor: '#1cb0f6',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});