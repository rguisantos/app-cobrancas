'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Receipt,
  User,
  Package,
  Calendar,
  DollarSign,
  Percent
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Cobranca {
  id: string
  dataInicio: string
  dataFim: string
  dataPagamento?: string
  dataVencimento?: string
  status: string
  relogioAnterior: number
  relogioAtual: number
  fichasRodadas: number
  valorFicha: number
  totalBruto: number
  descontoPartidasQtd?: number
  descontoPartidasValor?: number
  descontoDinheiro?: number
  percentualEmpresa: number
  subtotalAposDescontos: number
  valorPercentual: number
  totalClientePaga: number
  valorRecebido: number
  saldoDevedorGerado: number
  observacao?: string
  cliente: {
    id: string
    nomeExibicao: string
  }
  locacao: {
    id: string
    produto?: {
      id: string
      identificador: string
    }
  }
  createdAt: string
}

export default function CobrancaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [cobranca, setCobranca] = useState<Cobranca | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      loadData()
    }
  }, [params.id])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.get<Cobranca>(`/cobrancas/${params.id}`)
      setCobranca(res)
    } catch (error) {
      console.error('Error loading cobranca:', error)
      toast.error('Erro ao carregar cobrança')
      router.push('/cobrancas')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'Pago': 'default',
      'Pendente': 'secondary',
      'Parcial': 'outline',
      'Atrasado': 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
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

  if (!cobranca) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/cobrancas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Cobrança #{cobranca.id.slice(-6).toUpperCase()}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              {formatDate(cobranca.dataInicio)} - {formatDate(cobranca.dataFim)}
              <span className="mx-2">•</span>
              {getStatusBadge(cobranca.status)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cliente e Locação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vínculos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                {cobranca.cliente.nomeExibicao}
              </p>
              <Button
                variant="link"
                className="p-0 h-auto mt-1"
                onClick={() => router.push(`/clientes/${cobranca.cliente.id}`)}
              >
                Ver cliente
              </Button>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Produto</p>
              <p className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                {cobranca.locacao?.produto?.identificador || '-'}
              </p>
              {cobranca.locacao?.produto?.id && (
                <Button
                  variant="link"
                  className="p-0 h-auto mt-1"
                  onClick={() => router.push(`/produtos/${cobranca.locacao.produto!.id}`)}
                >
                  Ver produto
                </Button>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Locação</p>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => router.push(`/locacoes/${cobranca.locacao.id}`)}
              >
                Ver locação
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Período */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Data Início</p>
                <p className="font-medium">{formatDate(cobranca.dataInicio)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data Fim</p>
                <p className="font-medium">{formatDate(cobranca.dataFim)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Data Pagamento</p>
                <p className="font-medium">
                  {cobranca.dataPagamento ? formatDate(cobranca.dataPagamento) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data Vencimento</p>
                <p className="font-medium">
                  {cobranca.dataVencimento ? formatDate(cobranca.dataVencimento) : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leituras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leitura do Relógio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Anterior</p>
                <p className="font-medium text-lg">{cobranca.relogioAnterior}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">→</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Atual</p>
                <p className="font-medium text-lg">{cobranca.relogioAtual}</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Fichas Rodadas</p>
                <p className="font-medium text-xl">{cobranca.fichasRodadas}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor da Ficha</p>
                <p className="font-medium">{formatCurrency(cobranca.valorFicha)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Totais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Bruto</p>
              <p className="font-medium text-2xl">{formatCurrency(cobranca.totalBruto)}</p>
            </div>

            {(cobranca.descontoPartidasQtd || cobranca.descontoDinheiro) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Descontos</p>
                  {cobranca.descontoPartidasQtd && cobranca.descontoPartidasQtd > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Partidas ({cobranca.descontoPartidasQtd})</span>
                      <span className="text-red-600">
                        -{formatCurrency(cobranca.descontoPartidasValor || 0)}
                      </span>
                    </div>
                  )}
                  {cobranca.descontoDinheiro && cobranca.descontoDinheiro > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Desconto em dinheiro</span>
                      <span className="text-red-600">
                        -{formatCurrency(cobranca.descontoDinheiro)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="font-medium">{formatCurrency(cobranca.subtotalAposDescontos)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">% Empresa</p>
                <p className="font-medium flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  {cobranca.percentualEmpresa}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Total Cliente Paga</p>
              <p className="font-bold text-xl text-green-600">
                {formatCurrency(cobranca.totalClientePaga)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Valor Recebido</p>
              <p className="font-bold text-xl">
                {formatCurrency(cobranca.valorRecebido)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Saldo Devedor</p>
              <p className={`font-bold text-xl ${cobranca.saldoDevedorGerado > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(cobranca.saldoDevedorGerado)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Status</p>
              {getStatusBadge(cobranca.status)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Observação */}
      {cobranca.observacao && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Observação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{cobranca.observacao}</p>
          </CardContent>
        </Card>
      )}

      {/* Metadados */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Registrado em {formatDate(cobranca.createdAt)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
