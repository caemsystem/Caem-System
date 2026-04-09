import React, { useEffect, useState, FormEvent } from 'react';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp, where, orderBy, setDoc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Transaksi, Pengaturan, Cabang, Tagihan, Peserta } from '../types';
import { handleFirestoreError, OperationType, formatDate } from '../lib/firestore-utils';
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
  X,
  FileText,
  Send,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KeuanganPageProps {
  user: UserProfile;
}

export default function KeuanganPage({ user }: KeuanganPageProps) {
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [tagihanList, setTagihanList] = useState<Tagihan[]>([]);
  const [pendingPeserta, setPendingPeserta] = useState<Peserta[]>([]);
  const [activeTab, setActiveTab] = useState<'transaksi' | 'tagihan' | 'pengaturan' | 'verifikasi'>('transaksi');
  const [settings, setSettings] = useState<Pengaturan>({
    biayaPendaftaranCabang: 10000000,
    persentasePusat: 30,
    persentaseCabang: 70,
    persentaseMinimalDP: 50,
    biayaPendaftaranPeserta: 150000,
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Tagihan | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const compressImage = (file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Failed to get canvas context'));
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSendBill = async (cabangId: string, unbilledTransactions: Transaksi[]) => {
    if (unbilledTransactions.length === 0) return;
    
    setIsSaving(true);
    try {
      const totalNominal = unbilledTransactions.reduce((acc, tx) => acc + (tx.porsiPusat || 0), 0);
      const txIds = unbilledTransactions.map(tx => tx.id);
      
      const tagihanRef = await addDoc(collection(db, 'tagihan'), {
        cabangId,
        nominal: totalNominal,
        status: 'pending',
        transaksiIds: txIds,
        createdAt: serverTimestamp(),
      });
      
      // Update transactions with tagihanId
      for (const txId of txIds) {
        await updateDoc(doc(db, 'transaksi', txId), {
          tagihanId: tagihanRef.id
        });
      }
      
      setSuccessMessage('Tagihan berhasil dikirim!');
      fetchData();
    } catch (error) {
      console.error('Error sending bill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || !billFile) return;
    
    setIsSaving(true);
    try {
      const buktiBayarUrl = await compressImage(billFile);
      await updateDoc(doc(db, 'tagihan', selectedBill.id), {
        status: 'paid',
        paidAt: serverTimestamp(),
        buktiBayarUrl
      });
      setSuccessMessage('Bukti pembayaran berhasil diunggah!');
      setIsBillModalOpen(false);
      setBillFile(null);
      fetchData();
    } catch (error) {
      console.error('Error paying bill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveBill = async (tagihanId: string) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'tagihan', tagihanId), {
        status: 'paid',
        verified: true,
        verifiedAt: serverTimestamp()
      });
      setSuccessMessage('Pembayaran tagihan berhasil diverifikasi!');
      fetchData();
    } catch (error) {
      console.error('Error approving bill:', error);
    } finally {
      setIsSaving(false);
    }
  };

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

      // 3. Fetch Cabang & Tagihan
      if (user.role === 'admin' || user.role === 'bendahara') {
        const cabangSnap = await getDocs(query(collection(db, 'cabang'), where('status', '==', 'aktif')));
        setCabangList(cabangSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Cabang)));
        
        const tagihanSnap = await getDocs(query(collection(db, 'tagihan'), orderBy('createdAt', 'desc')));
        setTagihanList(tagihanSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tagihan)));

        const pSnap = await getDocs(query(collection(db, 'peserta'), where('status', '==', 'pending'), orderBy('createdAt', 'desc')));
        setPendingPeserta(pSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Peserta)));
      } else if (user.role === 'cabang') {
        const tagihanSnap = await getDocs(query(collection(db, 'tagihan'), where('cabangId', '==', user.cabangId), orderBy('createdAt', 'desc')));
        setTagihanList(tagihanSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tagihan)));
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
      setSuccessMessage('Pengaturan berhasil disimpan!');
    } catch (error) {
      console.error('Error saving settings:', error);
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
      setSuccessMessage('Transaksi berhasil dicatat!');
    } catch (error) {
      console.error('Error adding transaction:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyPeserta = async (peserta: Peserta) => {
    setIsSaving(true);
    try {
      // 1. Update Peserta status
      await updateDoc(doc(db, 'peserta', peserta.id), {
        status: 'aktif',
        statusPembayaran: 'lunas'
      });

      // 2. Find and update associated transaction
      const txSnap = await getDocs(query(collection(db, 'transaksi'), where('pesertaId', '==', peserta.id)));
      if (!txSnap.empty) {
        const txId = txSnap.docs[0].id;
        await updateDoc(doc(db, 'transaksi', txId), {
          status: 'paid'
        });
      }

      setSuccessMessage('Pendaftaran berhasil diverifikasi!');
      fetchData();
    } catch (error) {
      console.error('Error verifying peserta:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'transaksi', id));
      setSuccessMessage('Transaksi berhasil dihapus!');
      fetchData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const totalRevenue = transactions.reduce((acc, tx) => {
    if (tx.status !== 'paid') return acc;
    if (user.role === 'admin' || user.role === 'bendahara') return acc + (tx.porsiPusat || 0);
    if (user.role === 'cabang') return acc + (tx.porsiCabang || 0);
    return acc + (tx.nominal || 0);
  }, 0);

  const pendingRevenue = transactions.reduce((acc, tx) => {
    if (tx.status !== 'pending') return acc;
    if (user.role === 'admin' || user.role === 'bendahara') return acc + (tx.porsiPusat || 0);
    if (user.role === 'cabang') return acc + (tx.porsiCabang || 0);
    return acc + (tx.nominal || 0);
  }, 0);

  return (
    <div className="space-y-8">
      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <CheckCircle2 size={20} />
            <span className="font-bold text-sm">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-100 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-blue-100 text-sm font-medium mb-2">Total Saldo Terverifikasi</p>
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
            <p className="text-sm font-medium text-gray-500 mb-1">Saldo Pending</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(pendingRevenue)}</h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-6">
        <button 
          onClick={() => setActiveTab('transaksi')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'transaksi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Transaksi
        </button>
        <button 
          onClick={() => setActiveTab('tagihan')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'tagihan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Tagihan Cabang
        </button>
        {(user.role === 'admin' || user.role === 'bendahara') && (
          <button 
            onClick={() => setActiveTab('verifikasi')}
            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'verifikasi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Verifikasi Pendaftaran
          </button>
        )}
        {user.role === 'admin' && (
          <button 
            onClick={() => setActiveTab('pengaturan')}
            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'pengaturan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Pengaturan
          </button>
        )}
      </div>

      {activeTab === 'transaksi' && (
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
                          {formatDate(tx.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900">
                            {formatCurrency(user.role === 'admin' ? tx.porsiPusat : (user.role === 'cabang' ? tx.porsiCabang : tx.nominal))}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {user.role === 'admin' && (
                              <button 
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Hapus Transaksi"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              tx.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
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
                          <p className="text-[10px] text-gray-500">{formatDate(tx.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' && (
                          <button 
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus Transaksi"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          tx.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
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
      </div>
      )}

      {activeTab === 'tagihan' && (
        <div className="space-y-8">
          {user.role === 'admin' && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Kirim Tagihan ke Cabang</h3>
                <p className="text-sm text-gray-500">Kirim tagihan bagi hasil pendaftaran peserta ke cabang.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cabang</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Belum Ditagih</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Jumlah Transaksi</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cabangList.map(cabang => {
                      const unbilledTx = transactions.filter(tx => 
                        tx.cabangId === cabang.id && 
                        tx.tipe === 'pendaftaran_peserta' && 
                        !tx.tagihanId
                      );
                      const totalUnbilled = unbilledTx.reduce((acc, tx) => acc + (tx.porsiPusat || 0), 0);
                      
                      return (
                        <tr key={cabang.id}>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-900">{cabang.namaCabang}</p>
                            <p className="text-xs text-gray-500">{cabang.namaKepala}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-blue-600">{formatCurrency(totalUnbilled)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600">{unbilledTx.length} Transaksi</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleSendBill(cabang.id, unbilledTx)}
                              disabled={isSaving || unbilledTx.length === 0}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all ml-auto disabled:opacity-50"
                            >
                              <Send size={14} />
                              Kirim Tagihan
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {cabangList.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Tidak ada cabang aktif.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Riwayat Tagihan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID Tagihan</th>
                    {user.role === 'admin' && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cabang</th>}
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nominal</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tagihanList.map(tagihan => (
                    <tr key={tagihan.id}>
                      <td className="px-6 py-4">
                        <p className="text-xs font-mono font-bold text-gray-500">#{tagihan.id.substring(0, 8)}</p>
                      </td>
                      {user.role === 'admin' && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900">
                            {cabangList.find(c => c.id === tagihan.cabangId)?.namaCabang || 'Unknown'}
                          </p>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(tagihan.nominal)}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(tagihan.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          tagihan.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {tagihan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {user.role === 'cabang' && tagihan.status === 'pending' && (
                            <button
                              onClick={() => { setSelectedBill(tagihan); setIsBillModalOpen(true); }}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all"
                            >
                              Bayar Tagihan
                            </button>
                          )}
                          {tagihan.buktiBayarUrl && (user.role === 'admin' || user.role === 'bendahara') && !tagihan.verified && (
                            <button
                              onClick={() => handleApproveBill(tagihan.id)}
                              disabled={isSaving}
                              className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50"
                            >
                              Verifikasi Bayar
                            </button>
                          )}
                          {tagihan.buktiBayarUrl && (
                            <a 
                              href={tagihan.buktiBayarUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-blue-600 hover:underline text-xs font-bold"
                            >
                              Lihat Bukti
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tagihanList.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Belum ada tagihan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pengaturan' && user.role === 'admin' && (
        <div className="space-y-6 max-w-2xl">
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Minimal DP Cabang (%)</label>
                  <input
                    type="number"
                    max={100}
                    value={settings.persentaseMinimalDP || 50}
                    onChange={e => setSettings({ ...settings, persentaseMinimalDP: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Persentase minimal pembayaran awal untuk pendaftaran cabang.</p>
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

      {activeTab === 'verifikasi' && (user.role === 'admin' || user.role === 'bendahara') && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Verifikasi Pendaftaran Peserta</h3>
              <p className="text-sm text-gray-500">Daftar peserta yang baru mendaftar dan menunggu verifikasi pembayaran.</p>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingPeserta.length > 0 ? (
                pendingPeserta.map((peserta) => (
                  <div key={peserta.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
                        {peserta.nama[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{peserta.nama}</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Building2 size={12} />
                            {peserta.cabangId === 'pusat' ? 'Pusat' : (cabangList.find(c => c.id === peserta.cabangId)?.namaCabang || 'Cabang')}
                          </span>
                          <span>•</span>
                          <span>{formatCurrency(peserta.nominalPendaftaran || 0)}</span>
                          <span>•</span>
                          <span>{formatDate(peserta.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleVerifyPeserta(peserta)}
                        disabled={isSaving}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        Verifikasi
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-gray-400 text-sm">Tidak ada pendaftaran yang menunggu verifikasi.</div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Bill Payment Modal */}
      <AnimatePresence>
        {isBillModalOpen && selectedBill && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBillModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">Bayar Tagihan</h3>
                <button 
                  onClick={() => setIsBillModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handlePayBill} className="p-8 space-y-6">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Total Tagihan</p>
                  <p className="text-2xl font-black text-blue-900">{formatCurrency(selectedBill.nominal)}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Upload Bukti Transfer</label>
                  <div className="relative group">
                    <input
                      type="file"
                      required
                      accept="image/*"
                      onChange={e => e.target.files && setBillFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${billFile ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 group-hover:border-blue-400'}`}>
                      {billFile ? (
                        <>
                          <CheckCircle2 className="text-green-600" size={24} />
                          <span className="text-xs font-medium text-green-700 truncate px-4 w-full text-center">{billFile.name}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="text-gray-400" size={24} />
                          <span className="text-xs font-medium text-gray-500">Pilih Foto Bukti</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving || !billFile}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={20} />}
                  Konfirmasi Pembayaran
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
