import React, { useEffect, useState, FormEvent } from 'react';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { db, auth, firebaseConfig } from '../firebase';
import { UserProfile, Pengaturan } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { 
  Settings, 
  User, 
  Shield, 
  Bell, 
  Database, 
  Save,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Plus,
  Trash2,
  Mail,
  Lock,
  UserPlus,
  X
} from 'lucide-react';

// Secondary app for creating users without logging out current admin
const getSecondaryAuth = () => {
  const secondaryAppName = 'SecondaryApp';
  let secondaryApp;
  if (getApps().find(app => app.name === secondaryAppName)) {
    secondaryApp = getApp(secondaryAppName);
  } else {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  }
  return getAuth(secondaryApp);
};
import { motion } from 'motion/react';

interface PengaturanPageProps {
  user: UserProfile;
}

export default function PengaturanPage({ user }: PengaturanPageProps) {
  const [settings, setSettings] = useState<Pengaturan>({
    biayaPendaftaranCabang: 10000000,
    biayaPendaftaranPeserta: 150000,
    persentasePusat: 30,
    persentaseCabang: 70,
    persentaseMinimalDP: 50,
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'profile' | 'users'>('system');

  // User Management State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'bendahara' as 'admin' | 'bendahara'
  });
  const [userActionLoading, setUserActionLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    if (user.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const list = usersSnap.docs.map(doc => doc.data() as UserProfile);
      setUsersList(list.filter(u => u.role !== 'cabang')); // Only show internal users
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionLoading(true);
    try {
      const secondaryAuth = getSecondaryAuth();
      const email = newUser.email.trim();
      if (!email || !email.includes('@')) {
        alert('Format email tidak valid.');
        setUserActionLoading(false);
        return;
      }

      // Create user in secondary app
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, newUser.password);
      const uid = userCredential.user.uid;

      // Create profile in Firestore (using primary db)
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: newUser.email.trim(),
        displayName: newUser.displayName.trim(),
        role: newUser.role,
        createdAt: serverTimestamp(),
      });

      // Sign out from secondary app immediately
      await signOut(secondaryAuth);

      alert(`User ${newUser.role} berhasil ditambahkan!`);
      setNewUser({ email: '', password: '', displayName: '', role: 'bendahara' });
      setIsAddingUser(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Gagal menambah user: Email ini sudah terdaftar dalam sistem.');
      } else {
        alert('Gagal menambah user: ' + (error.message || 'Terjadi kesalahan tidak dikenal'));
      }
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === user.uid) return alert('Anda tidak bisa menghapus akun Anda sendiri.');
    if (!window.confirm('Hapus akses user ini?')) return;

    setUserActionLoading(true);
    try {
      await deleteDoc(doc(db, 'users', uid));
      alert('Akses user berhasil dicabut dari database.');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Gagal menghapus user.');
    } finally {
      setUserActionLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    const path = 'pengaturan/global';
    try {
      const settingsDoc = await getDoc(doc(db, path));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data() as Pengaturan;
        setSettings(prev => ({ 
          ...prev, 
          ...data,
          rincianBiayaCabang: data.rincianBiayaCabang || [],
          rincianBiayaPeserta: data.rincianBiayaPeserta || [],
        }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  const addItem = (type: 'cabang' | 'peserta') => {
    const key = type === 'cabang' ? 'rincianBiayaCabang' : 'rincianBiayaPeserta';
    const current = settings[key] || [];
    setSettings({
      ...settings,
      [key]: [...current, { nama: '', nominal: 0, nominalPusat: 0 }]
    });
  };

  const removeItem = (type: 'cabang' | 'peserta', index: number) => {
    const key = type === 'cabang' ? 'rincianBiayaCabang' : 'rincianBiayaPeserta';
    const current = settings[key] || [];
    const updated = current.filter((_, i) => i !== index);
    const totalKey = type === 'cabang' ? 'biayaPendaftaranCabang' : 'biayaPendaftaranPeserta';
    const newTotal = updated.reduce((sum, item) => sum + item.nominal, 0);
    
    setSettings({
      ...settings,
      [key]: updated,
      [totalKey]: newTotal
    });
  };

  const updateItem = (type: 'cabang' | 'peserta', index: number, field: 'nama' | 'nominal' | 'nominalPusat', value: string | number) => {
    const key = type === 'cabang' ? 'rincianBiayaCabang' : 'rincianBiayaPeserta';
    const current = [...(settings[key] || [])];
    current[index] = { ...current[index], [field]: value };
    
    const newTotal = current.reduce((sum, item) => sum + item.nominal, 0);
    const totalKey = type === 'cabang' ? 'biayaPendaftaranCabang' : 'biayaPendaftaranPeserta';

    setSettings({
      ...settings,
      [key]: current,
      [totalKey]: newTotal
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'pengaturan', 'global'), settings);
      alert('Pengaturan sistem berhasil diperbarui!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'system', label: 'Sistem', icon: Settings, show: user.role === 'admin' },
    { id: 'profile', label: 'Profil Saya', icon: User, show: true },
    { id: 'users', label: 'Manajemen User', icon: Shield, show: user.role === 'admin' },
  ].filter(t => t.show);

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-white border border-gray-100 rounded-2xl w-full sm:w-fit shadow-sm overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex-1 sm:flex-none whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <tab.icon size={16} className="sm:w-[18px] sm:h-[18px]" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 shadow-sm"
          >
            {activeTab === 'system' && (
              <form onSubmit={handleSaveSettings} className="space-y-6 sm:space-y-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-2.5 sm:p-3 bg-blue-50 text-blue-600 rounded-2xl"><Settings size={20} className="sm:w-6 sm:h-6" /></div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Konfigurasi Sistem</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Atur parameter dasar operasional CAEM.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-3 sm:space-y-4">
                    <label className="block text-sm font-bold text-gray-700">Biaya Pendaftaran Cabang</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                      <input
                        type="number"
                        value={settings.biayaPendaftaranCabang}
                        onChange={e => setSettings({ ...settings, biayaPendaftaranCabang: Number(e.target.value) })}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      />
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-400">Nominal yang harus dibayar oleh calon cabang baru.</p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <label className="block text-sm font-bold text-gray-700">Biaya Pendaftaran Peserta</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                      <input
                        type="number"
                        value={settings.biayaPendaftaranPeserta}
                        onChange={e => setSettings({ ...settings, biayaPendaftaranPeserta: Number(e.target.value) })}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      />
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-400">Nominal pendaftaran awal untuk setiap peserta baru.</p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <label className="block text-sm font-bold text-gray-700">Persentase Bagi Hasil Pusat (%)</label>
                    <input
                      type="number"
                      max={100}
                      value={settings.persentasePusat}
                      onChange={e => setSettings({ ...settings, persentasePusat: Number(e.target.value), persentaseCabang: 100 - Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-400">Porsi pendapatan yang masuk ke kas pusat (berlaku jika peserta memilih cabang).</p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <label className="block text-sm font-bold text-gray-700">Minimal DP Cabang (%)</label>
                    <input
                      type="number"
                      max={100}
                      value={settings.persentaseMinimalDP || 50}
                      onChange={e => setSettings({ ...settings, persentaseMinimalDP: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-400">Persentase minimal pembayaran awal untuk pendaftaran cabang.</p>
                  </div>
                </div>

                {/* Rincian Biaya Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-100">
                  {/* Rincian Biaya Cabang */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                        <Building2 size={18} className="text-blue-600" />
                        Rincian Biaya Cabang
                      </h4>
                      <button
                        type="button"
                        onClick={() => addItem('cabang')}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {settings.rincianBiayaCabang?.map((item, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                          <div className="flex gap-2">
                            <input
                              placeholder="Nama Item (misal: Biaya Sewa)"
                              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              value={item.nama || ''}
                              onChange={e => updateItem('cabang', idx, 'nama', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => removeItem('cabang', idx)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Total Biaya</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rp</span>
                                <input
                                  type="number"
                                  className="w-full pl-7 pr-2 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                  value={item.nominal || 0}
                                  onChange={e => updateItem('cabang', idx, 'nominal', Number(e.target.value))}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Porsi Pusat</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rp</span>
                                <input
                                  type="number"
                                  className="w-full pl-7 pr-2 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                                  value={item.nominalPusat || 0}
                                  onChange={e => updateItem('cabang', idx, 'nominalPusat', Number(e.target.value))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!settings.rincianBiayaCabang || settings.rincianBiayaCabang.length === 0) && (
                        <p className="text-xs text-gray-400 italic">Belum ada rincian biaya.</p>
                      )}
                    </div>
                  </div>

                  {/* Rincian Biaya Peserta */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                        <Users size={18} className="text-blue-600" />
                        Rincian Biaya Peserta
                      </h4>
                      <button
                        type="button"
                        onClick={() => addItem('peserta')}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {settings.rincianBiayaPeserta?.map((item, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                          <div className="flex gap-2">
                            <input
                              placeholder="Nama Item (misal: Kaos)"
                              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              value={item.nama || ''}
                              onChange={e => updateItem('peserta', idx, 'nama', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => removeItem('peserta', idx)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Total Biaya</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rp</span>
                                <input
                                  type="number"
                                  className="w-full pl-7 pr-2 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                  value={item.nominal || 0}
                                  onChange={e => updateItem('peserta', idx, 'nominal', Number(e.target.value))}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Porsi Pusat</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rp</span>
                                <input
                                  type="number"
                                  className="w-full pl-7 pr-2 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                                  value={item.nominalPusat || 0}
                                  onChange={e => updateItem('peserta', idx, 'nominalPusat', Number(e.target.value))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!settings.rincianBiayaPeserta || settings.rincianBiayaPeserta.length === 0) && (
                        <p className="text-xs text-gray-400 italic">Belum ada rincian biaya.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-50">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                    Simpan Perubahan Sistem
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6 sm:space-y-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-2.5 sm:p-3 bg-purple-50 text-purple-600 rounded-2xl"><User size={20} className="sm:w-6 sm:h-6" /></div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Profil Saya</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Kelola informasi akun Anda.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-1 sm:space-y-2">
                    <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Nama Lengkap</label>
                    <p className="text-base sm:text-lg font-bold text-gray-900">{user.displayName || '-'}</p>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Email</label>
                    <p className="text-base sm:text-lg font-bold text-gray-900">{user.email}</p>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Role Akses</label>
                    <p className="text-base sm:text-lg font-bold text-blue-600 capitalize">{user.role}</p>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">ID Akun</label>
                    <p className="text-xs sm:text-sm font-mono text-gray-500 break-all">{user.uid}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Manajemen Akses Internal</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Kelola akun Admin dan Bendahara Pusat.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingUser(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all w-full sm:w-auto"
                  >
                    <Plus size={18} />
                    Tambah User
                  </button>
                </div>

                {isAddingUser && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 sm:p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-4"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                        <UserPlus size={18} className="text-blue-600" />
                        Tambah User Baru
                      </h4>
                      <button onClick={() => setIsAddingUser(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                      </button>
                    </div>
                    <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                        <input
                          type="text"
                          required
                          value={newUser.displayName}
                          onChange={e => setNewUser({ ...newUser, displayName: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Nama User"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={newUser.email}
                          onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="email@caem.com"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Password</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={newUser.password}
                          onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Min. 6 karakter"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Role</label>
                        <select
                          value={newUser.role}
                          onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="bendahara">Bendahara</option>
                          <option value="admin">Admin Utama</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 pt-2">
                        <button
                          type="submit"
                          disabled={userActionLoading}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                        >
                          {userActionLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                          Simpan User Baru
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                <div className="overflow-hidden border border-gray-100 rounded-2xl">
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">User</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Role</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {usersList.map(u => (
                          <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">
                                  {u.displayName?.charAt(0) || u.email.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{u.displayName || 'No Name'}</p>
                                  <p className="text-xs text-gray-500">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {u.uid !== user.uid && (
                                <button 
                                  onClick={() => handleDeleteUser(u.uid)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Hapus Akses"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-gray-50">
                    {usersList.map(u => (
                      <div key={u.uid} className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">
                              {u.displayName?.charAt(0) || u.email.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{u.displayName || 'No Name'}</p>
                              <p className="text-[10px] text-gray-500">{u.email}</p>
                            </div>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                        {u.uid !== user.uid && (
                          <div className="flex justify-end pt-2 border-t border-gray-50">
                            <button 
                              onClick={() => handleDeleteUser(u.uid)}
                              className="flex items-center gap-2 text-[10px] font-bold text-red-600 px-3 py-1.5 bg-red-50 rounded-lg"
                            >
                              <Trash2 size={14} />
                              Hapus Akses
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h4 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Bell size={18} className="text-blue-600" />
              Notifikasi Sistem
            </h4>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-700 mb-1">Update v1.0.4</p>
                <p className="text-xs text-blue-600 leading-relaxed">Sistem pembagian hasil otomatis telah diaktifkan untuk semua cabang aktif.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs font-bold text-gray-700 mb-1">Backup Data</p>
                <p className="text-xs text-gray-500 leading-relaxed">Backup database otomatis dilakukan setiap hari pukul 00:00 WIB.</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-8 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Database size={18} className="text-blue-400" />
                Status Database
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Penyimpanan</span>
                  <span className="font-bold">1.2 GB / 5 GB</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full w-[24%]" />
                </div>
                <p className="text-[10px] text-gray-500 mt-2 italic">Data dienkripsi menggunakan standar AES-256.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
