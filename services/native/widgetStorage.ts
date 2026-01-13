/**
 * Default implementation for non-iOS platforms (Android, Web).
 * This is a no-op since Widgets/Live Activities are iOS only for now.
 */
export const saveWidgetData = async (key: string, data: string, group: string) => {
    // No-op
    return;
};
