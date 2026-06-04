import SharedGroupPreferences from 'react-native-shared-group-preferences';

/**
 * iOS implementation using SharedGroupPreferences.
 * @param key Shared app-group key to write.
 * @param data Serialized widget payload.
 * @param group iOS app-group identifier used by the widget extension.
 * @returns Promise resolved after writing, or after logging a SharedGroupPreferences error.
 */
export const saveWidgetData = async (key: string, data: string, group: string) => {
    try {
        await SharedGroupPreferences.setItem(key, data, group);
    } catch (e) {
        console.error('[WidgetStorage] Error saving data:', e);
    }
};
