'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Plus, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Estado {
  sigla: string
  nome: string
}

interface Cidade {
  nome: string
}

interface Rota {
  id: string
  descricao: string
}

interface ContatoAdicional {
  nome: string
  telefone: string
  whatsapp: boolean
}

export default function NovoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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
  }, [])

  const loadEstados = async () => {
    try {
      const res = await api.get<Estado[]>('/localizacao/estados')
      setEstados(res || [])
    } catch (error) {
      console.error('Erro ao carregar estados:', error)
    }
  }

  const loadRotas = async () => {
    try {
      const res = await api.get<{ data: Rota[] }>('/rotas')
      setRotas(res.data || [])
    } catch (error) {
      console.error('Erro ao carregar rotas:', error)
    }
  }

  const loadCidades = async (uf: string) => {
    if (!uf) return
    try {
      const res = await api.get<Cidade[]>(`/localizacao/cidades?uf=${uf}`)
      setCidades(res || [])
    } catch (error) {
      console.error('Erro ao carregar cidades:', error)
    }
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
        if (res.uf) {
          loadCidades(res.uf)
        }
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

  const formatCpf = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14)
  }

  const formatCnpj = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2')
      .slice(0, 18)
  }

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const nomeExibicao = formData.tipoPessoa === 'Fisica' 
      ? formData.nomeCompleto 
      : formData.nomeFantasia || formData.razaoSocial

    if (!nomeExibicao) {
      toast.error('Nome é obrigatório')
      return
    }

    if (!formData.telefonePrincipal) {
      toast.error('Telefone principal é obrigatório')
      return
    }

    setLoading(true)
    try {
      await api.post('/clientes', {
        ...formData,
        nomeExibicao,
        contatosAdicionais: JSON.stringify(contatosAdicionais),
      })
      toast.success('Cliente criado com sucesso')
      router.push('/clientes')
    } catch (error) {
      toast.error('Erro ao criar cliente')
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
          <h1 className="text-2xl font-bold">Novo Cliente</h1>
          <p className="text-muted-foreground">Cadastre um novo cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Pessoa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tipo de Pessoa</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={formData.tipoPessoa}
              onValueChange={(value) => setFormData(prev => ({ ...prev, tipoPessoa: value }))}
              className="flex gap-6"
            >
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

        {/* Dados Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {formData.tipoPessoa === 'Fisica' ? 'Dados Pessoais' : 'Dados da Empresa'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.tipoPessoa === 'Fisica' ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nomeCompleto">Nome Completo *</Label>
                    <Input
                      id="nomeCompleto"
                      value={formData.nomeCompleto}
                      onChange={(e) => setFormData(prev => ({ ...prev, nomeCompleto: e.target.value }))}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData(prev => ({ ...prev, cpf: formatCpf(e.target.value) }))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rg">RG</Label>
                    <Input
                      id="rg"
                      value={formData.rg}
                      onChange={(e) => setFormData(prev => ({ ...prev, rg: e.target.value }))}
                      placeholder="RG"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="razaoSocial">Razão Social *</Label>
                    <Input
                      id="razaoSocial"
                      value={formData.razaoSocial}
                      onChange={(e) => setFormData(prev => ({ ...prev, razaoSocial: e.target.value }))}
                      placeholder="Razão social"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                    <Input
                      id="nomeFantasia"
                      value={formData.nomeFantasia}
                      onChange={(e) => setFormData(prev => ({ ...prev, nomeFantasia: e.target.value }))}
                      placeholder="Nome fantasia"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData(prev => ({ ...prev, cnpj: formatCnpj(e.target.value) }))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                    <Input
                      id="inscricaoEstadual"
                      value={formData.inscricaoEstadual}
                      onChange={(e) => setFormData(prev => ({ ...prev, inscricaoEstadual: e.target.value }))}
                      placeholder="Inscrição estadual"
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Contatos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefonePrincipal">Telefone Principal *</Label>
                <Input
                  id="telefonePrincipal"
                  value={formData.telefonePrincipal}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefonePrincipal: formatPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Contatos Adicionais</Label>
                <Button type="button" variant="outline" size="sm" onClick={addContato}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              
              {contatosAdicionais.map((contato, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-1 grid gap-4 md:grid-cols-2">
                    <Input
                      placeholder="Nome do contato"
                      value={contato.nome}
                      onChange={(e) => updateContato(index, 'nome', e.target.value)}
                    />
                    <Input
                      placeholder="Telefone"
                      value={contato.telefone}
                      onChange={(e) => updateContato(index, 'telefone', formatPhone(e.target.value))}
                      maxLength={15}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeContato(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                    placeholder="00000000"
                    maxLength={8}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCepLookup}
                    disabled={loadingCep}
                  >
                    {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={formData.logradouro}
                  onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
                  placeholder="Rua, Avenida..."
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                  placeholder="Nº"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={formData.complemento}
                  onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                  placeholder="Apto, Sala..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                  placeholder="Bairro"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select value={formData.estado} onValueChange={handleEstadoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {estados.map(estado => (
                      <SelectItem key={estado.sigla} value={estado.sigla}>
                        {estado.sigla} - {estado.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Select 
                  value={formData.cidade} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cidade: value }))}
                  disabled={!formData.estado}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {cidades.map(cidade => (
                      <SelectItem key={cidade.nome} value={cidade.nome}>
                        {cidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rotaId">Rota</Label>
                <Select 
                  value={formData.rotaId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, rotaId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {rotas.map(rota => (
                      <SelectItem key={rota.id} value={rota.id}>
                        {rota.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outras Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={formData.observacao}
                onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                placeholder="Observações sobre o cliente..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Cliente
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
