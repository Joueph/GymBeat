/**
 * Default implementation for non-iOS platforms (Android, Web).
 * This is a no-op since Widgets/Live Activities are iOS only for now.
 * @param key Shared widget data key requested by the caller.
 * @param data Serialized widget payload.
 * @param group iOS app-group identifier; unused on non-iOS platforms.
 * @returns Promise resolved without writing data.
 */
export const saveWidgetData = async (key: string, data: string, group: string) => {
    // No-op
    return;
};
