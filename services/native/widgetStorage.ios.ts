import SharedGroupPreferences from 'react-native-shared-group-preferences';

/**
 * iOS implementation using SharedGroupPreferences.
 */
export const saveWidgetData = async (key: string, data: string, group: string) => {
    try {
        await SharedGroupPreferences.setItem(key, data, group);
    } catch (e) {
        console.error('[WidgetStorage] Error saving data:', e);
    }
};
