import { Link } from 'expo-router';

import { Button, EmptyState, Screen } from '@/ui';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        title="That page isn't here"
        action={
          <Link href="/" asChild>
            <Button title="Go home" variant="secondary" />
          </Link>
        }
      />
    </Screen>
  );
}
