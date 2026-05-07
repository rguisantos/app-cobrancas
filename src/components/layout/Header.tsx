'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { usePathname } from 'next/navigation'

const routeNames: Record<string, string> = {
  clientes: 'Clientes',
  produtos: 'Produtos',
  locacoes: 'Locações',
  cobrancas: 'Cobranças',
  rotas: 'Rotas',
  usuarios: 'Usuários',
  equipamentos: 'Equipamentos',
  admin: 'Administração',
  atributos: 'Atributos',
  novo: 'Novo',
  nova: 'Nova',
  editar: 'Editar',
}

export function Header() {
  const pathname = usePathname()
  
  const pathSegments = pathname.split('/').filter(Boolean)
  
  const getBreadcrumbItems = () => {
    const items: { label: string; href: string }[] = [{ label: 'Dashboard', href: '/' }]
    
    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const label = routeNames[segment] || segment
      items.push({ label, href: currentPath })
    })
    
    return items
  }
  
  const breadcrumbItems = getBreadcrumbItems()
  
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => (
            <BreadcrumbItem key={item.href}>
              {index < breadcrumbItems.length - 1 ? (
                <>
                  <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
