import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Peserta, Cabang } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { 
  Search, 
  Users, 
  Building2, 
  MapPin, 
  Phone, 
  Mail,
  X,
  CheckCircle2,
  GraduationCap,
  RotateCcw,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface AlumniPageProps {
  user: UserProfile;
}

export default function AlumniPage({ user }: AlumniPageProps) {
  const [alumniList, setAlumniList] = useState<Peserta[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAlumni, setSelectedAlumni] = useState<Peserta | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCabang, setFilterCabang] = useState('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let pQuery = query(collection(db, 'peserta'), where('status', '==', 'alumni'), orderBy('createdAt', 'desc'));
      if (user.role === 'cabang') {
        pQuery = query(collection(db, 'peserta'), where('cabangId', '==', user.cabangId), where('status', '==', 'alumni'), orderBy('createdAt', 'desc'));
      }
      const pSnap = await getDocs(pQuery);
      setAlumniList(pSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Peserta)));

      if (user.role !== 'cabang') {
        const cSnap = await getDocs(query(collection(db, 'cabang'), where('status', '==', 'aktif')));
        setCabangList(cSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Cabang)));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'alumni_data');
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePeserta = async (id: string) => {
    try {
      await updateDoc(doc(db, 'peserta', id), {
        status: 'aktif'
      });
      setSuccessMessage('Peserta berhasil dikembalikan ke daftar aktif!');
      setIsDetailModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error restoring peserta:', error);
    }
  };

  const exportToExcel = () => {
    const data = filteredAlumni.map((p, index) => ({
      'No': index + 1,
      'Nama Alumni': p.nama,
      'Alamat': p.dataDiri.alamat || '-',
      'No. HP': p.dataDiri.noHp || '-',
      'Email': p.dataDiri.email || '-',
      'Cabang': p.cabangId === 'pusat' ? 'Pusat' : (cabangList.find(c => c.id === p.cabangId)?.namaCabang || 'Cabang'),
      'Status': 'Alumni',
      'Tanggal Daftar': p.createdAt ? new Date(p.createdAt).toLocaleDateString('id-ID') : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Alumni');
    
    const maxWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String((row as any)[key]).length)) + 2
    }));
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, `Data_Alumni_${new Date().getTime()}.xlsx`);
  };

  const filteredAlumni = alumniList.filter(p => {
    const matchesSearch = p.nama.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCabang = filterCabang === 'all' || p.cabangId === filterCabang;
    return matchesSearch && matchesCabang;
  });

  return (
    <div className="space-y-6">
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari nama alumni..."
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
            onClick={exportToExcel}
            disabled={filteredAlumni.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet size={20} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white rounded-3xl border border-gray-100 shadow-sm animate-pulse" />
          ))
        ) : filteredAlumni.length > 0 ? (
          filteredAlumni.map((alumni, i) => (
            <motion.div
              key={alumni.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xl">
                  {alumni.nama[0]}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Alumni
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    alumni.cabangId === 'pusat' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {alumni.cabangId === 'pusat' ? 'Pusat' : 'Cabang'}
                  </div>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">{alumni.nama}</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <MapPin size={14} />
                  <span className="truncate">{alumni.dataDiri.alamat || 'Alamat tidak diisi'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                  <Building2 size={14} />
                  <span>
                    {alumni.cabangId === 'pusat' ? 'Bimbel Pusat' : (cabangList.find(c => c.id === alumni.cabangId)?.namaCabang || 'Cabang')}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedAlumni(alumni);
                    setIsDetailModalOpen(true);
                  }}
                  className="text-orange-600 text-xs font-bold hover:underline"
                >
                  Detail
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <GraduationCap size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">Belum ada data alumni.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isDetailModalOpen && selectedAlumni && (
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
                <h3 className="text-xl font-bold text-gray-900">Detail Alumni</h3>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-2xl">
                    {selectedAlumni.nama[0]}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{selectedAlumni.nama}</h4>
                    <p className="text-sm text-gray-500">{selectedAlumni.cabangId === 'pusat' ? 'Bimbel Pusat' : 'Cabang'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Informasi Kontak</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Phone size={14} className="text-gray-400" />
                        <span>{selectedAlumni.dataDiri.noHp || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Mail size={14} className="text-gray-400" />
                        <span>{selectedAlumni.dataDiri.email || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Alamat</p>
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <MapPin size={14} className="text-gray-400 mt-1" />
                      <span>{selectedAlumni.dataDiri.alamat || 'Alamat tidak diisi'}</span>
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    <button
                      onClick={() => handleRestorePeserta(selectedAlumni.id)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={20} />
                      Kembalikan ke Daftar Aktif
                    </button>
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
