'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Package,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface TipoProduto {
  id: string
  nome: string
}

interface DescricaoProduto {
  id: string
  nome: string
}

interface TamanhoProduto {
  id: string
  nome: string
}

interface Estabelecimento {
  id: string
  nome: string
}

export default function NovoProdutoPage() {
  const router = useRouter()

  // Form state
  const [identificador, setIdentificador] = useState('')
  const [numeroRelogio, setNumeroRelogio] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [descricaoId, setDescricaoId] = useState('')
  const [tamanhoId, setTamanhoId] = useState('')
  const [conservacao, setConservacao] = useState('Boa')
  const [statusProduto, setStatusProduto] = useState('Ativo')
  const [codigoCH, setCodigoCH] = useState('')
  const [codigoABLF, setCodigoABLF] = useState('')
  const [estabelecimento, setEstabelecimento] = useState('')
  const [observacao, setObservacao] = useState('')

  // Dropdown data
  const [tipos, setTipos] = useState<TipoProduto[]>([])
  const [descricoes, setDescricoes] = useState<DescricaoProduto[]>([])
  const [tamanhos, setTamanhos] = useState<TamanhoProduto[]>([])
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([])

  // UI state
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const [tiposRes, descricoesRes, tamanhosRes, estabelecimentosRes] = await Promise.all([
        api.get<{ data: TipoProduto[] }>('/tipos-produto'),
        api.get<{ data: DescricaoProduto[] }>('/descricoes-produto'),
        api.get<{ data: TamanhoProduto[] }>('/tamanhos-produto'),
        api.get<{ data: Estabelecimento[] }>('/estabelecimentos')
      ])

      setTipos(tiposRes.data || [])
      setDescricoes(descricoesRes.data || [])
      setTamanhos(tamanhosRes.data || [])
      setEstabelecimentos(estabelecimentosRes.data || [])
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!identificador.trim()) {
      toast.error('Identificador é obrigatório')
      return
    }

    setLoading(true)
    try {
      const data = {
        identificador,
        numeroRelogio: numeroRelogio || null,
        tipoId: tipoId || null,
        descricaoId: descricaoId || null,
        tamanhoId: tamanhoId || null,
        conservacao,
        statusProduto,
        codigoCH: codigoCH || null,
        codigoABLF: codigoABLF || null,
        estabelecimento: estabelecimento || null,
        observacao: observacao || null,
      }

      await api.post('/produtos', data)
      toast.success('Produto cadastrado com sucesso')
      router.push('/produtos')
    } catch (error) {
      console.error('Error saving produto:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/produtos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Novo Produto</h1>
          <p className="text-muted-foreground">
            Cadastre um novo produto no sistema
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Identificação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="identificador">Identificador *</Label>
                <Input
                  id="identificador"
                  placeholder="Ex: 515"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Número da placa física do produto
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numeroRelogio">Número do Relógio</Label>
                <Input
                  id="numeroRelogio"
                  placeholder="Ex: 8070"
                  value={numeroRelogio}
                  onChange={(e) => setNumeroRelogio(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Contador mecânico
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={tipoId} onValueChange={setTipoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((tipo) => (
                      <SelectItem key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Select value={descricaoId} onValueChange={setDescricaoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a descrição" />
                  </SelectTrigger>
                  <SelectContent>
                    {descricoes.map((desc) => (
                      <SelectItem key={desc.id} value={desc.id}>
                        {desc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tamanho">Tamanho</Label>
                <Select value={tamanhoId} onValueChange={setTamanhoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tamanho" />
                  </SelectTrigger>
                  <SelectContent>
                    {tamanhos.map((tamanho) => (
                      <SelectItem key={tamanho.id} value={tamanho.id}>
                        {tamanho.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conservacao">Conservação</Label>
                <Select value={conservacao} onValueChange={setConservacao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ótima">Ótima</SelectItem>
                    <SelectItem value="Boa">Boa</SelectItem>
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="Ruim">Ruim</SelectItem>
                    <SelectItem value="Péssima">Péssima</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Códigos Internos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Códigos Internos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="codigoCH">Código CH</Label>
                <Input
                  id="codigoCH"
                  placeholder="Código CH"
                  value={codigoCH}
                  onChange={(e) => setCodigoCH(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigoABLF">Código ABLF</Label>
                <Input
                  id="codigoABLF"
                  placeholder="Código ABLF"
                  value={codigoABLF}
                  onChange={(e) => setCodigoABLF(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Localização e Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Localização e Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estabelecimento">Estabelecimento</Label>
                <Select value={estabelecimento} onValueChange={setEstabelecimento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estabelecimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {estabelecimentos.map((est) => (
                      <SelectItem key={est.id} value={est.nome}>
                        {est.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusProduto} onValueChange={setStatusProduto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Manutenção">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                placeholder="Observações sobre o produto..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href="/produtos">
            <Button variant="outline" type="button">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Produto
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
