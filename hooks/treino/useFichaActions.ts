import * as Network from 'expo-network';
import { Alert, Share } from 'react-native';
import { FichaMenuAction } from '../../components/FichaOptionsMenu';
import { Ficha } from '../../models/ficha';
import { deleteFicha, setFichaAtiva, updateFicha } from '../../services/fichaService';
import { Folder } from './types';

interface UseFichaActionsProps {
    user: any;
    activeFicha: Ficha | null;
    folders: Folder[];
    setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
    setActiveFicha: React.Dispatch<React.SetStateAction<Ficha | null>>;
    fetchData: (isBackgroundRefresh?: boolean) => Promise<void>;
}

export function useFichaActions({
    user,
    activeFicha,
    folders,
    setFolders,
    setActiveFicha,
    fetchData
}: UseFichaActionsProps) {

    const handleFichaAction = async (action: FichaMenuAction, folderId: string) => {
        if (!user) return;

        const ficha = folders.find(f => f.id === folderId);
        if (!ficha) return;

        switch (action) {
            case 'set-active':
                try {
                    const networkState = await Network.getNetworkStateAsync();
                    const isOffline = !networkState.isConnected;

                    if (isOffline) {
                        Alert.alert("Offline", "Você precisa estar online para alterar a ficha principal.");
                        return;
                    }

                    const isCurrentlyActive = activeFicha?.id === folderId;
                    const targetFichaId = isCurrentlyActive ? null : folderId;

                    const fichaAtualizada = await setFichaAtiva(user.id, targetFichaId, activeFicha?.id);

                    setActiveFicha(fichaAtualizada);
                    setFolders(prevFolders => {
                        const unassigned = prevFolders.find(f => f.type === 'unassigned');
                        const fichaFolders = prevFolders.filter(f => f.type === 'ficha');

                        fichaFolders.sort((a, b) => {
                            if (fichaAtualizada) {
                                if (a.id === fichaAtualizada.id) return -1;
                                if (b.id === fichaAtualizada.id) return 1;
                            }
                            return a.nome.localeCompare(b.nome);
                        });

                        return unassigned ? [...fichaFolders, unassigned] : fichaFolders;
                    });
                } catch (error) {
                    console.error("Erro ao definir ficha ativa:", error);
                    Alert.alert("Erro", "Não foi possível definir a ficha como principal.");
                }
                break;

            case 'rename':
                Alert.prompt(
                    "Alterar Nome",
                    "Digite o novo nome para a ficha:",
                    async (newName) => {
                        if (newName && newName.trim() !== "") {
                            await updateFicha(folderId, { nome: newName.trim() });
                            fetchData(true);
                        }
                    },
                    'plain-text',
                    ficha.nome
                );
                break;

            case 'share':
                Share.share({ message: `Confira minha ficha de treino "${ficha.nome}" no GymBeat!` });
                break;

            case 'delete':
                Alert.alert("Deletar Ficha", `Tem certeza que deseja deletar a ficha "${ficha.nome}"? Todos os treinos nela serão movidos para "Meus Treinos".`, [{ text: "Cancelar", style: "cancel" }, {
                    text: "Deletar", style: "destructive", onPress: async () => {
                        const treinoIds = ficha.treinos.map(t => t.id);
                        await deleteFicha(folderId, treinoIds);
                        fetchData(true);
                    }
                }]);
                break;
        }
    };

    return { handleFichaAction };
}
