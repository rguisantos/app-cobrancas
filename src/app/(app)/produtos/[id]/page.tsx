'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Pencil,
  Package,
  MapPin,
  Calendar,
  Wrench,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  FileText,
  Trash2,
  User
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Produto {
  id: string
  identificador: string
  numeroRelogio?: string
  tipoId?: string
  tipo?: {
    id: string
    nome: string
  }
  descricaoId?: string
  descricao?: {
    id: string
    nome: string
  }
  tamanhoId?: string
  tamanho?: {
    id: string
    nome: string
  }
  codigoCH?: string
  codigoABLF?: string
  conservacao: string
  statusProduto: string
  estabelecimento?: string
  observacao?: string
  dataFabricacao?: string
  dataUltimaManutencao?: string
  relatorioUltimaManutencao?: string
  createdAt: string
  updatedAt: string
}

interface Locacao {
  id: string
  dataLocacao: string
  dataFim?: string
  status: string
  cliente: {
    id: string
    nomeExibicao: string
  }
}

export default function ProdutoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [produto, setProduto] = useState<Produto | null>(null)
  const [locacoes, setLocacoes] = useState<Locacao[]>([])
  const [locacaoAtiva, setLocacaoAtiva] = useState<Locacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadData()
    }
  }, [params.id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [produtoRes, locacoesRes] = await Promise.all([
        api.get<Produto>(`/produtos/${params.id}`),
        api.get<{ data: Locacao[] }>(`/locacoes?produtoId=${params.id}`)
      ])

      setProduto(produtoRes)
      const allLocacoes = locacoesRes.data || []
      setLocacoes(allLocacoes)
      
      // Find active locacao
      const ativa = allLocacoes.find(l => l.status === 'Ativa')
      setLocacaoAtiva(ativa || null)
    } catch (error) {
      console.error('Error loading produto:', error)
      toast.error('Erro ao carregar produto')
      router.push('/produtos')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await api.delete(`/produtos/${params.id}`)
      toast.success('Produto excluído com sucesso')
      router.push('/produtos')
    } catch (error) {
      console.error('Error deleting produto:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Ativo':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        )
      case 'Inativo':
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Inativo
          </Badge>
        )
      case 'Manutenção':
        return (
          <Badge variant="destructive">
            <Wrench className="h-3 w-3 mr-1" />
            Manutenção
          </Badge>
        )
      case 'Ativa':
        return <Badge variant="default">Ativa</Badge>
      case 'Finalizada':
        return <Badge variant="secondary">Finalizada</Badge>
      case 'Cancelada':
        return <Badge variant="destructive">Cancelada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getConservacaoBadge = (conservacao: string) => {
    const colors: Record<string, string> = {
      'Ótima': 'bg-green-100 text-green-800',
      'Boa': 'bg-blue-100 text-blue-800',
      'Regular': 'bg-yellow-100 text-yellow-800',
      'Ruim': 'bg-orange-100 text-orange-800',
      'Péssima': 'bg-red-100 text-red-800',
    }
    return (
      <Badge variant="outline" className={colors[conservacao] || ''}>
        {conservacao}
      </Badge>
    )
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!produto) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/produtos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{produto.identificador}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              {produto.descricao?.nome || 'Sem descrição'}
              <span className="mx-2">•</span>
              {getStatusBadge(produto.statusProduto)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {locacaoAtiva && (
            <>
              <Button variant="outline" onClick={() => router.push(`/locacoes/${locacaoAtiva.id}/relocar`)}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Relocar
              </Button>
              <Button variant="outline" onClick={() => router.push(`/locacoes/${locacaoAtiva.id}/enviar-estoque`)}>
                <MapPin className="h-4 w-4 mr-2" />
                Enviar para Estoque
              </Button>
            </>
          )}
          <Button onClick={() => router.push(`/produtos/${params.id}/editar`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Identificador</p>
                <p className="font-medium">{produto.identificador}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Número do Relógio</p>
                <p className="font-medium">{produto.numeroRelogio || '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">{produto.tipo?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tamanho</p>
                <p className="font-medium">{produto.tamanho?.nome || '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Descrição</p>
                <p className="font-medium">{produto.descricao?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conservação</p>
                {getConservacaoBadge(produto.conservacao)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Códigos e Localização */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Códigos e Localização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Código CH</p>
                <p className="font-medium">{produto.codigoCH || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Código ABLF</p>
                <p className="font-medium">{produto.codigoABLF || '-'}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Estabelecimento</p>
              <p className="font-medium flex items-center gap-2">
                {produto.estabelecimento ? (
                  <>
                    <MapPin className="h-4 w-4" />
                    {produto.estabelecimento}
                  </>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              {getStatusBadge(produto.statusProduto)}
            </div>
          </CardContent>
        </Card>

        {/* Locação Ativa */}
        {locacaoAtiva && (
          <Card className="lg:col-span-2 border-green-500/50 bg-green-50/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Locação Ativa
              </CardTitle>
              <CardDescription>Este produto está atualmente locado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-green-100 p-3">
                    <User className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{locacaoAtiva.cliente.nomeExibicao}</p>
                    <p className="text-sm text-muted-foreground">
                      Locado em {formatDate(locacaoAtiva.dataLocacao)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/locacoes/${locacaoAtiva.id}`)}
                >
                  Ver Locação
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manutenção */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Manutenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Data Fabricação</p>
                <p className="font-medium">
                  {produto.dataFabricacao ? formatDate(produto.dataFabricacao) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Manutenção</p>
                <p className="font-medium">
                  {produto.dataUltimaManutencao ? formatDate(produto.dataUltimaManutencao) : '-'}
                </p>
              </div>
            </div>
            {produto.relatorioUltimaManutencao && (
              <div>
                <p className="text-sm text-muted-foreground">Relatório</p>
                <p className="text-sm">{produto.relatorioUltimaManutencao}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observação e Cadastro */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outras Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {produto.observacao && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Observação</p>
                <p className="text-sm">{produto.observacao}</p>
              </div>
            )}
            <Separator />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Cadastrado em {formatDate(produto.createdAt)}
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Atualizado em {formatDate(produto.updatedAt)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Locações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Locações
          </CardTitle>
          <CardDescription>Histórico de todas as locações deste produto</CardDescription>
        </CardHeader>
        <CardContent>
          {locacoes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              Nenhuma locação encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Locação</TableHead>
                  <TableHead>Data Fim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locacoes.map((locacao) => (
                  <TableRow key={locacao.id}>
                    <TableCell className="font-medium">
                      {locacao.cliente.nomeExibicao}
                    </TableCell>
                    <TableCell>{formatDate(locacao.dataLocacao)}</TableCell>
                    <TableCell>{locacao.dataFim ? formatDate(locacao.dataFim) : '-'}</TableCell>
                    <TableCell>{getStatusBadge(locacao.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/locacoes/${locacao.id}`)}
                      >
                        Ver detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Zona de Perigo</CardTitle>
          <CardDescription>
            Ações irreversíveis relacionadas a este produto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Produto
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o produto "{produto.identificador}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
