import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, CheckCircle2, AlertCircle, ArrowLeft, Building2, User, Phone, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { Pengaturan } from '../types';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

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
  const [buktiBayar, setBuktiBayar] = useState<File | null>(null);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
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
        console.log('Fetching settings from pengaturan/global...');
        const settingsDoc = await getDoc(doc(db, 'pengaturan', 'global'));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data() as Pengaturan;
          console.log('Settings fetched:', settings);
          setPengaturan(settings);
          const items = settings.rincianBiayaPeserta || [];
          const totalFromItems = items.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
          setNominalPendaftaran(totalFromItems > 0 ? totalFromItems : (settings.biayaPendaftaranPeserta || 150000));
        } else {
          console.warn('Settings document not found at pengaturan/global');
        }
      } catch (err: any) {
        console.error('Failed to fetch settings:', err);
        setError('Gagal memuat rincian biaya. Silakan refresh halaman.');
      } finally {
        setFetchingSettings(false);
      }
    };

    fetchCabang();
    fetchSettings();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 500 * 1024) {
        return alert('Ukuran file terlalu besar. Maksimal 500KB.');
      }
      setBuktiBayar(file);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cabangId) return setError('Silakan pilih lembaga bimbel.');
    if (!buktiBayar) return setError('Silakan upload bukti pembayaran.');
    setLoading(true);
    setError('');

    try {
      const buktiBayarUrl = await compressImage(buktiBayar);

      try {
        const pesertaRef = await addDoc(collection(db, 'peserta'), {
          nama: formData.nama,
          dataDiri: {
            noHp: formData.noHp,
            alamat: '',
            email: '',
          },
          cabangId: formData.cabangId,
          status: 'pending',
          nominalPendaftaran,
          buktiBayarUrl,
          statusPembayaran: 'belum_lunas',
          createdAt: serverTimestamp(),
        });

        // Also create a transaction record
        const isPusat = formData.cabangId === 'pusat';
        let porsiPusat = 0;
        if (isPusat) {
          porsiPusat = nominalPendaftaran;
        } else if (pengaturan?.rincianBiayaPeserta && pengaturan.rincianBiayaPeserta.length > 0) {
          porsiPusat = pengaturan.rincianBiayaPeserta.reduce((sum, item) => sum + (item.nominalPusat || 0), 0);
        } else {
          porsiPusat = (nominalPendaftaran * (pengaturan?.persentasePusat || 30) / 100);
        }
        const porsiCabang = nominalPendaftaran - porsiPusat;

        await addDoc(collection(db, 'transaksi'), {
          pesertaId: pesertaRef.id,
          cabangId: formData.cabangId,
          nominal: nominalPendaftaran,
          porsiPusat,
          porsiCabang,
          tipe: 'pendaftaran_peserta',
          status: 'pending',
          keterangan: 'Pendaftaran Peserta Baru (Bukti Bayar Terlampir)',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        return handleFirestoreError(err, OperationType.CREATE, 'peserta_or_transaksi');
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
            Data Anda telah berhasil didaftarkan dan status Anda kini telah **Aktif**. Silakan hubungi admin cabang terkait untuk informasi lebih lanjut mengenai jadwal belajar.
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
              <div className="p-2 bg-white rounded-2xl">
                <img 
                  src="https://lh3.googleusercontent.com/d/1W2PxoxVqazsPJY9Ej3DawsZZLqs0lBZc?t=1" 
                  alt="CAEM Logo" 
                  className="h-12 w-auto"
                  referrerPolicy="no-referrer"
                />
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

              <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100 space-y-3">
                <div className="flex justify-between items-center border-b border-purple-200 pb-2">
                  <span className="text-sm font-bold text-purple-700 uppercase tracking-wider">Rincian Biaya</span>
                  <span className="text-xs font-medium text-purple-600 italic">100% Lunas</span>
                </div>
                
                <div className="space-y-2">
                  {fetchingSettings ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-purple-200 rounded w-full"></div>
                      <div className="h-4 bg-purple-200 rounded w-3/4"></div>
                    </div>
                  ) : (
                    <>
                      {pengaturan?.rincianBiayaPeserta && pengaturan.rincianBiayaPeserta.length > 0 ? (
                        pengaturan.rincianBiayaPeserta.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-purple-700">{item.nama}</span>
                            <span className="font-bold text-purple-900">Rp {(item.nominal || 0).toLocaleString('id-ID')}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span className="text-purple-700">Biaya Pendaftaran</span>
                          <span className="font-bold text-purple-900">Rp {nominalPendaftaran.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-purple-200 flex justify-between items-center">
                  <span className="text-sm font-bold text-purple-900">Total Pembayaran</span>
                  <span className="text-xl font-black text-purple-600">
                    {fetchingSettings ? '...' : `Rp ${nominalPendaftaran.toLocaleString('id-ID')}`}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Upload Bukti Pembayaran</label>
                <div className="relative group">
                  <input
                    type="file"
                    required
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={cn(
                    "h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all",
                    buktiBayar 
                      ? "border-green-500 bg-green-50" 
                      : "border-gray-200 bg-gray-50 group-hover:border-purple-400 group-hover:bg-purple-50"
                  )}>
                    {buktiBayar ? (
                      <>
                        <CheckCircle2 className="text-green-600" size={24} />
                        <span className="text-xs font-medium text-green-700 truncate px-4 w-full text-center">
                          {buktiBayar.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="text-gray-400 group-hover:text-purple-500" size={24} />
                        <span className="text-xs font-medium text-gray-500 group-hover:text-purple-600">Pilih Foto Bukti Bayar</span>
                      </>
                    )}
                  </div>
                </div>
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
