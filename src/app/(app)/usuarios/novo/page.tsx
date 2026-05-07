'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, UserCog, Shield, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Rota { id: string; descricao: string }

export default function NovoUsuarioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rotas, setRotas] = useState<Rota[]>([])
  const [showPassword, setShowPassword] = useState(false)
  
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    senha: '',
    tipoPermissao: 'Secretario',
    permissoesWebTodosCadastros: false,
    permissoesWebLocacaoRelocacao: false,
    permissoesWebRelatorios: false,
    permissoesMobileTodosCadastros: false,
    permissoesMobileAlteracaoRelogio: false,
    permissoesMobileLocacaoRelocacao: false,
    permissoesMobileCobrancasFaturas: false,
    rotasPermitidas: [] as string[],
    status: 'Ativo',
  })

  useEffect(() => { loadRotas() }, [])

  const loadRotas = async () => {
    try {
      const res = await api.get<{ data: Rota[] }>('/rotas')
      setRotas(res.data || [])
    } catch {}
  }

  const formatCpf = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').slice(0, 14)
  const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15)

  const toggleRota = (rotaId: string) => {
    setFormData(prev => ({
      ...prev,
      rotasPermitidas: prev.rotasPermitidas.includes(rotaId)
        ? prev.rotasPermitidas.filter(r => r !== rotaId)
        : [...prev.rotasPermitidas, rotaId]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nome || !formData.email || !formData.senha) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)
    try {
      await api.post('/usuarios', {
        ...formData,
        rotasPermitidas: JSON.stringify(formData.rotasPermitidas),
      })
      toast.success('Usuário criado com sucesso')
      router.push('/usuarios')
    } catch { toast.error('Erro ao criar usuário') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog className="h-6 w-6" />Novo Usuário</h1>
          <p className="text-muted-foreground">Cadastre um novo usuário no sistema</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Nome *</Label><Input value={formData.nome} onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))} /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={formData.cpf} onChange={(e) => setFormData(p => ({ ...p, cpf: formatCpf(e.target.value) }))} maxLength={14} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Telefone</Label><Input value={formData.telefone} onChange={(e) => setFormData(p => ({ ...p, telefone: formatPhone(e.target.value) }))} maxLength={15} /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Senha *</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} value={formData.senha} onChange={(e) => setFormData(p => ({ ...p, senha: e.target.value }))} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" />Permissões</CardTitle>
            <CardDescription>Defina o nível de acesso do usuário</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Permissão</Label>
              <Select value={formData.tipoPermissao} onValueChange={(v) => setFormData(p => ({ ...p, tipoPermissao: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador"><Badge className="bg-purple-100 text-purple-800 mr-2">Admin</Badge>Acesso total ao sistema</SelectItem>
                  <SelectItem value="Secretario"><Badge className="bg-blue-100 text-blue-800 mr-2">Secretário</Badge>Acesso de secretaria</SelectItem>
                  <SelectItem value="AcessoControlado"><Badge className="bg-yellow-100 text-yellow-800 mr-2">Controlado</Badge>Acesso restrito por rotas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.tipoPermissao === 'AcessoControlado' && rotas.length > 0 && (
              <div className="space-y-2">
                <Label>Rotas Permitidas</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-lg max-h-48 overflow-y-auto">
                  {rotas.map(r => (
                    <div key={r.id} className="flex items-center space-x-2">
                      <Checkbox id={r.id} checked={formData.rotasPermitidas.includes(r.id)} onCheckedChange={() => toggleRota(r.id)} />
                      <Label htmlFor={r.id} className="text-sm cursor-pointer">{r.descricao}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-medium">Permissões Web</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2"><Checkbox id="pw1" checked={formData.permissoesWebTodosCadastros} onCheckedChange={(c) => setFormData(p => ({ ...p, permissoesWebTodosCadastros: !!c }))} /><Label htmlFor="pw1" className="text-sm">Todos Cadastros</Label></div>
                  <div className="flex items-center space-x-2"><Checkbox id="pw2" checked={formData.permissoesWebLocacaoRelocacao} onCheckedChange={(c) => setFormData(p => ({ ...p, permissoesWebLocacaoRelocacao: !!c }))} /><Label htmlFor="pw2" className="text-sm">Locação/Relocação/Estoque</Label></div>
                  <div className="flex items-center space-x-2"><Checkbox id="pw3" checked={formData.permissoesWebRelatorios} onCheckedChange={(c) => setFormData(p => ({ ...p, permissoesWebRelatorios: !!c }))} /><Label htmlFor="pw3" className="text-sm">Relatórios</Label></div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Permissões Mobile</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2"><Checkbox id="pm1" checked={formData.permissoesMobileTodosCadastros} onCheckedChange={(c) => setFormData(p => ({ ...p, permissoesMobileTodosCadastros: !!c }))} /><Label htmlFor="pm1" className="text-sm">Todos Cadastros</Label></div>
                  <div className="flex items-center space-x-2"><Checkbox id="pm2" checked={formData.permissoesMobileAlteracaoRelogio} onCheckedChange={(c) => setFormData(p => ({ ...p, permissoesMobileAlteracaoRelogio: !!c }))} /><Label htmlFor="pm2" className="text-sm">Alteração de Relógio</Label></div>
                  <div className="flex items-center space-x-2"><Checkbox id="pm3" checked={formData.permissoesMobileLocacaoRelocacao} onCheckedChange={(c) => setFormData(p => ({ ...p, permissoesMobileLocacaoRelocacao: !!c }))} /><Label htmlFor="pm3" className="text-sm">Locação/Relocação/Estoque</Label></div>
                  <div className="flex items-center space-x-2"><Checkbox id="pm4" checked={formData.permissoesMobileCobrancasFaturas} onCheckedChange={(c) => setFormData(p => ({ ...p, permissoesMobileCobrancasFaturas: !!c }))} /><Label htmlFor="pm4" className="text-sm">Cobranças/Faturas</Label></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar</>}</Button>
        </div>
      </form>
    </div>
  )
}
