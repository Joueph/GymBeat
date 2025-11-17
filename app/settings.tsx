import * as Notifications from 'expo-notifications';
import React, { ReactNode, useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { getUserProfile, updateUserProfile } from '../userService';
import { useAuth } from './authprovider';
// --- Tipos para as Configurações ---
type PrivacyLevel = 'todos' | 'amigos' | 'ninguem';
type UserSettings = { notifications: NotificationSettings; privacy: PrivacySettings; };

export interface NotificationSettings {
  // Treinos
  workoutReminders: boolean;
  workoutReminderTime?: { hour: number; minute: number };
  restTimeEnding: boolean;

  // Lembretes
  creatine: boolean;
  protein: boolean;
  hypercaloric: boolean;
  // Amigos
  friendWorkoutDone: boolean;
}

export interface PrivacySettings {
  profileVisibility: PrivacyLevel;
  weekStreak: PrivacyLevel;
  workoutDays: PrivacyLevel;
  workoutDetails: PrivacyLevel;
  autoAcceptFriendRequests: boolean;
}

// --- Componentes Reutilizáveis ---

// Componente para um item com Switch
const SwitchSetting = ({ label, isEnabled, onToggle }: { label: string; isEnabled: boolean; onToggle: (enabled: boolean) => void; }) => (
  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>{label}</Text>
    <Switch
      trackColor={{ false: "#767577", true: "#81b0ff" }}
      thumbColor={isEnabled ? "#ffffff" : "#f4f3f4"}
      ios_backgroundColor="#3e3e3e"
      onValueChange={onToggle}
      value={isEnabled}
    />
  </View>
);

// Componente para um item de configuração de Privacidade
const PrivacySetting = ({ label, value, onChange }: { label: string; value: PrivacyLevel; onChange: (value: PrivacyLevel) => void; }) => (
  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>{label}</Text>
    <View style={styles.privacyOptionsContainer}>
      {(['todos', 'amigos', 'ninguem'] as const).map(level => (
        <TouchableOpacity
          key={level}
          style={[styles.privacyOption, value === level && styles.privacyOptionSelected]}
          onPress={() => onChange(level)}
        >
          <Text style={styles.privacyOptionText}>{level.charAt(0).toUpperCase() + level.slice(1)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// Componente para a Seção Colapsável
const CollapsibleSection = ({ title, children }: { title: string; children: ReactNode; }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <View style={styles.sectionContainer}>
      <TouchableOpacity onPress={() => setIsOpen(!isOpen)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionToggle}>{isOpen ? '−' : '+'}</Text>
      </TouchableOpacity>
      {isOpen && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
};

// --- Componente Principal da Página de Opções ---

const defaultNotificationSettings: NotificationSettings = {
    workoutReminders: true,
    workoutReminderTime: { hour: 9, minute: 0 },
    restTimeEnding: true,
    creatine: true,
    protein: true,
    hypercaloric: false,
    friendWorkoutDone: true,
};

const defaultPrivacySettings: PrivacySettings = {
    profileVisibility: 'amigos',
    weekStreak: 'todos',
    workoutDays: 'todos',
    workoutDetails: 'amigos',
    autoAcceptFriendRequests: false,
};

interface SettingsPageProps {
    initialSettings: {
        notifications: NotificationSettings;
        privacy: PrivacySettings;
    };
    onSettingsChange: (newSettings: { notifications: NotificationSettings; privacy: PrivacySettings }) => void;
}

const SettingsPage = ({ initialSettings, onSettingsChange }: Partial<SettingsPageProps>) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(initialSettings?.notifications ?? defaultNotificationSettings);
  const [privacy, setPrivacy] = useState(initialSettings?.privacy ?? defaultPrivacySettings);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);

  useEffect(() => {
    // If the component is used as a standalone page, initialSettings will be undefined.
    // We should fetch the settings from the user profile.
    if (!initialSettings && user) {
      getUserProfile(user.id).then(profile => {
        if (profile?.settings) {
          // Merge fetched settings with defaults to ensure all keys exist
          const mergedNotifications = { ...defaultNotificationSettings, ...profile.settings.notifications };
          const mergedPrivacy = { ...defaultPrivacySettings, ...profile.settings.privacy };
          setNotifications(mergedNotifications);
          setPrivacy(mergedPrivacy);
        }
      });
    }
  }, [initialSettings, user]);

  const handleSettingsSave = async (newSettings: UserSettings) => {
    if (onSettingsChange) {
      // If used as a modal component, just call the callback
      onSettingsChange(newSettings);
    } else if (user) {
      // If used as a standalone page, update the profile directly
      await updateUserProfile(user.id, { settings: newSettings });
    }
  };


  useEffect(() => {
    const checkPermissions = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
    };
    checkPermissions();
  }, []);

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted': return 'Concedida';
      case 'denied': return 'Negada';
      case 'undetermined': return 'Não definida';
      default: return 'Verificando...';
    }
  };

  const handleNotificationChange = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    const newSettings = { ...notifications, [key]: value };
    setNotifications(newSettings);
    handleSettingsSave({ notifications: newSettings, privacy });
  };

  const handleTimeChange = (time: { hour: number; minute: number }) => {
    handleNotificationChange('workoutReminderTime', time); // Corrigido
    setTimePickerVisible(false);
  };

  const handlePrivacyChange = (key: keyof PrivacySettings, value: PrivacyLevel) => {
    const newSettings = { ...privacy, [key]: value };
    setPrivacy(newSettings);
    handleSettingsSave({ notifications, privacy: newSettings });
  };

  const handlePrivacySwitchChange = (key: keyof PrivacySettings, value: boolean) => {
    const newSettings = { ...privacy, [key]: value };
    setPrivacy(newSettings);
    handleSettingsSave({ notifications, privacy: newSettings });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Seção de Permissões */}
      <CollapsibleSection title="Permissões do App">
        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Notificações Push</Text>
            <Text style={styles.permissionStatusText}>Status: {getPermissionStatusText()}</Text>
          </View>
          <TouchableOpacity style={styles.manageButton} onPress={handleOpenSettings}>
            <Text style={styles.manageButtonText}>Gerenciar</Text>
          </TouchableOpacity>
        </View>
      </CollapsibleSection>

      {/* Seção de Notificações */}
      <CollapsibleSection title="Notificações">
        <Text style={styles.subHeader}>Treinos</Text>
        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Lembretes de treinos</Text>
            <Text style={styles.settingDescription}>Vamos te enviar uma notificação nos dias que sua ficha ativa tiver treinos marcados.</Text>
          </View>
          <Switch trackColor={{ false: "#767577", true: "#81b0ff" }} thumbColor={notifications.workoutReminders ? "#ffffff" : "#f4f3f4"} ios_backgroundColor="#3e3e3e" onValueChange={(v) => handleNotificationChange('workoutReminders', v)} value={notifications.workoutReminders} />
        </View>
        {notifications.workoutReminders && (
          <TouchableOpacity style={styles.settingItem} onPress={() => setTimePickerVisible(true)}>
            <Text style={styles.settingLabel}>Horário do lembrete</Text>
            <Text style={styles.timeValueText}>{/* Ensure workoutReminderTime exists before accessing its properties */}
              {String(notifications.workoutReminderTime?.hour ?? 9).padStart(2, '0')}:{String(notifications.workoutReminderTime?.minute ?? 0).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        )}
        <SwitchSetting label="Acabando o tempo do intervalo" isEnabled={notifications.restTimeEnding} onToggle={(v) => handleNotificationChange('restTimeEnding', v)} />
        
        <Text style={styles.subHeader}>Lembretes</Text>
        <SwitchSetting label="Lembrete para tomar creatina" isEnabled={notifications.creatine} onToggle={(v) => handleNotificationChange('creatine', v)} />
        <SwitchSetting label="Lembrete de suplementos proteicos" isEnabled={notifications.protein} onToggle={(v) => handleNotificationChange('protein', v)} />
        <SwitchSetting label="Lembrete de suplementos hipercalóricos" isEnabled={notifications.hypercaloric} onToggle={(v) => handleNotificationChange('hypercaloric', v)} />

        <Text style={styles.subHeader}>Amigos</Text>
        <SwitchSetting label="Treino de amigo realizado" isEnabled={notifications.friendWorkoutDone} onToggle={(v) => handleNotificationChange('friendWorkoutDone', v)} />
      </CollapsibleSection>

      {/* Seção de Privacidade */}
      <CollapsibleSection title="Privacidade">
        <PrivacySetting label="Quem pode ver meu perfil" value={privacy.profileVisibility} onChange={(v) => handlePrivacyChange('profileVisibility', v)} />
        <PrivacySetting label="Quem pode ver minha sequência de semanas" value={privacy.weekStreak} onChange={(v) => handlePrivacyChange('weekStreak', v)} />
        <PrivacySetting label="Quem pode ver os dias em que treinei" value={privacy.workoutDays} onChange={(v) => handlePrivacyChange('workoutDays', v)} />
        <PrivacySetting label="Quem pode ver detalhes do meu treino" value={privacy.workoutDetails} onChange={(v) => handlePrivacyChange('workoutDetails', v)} />
        <SwitchSetting label="Aceitar pedidos de amizade automaticamente" isEnabled={privacy.autoAcceptFriendRequests} onToggle={(v) => handlePrivacySwitchChange('autoAcceptFriendRequests', v)} />
      </CollapsibleSection>

      <TimePickerDrawer
        visible={isTimePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        onSave={handleTimeChange}
        initialTime={notifications.workoutReminderTime ?? { hour: 9, minute: 0 }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030405',
    padding: 15,
  },
  sectionContainer: {
    backgroundColor: '#141414',
    borderRadius: 10,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#fff',
  },
  sectionToggle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionContent: {
    marginTop: 16,
  },
  subHeader: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 8,
    borderTopColor: '#ffffff1a',
    borderTopWidth: 1,
    paddingTop: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginRight: 10,
  },
  settingDescription: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  permissionStatusText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  manageButton: {
    backgroundColor: '#2c2c2e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  manageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  privacyOptionsContainer: {
    flexDirection: 'row',
    backgroundColor: '#030405',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  privacyOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  privacyOptionSelected: {
    backgroundColor: '#1cb0f6',
  },
  privacyOptionText: {
    color: '#fff',
    fontWeight: '500',
  },
  timeValueText: {
    color: '#1cb0f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsPage;
