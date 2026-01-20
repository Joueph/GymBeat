import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Post } from '../models/post';
import { uploadMediaAndGetURL } from './storageService';

export const createPost = async (postData: Omit<Post, 'id' | 'createdAt' | 'likes'>, imageUri?: string): Promise<void> => {
    try {
        let imageUrl = '';

        if (imageUri) {
            const timestamp = Date.now();
            const path = `posts/${postData.usuarioId}/${timestamp}.jpg`;
            imageUrl = await uploadMediaAndGetURL(imageUri, path);
        }

        const newPost: any = {
            ...postData,
            imageUrl: imageUrl || null,
            createdAt: serverTimestamp(),
            likes: [],
        };

        await addDoc(collection(db, 'posts'), newPost);
    } catch (error) {
        console.error("Error creating post:", error);
        throw error;
    }
};

export const getRecentPosts = async (filter: 'all' | 'friends' | 'mine' = 'all', userId?: string): Promise<Post[]> => {
    try {
        let q;
        const postsRef = collection(db, 'posts');

        if (filter === 'mine' && userId) {
            q = query(postsRef, where('usuarioId', '==', userId), orderBy('createdAt', 'desc'), limit(20));
        } else {
            // For 'all' and 'friends' (MVP friends: fetch recent and filter client-side)
            q = query(postsRef, orderBy('createdAt', 'desc'), limit(50));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
    } catch (error) {
        console.error("Error fetching posts:", error);
        return [];
    }
};

export const deletePost = async (postId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
    }
};

export const toggleLike = async (postId: string, userId: string): Promise<void> => {
    try {
        const postRef = doc(db, 'posts', postId);
        // We can't easily check 'liked' status atomically without reading, 
        // but for optimistic UI updates in the component, we usually know.
        // A safer way is to assume the UI knows the current state.
        // However, standard interaction is often: read -> check -> update. 
        // Or blindly add/remove. 
        // Let's implement independent add/remove or a helper that does both? 
        // Actually, let's just expose addLike and removeLike, or pass a bool 'isLiked'.
        // Let's assume the component will call this toggle.
        // For simplicity allow the component to pass the intended action is better?
        // No, let's read the doc transactionally? Too heavy.
        // Let's just try to remove, if not there, add? No.
        // Let's implement: The component knows if it's liked. Pass 'shouldLike'.
        // Wait, the plan said "toggleLike".
        // Let's stick to reading the post in the component and deciding.
        // Actually, Firestore arrayUnion/Remove is idempotent.
        // Let's implement updating based on current known state passed from UI?
        // Or just two functions: likePost and unlikePost.
        // Simpler for now: likePost and unlikePost helpers or one function with bool.
    } catch (e) { }
};

export const likePost = async (postId: string, userId: string) => {
    await updateDoc(doc(db, 'posts', postId), {
        likes: arrayUnion(userId)
    });
};

export const unlikePost = async (postId: string, userId: string) => {
    await updateDoc(doc(db, 'posts', postId), {
        likes: arrayRemove(userId)
    });
};


export const getPostByLogId = async (logId: string): Promise<Post | null> => {
    try {
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, where('logId', '==', logId), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Post;
    } catch (error) {
        console.error("Error fetching post by logId:", error);
        return null;
    }
};
