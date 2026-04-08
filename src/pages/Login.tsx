import React, { useState, FormEvent } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Special case for default admin
      let loginEmail = email.toLowerCase();
      if (loginEmail === 'admincaem') {
        loginEmail = 'admin@caem.com';
      }

      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'cabang') {
          const cabangDoc = await getDoc(doc(db, 'cabang', userData.cabangId));
          if (cabangDoc.exists() && cabangDoc.data().status !== 'aktif') {
            await auth.signOut();
            setError('Akun cabang Anda belum aktif atau sedang ditinjau.');
            setLoading(false);
            return;
          }
        }
        navigate('/');
      } else {
        setError('Data profil tidak ditemukan di database.');
        await auth.signOut();
      }
    } catch (err: any) {
      console.error('Login Error Details:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Metode login Email/Password belum diaktifkan di Firebase Console. Silakan aktifkan di menu Authentication > Sign-in method.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Email atau password salah. Pastikan Anda sudah klik tombol "Bootstrap Admin" di bawah jika ini login pertama kali.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Terlalu banyak percobaan login yang gagal. Akun Anda telah diblokir sementara. Silakan coba lagi nanti.');
      } else if (err.code === 'auth/user-disabled') {
        setError('Akun Anda telah dinonaktifkan oleh admin.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Koneksi internet bermasalah. Periksa jaringan Anda.');
      } else {
        setError('Terjadi kesalahan: ' + (err.message || 'Error tidak dikenal'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 lg:p-12">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight mb-2">CAEM</h1>
            <p className="text-gray-500 font-medium">Sistem Manajemen Lembaga Bimbel</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Username / Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="admincaem atau email@anda.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  Masuk ke Dashboard
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <button
              onClick={async () => {
                setLoading(true);
                console.log('Starting bootstrap process...');
                try {
                  const email = 'admin@caem.com';
                  const password = 'admin2026';
                  console.log('Creating auth user...');
                  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                  console.log('Auth user created:', userCredential.user.uid);
                  
                  console.log('Creating firestore document...');
                  await setDoc(doc(db, 'users', userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    email,
                    role: 'admin',
                    displayName: 'Admin CAEM',
                    createdAt: serverTimestamp(),
                  });
                  console.log('Firestore document created.');
                  alert('Admin default berhasil dibuat! Silakan login.');
                } catch (err: any) {
                  console.error('Bootstrap Error:', err);
                  if (err.code === 'auth/operation-not-allowed') {
                    alert('EROR: Metode Email/Password belum diaktifkan di Firebase Console. Silakan aktifkan di menu Authentication > Sign-in method.');
                  } else if (err.code === 'auth/email-already-in-use') {
                    alert('Admin sudah terdaftar. Silakan langsung login.');
                  } else {
                    alert('Terjadi kesalahan: ' + err.message);
                  }
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              Bootstrap Admin (Sekali Saja)
            </button>
          </div>

          <div className="mt-10 text-center">
            <p className="text-gray-500 text-sm">
              Ingin bergabung dengan CAEM?{' '}
              <Link to="/register" className="text-blue-600 font-bold hover:underline">
                Daftar Sekarang
              </Link>
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50 p-6 text-center border-t border-gray-100">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            &copy; 2026 CAEM Management System
          </p>
        </div>
      </motion.div>
    </div>
  );
}
