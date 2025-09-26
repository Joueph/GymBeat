import { StyleSheet, Text, View } from "react-native";

export default function AmigosScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Função em construção</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d181c",
  },
  text: {
    color: '#aaa',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
