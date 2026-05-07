'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Smartphone, MoreHorizontal, Eye, Edit, Key, Wifi, WifiOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Equipamento {
  id: string
  nome: string
  chave: string
  senhaNumerica?: string
  tipo: string
  status: string
  ultimaSincronizacao?: string
  createdAt: string
}

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEquip, setSelectedEquip] = useState<Equipamento | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const res = await api.get<{ data: Equipamento[] }>('/equipamentos')
      setEquipamentos(res.data || [])
    } catch (error) {
      toast.error('Erro ao carregar equipamentos')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-100 text-green-800'
      case 'inativo': return 'bg-gray-100 text-gray-800'
      case 'nao_sincronizado': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('pt-BR')
  }

  const getTimeSince = (date: string) => {
    if (!date) return null
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return 'agora há pouco'
    if (hours < 24) return `há ${hours}h`
    const days = Math.floor(hours / 24)
    return `há ${days}d`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipamentos</h1>
          <p className="text-muted-foreground">Dispositivos móveis conectados</p>
        </div>
        <Link href="/equipamentos/novo">
          <Button><Plus className="mr-2 h-4 w-4" />Novo Equipamento</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : equipamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Smartphone className="h-12 w-12 mb-4" />
              <p>Nenhum equipamento cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Senha</TableHead>
                  <TableHead>Última Sync</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipamentos.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-medium">{eq.nome}</TableCell>
                    <TableCell className="font-mono text-sm">{eq.chave}</TableCell>
                    <TableCell>{eq.tipo}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="font-mono" onClick={() => { setSelectedEquip(eq); setShowPassword(true); }}>
                        <Key className="mr-2 h-3 w-3" />{eq.senhaNumerica || '******'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {eq.status === 'ativo' ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-gray-400" />}
                        <span>{getTimeSince(eq.ultimaSincronizacao || eq.createdAt) || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={getStatusColor(eq.status)}>{eq.status === 'nao_sincronizado' ? 'Não Sincronizado' : eq.status}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/equipamentos/${eq.id}/editar`}><Edit className="mr-2 h-4 w-4" />Editar</Link></DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para mostrar senha */}
      <Dialog open={showPassword} onOpenChange={setShowPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha do Equipamento</DialogTitle>
            <DialogDescription>Use esta senha para autorizar o primeiro acesso no app mobile</DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-2">Senha de 6 dígitos:</p>
            <p className="text-4xl font-mono font-bold tracking-widest">{selectedEquip?.senhaNumerica}</p>
          </div>
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <strong>Como usar:</strong> No primeiro acesso do app mobile, será solicitada esta senha numérica para autorizar a sincronização com o servidor.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
