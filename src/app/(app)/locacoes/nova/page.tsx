'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Cliente { id: string; nomeExibicao: string }
interface Produto { id: string; identificador: string; tipo?: { nome: string }; numeroRelogio?: string; statusProduto: string }

export default function NovaLocacaoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [searchCliente, setSearchCliente] = useState('')
  const [searchProduto, setSearchProduto] = useState('')
  
  const [formData, setFormData] = useState({
    clienteId: '',
    produtoId: '',
    dataLocacao: new Date().toISOString().split('T')[0],
    formaPagamento: 'PercentualReceber',
    numeroRelogio: '',
    precoFicha: '',
    percentualEmpresa: '50',
    periodicidade: '',
    valorFixo: '',
    dataPrimeiraCobranca: '',
    trocaPano: false,
    observacao: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [clientesRes, produtosRes] = await Promise.all([
        api.get<{ data: Cliente[] }>('/clientes?status=Ativo'),
        api.get<{ data: Produto[] }>('/produtos?statusProduto=Ativo'),
      ])
      setClientes(clientesRes.data || [])
      // Filtrar apenas produtos sem locação ativa
      setProdutos(produtosRes.data || [])
    } catch (error) {
      toast.error('Erro ao carregar dados')
    }
  }

  const filteredClientes = clientes.filter(c => 
    c.nomeExibicao.toLowerCase().includes(searchCliente.toLowerCase())
  )

  const filteredProdutos = produtos.filter(p => 
    p.identificador.toLowerCase().includes(searchProduto.toLowerCase())
  )

  const handleProdutoSelect = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId)
    setFormData(prev => ({
      ...prev,
      produtoId,
      numeroRelogio: produto?.numeroRelogio || '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clienteId) {
      toast.error('Selecione um cliente')
      return
    }
    if (!formData.produtoId) {
      toast.error('Selecione um produto')
      return
    }
    if (!formData.numeroRelogio) {
      toast.error('Número do relógio é obrigatório')
      return
    }

    const percentualEmpresa = parseFloat(formData.percentualEmpresa) || 50
    
    setLoading(true)
    try {
      const cliente = clientes.find(c => c.id === formData.clienteId)
      const produto = produtos.find(p => p.id === formData.produtoId)
      
      await api.post('/locacoes', {
        clienteId: formData.clienteId,
        clienteNome: cliente?.nomeExibicao,
        produtoId: formData.produtoId,
        produtoIdentificador: produto?.identificador,
        produtoTipo: produto?.tipo?.nome,
        dataLocacao: new Date(formData.dataLocacao).toISOString(),
        formaPagamento: formData.formaPagamento,
        numeroRelogio: formData.numeroRelogio,
        precoFicha: parseFloat(formData.precoFicha) || 0,
        percentualEmpresa,
        percentualCliente: 100 - percentualEmpresa,
        periodicidade: formData.periodicidade || null,
        valorFixo: formData.valorFixo ? parseFloat(formData.valorFixo) : null,
        dataPrimeiraCobranca: formData.dataPrimeiraCobranca ? new Date(formData.dataPrimeiraCobranca).toISOString() : null,
        trocaPano: formData.trocaPano,
        dataUltimaManutencao: formData.trocaPano ? new Date().toISOString() : null,
        observacao: formData.observacao || null,
        status: 'Ativa',
      })
      
      toast.success('Locação criada com sucesso')
      router.push('/locacoes')
    } catch (error) {
      toast.error('Erro ao criar locação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Locação</h1>
          <p className="text-muted-foreground">Cadastre uma nova locação</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Cliente e Produto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={formData.clienteId} onValueChange={(v) => setFormData(prev => ({ ...prev, clienteId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
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
              <Label>Produto *</Label>
              <Select value={formData.produtoId} onValueChange={handleProdutoSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input placeholder="Buscar produto..." value={searchProduto} onChange={(e) => setSearchProduto(e.target.value)} />
                  </div>
                  {filteredProdutos.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.tipo?.nome || 'Produto'} N° {p.identificador}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Data da Locação</Label>
                <Input type="date" value={formData.dataLocacao} onChange={(e) => setFormData(prev => ({ ...prev, dataLocacao: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Forma de Pagamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Pagamento</Label>
              <Select value={formData.formaPagamento} onValueChange={(v) => setFormData(prev => ({ ...prev, formaPagamento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PercentualReceber">% Receber</SelectItem>
                  <SelectItem value="PercentualPagar">% Pagar</SelectItem>
                  <SelectItem value="Periodo">Por Período</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Número do Relógio *</Label>
                <Input value={formData.numeroRelogio} onChange={(e) => setFormData(prev => ({ ...prev, numeroRelogio: e.target.value }))} placeholder="00000" />
              </div>
            </div>
            
            {formData.formaPagamento !== 'Periodo' ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Preço da Ficha (R$)</Label>
                    <Input type="number" step="0.01" value={formData.precoFicha} onChange={(e) => setFormData(prev => ({ ...prev, precoFicha: e.target.value }))} placeholder="3.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>% Empresa</Label>
                    <Input type="number" value={formData.percentualEmpresa} onChange={(e) => setFormData(prev => ({ ...prev, percentualEmpresa: e.target.value }))} placeholder="50" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span className="text-sm">% Cliente (automático)</span>
                  <span className="font-bold">{100 - (parseFloat(formData.percentualEmpresa) || 0)}%</span>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select value={formData.periodicidade} onValueChange={(v) => setFormData(prev => ({ ...prev, periodicidade: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="Diária">Diária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Valor Fixo (R$)</Label>
                    <Input type="number" step="0.01" value={formData.valorFixo} onChange={(e) => setFormData(prev => ({ ...prev, valorFixo: e.target.value }))} placeholder="150.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Primeira Cobrança</Label>
                    <Input type="date" value={formData.dataPrimeiraCobranca} onChange={(e) => setFormData(prev => ({ ...prev, dataPrimeiraCobranca: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Manutenção</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox id="trocaPano" checked={formData.trocaPano} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, trocaPano: !!checked }))} />
              <Label htmlFor="trocaPano">Troca de pano realizada</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Observação</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={formData.observacao} onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))} placeholder="Observações..." rows={3} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar Locação</>}
          </Button>
        </div>
      </form>
    </div>
  )
}
