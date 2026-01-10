import { useAmigosData } from '@/hooks/useAmigosData';
import { getRecentPosts } from '@/services/postService';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Post } from '../../models/post';
import { PostCard } from './PostCard';

import {
    Menu,
    MenuOption,
    MenuOptions,
    MenuTrigger,
} from 'react-native-popup-menu';

type FilterType = 'all' | 'friends' | 'mine';

export const PostFeedWidget = () => {
    const { user, friendIds, actions } = useAmigosData();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    const fetchPosts = async () => {
        setLoading(true);
        try {
            // 'friends' filter logic: fetch 'all' then filter locally (MVP)
            // or pass 'friends' and let service handle if extended.
            // Plan says: pass filter to service.

            // If filter is friends, we fetch 'all' (or optimized query) and filter.
            // Service supports 'mine' and 'all'. Let's handle 'friends' here or update service.
            // Plan: "MVP friends: fetch recent and filter client-side". Service query for 'friends' returns all for now.
            const fetchedPosts = await getRecentPosts(filter, user?.id);

            if (filter === 'friends') {
                const friendsPosts = fetchedPosts.filter(p => friendIds?.includes(p.usuarioId));
                setPosts(friendsPosts);
            } else {
                setPosts(fetchedPosts);
            }

        } catch (error) {
            console.error("Error fetching feed:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchPosts();
        }
    }, [filter, user]);

    const handlePostDelete = async (postId: string) => {
        try {
            await actions.deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch (error) {
            console.error("Failed to delete post", error);
        }
    };

    const handlePostLike = async (postId: string, userId: string) => {
        // Optimistic update happens in Card. Here we just call service.
        // Actually, PostCard calls onLike provided here.
        // But wait, PostCard handles UI state. Does it verify if liked?
        // Yes, PostCard receives 'post' which has 'likes'.
        // BUT, if we re-fetch, we get updated likes.
        // If we toggle, we should update local state here too so if we re-render we don't flip back?
        // Let's rely on PostCard internal state for immediate feedback.
        // And fire-and-forget the service call?
        // Or better: update the post in the 'posts' array?
        // Updating 'posts' array is better for consistency.

        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return;

        const post = posts[postIndex];
        const isLiked = post.likes?.includes(userId);
        let newLikes = post.likes || [];

        if (isLiked) {
            newLikes = newLikes.filter(id => id !== userId);
            actions.unlikePost(postId, userId);
        } else {
            newLikes = [...newLikes, userId];
            actions.likePost(postId, userId);
        }

        const updatedPost = { ...post, likes: newLikes };
        const newPosts = [...posts];
        newPosts[postIndex] = updatedPost;
        setPosts(newPosts);
    };

    if (loading && posts.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" />
            </View>
        );
    }

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.title}>Feed</Text>
            <Menu>
                <MenuTrigger style={styles.filterTrigger}>
                    <Text style={styles.filterText}>
                        {filter === 'all' ? 'Todos' : filter === 'friends' ? 'Amigos' : 'Meus Posts'}
                    </Text>
                    <FontAwesome name="chevron-down" size={12} color="#888" />
                </MenuTrigger>
                <MenuOptions customStyles={{ optionsContainer: styles.menuOptions }}>
                    <MenuOption onSelect={() => setFilter('all')} text="Todos" customStyles={{ optionText: { color: '#fff' } }} />
                    <MenuOption onSelect={() => setFilter('friends')} text="Amigos" customStyles={{ optionText: { color: '#fff' } }} />
                    <MenuOption onSelect={() => setFilter('mine')} text="Meus Posts" customStyles={{ optionText: { color: '#fff' } }} />
                </MenuOptions>
            </Menu>
        </View>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}
            {posts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Nenhum post encontrado.</Text>
                </View>
            ) : (
                posts.map(post => (
                    <PostCard
                        key={post.id}
                        post={post}
                        currentUserId={user?.id || ''}
                        onDelete={handlePostDelete}
                        onLike={handlePostLike}
                        onShare={(id) => { /* Share logic handled in card for now */ }}
                    />
                ))
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 15,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    filterTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        backgroundColor: '#1A1D23',
        borderRadius: 8,
    },
    filterText: {
        color: '#ccc',
        fontSize: 14,
    },
    menuOptions: {
        backgroundColor: '#1A1D23',
        borderRadius: 8,
        padding: 5,
        marginTop: 30,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
    }
});
