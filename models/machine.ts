export interface Machine {
    id: string;
    exerciseId: string;
    name: string;
    userId: string;
    lastUsed?: any; // Timestamp or Date
    isDeleted?: boolean; // Soft delete
}
