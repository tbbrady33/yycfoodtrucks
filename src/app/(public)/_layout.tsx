import { Stack } from 'expo-router';

/**
 * Layout for the customer-facing public surface (trucks, categories, contact).
 * Native Stack header gives us back navigation for free. Per-screen titles
 * come from each screen's <Stack.Screen options={{ title }} /> declaration.
 */
export default function PublicLayout() {
  return <Stack screenOptions={{ headerBackTitle: 'Back' }} />;
}
