'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Package, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
  numeroRelogio: string
  formaPagamento: string
}

interface Estabelecimento { id: string; nome: string }

export default function EnviarEstoquePage() {
  const router = useRouter()
  const params = useParams()
  const locacaoId = params.id as string
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [locacao, setLocacao] = useState<Locacao | null>(null)
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([])
  
  const [formData, setFormData] = useState({
    estabelecimentoId: '',
    estabelecimentoNome: '',
    motivo: '',
    observacao: '',
  })

  useEffect(() => {
    loadData()
  }, [locacaoId])

  const loadData = async () => {
    try {
      const [locacaoRes, estabRes] = await Promise.all([
        api.get<{ data: Locacao }>(`/locacoes/${locacaoId}`),
        api.get<{ data: Estabelecimento[] }>('/estabelecimentos'),
      ])
      
      if (locacaoRes.data.status !== 'Ativa') {
        toast.error('Apenas locações ativas podem ser enviadas para estoque')
        router.push('/locacoes')
        return
      }
      
      setLocacao(locacaoRes.data)
      setEstabelecimentos(estabRes.data || [])
    } catch (error) {
      toast.error('Erro ao carregar dados')
      router.push('/locacoes')
    } finally {
      setLoadingData(false)
    }
  }

  const handleEstabelecimentoSelect = (id: string) => {
    const estab = estabelecimentos.find(e => e.id === id)
    setFormData(prev => ({
      ...prev,
      estabelecimentoId: id,
      estabelecimentoNome: estab?.nome || '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.estabelecimentoId) {
      toast.error('Selecione o destino')
      return
    }
    
    if (!formData.motivo.trim()) {
      toast.error('Informe o motivo')
      return
    }

    setLoading(true)
    try {
      await api.post(`/locacoes/${locacaoId}/enviar-estoque`, {
        estabelecimentoId: formData.estabelecimentoId,
        estabelecimentoNome: formData.estabelecimentoNome,
        motivo: formData.motivo,
        observacao: formData.observacao,
      })
      
      toast.success('Produto enviado para estoque com sucesso')
      router.push('/produtos')
    } catch (error) {
      toast.error('Erro ao enviar produto para estoque')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Enviar para Estoque
          </h1>
          <p className="text-muted-foreground">Retire o produto do cliente e envie para o estoque</p>
        </div>
      </div>

      {/* Info da locação atual */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Locação a Ser Finalizada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Produto:</span>
              <p className="font-medium">
                {locacao?.produtoTipo || locacao?.produto?.tipo?.nome || 'Produto'} N° {locacao?.produtoIdentificador}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">{locacao?.clienteNome || locacao?.cliente?.nomeExibicao}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Relógio:</span>
              <p className="font-medium">{locacao?.numeroRelogio}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Esta ação irá finalizar a locação atual e o produto ficará disponível no estoque para uma nova locação.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Destino</CardTitle>
            <CardDescription>Selecione para onde o produto será enviado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {estabelecimentos.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sem estabelecimentos</AlertTitle>
                <AlertDescription>
                  Nenhum estabelecimento cadastrado. Cadastre em Configurações → Estabelecimentos.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <Label>Estabelecimento de Destino *</Label>
                <RadioGroup value={formData.estabelecimentoId} onValueChange={handleEstabelecimentoSelect} className="grid gap-3">
                  {estabelecimentos.map(estab => (
                    <div key={estab.id} className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={estab.id} id={estab.id} />
                      <Label htmlFor={estab.id} className="cursor-pointer font-medium">{estab.nome}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Motivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea 
                value={formData.motivo} 
                onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Ex: Manutenção, cliente cancelou, produto danificado..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea 
                value={formData.observacao} 
                onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                placeholder="Informações adicionais..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" variant="destructive" disabled={loading || !formData.estabelecimentoId || !formData.motivo.trim()}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : <><Package className="mr-2 h-4 w-4" />Enviar para Estoque</>}
          </Button>
        </div>
      </form>
    </div>
  )
}
