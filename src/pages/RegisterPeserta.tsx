import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, CheckCircle2, AlertCircle, ArrowLeft, Building2, User, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { Pengaturan } from '../types';

interface Cabang {
  id: string;
  namaCabang: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export default function RegisterPeserta() {
  const [formData, setFormData] = useState({
    nama: '',
    noHp: '',
    cabangId: '',
  });
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [nominalPendaftaran, setNominalPendaftaran] = useState(150000);
  const [loading, setLoading] = useState(false);
  const [fetchingCabang, setFetchingCabang] = useState(true);
  const [fetchingSettings, setFetchingSettings] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFirestoreError = (err: any, operationType: OperationType, path: string) => {
    const errInfo = {
      error: err instanceof Error ? err.message : String(err),
      operationType,
      path,
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    throw new Error(err.message || 'Terjadi kesalahan saat pendaftaran.');
  };

  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const q = query(collection(db, 'cabang'), where('status', '==', 'aktif'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, namaCabang: doc.data().namaCabang }));
        setCabangList(list);
      } catch (err) {
        console.error('Error fetching cabang:', err);
      } finally {
        setFetchingCabang(false);
      }
    };

    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDocs(collection(db, 'pengaturan'));
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data() as Pengaturan;
          setNominalPendaftaran(settings.biayaPendaftaranPeserta || 150000);
        }
      } catch (err) {
        console.warn('Failed to fetch settings, using default:', err);
      } finally {
        setFetchingSettings(false);
      }
    };

    fetchCabang();
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cabangId) return setError('Silakan pilih lembaga bimbel.');
    setLoading(true);
    setError('');

    try {
      try {
        await addDoc(collection(db, 'peserta'), {
          nama: formData.nama,
          dataDiri: {
            noHp: formData.noHp,
            alamat: '',
            email: '',
          },
          cabangId: formData.cabangId,
          status: 'pending',
          nominalPendaftaran,
          statusPembayaran: 'belum_lunas',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        return handleFirestoreError(err, OperationType.CREATE, 'peserta');
      }

      try {
        // Also create a transaction record
        await addDoc(collection(db, 'transaksi'), {
          cabangId: formData.cabangId,
          nominal: nominalPendaftaran,
          porsiPusat: 0, // Will be calculated upon payment confirmation
          porsiCabang: 0,
          tipe: 'pendaftaran_peserta',
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        return handleFirestoreError(err, OperationType.CREATE, 'transaksi');
      }
      setSuccess(true);
    } catch (err: any) {
      console.error('Registration Error:', err);
      setError(err.message || 'Terjadi kesalahan saat pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center"
        >
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Pendaftaran Berhasil!</h2>
          <p className="text-gray-600 mb-8">
            Data Anda telah berhasil didaftarkan. Silakan hubungi admin cabang terkait untuk informasi lebih lanjut mengenai jadwal belajar.
          </p>
          <Link 
            to="/register" 
            className="inline-block bg-purple-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-purple-700 transition-all"
          >
            Kembali
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/register" className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-600 font-medium mb-8 transition-colors">
          <ArrowLeft size={20} />
          Kembali ke Pilihan
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl overflow-hidden"
        >
          <div className="bg-purple-600 p-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <GraduationCap size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Pendaftaran Peserta</h1>
                <p className="text-purple-100 text-sm">Ayo mulai belajar bersama CAEM!</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap Peserta</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="Contoh: Ahmad Fauzi"
                    value={formData.nama}
                    onChange={e => setFormData({ ...formData, nama: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">No. HP / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="0812..."
                    value={formData.noHp}
                    onChange={e => setFormData({ ...formData, noHp: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Pilih Lembaga Bimbel (Cabang)</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    required
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none appearance-none"
                    value={formData.cabangId}
                    onChange={e => setFormData({ ...formData, cabangId: e.target.value })}
                    disabled={fetchingCabang}
                  >
                    <option value="">Pilih Cabang</option>
                    <option value="pusat">Pusat</option>
                    {cabangList.map(c => (
                      <option key={c.id} value={c.id}>{c.namaCabang}</option>
                    ))}
                  </select>
                </div>
                {fetchingCabang && <p className="text-xs text-gray-400 mt-1">Memuat daftar cabang...</p>}
              </div>

              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-700">Biaya Pendaftaran (100% Lunas)</span>
                  <span className="text-lg font-bold text-purple-900">
                    {fetchingSettings ? '...' : `Rp ${nominalPendaftaran.toLocaleString('id-ID')}`}
                  </span>
                </div>
                <p className="text-xs text-purple-600 mt-1 italic">* Pembayaran dilakukan setelah pendaftaran dikonfirmasi oleh admin cabang.</p>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading || fetchingCabang}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-purple-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Daftar Sekarang'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
