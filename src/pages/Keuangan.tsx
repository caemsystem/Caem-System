import React, { useEffect, useState, FormEvent } from 'react';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp, where, orderBy, setDoc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Transaksi, Pengaturan, Cabang } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign,
  Settings,
  Save,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KeuanganPageProps {
  user: UserProfile;
}

export default function KeuanganPage({ user }: KeuanganPageProps) {
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [settings, setSettings] = useState<Pengaturan>({
    biayaPendaftaranCabang: 5000000,
    persentasePusat: 30,
    persentaseCabang: 70,
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Transactions
      let txQuery = query(collection(db, 'transaksi'), orderBy('createdAt', 'desc'));
      if (user.role === 'cabang') {
        txQuery = query(collection(db, 'transaksi'), where('cabangId', '==', user.cabangId), orderBy('createdAt', 'desc'));
      }
      const txSnap = await getDocs(txQuery);
      setTransactions(txSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaksi)));

      // 2. Fetch Settings
      const settingsDoc = await getDoc(doc(db, 'pengaturan/global'));
      if (settingsDoc.exists()) {
        setSettings(prev => ({ ...prev, ...settingsDoc.data() }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'keuangan_data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'pengaturan', 'global'), settings);
      alert('Pengaturan berhasil disimpan!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipe: 'pemasukan' as 'pemasukan' | 'pengeluaran',
    keterangan: '',
    nominal: 0,
    cabangId: user.role === 'cabang' ? (user.cabangId || '') : 'pusat',
  });

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const nominal = Number(formData.nominal);
      const isPusat = formData.cabangId === 'pusat';
      
      // For manual transactions, we don't necessarily apply the percentage split 
      // unless it's a specific type. For simplicity, manual entries belong 
      // entirely to the creator's entity.
      const porsiPusat = isPusat ? nominal : 0;
      const porsiCabang = isPusat ? 0 : nominal;

      await addDoc(collection(db, 'transaksi'), {
        cabangId: formData.cabangId,
        nominal: nominal,
        porsiPusat: formData.tipe === 'pemasukan' ? porsiPusat : -porsiPusat,
        porsiCabang: formData.tipe === 'pemasukan' ? porsiCabang : -porsiCabang,
        tipe: formData.tipe,
        keterangan: formData.keterangan,
        status: 'paid',
        createdAt: serverTimestamp(),
      });

      setIsModalOpen(false);
      setFormData({
        tipe: 'pemasukan',
        keterangan: '',
        nominal: 0,
        cabangId: user.role === 'cabang' ? (user.cabangId || '') : 'pusat',
      });
      fetchData();
      alert('Transaksi berhasil dicatat!');
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Gagal mencatat transaksi.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalRevenue = transactions.reduce((acc, tx) => {
    if (user.role === 'admin' || user.role === 'bendahara') return acc + (tx.porsiPusat || 0);
    if (user.role === 'cabang') return acc + (tx.porsiCabang || 0);
    return acc + (tx.nominal || 0);
  }, 0);

  return (
    <div className="space-y-8">
      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-100 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-blue-100 text-sm font-medium mb-2">Total Saldo Anda</p>
            <h2 className="text-3xl font-bold mb-6">{formatCurrency(totalRevenue)}</h2>
            <div className="flex items-center gap-2 text-blue-100 text-xs font-bold bg-white/10 w-fit px-3 py-1.5 rounded-full">
              <ArrowUpRight size={14} />
              <span>+15.2% dari bulan lalu</span>
            </div>
          </div>
          <Wallet className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32" />
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><TrendingUp size={24} /></div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pemasukan</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Bulan Ini</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue * 0.4)}</h3>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl"><Clock size={24} /></div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Tagihan</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue * 0.1)}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Transaction History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Riwayat Transaksi</h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all"
                >
                  <Plus size={16} />
                  Tambah Transaksi
                </button>
                <button className="text-sm text-blue-600 font-bold hover:underline">Lihat Semua</button>
              </div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Keterangan</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nominal</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="animate-pulse h-16"><td colSpan={4} className="px-6" /></tr>
                    ))
                  ) : transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${tx.tipe === 'pendaftaran_peserta' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                              {tx.tipe === 'pendaftaran_peserta' ? <Users size={16} /> : <Building2 size={16} />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 capitalize">{tx.tipe.replace('_', ' ')}</p>
                              <p className="text-xs text-gray-500">ID: {tx.id.substring(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(tx.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900">
                            {formatCurrency(user.role === 'admin' ? tx.porsiPusat : (user.role === 'cabang' ? tx.porsiCabang : tx.nominal))}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            tx.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Belum ada transaksi.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-50">
              {loading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="p-6 animate-pulse space-y-4">
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                  </div>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <div key={tx.id} className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.tipe === 'pendaftaran_peserta' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                          {tx.tipe === 'pendaftaran_peserta' ? <Users size={16} /> : <Building2 size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 capitalize">{tx.tipe.replace('_', ' ')}</p>
                          <p className="text-[10px] text-gray-500">{new Date(tx.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        tx.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                      <span className="text-xs text-gray-500">Nominal</span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(user.role === 'admin' ? tx.porsiPusat : (user.role === 'cabang' ? tx.porsiCabang : tx.nominal))}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-gray-400 text-sm">Belum ada transaksi.</div>
              )}
            </div>
          </div>
        </div>

        {/* Settings Section (Admin Only) */}
        {user.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Settings size={20} /></div>
                <h3 className="text-lg font-bold text-gray-900">Pengaturan Keuangan</h3>
              </div>
              
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Biaya Pendaftaran Cabang</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      value={settings.biayaPendaftaranCabang}
                      onChange={e => setSettings({ ...settings, biayaPendaftaranCabang: Number(e.target.value) })}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-700">Pembagian Hasil Peserta (%)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pusat</label>
                      <input
                        type="number"
                        max={100}
                        value={settings.persentasePusat}
                        onChange={e => setSettings({ ...settings, persentasePusat: Number(e.target.value), persentaseCabang: 100 - Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cabang</label>
                      <input
                        type="number"
                        max={100}
                        value={settings.persentaseCabang}
                        onChange={e => setSettings({ ...settings, persentaseCabang: Number(e.target.value), persentasePusat: 100 - Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                  Simpan Perubahan
                </button>
              </form>
            </div>

            <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
              <div className="flex items-center gap-3 mb-2 text-orange-700">
                <CheckCircle2 size={20} />
                <p className="text-sm font-bold">Info Bagi Hasil</p>
              </div>
              <p className="text-xs text-orange-600 leading-relaxed">
                Pembagian hasil akan diterapkan otomatis pada setiap transaksi pendaftaran peserta baru di cabang.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">Tambah Transaksi Manual</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipe Transaksi</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipe: 'pemasukan' })}
                      className={`py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                        formData.tipe === 'pemasukan' 
                          ? 'bg-green-50 border-green-500 text-green-700' 
                          : 'bg-gray-50 border-transparent text-gray-500'
                      }`}
                    >
                      Pemasukan
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipe: 'pengeluaran' })}
                      className={`py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                        formData.tipe === 'pengeluaran' 
                          ? 'bg-red-50 border-red-500 text-red-700' 
                          : 'bg-gray-50 border-transparent text-gray-500'
                      }`}
                    >
                      Pengeluaran
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: Pembelian Buku, Gaji Tutor, dll"
                    value={formData.keterangan}
                    onChange={e => setFormData({ ...formData, keterangan: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nominal</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      required
                      min="0"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      placeholder="0"
                      value={formData.nominal}
                      onChange={e => setFormData({ ...formData, nominal: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {user.role !== 'cabang' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entitas</label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.cabangId}
                      onChange={e => setFormData({ ...formData, cabangId: e.target.value })}
                    >
                      <option value="pusat">Pusat</option>
                      {/* Ideally we'd fetch and list branches here too, but for now pusat is default for admin */}
                    </select>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        Simpan Transaksi
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
