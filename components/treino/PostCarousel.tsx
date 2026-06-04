import { FontAwesome } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { DefaultPostCard } from './post-cards/DefaultPostCard';
import { ImagePostCard } from './post-cards/ImagePostCard';


const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 30; // 15 padding each side

interface PostCarouselProps {
    postImage: string | null;
    muscles: string[];
    exercisesCount: number;
    duration: string;
    trainingName: string;
    viewShotRef: React.RefObject<ViewShot | null>;
    cameraRef: React.RefObject<CameraView | null>;
    hasCameraPermission: boolean;
    onRequestCameraPermission: () => void;
    onCameraReady: () => void;
    requestedIndex?: number;
    onIndexChange: (index: number) => void;
}

export const PostCarousel = ({
    postImage,
    muscles,
    exercisesCount,
    duration,
    trainingName,
    viewShotRef,
    cameraRef,
    hasCameraPermission,
    onRequestCameraPermission,
    onCameraReady,
    requestedIndex,
    onIndexChange
}: PostCarouselProps) => {
    const flatListRef = useRef<FlatList>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const data = [{ key: 'default' }, { key: 'camera' }];

    useEffect(() => {
        if (!postImage) return;

        requestAnimationFrame(() => {
            flatListRef.current?.scrollToIndex({ index: 1, animated: true });
            setActiveIndex(1);
            onIndexChange(1);
        });
    }, [postImage, onIndexChange]);

    useEffect(() => {
        if (requestedIndex === undefined) return;

        requestAnimationFrame(() => {
            flatListRef.current?.scrollToIndex({ index: requestedIndex, animated: true });
            setActiveIndex(requestedIndex);
            onIndexChange(requestedIndex);
        });
    }, [requestedIndex, onIndexChange]);

    const handleScroll = (event: any) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        const roundIndex = Math.round(index);

        // Only update if changed prevents unnecessary renders, preferably check !==
        if (roundIndex !== activeIndex) {
            setActiveIndex(roundIndex);
            onIndexChange(roundIndex);
        }
    };



    const renderItem = ({ item }: { item: any }) => {
        if (item.key === 'default') {
            return (
                <View style={{ width: CARD_WIDTH, paddingHorizontal: 5 }}>
                    <DefaultPostCard
                        muscles={muscles}
                        count={exercisesCount}
                        time={duration}
                        trainingName={trainingName}
                    />
                </View>
            );
        }
        if (postImage) {
            return (
                <View style={styles.itemFrame}>
                    <ImagePostCard
                        imageUri={postImage}
                        duration={duration}
                        exercisesCount={exercisesCount}
                        muscles={muscles}
                        trainingName={trainingName}
                    />
                </View>
            );
        }

        return (
            <View style={{ width: CARD_WIDTH, paddingHorizontal: 5 }}>
                <View style={styles.cameraCard}>
                    {hasCameraPermission ? (
                        <CameraView
                            ref={cameraRef}
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            onCameraReady={onCameraReady}
                        />
                    ) : (
                        <View style={styles.permissionState}>
                            <FontAwesome name="camera" size={34} color="#3B82F6" />
                            <Text style={styles.permissionTitle}>Câmera</Text>
                            <TouchableOpacity style={styles.permissionButton} onPress={onRequestCameraPermission}>
                                <Text style={styles.permissionButtonText}>Permitir acesso</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View>
            <ViewStepShotWrapper viewShotRef={viewShotRef}>
                <FlatList
                    ref={flatListRef}
                    data={data}
                    renderItem={renderItem}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={item => item.key}
                    onMomentumScrollEnd={handleScroll}
                    style={{ width: CARD_WIDTH, alignSelf: 'center' }}
                    initialNumToRender={1}
                    maxToRenderPerBatch={1}
                    windowSize={3}
                    removeClippedSubviews={false}
                    getItemLayout={(data, index) => (
                        { length: CARD_WIDTH, offset: CARD_WIDTH * index, index }
                    )}
                />
            </ViewStepShotWrapper>

            <View style={styles.paginationDots}>
                {data.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeIndex && styles.activeDot]} />
                ))}
            </View>
        </View>
    );
};

const ViewStepShotWrapper = ({ children, viewShotRef }: { children: React.ReactNode, viewShotRef: any }) => (
    <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }} style={styles.viewShot}>
        {children}
    </ViewShot>
);

const styles = StyleSheet.create({
    viewShot: {
        backgroundColor: '#0B0D10',
        alignItems: 'center',
    },
    itemFrame: {
        width: CARD_WIDTH,
        paddingHorizontal: 5,
    },
    cameraCard: {
        width: '100%',
        aspectRatio: 4 / 5,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#050608',
        borderWidth: 1,
        borderColor: '#2A2E37',
        position: 'relative',
    },
    permissionState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 20,
    },
    permissionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    permissionButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    permissionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    paginationDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginTop: 14,
        marginBottom: 15,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#444',
    },
    activeDot: {
        backgroundColor: '#3B82F6',
        width: 20,
    },
});
