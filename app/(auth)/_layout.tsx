// Em app/(auth)/_layout.tsx

import { Stack } from 'expo-router';

/**
 * Defines the authentication stack routes.
 * @returns Auth stack with login and registration screens.
 */
export default function AuthLayout() {
  return (
    <Stack
      // A propriedade 'screenOptions' aplica as mesmas opções
      // a todas as telas gerenciadas por este Stack (login e cadastro).
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
