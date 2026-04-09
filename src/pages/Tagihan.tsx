import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, where, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Tagihan, Cabang } from '../types';
import { handleFirestoreError, OperationType, formatDate } from '../lib/firestore-utils';
import { 
  Wallet, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Upload,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TagihanPageProps {
  user: UserProfile;
}

export default function TagihanPage({ user }: TagihanPageProps) {
  const [tagihanList, setTagihanList] = useState<Tagihan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Tagihan | null>(null);
  const [buktiBayar, setBuktiBayar] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'tagihan'), 
        where('cabangId', '==', user.cabangId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setTagihanList(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tagihan)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'tagihan');
    } finally {
      setLoading(false);
    }
  };

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
      reader.onerror = reject;
    });
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || !buktiBayar) return;

    setIsSaving(true);
    try {
      const buktiBayarUrl = await compressImage(buktiBayar);
      await updateDoc(doc(db, 'tagihan', selectedBill.id), {
        status: 'paid',
        buktiBayarUrl,
        updatedAt: serverTimestamp()
      });

      setSuccessMessage('Bukti pembayaran berhasil diupload! Menunggu verifikasi pusat.');
      setIsBillModalOpen(false);
      setBuktiBayar(null);
      fetchData();
    } catch (error) {
      console.error('Error paying bill:', error);
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

  return (
    <div className="space-y-8">
      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3"
          >
            <CheckCircle2 size={20} />
            <span className="text-sm font-bold">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tagihan Cabang</h1>
          <p className="text-sm text-gray-500">Kelola dan bayar tagihan operasional dari pusat.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Tagihan Pending</p>
              <h3 className="text-xl font-bold text-gray-900">
                {tagihanList.filter(t => t.status === 'pending').length} Tagihan
              </h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Terbayar</p>
              <h3 className="text-xl font-bold text-gray-900">
                {formatCurrency(tagihanList.filter(t => t.status === 'paid').reduce((acc, t) => acc + t.nominal, 0))}
              </h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Tagihan</p>
              <h3 className="text-xl font-bold text-gray-900">
                {formatCurrency(tagihanList.reduce((acc, t) => acc + t.nominal, 0))}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <h3 className="text-lg font-bold text-gray-900">Riwayat Tagihan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID Tagihan</th>
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
                    {tagihan.status === 'pending' ? (
                      <button
                        onClick={() => { setSelectedBill(tagihan); setIsBillModalOpen(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all"
                      >
                        Bayar Tagihan
                      </button>
                    ) : (
                      tagihan.buktiBayarUrl && (
                        <a 
                          href={tagihan.buktiBayarUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-xs font-bold"
                        >
                          Lihat Bukti
                        </a>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {tagihanList.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Belum ada tagihan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Payment Modal */}
      <AnimatePresence>
        {isBillModalOpen && selectedBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsBillModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-900">Bayar Tagihan</h3>
                <button onClick={() => setIsBillModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handlePayBill} className="p-8 space-y-6">
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <p className="text-xs font-medium text-blue-600 mb-1">Total Tagihan</p>
                  <h4 className="text-2xl font-bold text-blue-900">{formatCurrency(selectedBill.nominal)}</h4>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">Upload Bukti Transfer</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBuktiBayar(e.target.files?.[0] || null)}
                      className="hidden"
                      id="bukti-bayar"
                      required
                    />
                    <label 
                      htmlFor="bukti-bayar"
                      className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                    >
                      {buktiBayar ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 size={32} className="text-green-500" />
                          <p className="text-xs font-bold text-gray-900">{buktiBayar.name}</p>
                          <p className="text-[10px] text-gray-500">Klik untuk ganti file</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload size={32} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                          <p className="text-xs font-bold text-gray-500 group-hover:text-blue-600 transition-colors">Pilih file bukti transfer</p>
                          <p className="text-[10px] text-gray-400">Format: JPG, PNG (Max 5MB)</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBillModalOpen(false)}
                    className="flex-1 py-3.5 px-4 border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !buktiBayar}
                    className="flex-1 py-3.5 px-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Memproses...' : 'Kirim Bukti'}
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
