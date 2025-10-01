import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app } from "../firebaseconfig"; // Importa a instância do app Firebase
// Inicializa o Firebase Storage
const storage = getStorage(app);



/**
 * Faz o upload de uma imagem para o Firebase Storage e retorna a URL de download.
 * @param uri - A URI local do arquivo de imagem (do image picker).
 * @param userId - O ID do usuário para nomear o arquivo.
 * @returns A URL pública da imagem após o upload.
 */
export const uploadImageAndGetURL = async (uri: string, userId: string): Promise<string> => {
  try {
    // Converte a URI da imagem para um blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Cria uma referência no Storage para a foto de perfil do usuário
    const storageRef = ref(storage, `profilePictures/${userId}`);

    // Faz o upload do blob
    const snapshot = await uploadBytes(storageRef, blob);
    console.log('Uploaded a blob or file!', snapshot);

    // Obtém a URL de download
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Erro ao fazer upload da imagem: ", error);
    throw error;
  }
};