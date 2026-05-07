import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login - SGL',
  description: 'Sistema de Gestão de Locação',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      {children}
    </div>
  )
}
