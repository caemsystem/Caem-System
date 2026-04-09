import React, { useEffect, useState, FormEvent } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, where, orderBy, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Peserta, Cabang, Pengaturan } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { 
  Plus, 
  Search, 
  Filter, 
  Users, 
  Building2, 
  MapPin, 
  Phone, 
  Mail,
  X,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PesertaPageProps {
  user: UserProfile;
}

export default function PesertaPage({ user }: PesertaPageProps) {
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPeserta, setSelectedPeserta] = useState<Peserta | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCabang, setFilterCabang] = useState('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const [formData, setFormData] = useState({
    nama: '',
    alamat: '',
    noHp: '',
    email: '',
    cabangId: user.role === 'cabang' ? (user.cabangId || '') : 'pusat',
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Peserta
      let pQuery = query(collection(db, 'peserta'), orderBy('createdAt', 'desc'));
      if (user.role === 'cabang') {
        pQuery = query(collection(db, 'peserta'), where('cabangId', '==', user.cabangId), orderBy('createdAt', 'desc'));
      }
      const pSnap = await getDocs(pQuery);
      setPesertaList(pSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Peserta)));

      // 2. Fetch Cabang for dropdown
      if (user.role !== 'cabang') {
        const cSnap = await getDocs(query(collection(db, 'cabang'), where('status', '==', 'aktif')));
        setCabangList(cSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Cabang)));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'peserta_or_cabang');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePeserta = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'peserta', id));
      
      // Also delete associated transactions
      const txSnap = await getDocs(query(collection(db, 'transaksi'), where('pesertaId', '==', id)));
      for (const txDoc of txSnap.docs) {
        await deleteDoc(doc(db, 'transaksi', txDoc.id));
      }

      setSuccessMessage('Data peserta berhasil dihapus!');
      fetchData();
    } catch (error) {
      console.error('Error deleting peserta:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Fetch settings for registration fee
      const settingsDoc = await getDoc(doc(db, 'pengaturan', 'global'));
      const settings = (settingsDoc.exists() ? settingsDoc.data() as Pengaturan : { 
        biayaPendaftaranCabang: 10000000,
        biayaPendaftaranPeserta: 150000,
        persentasePusat: 30, 
        persentaseCabang: 70 
      });

      const nominal = settings.biayaPendaftaranPeserta;

      const pesertaRef = await addDoc(collection(db, 'peserta'), {
        nama: formData.nama,
        dataDiri: {
          alamat: formData.alamat,
          noHp: formData.noHp,
          email: formData.email,
        },
        cabangId: formData.cabangId,
        status: 'pending', 
        nominalPendaftaran: nominal,
        statusPembayaran: 'belum_lunas',
        createdAt: serverTimestamp(),
      });

      // Also create a transaction for registration fee
      const porsiPusat = formData.cabangId === 'pusat' ? nominal : (nominal * settings.persentasePusat / 100);
      const porsiCabang = formData.cabangId === 'pusat' ? 0 : (nominal * settings.persentaseCabang / 100);

      await addDoc(collection(db, 'transaksi'), {
        pesertaId: pesertaRef.id,
        cabangId: formData.cabangId,
        nominal,
        porsiPusat,
        porsiCabang,
        tipe: 'pendaftaran_peserta',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setIsModalOpen(false);
      setFormData({ nama: '', alamat: '', noHp: '', email: '', cabangId: user.role === 'cabang' ? (user.cabangId || '') : 'pusat' });
      fetchData();
      setSuccessMessage('Peserta berhasil ditambahkan!');
    } catch (error) {
      console.error('Error adding peserta:', error);
    }
  };

  const filteredPeserta = pesertaList.filter(p => {
    const matchesSearch = p.nama.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCabang = filterCabang === 'all' || p.cabangId === filterCabang;
    return matchesSearch && matchesCabang;
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

      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari nama peserta..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          {user.role !== 'cabang' && (
            <select
              value={filterCabang}
              onChange={e => setFilterCabang(e.target.value)}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="all">Semua Cabang</option>
              <option value="pusat">Pusat</option>
              {cabangList.map(c => (
                <option key={c.id} value={c.id}>{c.namaCabang}</option>
              ))}
            </select>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus size={20} />
            Tambah Peserta
          </button>
        </div>
      </div>

      {/* Peserta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white rounded-3xl border border-gray-100 shadow-sm animate-pulse" />
          ))
        ) : filteredPeserta.length > 0 ? (
          filteredPeserta.map((peserta, i) => (
            <motion.div
              key={peserta.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
                  {peserta.nama[0]}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePeserta(peserta.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Hapus Peserta"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      peserta.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {peserta.status || 'aktif'}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    peserta.cabangId === 'pusat' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {peserta.cabangId === 'pusat' ? 'Pusat' : 'Cabang'}
                  </div>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{peserta.nama}</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <MapPin size={14} />
                  <span className="truncate">{peserta.dataDiri.alamat || 'Alamat tidak diisi'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Phone size={14} />
                  <span>{peserta.dataDiri.noHp || '-'}</span>
                </div>
              </div>

                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <Building2 size={14} />
                    <span>
                      {peserta.cabangId === 'pusat' ? 'Bimbel Pusat' : (cabangList.find(c => c.id === peserta.cabangId)?.namaCabang || 'Cabang')}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedPeserta(peserta);
                      setIsDetailModalOpen(true);
                    }}
                    className="text-blue-600 text-xs font-bold hover:underline"
                  >
                    Detail
                  </button>
                </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <Users size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">Belum ada data peserta.</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
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
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">Tambah Peserta Baru</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nama lengkap peserta"
                    value={formData.nama}
                    onChange={e => setFormData({ ...formData, nama: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">No. HP</label>
                    <input
                      type="tel"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0812..."
                      value={formData.noHp}
                      onChange={e => setFormData({ ...formData, noHp: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="email@peserta.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Alamat lengkap"
                    value={formData.alamat}
                    onChange={e => setFormData({ ...formData, alamat: e.target.value })}
                  />
                </div>

                {user.role !== 'cabang' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Pilih Lokasi Bimbel</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.cabangId}
                      onChange={e => setFormData({ ...formData, cabangId: e.target.value })}
                    >
                      <option value="pusat">Bimbel Pusat</option>
                      {cabangList.map(c => (
                        <option key={c.id} value={c.id}>{c.namaCabang}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} />
                    Simpan Data Peserta
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedPeserta && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">Detail Peserta</h3>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-2xl">
                    {selectedPeserta.nama[0]}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{selectedPeserta.nama}</h4>
                    <p className="text-sm text-gray-500">{selectedPeserta.cabangId === 'pusat' ? 'Bimbel Pusat' : 'Cabang'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Informasi Kontak</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Phone size={14} className="text-gray-400" />
                        <span>{selectedPeserta.dataDiri.noHp || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Mail size={14} className="text-gray-400" />
                        <span>{selectedPeserta.dataDiri.email || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Alamat</p>
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <MapPin size={14} className="text-gray-400 mt-1" />
                      <span>{selectedPeserta.dataDiri.alamat || 'Alamat tidak diisi'}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Status Pendaftaran</p>
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedPeserta.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {selectedPeserta.status || 'aktif'}
                      </span>
                      <span className="text-xs text-gray-500">Terdaftar: {new Date(selectedPeserta.createdAt).toLocaleDateString()}</span>
                    </div>
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
