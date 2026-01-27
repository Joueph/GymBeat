import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { Treino } from '../../models/treino';
import { updateFicha } from '../../services/fichaService';
import { updateTreino, updateTreinosOrdem } from '../../services/treinoService';
import { DIAS_SEMANA_ORDEM, DisplayItem, Folder } from './types';

interface UseTreinoDragAndDropProps {
    folders: Folder[];
    setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
    displayItems: DisplayItem[];
    fetchData: (background?: boolean) => void;
    activeFichaFolder?: Folder;
}

export function useTreinoDragAndDrop({
    folders,
    setFolders,
    displayItems,
    fetchData,
    activeFichaFolder
}: UseTreinoDragAndDropProps) {

    const handleDragEnd = async ({ data: newDisplayItems, from, to }: { data: DisplayItem[], from: number, to: number }) => {
        const draggedItem = displayItems[from];
        if (!draggedItem || draggedItem.type !== 'workout' || !draggedItem.data) {
            setFolders(prev => [...prev]);
            return;
        }

        // Determine Source Parent
        let originalParentFolderItem = displayItems.slice(0, from).reverse().find(d => d.type === 'folder');
        // If no folder found above in list, it implies it belongs to the Header (Active Ficha)
        if (!originalParentFolderItem && activeFichaFolder) {
            originalParentFolderItem = { type: 'folder', id: activeFichaFolder.id, data: activeFichaFolder };
        }

        // Determine Destination Parent
        let newParentFolderItem = newDisplayItems.slice(0, to).reverse().find(d => d.type === 'folder');
        // If no folder found above drop location, it belongs to the Header (Active Ficha)
        if (!newParentFolderItem && activeFichaFolder) {
            newParentFolderItem = { type: 'folder', id: activeFichaFolder.id, data: activeFichaFolder };
        }

        // 🚫 Double Check validity
        if (!newParentFolderItem?.id || !originalParentFolderItem?.id) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setFolders(prev => [...prev]);
            return;
        }

        const isReorder = originalParentFolderItem.id === newParentFolderItem.id;
        const newFoldersState = JSON.parse(JSON.stringify(folders));

        const originalFolderIndex = newFoldersState.findIndex((f: Folder) => f.id === originalParentFolderItem?.id);
        const targetFolderIndex = isReorder ? originalFolderIndex : newFoldersState.findIndex((f: Folder) => f.id === newParentFolderItem?.id);

        if (originalFolderIndex === -1 || targetFolderIndex === -1) {
            console.warn("Folder not found in state");
            setFolders(prev => [...prev]);
            return;
        }

        const workoutIndex = newFoldersState[originalFolderIndex].treinos.findIndex((t: Treino) => t.id === draggedItem.id);

        // 🛡️ Previne bug de desaparecimento
        if (workoutIndex === -1) {
            console.warn("Workout not found in source folder");
            setFolders(prev => [...prev]);
            return;
        }

        const [workout] = newFoldersState[originalFolderIndex].treinos.splice(workoutIndex, 1);

        if (isReorder) {
            // Calculate relative index for splice
            let targetIndexRelative = 0;
            for (let i = 0; i < to; i++) {
                const item = newDisplayItems[i];
                if (item.type === 'workout' && (item.data as Treino).fichaId === newParentFolderItem?.id) {
                    targetIndexRelative++;
                }
            }
            newFoldersState[targetFolderIndex].treinos.splice(targetIndexRelative, 0, workout);
        } else {
            // Movimento entre pastas -> Auto Sort (Dom - Sab)
            newFoldersState[targetFolderIndex].treinos.push(workout);

            const getDayValue = (t: Treino) => {
                if (!t.diasSemana || t.diasSemana.length === 0) return 7;
                return Math.min(...t.diasSemana.map(d => DIAS_SEMANA_ORDEM[d] ?? 7));
            };

            newFoldersState[targetFolderIndex].treinos.sort((a: Treino, b: Treino) => {
                return getDayValue(a) - getDayValue(b);
            });
        }

        setFolders(newFoldersState);

        // Persistência
        try {
            if (isReorder) {
                const reorderedWorkoutIds = newFoldersState[targetFolderIndex].treinos.map((t: Treino) => t.id);
                if (newFoldersState[targetFolderIndex].type === 'ficha') {
                    await updateFicha(newFoldersState[targetFolderIndex].id, { treinos: reorderedWorkoutIds });
                } else {
                    await updateTreinosOrdem(reorderedWorkoutIds);
                }
            } else {
                const treinoId = draggedItem.id;
                const newFichaId = newParentFolderItem.id === 'unassigned' ? null : newParentFolderItem.id;

                await updateTreino(treinoId, { fichaId: newFichaId ?? undefined });

                if ((originalParentFolderItem.data as Folder).type === 'ficha') {
                    const originalTreinoIds = newFoldersState[originalFolderIndex].treinos.map((t: Treino) => t.id);
                    await updateFicha(originalParentFolderItem.id, { treinos: originalTreinoIds });
                }

                if (newFoldersState[targetFolderIndex].type === 'ficha') {
                    const targetTreinoIds = newFoldersState[targetFolderIndex].treinos.map((t: Treino) => t.id);
                    await updateFicha(newFoldersState[targetFolderIndex].id, { treinos: targetTreinoIds });
                }
            }
        } catch (error) {
            console.error("Erro ao mover/reordenar treino:", error);
            Alert.alert("Erro", "Falha ao salvar. Recarregando...");
            fetchData(false);
        }
    };

    return { handleDragEnd };
}
