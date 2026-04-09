import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp, orderBy, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Cabang } from '../types';
import { handleFirestoreError, OperationType, formatDate } from '../lib/firestore-utils';
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Search, 
  Filter,
  MoreVertical,
  ExternalLink,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CabangPageProps {
  user: UserProfile;
}

export default function CabangPage({ user }: CabangPageProps) {
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'aktif' | 'rejected'>('all');
  const [selectedCabang, setSelectedCabang] = useState<Cabang | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    fetchCabang();
  }, []);

  const fetchCabang = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'cabang'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Cabang));
      setCabangList(list);
    } catch (error) {
      console.error('Error fetching cabang:', error);
    } finally {
      setLoading(false);
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');

  const handleApprove = async (cabang: Cabang) => {
    setIsProcessing(true);
    setActionError('');

    try {
      // Generate No Registrasi: CAEM-YYYY-XXX
      const year = new Date().getFullYear();
      const activeCabangCount = cabangList.filter(c => c.status === 'aktif').length;
      const nextNumber = (activeCabangCount + 1).toString().padStart(3, '0');
      const noRegistrasi = `CAEM-${year}-${nextNumber}`;

      await updateDoc(doc(db, 'cabang', cabang.id), {
        status: 'aktif',
        statusPembayaran: 'lunas',
        noRegistrasi,
        approvedAt: serverTimestamp(),
      });

      // Update the transaction status if it exists
      const txQuery = query(
        collection(db, 'transaksi'), 
        where('cabangId', '==', cabang.id), 
        where('tipe', '==', 'pendaftaran_cabang'),
        where('status', '==', 'pending')
      );
      const txSnap = await getDocs(txQuery);
      if (!txSnap.empty) {
        await updateDoc(doc(db, 'transaksi', txSnap.docs[0].id), {
          status: 'paid'
        });
      }

      // Also update the user document if it exists
      const q = query(collection(db, 'users'), where('cabangId', '==', cabang.id));
      const userSnap = await getDocs(q);
      if (!userSnap.empty) {
        await updateDoc(doc(db, 'users', userSnap.docs[0].id), {
          status: 'aktif'
        });
      }

      await fetchCabang();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error approving cabang:', error);
      setActionError('Gagal menyetujui cabang: ' + (error.message || 'Terjadi kesalahan'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (cabang: Cabang) => {
    setIsProcessing(true);
    setActionError('');

    try {
      await updateDoc(doc(db, 'cabang', cabang.id), {
        status: 'rejected',
      });

      // Also update the user document if it exists
      const q = query(collection(db, 'users'), where('cabangId', '==', cabang.id));
      const userSnap = await getDocs(q);
      if (!userSnap.empty) {
        await updateDoc(doc(db, 'users', userSnap.docs[0].id), {
          status: 'rejected'
        });
      }

      await fetchCabang();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error rejecting cabang:', error);
      setActionError('Gagal menolak cabang: ' + (error.message || 'Terjadi kesalahan'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCabang = async (id: string) => {
    setIsProcessing(true);
    try {
      // 1. Delete associated users
      const userSnap = await getDocs(query(collection(db, 'users'), where('cabangId', '==', id)));
      for (const userDoc of userSnap.docs) {
        await deleteDoc(doc(db, 'users', userDoc.id));
      }

      // 2. Delete associated peserta
      const pesertaSnap = await getDocs(query(collection(db, 'peserta'), where('cabangId', '==', id)));
      for (const pDoc of pesertaSnap.docs) {
        await deleteDoc(doc(db, 'peserta', pDoc.id));
      }

      // 3. Delete associated transactions
      const txSnap = await getDocs(query(collection(db, 'transaksi'), where('cabangId', '==', id)));
      for (const txDoc of txSnap.docs) {
        await deleteDoc(doc(db, 'transaksi', txDoc.id));
      }

      // 4. Delete the cabang itself
      await deleteDoc(doc(db, 'cabang', id));

      setSuccessMessage('Data cabang berhasil dihapus!');
      fetchCabang();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error deleting cabang:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredCabang = cabangList.filter(c => {
    const matchesSearch = c.namaCabang.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.namaKepala.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
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

      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari nama cabang atau kepala..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter className="text-gray-400" size={20} />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="aktif">Aktif</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>
      </div>

      {/* Cabang List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cabang</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Kepala Bimbel</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">No. Registrasi</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8 h-20 bg-gray-50/20" />
                  </tr>
                ))
              ) : filteredCabang.length > 0 ? (
                filteredCabang.map((cabang) => (
                  <tr key={cabang.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                          {cabang.namaCabang[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{cabang.namaCabang}</p>
                          <p className="text-xs text-gray-500">{cabang.alamat.substring(0, 30)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{cabang.namaKepala}</p>
                      <p className="text-xs text-gray-500">{cabang.noHp}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-bold text-gray-600">
                        {cabang.noRegistrasi || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                        cabang.status === 'aktif' ? 'bg-green-100 text-green-700' :
                        cabang.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {cabang.status === 'aktif' ? 'Aktif' :
                         cabang.status === 'pending' ? 'Menunggu' : 'Ditolak'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedCabang(cabang); setIsModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Detail Cabang"
                        >
                          <Eye size={20} />
                        </button>
                        {user.role === 'admin' && (
                          <button 
                            onClick={() => handleDeleteCabang(cabang.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus Cabang"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Tidak ada data cabang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="p-6 animate-pulse space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredCabang.length > 0 ? (
            filteredCabang.map((cabang) => (
              <div key={cabang.id} className="p-6 space-y-4 active:bg-gray-50 transition-colors" onClick={() => { setSelectedCabang(cabang); setIsModalOpen(true); }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                      {cabang.namaCabang[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{cabang.namaCabang}</h4>
                      <p className="text-xs text-gray-500">{cabang.namaKepala}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    cabang.status === 'aktif' ? 'bg-green-100 text-green-700' :
                    cabang.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {cabang.status === 'aktif' ? 'Aktif' :
                     cabang.status === 'pending' ? 'Menunggu' : 'Ditolak'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    <span className="truncate max-w-[150px]">{cabang.alamat}</span>
                  </div>
                  <span className="font-mono font-bold text-gray-400">{cabang.noRegistrasi || '-'}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-gray-400 text-sm">
              Tidak ada data cabang ditemukan.
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isModalOpen && selectedCabang && (
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
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">Detail Pendaftaran Cabang</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <section>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Informasi Utama</h4>
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0"><Building2 size={20} /></div>
                          <div>
                            <p className="text-xs text-gray-500">Nama Cabang</p>
                            <p className="text-base font-bold text-gray-900">{selectedCabang.namaCabang}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0"><MapPin size={20} /></div>
                          <div>
                            <p className="text-xs text-gray-500">Alamat</p>
                            <p className="text-sm font-medium text-gray-700">{selectedCabang.alamat}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0"><Calendar size={20} /></div>
                          <div>
                            <p className="text-xs text-gray-500">Tanggal Daftar</p>
                            <p className="text-sm font-medium text-gray-700">
                              {formatDate(selectedCabang.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Kontak Kepala Bimbel</h4>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                            {selectedCabang.namaKepala[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{selectedCabang.namaKepala}</p>
                            <p className="text-xs text-gray-500">Kepala Cabang</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Phone size={18} className="text-gray-400" />
                          <p className="text-sm text-gray-700">{selectedCabang.noHp}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Mail size={18} className="text-gray-400" />
                          <p className="text-sm text-gray-700">{selectedCabang.email}</p>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="space-y-8">
                    <section>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Dokumen & Bukti</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'KTP', url: selectedCabang.ktpUrl },
                          { label: 'Foto', url: selectedCabang.fotoUrl },
                          { label: 'Bukti Bayar', url: selectedCabang.buktiBayarUrl },
                        ].map(doc => (
                          <div key={doc.label} className="space-y-2">
                            <p className="text-xs font-bold text-gray-500">{doc.label}</p>
                            {doc.url ? (
                              <a 
                                href={doc.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="group relative block aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200"
                              >
                                <img 
                                  src={doc.url} 
                                  alt={doc.label} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <ExternalLink className="text-white" size={20} />
                                </div>
                              </a>
                            ) : (
                              <div className="aspect-video bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                                Tidak ada file
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>

                    {selectedCabang.status === 'pending' && user.role === 'admin' && (
                      <div className="space-y-4 pt-4">
                        {actionError && (
                          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm">
                            <XCircle size={18} />
                            {actionError}
                          </div>
                        )}
                        <div className="flex gap-4">
                          <button 
                            onClick={() => handleReject(selectedCabang)}
                            disabled={isProcessing}
                            className="flex-1 px-6 py-3 border-2 border-red-100 text-red-600 font-bold rounded-2xl hover:bg-red-50 transition-all disabled:opacity-50"
                          >
                            {isProcessing ? 'Memproses...' : 'Tolak'}
                          </button>
                          <button 
                            onClick={() => handleApprove(selectedCabang)}
                            disabled={isProcessing}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 size={20} />
                                Setujui
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
