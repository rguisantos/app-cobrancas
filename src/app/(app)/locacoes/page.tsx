'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, FileText, MoreHorizontal, Eye, Edit, ArrowRightLeft, Package, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Locacao {
  id: string
  clienteId: string
  cliente?: { id: string; nomeExibicao: string }
  clienteNome?: string
  produtoId: string
  produto?: { id: string; identificador: string; tipo?: { nome: string } }
  produtoIdentificador: string
  produtoTipo?: string
  dataLocacao: string
  dataFim?: string
  formaPagamento: string
  numeroRelogio: string
  status: string
}

export default function LocacoesPage() {
  const [locacoes, setLocacoes] = useState<Locacao[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.get<{ data: Locacao[] }>('/locacoes')
      setLocacoes(res.data || [])
    } catch (error) {
      toast.error('Erro ao carregar locações')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta locação?')) return
    try {
      await api.delete(`/locacoes/${id}`)
      toast.success('Locação excluída com sucesso')
      loadData()
    } catch (error) {
      toast.error('Erro ao excluir locação')
    }
  }

  const filteredLocacoes = locacoes.filter(l => {
    const matchSearch = !search || 
      l.clienteNome?.toLowerCase().includes(search.toLowerCase()) ||
      l.produtoIdentificador?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || l.status === statusFilter
    return matchSearch && matchStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativa': return 'bg-green-100 text-green-800'
      case 'Finalizada': return 'bg-blue-100 text-blue-800'
      case 'Cancelada': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locações</h1>
          <p className="text-muted-foreground">Gerencie as locações</p>
        </div>
        <Link href="/locacoes/nova">
          <Button><Plus className="mr-2 h-4 w-4" />Nova Locação</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por cliente ou produto..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredLocacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>Nenhuma locação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Locação</TableHead>
                  <TableHead>Relógio</TableHead>
                  <TableHead>Forma Pgto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocacoes.map((locacao) => (
                  <TableRow key={locacao.id}>
                    <TableCell className="font-medium">
                      {locacao.produtoTipo || locacao.produto?.tipo?.nome || 'Produto'} N° {locacao.produtoIdentificador}
                    </TableCell>
                    <TableCell>{locacao.clienteNome || locacao.cliente?.nomeExibicao || '-'}</TableCell>
                    <TableCell>{formatDate(locacao.dataLocacao)}</TableCell>
                    <TableCell>{locacao.numeroRelogio || '-'}</TableCell>
                    <TableCell>{locacao.formaPagamento}</TableCell>
                    <TableCell><Badge className={getStatusColor(locacao.status)}>{locacao.status}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/locacoes/${locacao.id}`}><Eye className="mr-2 h-4 w-4" />Visualizar</Link></DropdownMenuItem>
                          {locacao.status === 'Ativa' && (
                            <>
                              <DropdownMenuItem asChild><Link href={`/locacoes/${locacao.id}/editar`}><Edit className="mr-2 h-4 w-4" />Editar</Link></DropdownMenuItem>
                              <DropdownMenuItem asChild><Link href={`/locacoes/${locacao.id}/relocar`}><ArrowRightLeft className="mr-2 h-4 w-4" />Relocar</Link></DropdownMenuItem>
                              <DropdownMenuItem asChild><Link href={`/locacoes/${locacao.id}/enviar-estoque`}><Package className="mr-2 h-4 w-4" />Enviar para Estoque</Link></DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(locacao.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
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
