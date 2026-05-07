'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, ArrowRightLeft, Package, Receipt, Calendar, User, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Locacao {
  id: string
  clienteId: string
  cliente?: { id: string; nomeExibicao: string }
  clienteNome?: string
  produtoId: string
  produto?: { identificador: string; tipo?: { nome: string }; descricao?: { nome: string }; tamanho?: { nome: string } }
  produtoIdentificador: string
  produtoTipo?: string
  dataLocacao: string
  dataFim?: string
  formaPagamento: string
  numeroRelogio: string
  precoFicha: number
  percentualEmpresa: number
  percentualCliente: number
  periodicidade?: string
  valorFixo?: number
  dataPrimeiraCobranca?: string
  status: string
  ultimaLeituraRelogio?: number
  dataUltimaCobranca?: string
  trocaPano: boolean
  observacao?: string
}

export default function LocacaoDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  
  const [locacao, setLocacao] = useState<Locacao | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    try {
      const res = await api.get<{ data: Locacao }>(`/locacoes/${id}`)
      setLocacao(res.data)
    } catch (error) {
      toast.error('Erro ao carregar locação')
      router.push('/locacoes')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativa': return 'bg-green-100 text-green-800'
      case 'Finalizada': return 'bg-blue-100 text-blue-800'
      case 'Cancelada': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Skeleton className="h-8 w-8 animate-spin" /></div>
  }

  if (!locacao) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {locacao.produtoTipo || locacao.produto?.tipo?.nome || 'Produto'} N° {locacao.produtoIdentificador}
            </h1>
            <p className="text-muted-foreground">{locacao.clienteNome || locacao.cliente?.nomeExibicao}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {locacao.status === 'Ativa' && (
            <>
              <Link href={`/locacoes/${id}/editar`}>
                <Button variant="outline"><Edit className="mr-2 h-4 w-4" />Editar</Button>
              </Link>
              <Link href={`/locacoes/${id}/relocar`}>
                <Button variant="outline"><ArrowRightLeft className="mr-2 h-4 w-4" />Relocar</Button>
              </Link>
              <Link href={`/locacoes/${id}/enviar-estoque`}>
                <Button variant="destructive"><Package className="mr-2 h-4 w-4" />Estoque</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><User className="h-4 w-4" />Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><Link href={`/clientes/${locacao.clienteId}`} className="font-medium hover:underline">{locacao.clienteNome || locacao.cliente?.nomeExibicao}</Link></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="h-4 w-4" />Produto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Identificador</span><span className="font-medium">{locacao.produtoIdentificador}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span>{locacao.produtoTipo || locacao.produto?.tipo?.nome || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Descrição</span><span>{locacao.produto?.descricao?.nome || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tamanho</span><span>{locacao.produto?.tamanho?.nome || '-'}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-4 w-4" />Datas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Início</span><span>{formatDate(locacao.dataLocacao)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fim</span><span>{locacao.dataFim ? formatDate(locacao.dataFim) : '-'}</span></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><Badge className={getStatusColor(locacao.status)}>{locacao.status}</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="h-4 w-4" />Pagamento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Forma</span><span className="font-medium">{locacao.formaPagamento}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Relógio</span><span className="font-medium">{locacao.numeroRelogio}</span></div>
            {locacao.formaPagamento !== 'Periodo' ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Preço Ficha</span><span>{formatCurrency(locacao.precoFicha)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">% Empresa</span><span>{locacao.percentualEmpresa}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">% Cliente</span><span>{locacao.percentualCliente}%</span></div>
              </>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Periodicidade</span><span>{locacao.periodicidade}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor Fixo</span><span>{formatCurrency(locacao.valorFixo || 0)}</span></div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-4 w-4" />Cobrança</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Última Leitura</span><span>{locacao.ultimaLeituraRelogio ?? '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Última Cobrança</span><span>{locacao.dataUltimaCobranca ? formatDate(locacao.dataUltimaCobranca) : '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Troca de Pano</span><Badge variant={locacao.trocaPano ? 'default' : 'secondary'}>{locacao.trocaPano ? 'Sim' : 'Não'}</Badge></div>
          </CardContent>
        </Card>

        {locacao.observacao && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-lg">Observação</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{locacao.observacao}</p></CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
