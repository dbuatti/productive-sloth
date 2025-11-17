import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { Loader2 } from 'lucide-react';

const AchievementsPage: React.FC = () => {
  const { isLoading: isSessionLoading, user } = useSession();

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground animate-slide-in-up">Achievements</h1> {/* Changed text-3xl to text-2xl */}
      <Card className="animate-pop-in animate-hover-lift"> {/* Added animate-hover-lift */}
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"> {/* Changed text-xl to text-lg */}
            <Trophy className="h-6 w-6 text-logo-yellow" />
            Coming Soon!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will showcase your accomplishments and milestones. Stay tuned for exciting updates!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AchievementsPage;