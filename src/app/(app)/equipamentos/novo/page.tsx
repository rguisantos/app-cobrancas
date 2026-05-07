'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Smartphone, Key, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const generatePassword = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export default function NovoEquipamentoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [senha, setSenha] = useState(generatePassword())
  
  const [formData, setFormData] = useState({
    nome: '',
    chave: '',
    tipo: 'Celular',
  })

  const regenerarSenha = () => {
    setSenha(generatePassword())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    if (!formData.chave.trim()) {
      toast.error('Chave é obrigatória')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/equipamentos', {
        nome: formData.nome,
        chave: formData.chave,
        tipo: formData.tipo,
        senhaNumerica: senha,
        status: 'nao_sincronizado',
      })
      
      toast.success('Equipamento cadastrado com sucesso')
      router.push('/equipamentos')
    } catch (error) {
      toast.error('Erro ao cadastrar equipamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="h-6 w-6" />
            Novo Equipamento
          </h1>
          <p className="text-muted-foreground">Cadastre um novo dispositivo móvel</p>
        </div>
      </div>

      <Alert>
        <Key className="h-4 w-4" />
        <AlertTitle>Senha de Acesso</AlertTitle>
        <AlertDescription>
          A senha numérica será solicitada no primeiro acesso do app mobile para autorizar a sincronização.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Senha de Acesso</CardTitle>
          <CardDescription>Anote esta senha para fornecer ao usuário do dispositivo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-4">
            <span className="text-4xl font-mono font-bold tracking-widest">{senha}</span>
            <Button variant="outline" size="icon" onClick={regenerarSenha}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Esta senha foi gerada automaticamente. Clique no botão para gerar uma nova.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do Equipamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input 
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Celular João - Vendas"
              />
              <p className="text-xs text-muted-foreground">Nome para identificar o dispositivo</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chave">Chave de Identificação *</Label>
              <Input 
                id="chave"
                value={formData.chave}
                onChange={(e) => setFormData(prev => ({ ...prev, chave: e.target.value }))}
                placeholder="Ex: IMEI, Serial Number, UUID"
              />
              <p className="text-xs text-muted-foreground">Identificador único do dispositivo (IMEI, Serial, etc.)</p>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Dispositivo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Celular">Celular</SelectItem>
                  <SelectItem value="Tablet">Tablet</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar Equipamento</>}
          </Button>
        </div>
      </form>
    </div>
  )
}
