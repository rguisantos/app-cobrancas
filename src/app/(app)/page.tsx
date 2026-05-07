'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  Users, 
  Package, 
  PackageCheck, 
  DollarSign,
  Plus,
  FileText,
  Receipt,
  TrendingUp,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'

interface DashboardStats {
  totalClientes: number
  produtosLocados: number
  produtosEmEstoque: number
  receitaMes: number
}

interface RecentActivity {
  id: string
  tipo: 'cliente' | 'locacao' | 'cobranca'
  descricao: string
  data: string
  status?: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [clientesRes, produtosRes, locacoesRes, cobrancasRes] = await Promise.all([
        api.get<{ data: unknown[]; pagination: { total: number } }>('/clientes?limit=1'),
        api.get<{ data: unknown[]; pagination: { total: number } }>('/produtos?limit=1'),
        api.get<{ data: unknown[]; pagination: { total: number } }>('/locacoes?status=Ativa&limit=1'),
        api.get<{ data: unknown[] }>('/cobrancas?limit=5'),
      ])

      // Calculate stats
      const produtosLocados = locacoesRes.pagination?.total || 0
      const produtosEmEstoque = (produtosRes.pagination?.total || 0) - produtosLocados
      
      setStats({
        totalClientes: clientesRes.pagination?.total || 0,
        produtosLocados,
        produtosEmEstoque: Math.max(0, produtosEmEstoque),
        receitaMes: 0, // Will be calculated from cobrancas
      })

      // Generate mock recent activities based on data
      setRecentActivities([
        { id: '1', tipo: 'cliente', descricao: 'Novo cliente cadastrado', data: new Date().toISOString() },
        { id: '2', tipo: 'locacao', descricao: 'Locação realizada', data: new Date().toISOString(), status: 'Ativa' },
        { id: '3', tipo: 'cobranca', descricao: 'Cobrança registrada', data: new Date().toISOString(), status: 'Pendente' },
      ])
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const receitaData = [
    { mes: 'Jan', valor: 4500 },
    { mes: 'Fev', valor: 5200 },
    { mes: 'Mar', valor: 4800 },
    { mes: 'Abr', valor: 6100 },
    { mes: 'Mai', valor: 5800 },
    { mes: 'Jun', valor: 7200 },
  ]

  const produtosData = [
    { nome: 'Máquinas', quantidade: 45 },
    { nome: 'Equipamentos', quantidade: 32 },
    { nome: 'Acessórios', quantidade: 28 },
  ]

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description,
    color 
  }: { 
    title: string
    value: number | string
    icon: React.ElementType
    description?: string
    color: string
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )

  const QuickActionButton = ({ 
    href, 
    icon: Icon, 
    label 
  }: { 
    href: string
    icon: React.ElementType
    label: string 
  }) => (
    <Link href={href}>
      <Button variant="outline" className="w-full justify-start gap-2">
        <Icon className="h-4 w-4" />
        {label}
        <ArrowRight className="h-4 w-4 ml-auto" />
      </Button>
    </Link>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema de gestão de locação
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de Clientes"
          value={stats?.totalClientes || 0}
          icon={Users}
          description="Clientes cadastrados"
          color="bg-blue-500"
        />
        <StatCard
          title="Produtos Locados"
          value={stats?.produtosLocados || 0}
          icon={Package}
          description="Em locação ativa"
          color="bg-green-500"
        />
        <StatCard
          title="Produtos em Estoque"
          value={stats?.produtosEmEstoque || 0}
          icon={PackageCheck}
          description="Disponíveis para locação"
          color="bg-amber-500"
        />
        <StatCard
          title="Receita do Mês"
          value={`R$ ${(stats?.receitaMes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          description="Total recebido"
          color="bg-purple-500"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações Rápidas</CardTitle>
          <CardDescription>Acesso rápido às principais funcionalidades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <QuickActionButton
              href="/clientes/novo"
              icon={Plus}
              label="Novo Cliente"
            />
            <QuickActionButton
              href="/locacoes/nova"
              icon={FileText}
              label="Nova Locação"
            />
            <QuickActionButton
              href="/cobrancas"
              icon={Receipt}
              label="Nova Cobrança"
            />
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Receita por Período
            </CardTitle>
            <CardDescription>Evolução da receita nos últimos meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={receitaData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita']}
                    contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Products Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos por Tipo
            </CardTitle>
            <CardDescription>Distribuição dos produtos cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={produtosData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="nome" className="text-xs" width={80} />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Quantidade']}
                    contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Atividade Recente</CardTitle>
          <CardDescription>Últimas ações realizadas no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentActivities.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              Nenhuma atividade recente
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${
                      activity.tipo === 'cliente' ? 'bg-blue-100 text-blue-600' :
                      activity.tipo === 'locacao' ? 'bg-green-100 text-green-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {activity.tipo === 'cliente' && <Users className="h-4 w-4" />}
                      {activity.tipo === 'locacao' && <FileText className="h-4 w-4" />}
                      {activity.tipo === 'cobranca' && <Receipt className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.data).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {activity.status && (
                    <Badge variant={activity.status === 'Ativa' ? 'default' : 'secondary'}>
                      {activity.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
