// TimePickerDrawer.tsx
import React, { useEffect, useState } from "react";
import {
    Modal,
    Pressable, // Importado
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NumberSlider } from "./NumberSlider"; // Assumindo que está na mesma pasta

// --- PROPS ---
interface TimePickerDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (time: { hour: number; minute: number }) => void;
  initialTime?: { hour: number; minute: number };
}

export const TimePickerDrawer = ({
  visible,
  onClose,
  onSave,
  initialTime = { hour: 9, minute: 0 },
}: TimePickerDrawerProps) => {
  const [is24Hour, setIs24Hour] = useState(true);
  const [hour, setHour] = useState(initialTime.hour);
  const [minute, setMinute] = useState(initialTime.minute);
  const [period, setPeriod] = useState(
    initialTime.hour >= 12 ? "PM" : "AM"
  );

  // Efeito para rolar para a posição inicial ao abrir
  useEffect(() => {
    if (visible) {
      const initialHour = initialTime.hour;
      const initialMinute = initialTime.minute;

      // Garante que o minuto inicial esteja alinhado com o step (5)
      const roundedMinute = Math.round(initialMinute / 5) * 5;

      setHour(initialHour);
      setMinute(roundedMinute);
      setPeriod(initialHour >= 12 ? "PM" : "AM");
      setIs24Hour(true); // Pode definir um padrão ou salvar a preferência do usuário
    }
  }, [visible, initialTime]);

  // Salva o estado final
  const handleSave = () => {
    let finalHour = hour;

    // Converte de 12h para 24h se necessário
    if (!is24Hour) {
      if (period === "PM" && hour < 12) finalHour = hour + 12;
      if (period === "AM" && hour === 12) finalHour = 0; // 12 AM é 0h
    }

    onSave({ hour: finalHour, minute });
    onClose();
  };

  // --- HANDLERS DOS SLIDERS ---

  const handleHourChange = (displayHour: number) => {
    if (is24Hour) {
      setHour(displayHour);
      return;
    }

    // Se estiver em 12h, precisamos converter a hora do display (1-12) para a hora real (0-23)
    let realHour = displayHour;
    if (period === "PM" && displayHour < 12) realHour = displayHour + 12;
    if (period === "AM" && displayHour === 12) realHour = 0; // 12 AM -> 0
    // 12 PM (displayHour=12) já é 12, então não precisa de regra.

    setHour(realHour);
  };

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    if (newPeriod === period) return;

    let newHour = hour;
    if (newPeriod === "PM" && hour < 12) {
      // De AM para PM (ex: 9 AM -> 9 PM)
      newHour = hour + 12;
    } else if (newPeriod === "AM" && hour >= 12) {
      // De PM para AM (ex: 9 PM -> 9 AM)
      newHour = hour - 12;
    }
    
    setHour(newHour);
    setPeriod(newPeriod);
  };

  // Calcula a hora a ser mostrada no slider (1-12 ou 0-23)
  const displayHour = is24Hour
    ? hour
    : hour === 0 // 12 AM
    ? 12
    : hour > 12 // PM (13-23 -> 1-11)
    ? hour - 12
    : hour; // AM (1-11)

  return (
    <Modal
      animationType="slide"
      transparent={true} // <-- Replicado
      visible={visible}
      onRequestClose={onClose}
    >
      <>
        {/* Overlay para fechar o modal */}
        <Pressable style={styles.overlay} onPress={onClose} />

        {/* Conteúdo do Drawer */}
        <View style={styles.drawerContainer}>
          <SafeAreaView style={{ flex: 1 }} edges={["bottom", "left", "right"]}>
            
            <View style={styles.header}>
              <Text style={styles.title}>Definir Horário</Text>
            </View>

            {/* Seletor de 12h/24h (replicando o estilo do toggleContainer) */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.formatButton,
                  is24Hour && styles.formatButtonSelected,
                ]}
                onPress={() => setIs24Hour(true)}
              >
                <Text style={styles.formatButtonText}>24 Horas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formatButton,
                  !is24Hour && styles.formatButtonSelected,
                ]}
                onPress={() => setIs24Hour(false)}
              >
                <Text style={styles.formatButtonText}>12 Horas</Text>
              </TouchableOpacity>
            </View>

            {/* Área dos Sliders */}
            <View style={styles.listArea}>
              {/* Slider de Hora */}
              <View style={styles.listContainer}>
                <Text style={styles.listLabel}>Hora</Text>
                <NumberSlider
                  min={is24Hour ? 0 : 1}
                  max={is24Hour ? 23 : 12}
                  step={1}
                  value={displayHour}
                  onChange={handleHourChange}
                  vertical
                />
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Slider de Minuto */}
              <View style={styles.listContainer}>
                <Text style={styles.listLabel}>Minuto</Text>
                <NumberSlider
                  min={0}
                  max={55} // Corrigido (como na nossa conversa anterior)
                  step={5}
                  value={minute}
                  onChange={setMinute}
                  vertical
                />
              </View>

              {/* Seletor AM/PM (condicional) */}
              {!is24Hour && (
                <View style={styles.periodSelector}>
                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      period === "AM" && styles.periodButtonSelected,
                    ]}
                    onPress={() => handlePeriodChange("AM")}
                  >
                    <Text style={styles.periodButtonText}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      period === "PM" && styles.periodButtonSelected,
                    ]}
                    onPress={() => handlePeriodChange("PM")}
                  >
                    <Text style={styles.periodButtonText}>PM</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Botão Salvar */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>

          </SafeAreaView>
        </View>
      </>
    </Modal>
  );
};

// --- ESTILOS ---
// (Baseados nos estilos do RepetitionsDrawer, com adições)
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  drawerContainer: {
    height: "60%", // Um pouco menor que o de repetições
    backgroundColor: "#0B0D10",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  header: {
    alignItems: "center",
    paddingBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  // Estilo do seletor 12/24h (baseado no toggleContainer)
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#1A1D23",
    borderRadius: 10,
    overflow: "hidden", // Para os botões internos
  },
  formatButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  formatButtonSelected: {
    backgroundColor: "#3B82F6", // Cor principal
  },
  formatButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Área dos sliders
  listArea: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 300,
    overflow: "hidden",
  },
  listContainer: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
  },
  listLabel: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
    position: "absolute",
    top: -10,
  },
  timeSeparator: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
    marginHorizontal: 10,
    alignSelf: "center",
    paddingBottom: 20, // Ajuste para alinhar com o centro dos sliders
  },
  // Seletor AM/PM
  periodSelector: {
    flex: 0.8, // Ocupa menos espaço
    height: "80%", // Alinha-se melhor com os sliders
    justifyContent: "center",
    marginLeft: 10,
  },
  periodButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#1A1D23",
    marginVertical: 6,
  },
  periodButtonSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  periodButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  // Botão Salvar
  saveButton: {
    backgroundColor: '#3B82F6',
    height: 60,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});