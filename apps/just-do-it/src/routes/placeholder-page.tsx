import { Card } from '../components/ui/card'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <Card className="mt-8 max-w-xl">
        <p className="font-semibold">{title} is coming next.</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          This route is ready for its feature module as the product grows.
        </p>
      </Card>
    </div>
  )
}
