'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Route, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Rota { id: string; descricao: string; status: string }

export default function RotasPage() {
  const [rotas, setRotas] = useState<Rota[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const res = await api.get<{ data: Rota[] }>('/rotas')
      setRotas(res.data || [])
    } catch { toast.error('Erro ao carregar rotas') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza?')) return
    try { await api.delete(`/rotas/${id}`); toast.success('Rota excluída'); loadData() }
    catch { toast.error('Erro ao excluir') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Rotas</h1><p className="text-muted-foreground">Gerencie as rotas de cobrança</p></div>
        <Link href="/rotas/nova"><Button><Plus className="mr-2 h-4 w-4" />Nova Rota</Button></Link>
      </div>
      <Card>
        <CardContent className="p-0">
          {rotas.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground"><Route className="h-12 w-12 mb-4" /><p>Nenhuma rota cadastrada</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead className="w-[70px]"></TableHead></TableRow></TableHeader>
              <TableBody>
                {rotas.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.descricao}</TableCell>
                    <TableCell><Badge variant={r.status === 'Ativo' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/rotas/${r.id}/editar`}><Edit className="mr-2 h-4 w-4" />Editar</Link></DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(r.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
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
