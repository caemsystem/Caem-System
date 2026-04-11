import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CabangPage from './pages/Cabang';
import PesertaPage from './pages/Peserta';
import KeuanganPage from './pages/Keuangan';
import LaporanPage from './pages/Laporan';
import PengaturanPage from './pages/Pengaturan';
import RegisterCabang from './pages/RegisterCabang';
import RegisterSelection from './pages/RegisterSelection';
import RegisterPeserta from './pages/RegisterPeserta';
import TagihanPage from './pages/Tagihan';
import AlumniPage from './pages/Alumni';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        } else {
          // Handle case where user is in Auth but not in Firestore
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={<RegisterSelection />} />
        <Route path="/register-cabang" element={<RegisterCabang />} />
        <Route path="/register-peserta" element={<RegisterPeserta />} />
        
        <Route path="/" element={user ? <Layout user={user} /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard user={user} />} />
          <Route path="cabang" element={<CabangPage user={user} />} />
          <Route path="peserta" element={<PesertaPage user={user} />} />
          <Route path="alumni" element={<AlumniPage user={user} />} />
          <Route path="keuangan" element={<KeuanganPage user={user} />} />
          <Route path="tagihan" element={<TagihanPage user={user} />} />
          <Route path="laporan" element={<LaporanPage user={user} />} />
          <Route path="pengaturan" element={<PengaturanPage user={user} />} />
        </Route>
      </Routes>
    </Router>
  );
}
