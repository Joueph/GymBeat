import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
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
    onIndexChange: (index: number) => void;
}

export const PostCarousel = ({
    postImage,
    muscles,
    exercisesCount,
    duration,
    trainingName,
    viewShotRef,
    onIndexChange
}: PostCarouselProps) => {
    const flatListRef = useRef<FlatList>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    // Data source for carousel
    const data = [{ key: 'default' }];
    if (postImage) data.push({ key: 'image' });

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
        return (
            <View style={{ width: CARD_WIDTH, paddingHorizontal: 5 }}>
                <ImagePostCard
                    imageUri={postImage!}
                    duration={duration}
                    exercisesCount={exercisesCount}
                    muscles={muscles}
                    trainingName={trainingName}
                />
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

            {/* Dots */}
            {data.length > 1 && (
                <View style={styles.paginationDots}>
                    {data.map((_, i) => (
                        <View key={i} style={[styles.dot, i === activeIndex && styles.activeDot]} />
                    ))}
                </View>
            )}
        </View>
    );
};

const ViewStepShotWrapper = ({ children, viewShotRef }: { children: React.ReactNode, viewShotRef: any }) => (
    <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }}>
        {children}
    </ViewShot>
);

const styles = StyleSheet.create({
    paginationDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
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
