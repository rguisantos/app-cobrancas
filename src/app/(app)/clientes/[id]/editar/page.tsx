'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Estado { sigla: string; nome: string }
interface Cidade { nome: string }
interface Rota { id: string; descricao: string }
interface ContatoAdicional { nome: string; telefone: string; whatsapp: boolean }

export default function EditarClientePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [loadingCep, setLoadingCep] = useState(false)
  const [estados, setEstados] = useState<Estado[]>([])
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [rotas, setRotas] = useState<Rota[]>([])
  
  const [formData, setFormData] = useState({
    tipoPessoa: 'Fisica',
    nomeCompleto: '',
    cpf: '',
    rg: '',
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    inscricaoEstadual: '',
    telefonePrincipal: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    rotaId: '',
    observacao: '',
    status: 'Ativo',
  })
  
  const [contatosAdicionais, setContatosAdicionais] = useState<ContatoAdicional[]>([])

  useEffect(() => {
    loadEstados()
    loadRotas()
    loadCliente()
  }, [id])

  const loadCliente = async () => {
    try {
      const res = await api.get<{ data: any }>(`/clientes/${id}`)
      const cliente = res.data
      
      setFormData({
        tipoPessoa: cliente.tipoPessoa || 'Fisica',
        nomeCompleto: cliente.nomeCompleto || '',
        cpf: cliente.cpf || '',
        rg: cliente.rg || '',
        razaoSocial: cliente.razaoSocial || '',
        nomeFantasia: cliente.nomeFantasia || '',
        cnpj: cliente.cnpj || '',
        inscricaoEstadual: cliente.inscricaoEstadual || '',
        telefonePrincipal: cliente.telefonePrincipal || '',
        email: cliente.email || '',
        cep: cliente.cep || '',
        logradouro: cliente.logradouro || '',
        numero: cliente.numero || '',
        complemento: cliente.complemento || '',
        bairro: cliente.bairro || '',
        cidade: cliente.cidade || '',
        estado: cliente.estado || '',
        rotaId: cliente.rotaId || '',
        observacao: cliente.observacao || '',
        status: cliente.status || 'Ativo',
      })
      
      if (cliente.contatosAdicionais) {
        try {
          const contatos = typeof cliente.contatosAdicionais === 'string' 
            ? JSON.parse(cliente.contatosAdicionais) 
            : cliente.contatosAdicionais
          setContatosAdicionais(contatos || [])
        } catch (e) {}
      }
      
      if (cliente.estado) {
        loadCidades(cliente.estado)
      }
    } catch (error) {
      toast.error('Erro ao carregar cliente')
      router.push('/clientes')
    } finally {
      setLoadingData(false)
    }
  }

  const loadEstados = async () => {
    try {
      const res = await api.get<Estado[]>('/localizacao/estados')
      setEstados(res || [])
    } catch (error) {}
  }

  const loadRotas = async () => {
    try {
      const res = await api.get<{ data: Rota[] }>('/rotas')
      setRotas(res.data || [])
    } catch (error) {}
  }

  const loadCidades = async (uf: string) => {
    if (!uf) return
    try {
      const res = await api.get<Cidade[]>(`/localizacao/cidades?uf=${uf}`)
      setCidades(res || [])
    } catch (error) {}
  }

  const handleCepLookup = async () => {
    const cep = formData.cep.replace(/\D/g, '')
    if (cep.length !== 8) {
      toast.error('CEP deve ter 8 dígitos')
      return
    }
    
    setLoadingCep(true)
    try {
      const res = await api.get(`/localizacao/cep?cep=${cep}`)
      if (res) {
        setFormData(prev => ({
          ...prev,
          logradouro: res.logradouro || prev.logradouro,
          bairro: res.bairro || prev.bairro,
          cidade: res.localidade || prev.cidade,
          estado: res.uf || prev.estado,
        }))
        if (res.uf) loadCidades(res.uf)
        toast.success('Endereço preenchido automaticamente')
      }
    } catch (error) {
      toast.error('CEP não encontrado')
    } finally {
      setLoadingCep(false)
    }
  }

  const handleEstadoChange = (uf: string) => {
    setFormData(prev => ({ ...prev, estado: uf, cidade: '' }))
    loadCidades(uf)
  }

  const addContato = () => {
    setContatosAdicionais(prev => [...prev, { nome: '', telefone: '', whatsapp: false }])
  }

  const removeContato = (index: number) => {
    setContatosAdicionais(prev => prev.filter((_, i) => i !== index))
  }

  const updateContato = (index: number, field: keyof ContatoAdicional, value: string | boolean) => {
    setContatosAdicionais(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const formatCpf = (value: string) => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').slice(0, 14)
  const formatCnpj = (value: string) => value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})/, '$1-$2').slice(0, 18)
  const formatPhone = (value: string) => value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const nomeExibicao = formData.tipoPessoa === 'Fisica' ? formData.nomeCompleto : formData.nomeFantasia || formData.razaoSocial
    if (!nomeExibicao) {
      toast.error('Nome é obrigatório')
      return
    }

    setLoading(true)
    try {
      await api.put(`/clientes/${id}`, {
        ...formData,
        nomeExibicao,
        contatosAdicionais: JSON.stringify(contatosAdicionais),
      })
      toast.success('Cliente atualizado com sucesso')
      router.push('/clientes')
    } catch (error) {
      toast.error('Erro ao atualizar cliente')
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editar Cliente</h1>
          <p className="text-muted-foreground">Atualize os dados do cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Tipo de Pessoa</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={formData.tipoPessoa} onValueChange={(value) => setFormData(prev => ({ ...prev, tipoPessoa: value }))} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Fisica" id="fisica" />
                <Label htmlFor="fisica">Pessoa Física</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Juridica" id="juridica" />
                <Label htmlFor="juridica">Pessoa Jurídica</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">{formData.tipoPessoa === 'Fisica' ? 'Dados Pessoais' : 'Dados da Empresa'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {formData.tipoPessoa === 'Fisica' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input value={formData.nomeCompleto} onChange={(e) => setFormData(prev => ({ ...prev, nomeCompleto: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={formData.cpf} onChange={(e) => setFormData(prev => ({ ...prev, cpf: formatCpf(e.target.value) }))} maxLength={14} />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={formData.rg} onChange={(e) => setFormData(prev => ({ ...prev, rg: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Razão Social *</Label>
                  <Input value={formData.razaoSocial} onChange={(e) => setFormData(prev => ({ ...prev, razaoSocial: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nome Fantasia</Label>
                  <Input value={formData.nomeFantasia} onChange={(e) => setFormData(prev => ({ ...prev, nomeFantasia: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={formData.cnpj} onChange={(e) => setFormData(prev => ({ ...prev, cnpj: formatCnpj(e.target.value) }))} maxLength={18} />
                </div>
                <div className="space-y-2">
                  <Label>Inscrição Estadual</Label>
                  <Input value={formData.inscricaoEstadual} onChange={(e) => setFormData(prev => ({ ...prev, inscricaoEstadual: e.target.value }))} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Contatos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Telefone Principal *</Label>
                <Input value={formData.telefonePrincipal} onChange={(e) => setFormData(prev => ({ ...prev, telefonePrincipal: formatPhone(e.target.value) }))} maxLength={15} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Endereço</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>CEP</Label>
                <div className="flex gap-2">
                  <Input value={formData.cep} onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, '').slice(0, 8) }))} maxLength={8} />
                  <Button type="button" variant="outline" onClick={handleCepLookup} disabled={loadingCep}>
                    {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Logradouro</Label>
                <Input value={formData.logradouro} onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2"><Label>Número</Label><Input value={formData.numero} onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Complemento</Label><Input value={formData.complemento} onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Bairro</Label><Input value={formData.bairro} onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={formData.estado} onValueChange={handleEstadoChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {estados.map(e => <SelectItem key={e.sigla} value={e.sigla}>{e.sigla} - {e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Select value={formData.cidade} onValueChange={(v) => setFormData(prev => ({ ...prev, cidade: v }))} disabled={!formData.estado}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {cidades.map(c => <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rota</Label>
                <Select value={formData.rotaId || ''} onValueChange={(v) => setFormData(prev => ({ ...prev, rotaId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {rotas.map(r => <SelectItem key={r.id} value={r.id}>{r.descricao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Outras Informações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={formData.observacao} onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar</>}</Button>
        </div>
      </form>
    </div>
  )
}
