import { Card, CardContent } from "@/components/ui/card"
import { type LucideIcon } from 'lucide-react'
import { cn } from "@/lib/utils"

interface AdminStatCardProps {
  title: string
  count: number
  icon: LucideIcon
  variant: "warning" | "destructive" | "success"
}

export function AdminStatCard({ title, count, icon: Icon, variant }: AdminStatCardProps) {
  const variantClasses = {
    warning: "text-yellow-600",
    destructive: "text-red-600",
    success: "text-green-600",
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn("text-4xl font-bold", variantClasses[variant])}>{count}</p>
        </div>
        <Icon className={cn("h-8 w-8", variantClasses[variant])} />
      </CardContent>
    </Card>
  )
}
