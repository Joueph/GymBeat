import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';

export function KeyboardDismissButton() {
    const [visible, setVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const opacity = useRef(new Animated.Value(0)).current;
    const { height: screenHeight } = useWindowDimensions();

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (event: any) => {
            setKeyboardHeight(event.endCoordinates.height);
            setVisible(true);
            Animated.timing(opacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }).start();
        };

        const onHide = () => {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start(() => {
                setVisible(false);
                setKeyboardHeight(0);
            });
        };

        const showListener = Keyboard.addListener(showEvent, onShow);
        const hideListener = Keyboard.addListener(hideEvent, onHide);

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, [opacity]);

    if (!visible) return null;

    // Calculate position: just above the keyboard with some padding
    // We use absolute positioning from bottom. 
    // On iOS, keyboardHeight is accurate. On Android, it might behave differently depending on soft input mode.
    // Assuming 'overlap' or generic standard behavior where we want it sitting on top of the keyboard.
    const bottomPosition = keyboardHeight + 10;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    bottom: bottomPosition,
                    opacity: opacity,
                },
            ]}
        >
            <TouchableOpacity
                style={styles.button}
                onPress={() => Keyboard.dismiss()}
                activeOpacity={0.8}
            >
                <MaterialIcons name="keyboard" size={20} color="#fff" />
                <MaterialIcons name="keyboard-arrow-down" size={20} color="#fff" style={styles.chevron} />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 16,
        zIndex: 9999, // Ensure it's above everything
    },
    button: {
        backgroundColor: '#333',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    chevron: {
        marginTop: -4, // Pull closer to the keyboard icon
    },
});
