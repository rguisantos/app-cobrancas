'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  FileText,
  Loader2,
  DollarSign,
  Percent
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Locacao {
  id: string
  dataLocacao: string
  formaPagamento: string
  numeroRelogio: string
  precoFicha: number
  percentualEmpresa: number
  percentualCliente: number
  periodicidade?: string
  valorFixo?: number
  dataPrimeiraCobranca?: string
  trocaPano: boolean
  observacao?: string
  cliente: { id: string; nomeExibicao: string }
  produto: { id: string; identificador: string }
}

export default function EditarLocacaoPage() {
  const params = useParams()
  const router = useRouter()

  // Form state
  const [dataLocacao, setDataLocacao] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<'Periodo' | 'PercentualPagar' | 'PercentualReceber'>('Periodo')
  const [numeroRelogio, setNumeroRelogio] = useState('')
  const [precoFicha, setPrecoFicha] = useState('')
  const [percentualEmpresa, setPercentualEmpresa] = useState('50')
  const [percentualCliente, setPercentualCliente] = useState('50')
  const [periodicidade, setPeriodicidade] = useState('')
  const [valorFixo, setValorFixo] = useState('')
  const [dataPrimeiraCobranca, setDataPrimeiraCobranca] = useState('')
  const [trocaPano, setTrocaPano] = useState(false)
  const [observacao, setObservacao] = useState('')

  // Locacao info
  const [locacao, setLocacao] = useState<Locacao | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadLocacao()
    }
  }, [params.id])

  const loadLocacao = async () => {
    try {
      setLoading(true)
      const locacaoData: Locacao = await api.get(`/locacoes/${params.id}`)
      setLocacao(locacaoData)

      const date = new Date(locacaoData.dataLocacao)
      setDataLocacao(date.toISOString().split('T')[0])
      setFormaPagamento(locacaoData.formaPagamento as 'Periodo' | 'PercentualPagar' | 'PercentualReceber')
      setNumeroRelogio(locacaoData.numeroRelogio || '')
      setPrecoFicha(String(locacaoData.precoFicha))
      setPercentualEmpresa(String(locacaoData.percentualEmpresa))
      setPercentualCliente(String(locacaoData.percentualCliente))
      setPeriodicidade(locacaoData.periodicidade || '')
      setValorFixo(locacaoData.valorFixo ? String(locacaoData.valorFixo) : '')
      if (locacaoData.dataPrimeiraCobranca) {
        setDataPrimeiraCobranca(new Date(locacaoData.dataPrimeiraCobranca).toISOString().split('T')[0])
      }
      setTrocaPano(locacaoData.trocaPano)
      setObservacao(locacaoData.observacao || '')
    } catch (error) {
      console.error('Error loading locacao:', error)
      toast.error('Erro ao carregar locação')
      router.push('/locacoes')
    } finally {
      setLoading(false)
    }
  }

  const handlePercentChange = (field: 'empresa' | 'cliente', value: string) => {
    const numValue = parseFloat(value) || 0
    if (field === 'empresa') {
      setPercentualEmpresa(value)
      setPercentualCliente(String(100 - numValue))
    } else {
      setPercentualCliente(value)
      setPercentualEmpresa(String(100 - numValue))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dataLocacao) {
      toast.error('Data da locação é obrigatória')
      return
    }

    setSaving(true)
    try {
      const data = {
        dataLocacao: new Date(dataLocacao).toISOString(),
        formaPagamento,
        numeroRelogio: numeroRelogio || null,
        precoFicha: parseFloat(precoFicha) || 0,
        percentualEmpresa: parseFloat(percentualEmpresa) || 50,
        percentualCliente: parseFloat(percentualCliente) || 50,
        periodicidade: formaPagamento === 'Periodo' ? periodicidade : null,
        valorFixo: formaPagamento === 'Periodo' ? parseFloat(valorFixo) || null : null,
        dataPrimeiraCobranca: formaPagamento === 'Periodo' && dataPrimeiraCobranca 
          ? new Date(dataPrimeiraCobranca).toISOString() 
          : null,
        trocaPano,
        observacao: observacao || null,
      }

      await api.put(`/locacoes/${params.id}`, data)
      toast.success('Locação atualizada com sucesso')
      router.push(`/locacoes/${params.id}`)
    } catch (error) {
      console.error('Error saving locacao:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!locacao) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/locacoes/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Editar Locação</h1>
          <p className="text-muted-foreground">
            Cliente: {locacao.cliente.nomeExibicao} | Produto: {locacao.produto.identificador}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados da Locação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dados da Locação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dataLocacao">Data da Locação *</Label>
                <Input
                  id="dataLocacao"
                  type="date"
                  value={dataLocacao}
                  onChange={(e) => setDataLocacao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numeroRelogio">Número do Relógio</Label>
                <Input
                  id="numeroRelogio"
                  placeholder="Número do relógio"
                  value={numeroRelogio}
                  onChange={(e) => setNumeroRelogio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precoFicha">Preço da Ficha</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="precoFicha"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={precoFicha}
                    onChange={(e) => setPrecoFicha(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Forma de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Forma de Pagamento
            </CardTitle>
            <CardDescription>Selecione como será feito o pagamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Button
                type="button"
                variant={formaPagamento === 'Periodo' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col gap-1"
                onClick={() => setFormaPagamento('Periodo')}
              >
                <span className="font-semibold">Período</span>
                <span className="text-xs opacity-70">Mensal/Semanal</span>
              </Button>
              <Button
                type="button"
                variant={formaPagamento === 'PercentualPagar' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col gap-1"
                onClick={() => setFormaPagamento('PercentualPagar')}
              >
                <span className="font-semibold">% Pagar</span>
                <span className="text-xs opacity-70">Empresa paga cliente</span>
              </Button>
              <Button
                type="button"
                variant={formaPagamento === 'PercentualReceber' ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col gap-1"
                onClick={() => setFormaPagamento('PercentualReceber')}
              >
                <span className="font-semibold">% Receber</span>
                <span className="text-xs opacity-70">Cliente paga empresa</span>
              </Button>
            </div>

            {/* Percentuais */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="percentualEmpresa">Percentual Empresa (%)</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="percentualEmpresa"
                    type="number"
                    min="0"
                    max="100"
                    value={percentualEmpresa}
                    onChange={(e) => handlePercentChange('empresa', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentualCliente">Percentual Cliente (%)</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="percentualCliente"
                    type="number"
                    min="0"
                    max="100"
                    value={percentualCliente}
                    onChange={(e) => handlePercentChange('cliente', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Campos específicos para pagamento por Período */}
            {formaPagamento === 'Periodo' && (
              <>
                <Separator />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="periodicidade">Periodicidade</Label>
                    <Select value={periodicidade} onValueChange={setPeriodicidade}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mensal">Mensal</SelectItem>
                        <SelectItem value="Semanal">Semanal</SelectItem>
                        <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                        <SelectItem value="Diária">Diária</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valorFixo">Valor Fixo</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="valorFixo"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={valorFixo}
                        onChange={(e) => setValorFixo(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataPrimeiraCobranca">Data Primeira Cobrança</Label>
                    <Input
                      id="dataPrimeiraCobranca"
                      type="date"
                      value={dataPrimeiraCobranca}
                      onChange={(e) => setDataPrimeiraCobranca(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Outras Informações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outras Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trocaPano"
                checked={trocaPano}
                onCheckedChange={(checked) => setTrocaPano(checked as boolean)}
              />
              <Label htmlFor="trocaPano" className="cursor-pointer">
                Troca de pano necessária
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                placeholder="Observações sobre a locação..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href={`/locacoes/${params.id}`}>
            <Button variant="outline" type="button">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
