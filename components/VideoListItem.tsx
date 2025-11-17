import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, StyleProp, View } from 'react-native';

interface VideoListItemProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
}

const isImage = (uri: string) => {
  const lowerUri = uri.toLowerCase();
  const queryStringIndex = lowerUri.indexOf('?');
  const path = queryStringIndex !== -1 ? lowerUri.substring(0, queryStringIndex) : lowerUri;
  return path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || path.endsWith('.webp');
};

export const VideoListItem = memo(({ uri, style }: VideoListItemProps) => {
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    const fetchCachedMedia = async () => {
      if (uri.startsWith('file://')) {
        setCachedUri(uri);
        return;
      }

      const fileName = uri.split('/').pop()?.split('?')[0];
      if (!fileName) return;

      const cachedFileUri = `${FileSystem.cacheDirectory}${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(cachedFileUri);

      if (fileInfo.exists) {
        setCachedUri(cachedFileUri);
      } else {
        setCachedUri(uri); // Use remote URI while downloading
        await FileSystem.downloadAsync(uri, cachedFileUri);
        setCachedUri(cachedFileUri); // Use cached URI after download
      }
    };

    fetchCachedMedia();
  }, [uri]);

  if (!cachedUri) {
    return <View style={[style, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#fff" /></View>;
  }

  if (isImage(cachedUri)) {
    return <Image source={{ uri: cachedUri }} style={style} resizeMode="cover" />;
  }

  return (
    <Video
      source={{ uri: cachedUri }}
      isMuted={true}
      isLooping={true}
      shouldPlay={true}
      resizeMode={ResizeMode.COVER}
      style={style}
    />
  );
});