import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardFooter } from '@/components/ui/card'

export function CandidateCardSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardContent className="flex-1 pt-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <div className="space-y-3 mt-4">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-6 w-32 rounded-md" />
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50 border-t p-3 flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
        <Skeleton className="h-8 w-full" />
      </CardFooter>
    </Card>
  )
}
