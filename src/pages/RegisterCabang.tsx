import React, { useState, FormEvent, ChangeEvent } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc, getFirestore, getDocs } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Upload, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { Pengaturan } from '../types';

// Secondary app for registration to avoid session interference
const getRegApp = () => {
  const appName = 'RegApp';
  if (getApps().find(a => a.name === appName)) {
    return getApp(appName);
  }
  return initializeApp(firebaseConfig, appName);
};

const getRegAuth = () => getAuth(getRegApp());
const getRegDb = () => getFirestore(getRegApp(), (firebaseConfig as any).firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export default function RegisterCabang() {
  const [formData, setFormData] = useState({
    namaCabang: '',
    alamat: '',
    namaKepala: '',
    noHp: '',
    email: '',
    password: '',
  });
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    ktp: null,
    foto: null,
    buktiBayar: null,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFirestoreError = (err: any, operationType: OperationType, path: string) => {
    const regAuth = getRegAuth();
    const errInfo = {
      error: err instanceof Error ? err.message : String(err),
      operationType,
      path,
      authInfo: {
        userId: regAuth.currentUser?.uid,
        email: regAuth.currentUser?.email,
        emailVerified: regAuth.currentUser?.emailVerified,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    throw new Error(err.message || 'Terjadi kesalahan saat pendaftaran.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 300 * 1024) { // Limit to 300KB per file to stay under 1MB total
        return alert('Ukuran file terlalu besar. Maksimal 300KB per file.');
      }
      setFiles(prev => ({ ...prev, [key]: file }));
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

          // Calculate new dimensions
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
          
          // Compress to JPEG with specified quality
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
    if (!files.ktp || !files.foto || !files.buktiBayar) {
      return setError('Silakan upload semua dokumen yang diperlukan.');
    }
    setLoading(true);
    setError('');

    try {
      const regAuth = getRegAuth();
      const regDb = getRegDb();
      
      // 1. Create or Get Auth User
      let uid = '';
      try {
        const userCredential = await createUserWithEmailAndPassword(regAuth, formData.email, formData.password);
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            const signInCred = await signInWithEmailAndPassword(regAuth, formData.email, formData.password);
            uid = signInCred.user.uid;
            let userDoc;
            try {
              userDoc = await getDoc(doc(regDb, 'users', uid));
            } catch (err) {
              return handleFirestoreError(err, OperationType.GET, `users/${uid}`);
            }
            if (userDoc.exists()) {
              throw new Error('Email ini sudah terdaftar dan akun sudah aktif. Silakan login.');
            }
          } catch (signInErr: any) {
            if (signInErr.message.includes('Email ini sudah terdaftar')) throw signInErr;
            throw new Error('Email sudah terdaftar. Jika ini akun Anda, pastikan password benar.');
          }
        } else {
          throw authErr;
        }
      }

      // 2. Compress and Convert Files to Base64
      const ktpUrl = await compressImage(files.ktp);
      const fotoUrl = await compressImage(files.foto);
      const buktiBayarUrl = await compressImage(files.buktiBayar);

      // 3. Create Cabang Document
      let cabangRef;
      try {
        // Fetch settings for registration fee
        const settingsSnap = await getDocs(collection(regDb, 'pengaturan'));
        let nominalPendaftaran = 5000000; // Default
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data() as Pengaturan;
          nominalPendaftaran = settings.biayaPendaftaranCabang;
        }

        cabangRef = await addDoc(collection(regDb, 'cabang'), {
          namaCabang: formData.namaCabang,
          alamat: formData.alamat,
          namaKepala: formData.namaKepala,
          noHp: formData.noHp,
          email: formData.email,
          ktpUrl, 
          fotoUrl, 
          buktiBayarUrl, 
          status: 'pending',
          nominalPendaftaran,
          statusPembayaran: 'belum_lunas', // Initially unpaid until verified by admin
          createdAt: serverTimestamp(),
        });

        // Also create a transaction record
        await addDoc(collection(regDb, 'transaksi'), {
          cabangId: cabangRef.id,
          nominal: nominalPendaftaran,
          porsiPusat: nominalPendaftaran, // For branch registration, all goes to central
          porsiCabang: 0,
          tipe: 'pendaftaran_cabang',
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        return handleFirestoreError(err, OperationType.CREATE, 'cabang');
      }

      // 4. Create User Document
      try {
        await setDoc(doc(regDb, 'users', uid), {
          uid,
          email: formData.email,
          role: 'cabang',
          displayName: formData.namaKepala,
          cabangId: cabangRef.id,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        return handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }

      // Sign out from secondary app
      await signOut(regAuth);
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
            Data Anda telah kami terima dan sedang dalam proses peninjauan oleh Admin Pusat. 
            Kami akan menghubungi Anda melalui email atau WhatsApp setelah akun Anda aktif.
          </p>
          <Link 
            to="/register" 
            className="inline-block bg-blue-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-blue-700 transition-all"
          >
            Kembali
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/register" className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium mb-8 transition-colors">
          <ArrowLeft size={20} />
          Kembali ke Pilihan
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl overflow-hidden"
        >
          <div className="bg-blue-600 p-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Building2 size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Pendaftaran Cabang Baru</h1>
                <p className="text-blue-100 text-sm">Bergabunglah dengan jaringan CAEM</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3">Informasi Cabang</h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Cabang (Kecamatan)</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: Sukajadi"
                    value={formData.namaCabang}
                    onChange={e => setFormData({ ...formData, namaCabang: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat Lengkap</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Alamat lengkap operasional cabang"
                    value={formData.alamat}
                    onChange={e => setFormData({ ...formData, alamat: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3">Kontak & Akun</h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Kepala Bimbel</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nama lengkap"
                    value={formData.namaKepala}
                    onChange={e => setFormData({ ...formData, namaKepala: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">No. HP / WhatsApp</label>
                  <input
                    type="tel"
                    required
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
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="email@cabang.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Password Akun</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Minimal 6 karakter"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3">Dokumen Pendukung</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'ktp', label: 'Upload KTP' },
                  { id: 'foto', label: 'Upload Foto' },
                  { id: 'buktiBayar', label: 'Bukti Bayar Pendaftaran' },
                ].map(file => (
                  <div key={file.id} className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{file.label}</label>
                    <div className="relative group">
                      <input
                        type="file"
                        required
                        accept="image/*"
                        onChange={e => handleFileChange(e, file.id)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={cn(
                        "h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all",
                        files[file.id] 
                          ? "border-green-500 bg-green-50" 
                          : "border-gray-200 bg-gray-50 group-hover:border-blue-400 group-hover:bg-blue-50"
                      )}>
                        {files[file.id] ? (
                          <>
                            <CheckCircle2 className="text-green-600" size={24} />
                            <span className="text-xs font-medium text-green-700 truncate px-4 w-full text-center">
                              {files[file.id]!.name}
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="text-gray-400 group-hover:text-blue-500" size={24} />
                            <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600">Pilih File</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Kirim Pendaftaran'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
