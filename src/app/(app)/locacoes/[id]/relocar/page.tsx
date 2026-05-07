'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Loader2, ArrowRightLeft, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  percentualEmpresa: number
}

interface Cliente { id: string; nomeExibicao: string }

export default function RelocarLocacaoPage() {
  const router = useRouter()
  const params = useParams()
  const locacaoId = params.id as string
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [locacao, setLocacao] = useState<Locacao | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [searchCliente, setSearchCliente] = useState('')
  
  const [formData, setFormData] = useState({
    novoClienteId: '',
    novoNumeroRelogio: '',
    observacao: '',
  })

  useEffect(() => {
    loadData()
  }, [locacaoId])

  const loadData = async () => {
    try {
      const [locacaoRes, clientesRes] = await Promise.all([
        api.get<{ data: Locacao }>(`/locacoes/${locacaoId}`),
        api.get<{ data: Cliente[] }>('/clientes?status=Ativo'),
      ])
      
      if (locacaoRes.data.status !== 'Ativa') {
        toast.error('Apenas locações ativas podem ser relocadas')
        router.push('/locacoes')
        return
      }
      
      setLocacao(locacaoRes.data)
      setFormData(prev => ({
        ...prev,
        novoNumeroRelogio: locacaoRes.data.numeroRelogio || '',
      }))
      setClientes(clientesRes.data || [])
    } catch (error) {
      toast.error('Erro ao carregar locação')
      router.push('/locacoes')
    } finally {
      setLoadingData(false)
    }
  }

  const filteredClientes = clientes.filter(c => 
    c.id !== locacao?.clienteId &&
    c.nomeExibicao.toLowerCase().includes(searchCliente.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.novoClienteId) {
      toast.error('Selecione o novo cliente')
      return
    }
    
    if (!formData.novoNumeroRelogio) {
      toast.error('Número do relógio é obrigatório')
      return
    }

    setLoading(true)
    try {
      await api.post(`/locacoes/${locacaoId}/relocar`, {
        novoClienteId: formData.novoClienteId,
        novoNumeroRelogio: formData.novoNumeroRelogio,
        observacao: formData.observacao || 'Relocação realizada via web',
      })
      
      toast.success('Produto relocado com sucesso')
      router.push('/locacoes')
    } catch (error) {
      toast.error('Erro ao relocar produto')
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
            <ArrowRightLeft className="h-6 w-6" />
            Relocar Produto
          </h1>
          <p className="text-muted-foreground">Transfira o produto para outro cliente</p>
        </div>
      </div>

      {/* Info da locação atual */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Locação Atual</CardTitle>
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
              <span className="text-muted-foreground">Cliente Atual:</span>
              <p className="font-medium">{locacao?.clienteNome || locacao?.cliente?.nomeExibicao}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Relógio:</span>
              <p className="font-medium">{locacao?.numeroRelogio}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Forma Pgto:</span>
              <p className="font-medium">{locacao?.formaPagamento}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Esta ação irá finalizar a locação atual e criar uma nova locação para o produto com o novo cliente.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Novo Cliente</CardTitle>
            <CardDescription>Selecione o cliente para quem o produto será relocado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Novo Cliente *</Label>
              <Select value={formData.novoClienteId} onValueChange={(v) => setFormData(prev => ({ ...prev, novoClienteId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o novo cliente" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input placeholder="Buscar cliente..." value={searchCliente} onChange={(e) => setSearchCliente(e.target.value)} />
                  </div>
                  {filteredClientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nomeExibicao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Número do Relógio *</Label>
              <Input 
                value={formData.novoNumeroRelogio} 
                onChange={(e) => setFormData(prev => ({ ...prev, novoNumeroRelogio: e.target.value }))}
                placeholder="Novo número do relógio"
              />
              <p className="text-xs text-muted-foreground">
                Informe o número atual do relógio para a nova locação
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Observação / Motivo</Label>
              <Textarea 
                value={formData.observacao} 
                onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                placeholder="Motivo da relocação..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Relocando...</> : <><Save className="mr-2 h-4 w-4" />Confirmar Relocação</>}
          </Button>
        </div>
      </form>
    </div>
  )
}
