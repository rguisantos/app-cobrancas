'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Plus, Phone, Mail, MapPin, Route, FileText, Receipt, MoreHorizontal, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Cliente {
  id: string
  tipoPessoa: string
  nomeExibicao: string
  nomeCompleto?: string
  cpf?: string
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  telefonePrincipal: string
  email?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  rotaId?: string
  rota?: { id: string; descricao: string }
  status: string
  observacao?: string
  contatosAdicionais?: string
}

interface Locacao {
  id: string
  produtoId: string
  produtoIdentificador: string
  produtoTipo: string
  dataLocacao: string
  status: string
  formaPagamento: string
}

interface Cobranca {
  id: string
  dataInicio: string
  dataFim: string
  valorRecebido: number
  status: string
}

export default function ClienteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [locacoes, setLocacoes] = useState<Locacao[]>([])
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [clienteRes, locacoesRes, cobrancasRes] = await Promise.all([
        api.get<{ data: Cliente }>(`/clientes/${id}`),
        api.get<{ data: Locacao[] }>(`/locacoes?clienteId=${id}`),
        api.get<{ data: Cobranca[] }>(`/cobrancas?clienteId=${id}`),
      ])
      
      setCliente(clienteRes.data)
      setLocacoes(locacoesRes.data || [])
      setCobrancas(cobrancasRes.data || [])
    } catch (error) {
      toast.error('Erro ao carregar cliente')
      router.push('/clientes')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    
    try {
      await api.delete(`/clientes/${id}`)
      toast.success('Cliente excluído com sucesso')
      router.push('/clientes')
    } catch (error) {
      toast.error('Erro ao excluir cliente')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativo':
      case 'Ativa':
      case 'Pago': return 'bg-green-100 text-green-800'
      case 'Inativo': return 'bg-gray-100 text-gray-800'
      case 'Finalizada': return 'bg-blue-100 text-blue-800'
      case 'Pendente': return 'bg-yellow-100 text-yellow-800'
      case 'Parcial': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const parseContatos = (contatosStr?: string) => {
    if (!contatosStr) return []
    try {
      return typeof contatosStr === 'string' ? JSON.parse(contatosStr) : contatosStr
    } catch {
      return []
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!cliente) {
    return null
  }

  const contatosAdicionais = parseContatos(cliente.contatosAdicionais)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{cliente.nomeExibicao}</h1>
            <p className="text-muted-foreground">
              {cliente.tipoPessoa === 'Fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/clientes/${id}/editar`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
          <Link href={`/locacoes/nova?clienteId=${id}`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Locação
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cliente.tipoPessoa === 'Fisica' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome Completo</span>
                  <span className="font-medium">{cliente.nomeCompleto || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPF</span>
                  <span className="font-medium">{cliente.cpf || '-'}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Razão Social</span>
                  <span className="font-medium">{cliente.razaoSocial || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome Fantasia</span>
                  <span className="font-medium">{cliente.nomeFantasia || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ</span>
                  <span className="font-medium">{cliente.cnpj || '-'}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge className={getStatusColor(cliente.status)}>{cliente.status}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Contatos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{cliente.telefonePrincipal || '-'}</span>
            </div>
            {cliente.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{cliente.email}</span>
              </div>
            )}
            
            {contatosAdicionais.length > 0 && (
              <>
                <Separator />
                <p className="text-sm font-medium text-muted-foreground">Contatos Adicionais</p>
                {contatosAdicionais.map((contato: any, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{contato.nome} - {contato.telefone}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                {cliente.logradouro && (
                  <p>{cliente.logradouro}{cliente.numero ? `, ${cliente.numero}` : ''}</p>
                )}
                {cliente.complemento && <p>{cliente.complemento}</p>}
                {cliente.bairro && <p>{cliente.bairro}</p>}
                {(cliente.cidade || cliente.estado) && (
                  <p>{cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</p>
                )}
                {cliente.cep && <p className="text-muted-foreground">CEP: {cliente.cep}</p>}
              </div>
            </div>
            {cliente.rota && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-muted-foreground" />
                  <span>Rota: {cliente.rota.descricao}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Observação */}
        {cliente.observacao && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Observação</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{cliente.observacao}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Locações e Cobranças */}
      <Tabs defaultValue="locacoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="locacoes">Locações ({locacoes.length})</TabsTrigger>
          <TabsTrigger value="cobrancas">Cobranças ({cobrancas.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="locacoes">
          <Card>
            <CardContent className="p-0">
              {locacoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4" />
                  <p>Nenhuma locação encontrada</p>
                  <Link href={`/locacoes/nova?clienteId=${id}`}>
                    <Button variant="outline" className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Locação
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Data Locação</TableHead>
                      <TableHead>Forma Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locacoes.map((locacao) => (
                      <TableRow key={locacao.id}>
                        <TableCell className="font-medium">
                          {locacao.produtoTipo} N° {locacao.produtoIdentificador}
                        </TableCell>
                        <TableCell>{formatDate(locacao.dataLocacao)}</TableCell>
                        <TableCell>{locacao.formaPagamento}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(locacao.status)}>
                            {locacao.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/locacoes/${locacao.id}`}>
                            <Button variant="ghost" size="sm">Ver</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="cobrancas">
          <Card>
            <CardContent className="p-0">
              {cobrancas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mb-4" />
                  <p>Nenhuma cobrança encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Valor Recebido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cobrancas.map((cobranca) => (
                      <TableRow key={cobranca.id}>
                        <TableCell>
                          {formatDate(cobranca.dataInicio)} - {formatDate(cobranca.dataFim)}
                        </TableCell>
                        <TableCell>{formatCurrency(cobranca.valorRecebido)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(cobranca.status)}>
                            {cobranca.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/cobrancas/${cobranca.id}`}>
                            <Button variant="ghost" size="sm">Ver</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
