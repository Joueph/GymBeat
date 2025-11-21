export default {
  expo: {
    name: "GymBeat",
    slug: "GymBeat",
    version: "1.1.3",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "gymbeat",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      icon: "./assets/images/icon.png",
      bundleIdentifier: "br.com.gymbeat",
      appleTeamId: "M4M9UUR2NT",
      buildNumber: "35",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSSupportsLiveActivities: true,
      },
      googleServicesFile: "./GoogleService-Info.plist",
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#000000",
        foregroundImage: "./assets/icons/adaptive-icon.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "br.com.gymbeat",
      versionCode: 15,
      googleServicesFile: "./google-services.json"
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "@bacons/apple-targets",
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/icons/splash-icon-light.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#000000",
          dark: {
            backgroundColor: "#000000",
            image: "./assets/images/icon.png",
          },
          ios: {
            image: "./assets/images/icon.png",
            dark: {
              image: "./assets/images/icon.png",
            },
          },
        },
      ],
      "expo-video",
      "expo-audio",
      "expo-web-browser",
      [
        "@react-native-firebase/app",
        {
          ios_uses_modules: true,
          ios_set_modular_headers: true,
        },
      ],
      
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
            deploymentTarget: "16.2",
          },
        },
      ],
      "expo-font",
      "./plugins/with-rnfb-nonmodular-fix.js",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "98b439cb-fc45-4f0b-ab2b-36f1c758c347",
      },
      // Agora isto é válido porque estamos em um arquivo .js
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    },
    updates: {
      url: "https://u.expo.dev/98b439cb-fc45-4f0b-ab2b-36f1c758c347", // mesmo ID do seu projeto
      enabled: true,
      fallbackToCacheTimeout: 0,
    },
        runtimeVersion: {
      policy: "appVersion",
    },

    

    owner: "joueph",
  },
};