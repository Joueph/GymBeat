import React, { createContext, useCallback, useContext, useState } from 'react';
import { FeedbackToast } from '../FeedbackToast';

type FeedbackType = 'success' | 'failure';

interface FeedbackContextType {
    showFeedback: (type: FeedbackType, title: string, message: string, duration?: number) => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [data, setData] = useState({
        type: 'success' as FeedbackType,
        title: '',
        message: '',
        duration: 3000,
    });

    const showFeedback = useCallback((type: FeedbackType, title: string, message: string, duration = 3000) => {
        setData({ type, title, message, duration });
        setVisible(true);
    }, []);

    const hideFeedback = useCallback(() => {
        setVisible(false);
    }, []);

    return (
        <FeedbackContext.Provider value={{ showFeedback }}>
            {children}
            <FeedbackToast
                visible={visible}
                type={data.type}
                title={data.title}
                message={data.message}
                duration={data.duration}
                onHide={hideFeedback}
            />
        </FeedbackContext.Provider>
    );
};

export const useFeedback = () => {
    const context = useContext(FeedbackContext);
    if (!context) {
        throw new Error('useFeedback must be used within a FeedbackProvider');
    }
    return context;
};
