import { useEffect, useState } from 'react';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Cabang, Peserta, Transaksi, Pengaturan } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { 
  Users, 
  Building2, 
  TrendingUp, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  const [stats, setStats] = useState({
    totalCabang: 0,
    totalPeserta: 0,
    totalPemasukan: 0,
    pemasukanBulanIni: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaksi[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Pengaturan
        const settingsSnap = await getDocs(collection(db, 'pengaturan'));
        if (!settingsSnap.empty) {
          setPengaturan(settingsSnap.docs[0].data() as Pengaturan);
        }

        // 1. Fetch Stats
        let cabangSnap;
        let pesertaSnap;
        
        if (user.role === 'admin' || user.role === 'bendahara') {
          cabangSnap = await getDocs(collection(db, 'cabang'));
          pesertaSnap = await getDocs(collection(db, 'peserta'));
        } else {
          cabangSnap = { size: 0, docs: [] };
          if (user.status === 'aktif') {
            pesertaSnap = await getDocs(query(collection(db, 'peserta'), where('cabangId', '==', user.cabangId)));
          } else {
            pesertaSnap = { size: 0, docs: [] };
          }
        }
        
        const totalCabang = user.role === 'cabang' ? 0 : (cabangSnap as any).size;
        const totalPeserta = (pesertaSnap as any).size;

        let totalPemasukan = 0;
        let pemasukanBulanIni = 0;
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let txQuery = query(collection(db, 'transaksi'), orderBy('createdAt', 'desc'));
        if (user.role === 'cabang') {
          if (user.status === 'aktif') {
            txQuery = query(collection(db, 'transaksi'), where('cabangId', '==', user.cabangId), orderBy('createdAt', 'desc'));
          } else {
            txQuery = query(collection(db, 'transaksi'), where('cabangId', '==', user.cabangId), where('tipe', '==', 'pendaftaran_cabang'), orderBy('createdAt', 'desc'));
          }
        }
        const txSnap = await getDocs(txQuery);

        const transactions: Transaksi[] = [];
        const monthlyData: { [key: string]: number } = {};

        txSnap.docs.forEach(doc => {
          const data = doc.data() as Transaksi;
          if (data.status === 'paid' || data.status === 'lunas') {
            transactions.push({ ...data, id: doc.id });
            
            const amount = user.role === 'admin' || user.role === 'bendahara' ? (data.porsiPusat || 0) : (user.role === 'cabang' ? (data.porsiCabang || 0) : (data.nominal || 0));
            totalPemasukan += amount;

            const txDate = new Date(data.createdAt);
            if (txDate >= firstDayOfMonth) {
              pemasukanBulanIni += amount;
            }

            const monthKey = txDate.toLocaleString('default', { month: 'short' });
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
          }
        });

        setStats({
          totalCabang,
          totalPeserta,
          totalPemasukan,
          pemasukanBulanIni,
        });

        setRecentTransactions(transactions.slice(0, 5));

        // Format chart data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedChartData = months.map(m => ({
          name: m,
          value: monthlyData[m] || 0
        }));
        setChartData(formattedChartData);

      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'dashboard_collections');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white rounded-3xl border border-gray-100 shadow-sm" />
          ))}
        </div>
        <div className="h-96 bg-white rounded-3xl border border-gray-100 shadow-sm" />
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Total Cabang', 
      value: stats.totalCabang, 
      icon: Building2, 
      color: 'bg-blue-500', 
      show: user.role !== 'cabang' 
    },
    { 
      label: 'Total Peserta', 
      value: stats.totalPeserta, 
      icon: Users, 
      color: 'bg-purple-500', 
      show: true 
    },
    { 
      label: 'Total Pemasukan', 
      value: formatCurrency(stats.totalPemasukan), 
      icon: DollarSign, 
      color: 'bg-green-500', 
      show: true 
    },
    { 
      label: 'Bulan Ini', 
      value: formatCurrency(stats.pemasukanBulanIni), 
      icon: TrendingUp, 
      color: 'bg-orange-500', 
      show: true 
    },
  ].filter(card => card.show);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Selamat Datang, {user.displayName}!</h1>
          <p className="text-sm text-gray-500">Berikut adalah ringkasan aktivitas bimbingan belajar Anda hari ini.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm w-fit">
          <Clock size={16} className="text-blue-600" />
          <span className="text-xs sm:text-sm font-medium text-gray-700">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Pending Branch Notice */}
      {user.role === 'cabang' && user.status !== 'aktif' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 border border-orange-100 rounded-3xl p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl shrink-0">
              <Clock size={32} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-orange-900 mb-2">Akun Anda Sedang Ditinjau</h3>
              <p className="text-orange-800 text-sm mb-6 leading-relaxed">
                Terima kasih telah mendaftar sebagai cabang CAEM. Saat ini akun Anda sedang dalam proses peninjauan oleh Admin Pusat. 
                Anda dapat mulai beroperasi dan mengakses seluruh fitur setelah status Anda berubah menjadi <strong>Aktif</strong>.
              </p>
              
              {pengaturan && (
                <div className="bg-white/50 rounded-2xl p-6 border border-orange-200">
                  <h4 className="text-sm font-bold text-orange-900 mb-4">Persyaratan Aktivasi:</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-orange-800">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                      <span>Pelunasan biaya pendaftaran sebesar {formatCurrency(pengaturan.biayaPendaftaranCabang)}</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-orange-800">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                      <span>Verifikasi dokumen (KTP & Foto Profil)</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm text-orange-800">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                      <span>Persetujuan Admin Pusat</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Stat Cards */}
      {user.status === 'aktif' || user.role !== 'cabang' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 sm:p-3 rounded-2xl ${card.color} text-white shadow-lg shadow-${card.color.split('-')[1]}-100`}>
                    <card.icon size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold">
                    <ArrowUpRight size={12} className="sm:w-3.5 sm:h-3.5" />
                    <span>12%</span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{card.label}</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{card.value}</h3>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Chart Section */}
            <div className="lg:col-span-2 bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Statistik Keuangan</h3>
                <select className="text-xs sm:text-sm border-none bg-gray-50 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto">
                  <option>Tahun 2026</option>
                </select>
              </div>
              <div className="h-64 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(value) => `Rp${value/1000}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        padding: '12px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Pemasukan']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-6">Transaksi Terakhir</h3>
              <div className="space-y-5 sm:space-y-6">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((tx, i) => (
                    <div key={tx.id} className="flex items-center gap-3 sm:gap-4">
                      <div className={`p-2.5 sm:p-3 rounded-2xl shrink-0 ${tx.tipe === 'pendaftaran_peserta' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                        <DollarSign size={18} className="sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                          {tx.tipe === 'pendaftaran_peserta' ? 'Pendaftaran Peserta' : 'Biaya Bulanan'}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs sm:text-sm font-bold text-gray-900">
                          +{formatCurrency(user.role === 'admin' ? tx.porsiPusat : (user.role === 'cabang' ? tx.porsiCabang : tx.nominal))}
                        </p>
                        <p className="text-[9px] sm:text-[10px] uppercase font-bold text-green-600 tracking-wider">Berhasil</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm">Belum ada transaksi.</p>
                  </div>
                )}
              </div>
              <button className="w-full mt-6 sm:mt-8 py-3 bg-gray-50 text-gray-600 text-xs sm:text-sm font-bold rounded-2xl hover:bg-gray-100 transition-colors">
                Lihat Semua Riwayat
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Building2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Fitur Belum Tersedia</h3>
            <p className="text-gray-500 text-sm">
              Silakan selesaikan proses aktivasi akun Anda untuk mulai menggunakan fitur manajemen peserta, keuangan, dan laporan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
