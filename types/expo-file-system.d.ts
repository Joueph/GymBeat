declare module 'expo-file-system' {
  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;
  
  export interface FileInfo {
    exists: boolean;
    uri: string;
    size?: number;
    isDirectory?: boolean;
    modificationTime?: number;
  }
  
  export function getInfoAsync(fileUri: string, options?: object): Promise<FileInfo>;
  export function downloadAsync(uri: string, fileUri: string): Promise<{ uri: string; status: number; headers: Record<string, string>; md5?: string }>;
  export function deleteAsync(fileUri: string, options?: { idempotent?: boolean }): Promise<void>;
}