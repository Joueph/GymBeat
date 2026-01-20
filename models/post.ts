export interface Post {
    id: string;
    usuarioId: string;
    logId?: string;
    imageUrl?: string;
    descricao?: string;
    stats: {
        duration: number;
        exercisesCount: number;
        volume?: number;
        muscles?: string[];
    };
    createdAt: any;
    likes: string[];
    userName?: string;
    userPhotoUrl?: string;
}
