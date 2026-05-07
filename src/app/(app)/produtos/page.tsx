'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Package, MoreHorizontal, Edit, Eye, Trash2 } from 'lucide-react'
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

interface Produto {
  id: string
  identificador: string
  numeroRelogio?: string
  tipoId?: string
  tipo?: { id: string; nome: string }
  descricaoId?: string
  descricao?: { id: string; nome: string }
  tamanhoId?: string
  tamanho?: { id: string; nome: string }
  conservacao: string
  statusProduto: string
  estabelecimento?: string
  observacao?: string
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [conservacaoFilter, setConservacaoFilter] = useState<string>('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.get<{ data: Produto[] }>('/produtos')
      setProdutos(res.data || [])
    } catch (error) {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return
    try {
      await api.delete(`/produtos/${id}`)
      toast.success('Produto excluído com sucesso')
      loadData()
    } catch (error) {
      toast.error('Erro ao excluir produto')
    }
  }

  const filteredProdutos = produtos.filter(p => {
    const matchSearch = !search || p.identificador.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || p.statusProduto === statusFilter
    const matchConservacao = !conservacaoFilter || p.conservacao === conservacaoFilter
    return matchSearch && matchStatus && matchConservacao
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativo': return 'bg-green-100 text-green-800'
      case 'Inativo': return 'bg-gray-100 text-gray-800'
      case 'Manutenção': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getConservacaoColor = (conservacao: string) => {
    switch (conservacao) {
      case 'Ótima': return 'bg-green-100 text-green-800'
      case 'Boa': return 'bg-blue-100 text-blue-800'
      case 'Regular': return 'bg-yellow-100 text-yellow-800'
      case 'Ruim': return 'bg-orange-100 text-orange-800'
      case 'Péssima': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Gerencie os produtos do sistema</p>
        </div>
        <Link href="/produtos/novo">
          <Button><Plus className="mr-2 h-4 w-4" />Novo Produto</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por identificador..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
                <SelectItem value="Manutenção">Manutenção</SelectItem>
              </SelectContent>
            </Select>
            <Select value={conservacaoFilter} onValueChange={setConservacaoFilter}>
              <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Conservação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                <SelectItem value="Ótima">Ótima</SelectItem>
                <SelectItem value="Boa">Boa</SelectItem>
                <SelectItem value="Regular">Regular</SelectItem>
                <SelectItem value="Ruim">Ruim</SelectItem>
                <SelectItem value="Péssima">Péssima</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredProdutos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Relógio</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conservação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProdutos.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell className="font-medium">{produto.identificador}</TableCell>
                    <TableCell>{produto.numeroRelogio || '-'}</TableCell>
                    <TableCell>{produto.tipo?.nome || '-'}</TableCell>
                    <TableCell>{produto.descricao?.nome || '-'}</TableCell>
                    <TableCell><Badge className={getConservacaoColor(produto.conservacao)}>{produto.conservacao}</Badge></TableCell>
                    <TableCell><Badge className={getStatusColor(produto.statusProduto)}>{produto.statusProduto}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/produtos/${produto.id}`}><Eye className="mr-2 h-4 w-4" />Visualizar</Link></DropdownMenuItem>
                          <DropdownMenuItem asChild><Link href={`/produtos/${produto.id}/editar`}><Edit className="mr-2 h-4 w-4" />Editar</Link></DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(produto.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
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
