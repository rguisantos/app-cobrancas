'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Users, MoreHorizontal, Edit, Trash2, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Usuario {
  id: string
  nome: string
  email: string
  cpf: string
  tipoPermissao: string
  status: string
  bloqueado: boolean
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const res = await api.get<{ data: Usuario[] }>('/usuarios')
      setUsuarios(res.data || [])
    } catch { toast.error('Erro ao carregar usuários') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return
    try { await api.delete(`/usuarios/${id}`); toast.success('Usuário excluído'); loadData() }
    catch { toast.error('Erro ao excluir') }
  }

  const getPermissaoColor = (tipo: string) => {
    switch (tipo) {
      case 'Administrador': return 'bg-purple-100 text-purple-800'
      case 'Secretario': return 'bg-blue-100 text-blue-800'
      case 'AcessoControlado': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <Link href="/usuarios/novo"><Button><Plus className="mr-2 h-4 w-4" />Novo Usuário</Button></Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Users className="h-12 w-12 mb-4" /><p>Nenhum usuário cadastrado</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="font-mono text-sm">{u.cpf}</TableCell>
                    <TableCell><Badge className={getPermissaoColor(u.tipoPermissao)}><Shield className="mr-1 h-3 w-3" />{u.tipoPermissao}</Badge></TableCell>
                    <TableCell><Badge variant={u.status === 'Ativo' && !u.bloqueado ? 'default' : 'secondary'}>{u.bloqueado ? 'Bloqueado' : u.status}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/usuarios/${u.id}/editar`}><Edit className="mr-2 h-4 w-4" />Editar</Link></DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(u.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
