'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Settings, Box, Palette, Ruler, Building2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Item { id: string; nome: string }

export default function AtributosPage() {
  const [tipos, setTipos] = useState<Item[]>([])
  const [descricoes, setDescricoes] = useState<Item[]>([])
  const [tamanhos, setTamanhos] = useState<Item[]>([])
  const [estabelecimentos, setEstabelecimentos] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  
  const [novoTipo, setNovoTipo] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novoTamanho, setNovoTamanho] = useState('')
  const [novoEstab, setNovoEstab] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [t, d, ta, e] = await Promise.all([
        api.get<{ data: Item[] }>('/tipos-produto'),
        api.get<{ data: Item[] }>('/descricoes-produto'),
        api.get<{ data: Item[] }>('/tamanhos-produto'),
        api.get<{ data: Item[] }>('/estabelecimentos'),
      ])
      setTipos(t.data || [])
      setDescricoes(d.data || [])
      setTamanhos(ta.data || [])
      setEstabelecimentos(e.data || [])
    } catch { toast.error('Erro ao carregar dados') }
    finally { setLoading(false) }
  }

  const addItem = async (type: string, nome: string, setter: (v: string) => void, updater: (prev: Item[]) => Item[]) => {
    if (!nome.trim()) return
    setSaving(type)
    try {
      const endpoint = type === 'tipo' ? 'tipos-produto' : type === 'descricao' ? 'descricoes-produto' : type === 'tamanho' ? 'tamanhos-produto' : 'estabelecimentos'
      const res = await api.post<{ data: Item }>(`/${endpoint}`, { nome })
      updater(prev => [...prev, res.data])
      setter('')
      toast.success('Adicionado com sucesso')
    } catch { toast.error('Erro ao adicionar') }
    finally { setSaving(null) }
  }

  const deleteItem = async (type: string, id: string) => {
    const endpoint = type === 'tipo' ? 'tipos-produto' : type === 'descricao' ? 'descricoes-produto' : type === 'tamanho' ? 'tamanhos-produto' : 'estabelecimentos'
    try {
      await api.delete(`/${endpoint}/${id}`)
      toast.success('Removido com sucesso')
      loadData()
    } catch { toast.error('Erro ao remover') }
  }

  const ItemList = ({ items, type, onDelete }: { items: Item[]; type: string; onDelete: (id: string) => void }) => (
    <div className="space-y-2 mt-4 max-h-64 overflow-y-auto">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado</p>
      ) : (
        items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg">
            <span>{item.nome}</span>
            <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))
      )}
    </div>
  )

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6" />Configurações</h1>
        <p className="text-muted-foreground">Gerencie os atributos de produtos e estabelecimentos</p>
      </div>

      <Tabs defaultValue="tipos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tipos"><Box className="mr-2 h-4 w-4" />Tipos</TabsTrigger>
          <TabsTrigger value="descricoes"><Palette className="mr-2 h-4 w-4" />Descrições</TabsTrigger>
          <TabsTrigger value="tamanhos"><Ruler className="mr-2 h-4 w-4" />Tamanhos</TabsTrigger>
          <TabsTrigger value="estabelecimentos"><Building2 className="mr-2 h-4 w-4" />Estabelecimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos">
          <Card>
            <CardHeader><CardTitle className="text-lg">Tipos de Produto</CardTitle><CardDescription>Ex: Bilhar, Jukebox, Mesa de Sinuca</CardDescription></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="Novo tipo..." value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem('tipo', novoTipo, setNovoTipo, setTipos)} />
                <Button onClick={() => addItem('tipo', novoTipo, setNovoTipo, setTipos)} disabled={saving === 'tipo'}>{saving === 'tipo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
              </div>
              <ItemList items={tipos} type="tipo" onDelete={(id) => deleteItem('tipo', id)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="descricoes">
          <Card>
            <CardHeader><CardTitle className="text-lg">Descrições de Produto</CardTitle><CardDescription>Ex: Azul, Branco, Preto</CardDescription></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="Nova descrição..." value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem('descricao', novaDescricao, setNovaDescricao, setDescricoes)} />
                <Button onClick={() => addItem('descricao', novaDescricao, setNovaDescricao, setDescricoes)} disabled={saving === 'descricao'}>{saving === 'descricao' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
              </div>
              <ItemList items={descricoes} type="descricao" onDelete={(id) => deleteItem('descricao', id)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tamanhos">
          <Card>
            <CardHeader><CardTitle className="text-lg">Tamanhos de Produto</CardTitle><CardDescription>Ex: 2,00m, 2,20m, Grande, Média</CardDescription></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="Novo tamanho..." value={novoTamanho} onChange={(e) => setNovoTamanho(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem('tamanho', novoTamanho, setNovoTamanho, setTamanhos)} />
                <Button onClick={() => addItem('tamanho', novoTamanho, setNovoTamanho, setTamanhos)} disabled={saving === 'tamanho'}>{saving === 'tamanho' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
              </div>
              <ItemList items={tamanhos} type="tamanho" onDelete={(id) => deleteItem('tamanho', id)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estabelecimentos">
          <Card>
            <CardHeader><CardTitle className="text-lg">Estabelecimentos</CardTitle><CardDescription>Locais para onde produtos podem ser enviados (estoque)</CardDescription></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="Novo estabelecimento..." value={novoEstab} onChange={(e) => setNovoEstab(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem('estabelecimento', novoEstab, setNovoEstab, setEstabelecimentos)} />
                <Button onClick={() => addItem('estabelecimento', novoEstab, setNovoEstab, setEstabelecimentos)} disabled={saving === 'estabelecimento'}>{saving === 'estabelecimento' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
              </div>
              <ItemList items={estabelecimentos} type="estabelecimento" onDelete={(id) => deleteItem('estabelecimento', id)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
